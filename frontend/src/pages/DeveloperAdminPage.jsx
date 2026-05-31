import React, { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AsyncState from "../components/AsyncState";
import { apiGet, apiPost } from "../api";

const defaultLimits = {
  wedding_limit: 1,
  program_limit: 3,
  episode_limit: 3,
  photo_limit: 100,
};

const defaultFeatures = {
  allow_public_access: true,
  allow_drive_import: true,
};

const emptyPlan = {
  plan_id: "premium",
  name: "Premium",
  description: "",
  limits: defaultLimits,
  features: defaultFeatures,
  active: true,
};

function numberValue(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function planWithDefaults(plan = emptyPlan) {
  return {
    plan_id: plan.plan_id || "",
    name: plan.name || "",
    description: plan.description || "",
    limits: { ...defaultLimits, ...(plan.limits || {}) },
    features: { ...defaultFeatures, ...(plan.features || {}) },
    active: plan.active !== false,
  };
}

function useToast() {
  const [toast, setToast] = useState("");
  const timerRef = useRef(null);
  const showToast = (message) => {
    setToast(message);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setToast(""), 2800);
  };
  return [toast, showToast];
}

function StatCard({ label, value, note }) {
  return (
    <article className="developer-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </article>
  );
}

function UsageBar({ label, value, limit }) {
  const numericLimit = Number(limit || 0);
  const percent = numericLimit ? Math.min(100, Math.round((Number(value || 0) / numericLimit) * 100)) : 0;
  return (
    <div className="developer-usage-bar">
      <div>
        <span>{label}</span>
        <strong>{value || 0}{numericLimit ? ` / ${numericLimit}` : ""}</strong>
      </div>
      <i aria-hidden="true"><b style={{ width: `${percent}%` }} /></i>
    </div>
  );
}

export default function DeveloperAdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planForm, setPlanForm] = useState(() => planWithDefaults(emptyPlan));
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingUserId, setSavingUserId] = useState("");
  const [toast, showToast] = useToast();

  const { data: session, isLoading: loadingSession } = useQuery({
    queryKey: ["session"],
    queryFn: () => apiGet("/api/session"),
    retry: false,
  });

  const { data: plans = [], isLoading: loadingPlans, error: plansError } = useQuery({
    queryKey: ["developer-plans"],
    queryFn: () => apiGet("/api/developer/plans"),
    enabled: !!session?.is_developer,
  });

  const { data: users = [], isLoading: loadingUsers, error: usersError } = useQuery({
    queryKey: ["developer-users"],
    queryFn: () => apiGet("/api/developer/users"),
    enabled: !!session?.is_developer,
  });

  const { data: overview, isLoading: loadingOverview, error: overviewError } = useQuery({
    queryKey: ["developer-overview"],
    queryFn: () => apiGet("/api/developer/overview"),
    enabled: !!session?.is_developer,
  });

  const refreshDeveloperData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["developer-plans"] }),
      queryClient.invalidateQueries({ queryKey: ["developer-users"] }),
      queryClient.invalidateQueries({ queryKey: ["developer-overview"] }),
      queryClient.invalidateQueries({ queryKey: ["session"] }),
    ]);
  };

  const planOptions = useMemo(() => plans.map((plan) => plan.plan_id), [plans]);
  const planById = useMemo(() => Object.fromEntries(plans.map((plan) => [plan.plan_id, planWithDefaults(plan)])), [plans]);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return users.filter((user) => {
      const haystack = [
        user.name,
        user.email,
        user.phone,
        user.role,
        user.status,
        user.plan_id,
        user.details?.business_name,
        user.details?.city,
        user.details?.purpose,
      ].filter(Boolean).join(" ").toLowerCase();
      const matchesTerm = !term || haystack.includes(term);
      const matchesPlan = planFilter === "all" || user.plan_id === planFilter;
      const matchesStatus = statusFilter === "all" || user.status === statusFilter;
      return matchesTerm && matchesPlan && matchesStatus;
    });
  }, [users, searchTerm, planFilter, statusFilter]);

  const customerUsers = users.filter((user) => user.role !== "developer");
  const stats = overview?.stats || {};
  const conversionHealth = stats.users ? Math.round(((stats.active_users || 0) / stats.users) * 100) : 0;

  const savePlan = async (ev) => {
    ev.preventDefault();
    setSavingPlan(true);
    try {
      await apiPost("/api/developer/plans", planForm);
      await refreshDeveloperData();
      showToast(`${planForm.name || planForm.plan_id} plan saved`);
      setActiveTab("plans");
    } catch (err) {
      showToast(err?.message || "Plan save failed");
    } finally {
      setSavingPlan(false);
    }
  };

  const loadPlan = (plan) => {
    setPlanForm(planWithDefaults(plan));
    setActiveTab("plans");
    showToast(`${plan.name || plan.plan_id} loaded`);
  };

  const duplicatePlan = (plan) => {
    const base = planWithDefaults(plan);
    setPlanForm({
      ...base,
      plan_id: `${base.plan_id}-copy`,
      name: `${base.name || base.plan_id} Copy`,
    });
    setActiveTab("plans");
    showToast("Plan duplicated into editor");
  };

  const resetPlanForm = () => {
    setPlanForm(planWithDefaults(emptyPlan));
    showToast("Plan editor reset");
  };

  const updateUser = async (user, patch) => {
    setSavingUserId(user._id);
    try {
      await apiPost(`/api/developer/users/${user._id}`, patch);
      await refreshDeveloperData();
      showToast(`${user.name || user.email} updated`);
    } catch (err) {
      showToast(err?.message || "User update failed");
    } finally {
      setSavingUserId("");
    }
  };

  const updateWedding = async (wedding, patch) => {
    setSavingUserId(`wedding:${wedding._id}`);
    try {
      await apiPost(`/api/developer/weddings/${wedding._id}`, patch);
      await refreshDeveloperData();
      showToast(`${wedding.couple_names || "Wedding"} updated`);
    } catch (err) {
      showToast(err?.message || "Wedding update failed");
    } finally {
      setSavingUserId("");
    }
  };

  const copyText = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast(`${label} copied`);
    } catch {
      window.prompt(`Copy ${label}`, value);
    }
  };

  const logout = async () => {
    await apiPost("/api/session/logout", {});
    localStorage.setItem("wedflix_backend_auth_ok", "0");
    window.dispatchEvent(new Event("wedflix-auth-changed"));
    await queryClient.invalidateQueries({ queryKey: ["session"] });
    navigate("/developer-login");
  };

  if (loadingSession) return <AsyncState mode="loading" />;
  if (!session?.is_developer) {
    return (
      <section className="developer-page developer-page--locked">
        <div className="developer-panel developer-access-card">
          <p className="developer-eyebrow">Developer Admin</p>
          <h2>Developer Access Required</h2>
          <p>This area is separate from customer admin login and controls users, plan rules, and platform access.</p>
          <Link className="developer-primary-btn" to="/developer-login">Developer Login</Link>
        </div>
      </section>
    );
  }

  if (loadingPlans || loadingUsers || loadingOverview) return <AsyncState mode="loading" />;
  if (plansError || usersError || overviewError) return <AsyncState mode="error" message={(plansError || usersError || overviewError)?.message} />;

  return (
    <section className="developer-page">
      <header className="developer-shell-header">
        <div>
          <p className="developer-eyebrow">Wedflix Platform</p>
          <h1>Developer Control Center</h1>
          <p>Manage customer access, plan limits, signup quality, and platform usage from one place.</p>
        </div>
        <div className="developer-header-actions">
          {toast && <span className="developer-toast">{toast}</span>}
          <button type="button" className="developer-secondary-btn" onClick={refreshDeveloperData}>Refresh</button>
          <button type="button" className="developer-danger-btn" onClick={logout}>Logout</button>
        </div>
      </header>

      <section className="developer-client-search" aria-label="Client search">
        <div>
          <p className="developer-eyebrow">Client finder</p>
          <h2>Search customers instantly</h2>
        </div>
        <label>
          <span>Search by name, mobile, email, city, or business</span>
          <input
            type="search"
            value={searchTerm}
            onFocus={() => setActiveTab("users")}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setActiveTab("users");
            }}
            placeholder="Type client name, mobile number, or email..."
          />
        </label>
        <strong>{filteredUsers.length} match{filteredUsers.length === 1 ? "" : "es"}</strong>
      </section>

      <nav className="developer-tabs" aria-label="Developer sections">
        {[
          ["overview", "Overview"],
          ["users", `Users (${customerUsers.length})`],
          ["plans", `Plans (${plans.length})`],
        ].map(([key, label]) => (
          <button key={key} type="button" className={activeTab === key ? "is-active" : ""} onClick={() => setActiveTab(key)}>
            {label}
          </button>
        ))}
      </nav>

      {activeTab === "overview" && (
        <>
          <div className="developer-stats">
            <StatCard label="Total users" value={stats.users || 0} note={`${stats.active_users || 0} active`} />
            <StatCard label="Weddings" value={stats.weddings || 0} note="owned profiles" />
            <StatCard label="Functions" value={stats.functions || 0} note="across accounts" />
            <StatCard label="Events" value={stats.events || 0} note="inside functions" />
            <StatCard label="Photos" value={stats.photos || 0} note="stored media" />
            <StatCard label="Health" value={`${conversionHealth}%`} note="active accounts" />
          </div>

          <div className="developer-grid developer-grid--overview">
            <section className="developer-panel">
              <div className="developer-panel-head">
                <div>
                  <p className="developer-eyebrow">Distribution</p>
                  <h2>Plan Adoption</h2>
                </div>
                <button type="button" onClick={() => setActiveTab("plans")}>Manage Plans</button>
              </div>
              <div className="developer-mini-list">
                {Object.entries(overview?.plan_counts || {}).map(([planId, count]) => (
                  <button type="button" key={planId} onClick={() => { setPlanFilter(planId); setActiveTab("users"); }}>
                    <span>{planById[planId]?.name || planId}</span>
                    <strong>{count}</strong>
                  </button>
                ))}
              </div>
            </section>

            <section className="developer-panel">
              <div className="developer-panel-head">
                <div>
                  <p className="developer-eyebrow">Latest signups</p>
                  <h2>Recent Users</h2>
                </div>
                <button type="button" onClick={() => setActiveTab("users")}>View Users</button>
              </div>
              <div className="developer-mini-list">
                {(overview?.recent_users || []).map((user) => (
                  <button type="button" key={user._id} onClick={() => { setSearchTerm(user.email); setActiveTab("users"); }}>
                    <span>{user.name || user.email}</span>
                    <strong>{user.plan_id}</strong>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </>
      )}

      {activeTab === "users" && (
        <section className="developer-panel developer-panel--wide">
          <div className="developer-panel-head developer-panel-head--stack">
            <div>
              <p className="developer-eyebrow">Customer operations</p>
              <h2>Client Directory & Access</h2>
            </div>
            <div className="developer-filters">
              <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search name, email, phone, city..." />
              <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
                <option value="all">All plans</option>
                {planOptions.map((planId) => <option key={planId} value={planId}>{planById[planId]?.name || planId}</option>)}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All status</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
              <button type="button" onClick={() => { setSearchTerm(""); setPlanFilter("all"); setStatusFilter("all"); }}>Clear</button>
            </div>
          </div>

          <div className="developer-user-list">
            {filteredUsers.map((user) => {
              const plan = planById[user.plan_id] || planWithDefaults();
              const isSaving = savingUserId === user._id;
              const isDeveloper = user.role === "developer";
              return (
                <article className="developer-user-card" key={user._id}>
                  <div className="developer-user-main">
                    <div>
                      <strong>{user.name || user.email}</strong>
                      <span>{user.email}</span>
                      <span>{user.phone || "No phone"} · {user.details?.city || "No city"}</span>
                      <span>{user.details?.business_name || user.details?.purpose || "No business details"}</span>
                    </div>
                    <div className="developer-user-tags">
                      <b className={user.status === "active" ? "is-active" : "is-paused"}>{user.status}</b>
                      <b>{isDeveloper ? "developer" : "admin"}</b>
                      <b>{plan.name || user.plan_id}</b>
                    </div>
                  </div>

                  <div className="developer-usage-grid">
                    <UsageBar label="Weddings" value={user.usage?.weddings} limit={plan.limits.wedding_limit} />
                    <UsageBar label="Functions" value={user.usage?.programs} limit={plan.limits.program_limit} />
                    <UsageBar label="Events" value={user.usage?.episodes} limit={plan.limits.episode_limit} />
                    <UsageBar label="Photos" value={user.usage?.photos} limit={plan.limits.photo_limit} />
                  </div>

                  {!!user.weddings?.length && (
                    <div className="developer-mini-list">
                      {user.weddings.map((wedding) => {
                        const isWeddingSaving = savingUserId === `wedding:${wedding._id}`;
                        return (
                          <div className="developer-user-main" key={wedding._id}>
                            <div>
                              <strong>{wedding.couple_names}</strong>
                              <span>{wedding.wedding_date || "No date"} · {wedding.access_level}</span>
                              <span>{wedding.public_slug ? `/p/${wedding.public_slug}` : "No public slug"}</span>
                            </div>
                            <div className="developer-user-controls">
                              <select
                                value={wedding.access_level || "private"}
                                disabled={isWeddingSaving}
                                onChange={(e) => updateWedding(wedding, { access_level: e.target.value })}
                              >
                                <option value="private">Private</option>
                                <option value="public">Public</option>
                              </select>
                              <button
                                type="button"
                                disabled={isWeddingSaving || wedding.access_level !== "public"}
                                onClick={() => updateWedding(wedding, { show_on_demo_home: !wedding.show_on_demo_home })}
                              >
                                {isWeddingSaving ? "Saving..." : wedding.show_on_demo_home ? "Remove From Demo" : "Approve Demo"}
                              </button>
                              {wedding.public_slug && (
                                <button type="button" onClick={() => copyText(`${window.location.origin}/p/${wedding.public_slug}`, "public link")}>
                                  Copy Public Link
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="developer-user-controls">
                    <select value={user.plan_id} disabled={isSaving || isDeveloper} onChange={(e) => updateUser(user, { plan_id: e.target.value })}>
                      {planOptions.map((planId) => <option key={planId} value={planId}>{planById[planId]?.name || planId}</option>)}
                    </select>
                    <button type="button" disabled={isSaving || isDeveloper} onClick={() => updateUser(user, { status: user.status === "active" ? "paused" : "active" })}>
                      {isSaving ? "Saving..." : user.status === "active" ? "Pause Access" : "Activate"}
                    </button>
                    <button type="button" onClick={() => copyText(user.email, "email")}>Copy Email</button>
                    {user.phone && <button type="button" onClick={() => copyText(user.phone, "mobile")}>Copy Mobile</button>}
                  </div>
                </article>
              );
            })}
            {!filteredUsers.length && <p className="developer-empty">No users match these filters.</p>}
          </div>
        </section>
      )}

      {activeTab === "plans" && (
        <div className="developer-grid developer-grid--plans">
          <form className="developer-panel developer-plan-editor" onSubmit={savePlan}>
            <div className="developer-panel-head">
              <div>
                <p className="developer-eyebrow">Plan builder</p>
                <h2>Create or Edit Plan</h2>
              </div>
              <button type="button" onClick={resetPlanForm}>New Plan</button>
            </div>

            <div className="developer-form-grid">
              <label>
                <span>Plan id</span>
                <input value={planForm.plan_id} onChange={(e) => setPlanForm((p) => ({ ...p, plan_id: e.target.value.trim().toLowerCase().replace(/\s+/g, "-") }))} placeholder="premium" />
              </label>
              <label>
                <span>Plan name</span>
                <input value={planForm.name} onChange={(e) => setPlanForm((p) => ({ ...p, name: e.target.value }))} placeholder="Premium" />
              </label>
              <label className="developer-form-wide">
                <span>Description</span>
                <textarea value={planForm.description} onChange={(e) => setPlanForm((p) => ({ ...p, description: e.target.value }))} placeholder="Plan positioning and internal notes" />
              </label>
            </div>

            <div className="developer-limits">
              {Object.keys(defaultLimits).map((key) => (
                <label key={key}>
                  <span>{key.replace("_", " ")}</span>
                  <input
                    type="number"
                    min="0"
                    value={planForm.limits[key]}
                    onChange={(e) => setPlanForm((p) => ({ ...p, limits: { ...p.limits, [key]: numberValue(e.target.value) } }))}
                  />
                </label>
              ))}
            </div>

            <div className="developer-feature-row">
              <label className="developer-check">
                <input
                  type="checkbox"
                  checked={!!planForm.features.allow_public_access}
                  onChange={(e) => setPlanForm((p) => ({ ...p, features: { ...p.features, allow_public_access: e.target.checked } }))}
                />
                Public share links
              </label>
              <label className="developer-check">
                <input
                  type="checkbox"
                  checked={!!planForm.features.allow_drive_import}
                  onChange={(e) => setPlanForm((p) => ({ ...p, features: { ...p.features, allow_drive_import: e.target.checked } }))}
                />
                Google Drive import
              </label>
            </div>

            <button type="submit" className="developer-primary-btn" disabled={savingPlan || !planForm.plan_id || !planForm.name}>
              {savingPlan ? "Saving Plan..." : "Save Plan"}
            </button>
          </form>

          <section className="developer-panel">
            <div className="developer-panel-head">
              <div>
                <p className="developer-eyebrow">Catalog</p>
                <h2>Plan Rules</h2>
              </div>
            </div>
            <div className="developer-plan-list">
              {plans.map((plan) => {
                const normalized = planWithDefaults(plan);
                return (
                  <article key={plan.plan_id} className="developer-plan-card">
                    <div>
                      <strong>{normalized.name}</strong>
                      <span>{normalized.plan_id}</span>
                      {normalized.description && <p>{normalized.description}</p>}
                    </div>
                    <div className="developer-plan-meta">
                      <span>{normalized.limits.wedding_limit} wedding</span>
                      <span>{normalized.limits.program_limit} functions</span>
                      <span>{normalized.limits.episode_limit} events</span>
                      <span>{normalized.limits.photo_limit} photos</span>
                    </div>
                    <div className="developer-card-actions">
                      <button type="button" onClick={() => loadPlan(plan)}>Edit</button>
                      <button type="button" onClick={() => duplicatePlan(plan)}>Duplicate</button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
