import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AsyncState from "../components/AsyncState";
import { apiGet, apiPatch, apiPost } from "../api";

const defaultLimits = {
  wedding_limit: 1,
  program_limit: 3,
  episode_limit: 3,
  photo_limit: 100,
};

const defaultFeatures = {
  allow_public_access: false,
  allow_drive_import: true,
};

function numberValue(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function DeveloperAdminPage() {
  const queryClient = useQueryClient();
  const { data: session, isLoading: loadingSession } = useQuery({ queryKey: ["session"], queryFn: () => apiGet("/api/session"), retry: false });
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

  const [planForm, setPlanForm] = useState({
    plan_id: "premium",
    name: "Premium",
    description: "",
    limits: defaultLimits,
    features: defaultFeatures,
  });
  const [message, setMessage] = useState("");

  const planOptions = useMemo(() => plans.map((plan) => plan.plan_id), [plans]);

  const savePlan = async (ev) => {
    ev.preventDefault();
    setMessage("");
    await apiPost("/api/developer/plans", planForm);
    await queryClient.invalidateQueries({ queryKey: ["developer-plans"] });
    setMessage("Plan saved.");
  };

  const updateUser = async (user, patch) => {
    await apiPatch(`/api/developer/users/${user._id}`, patch);
    await queryClient.invalidateQueries({ queryKey: ["developer-users"] });
    await queryClient.invalidateQueries({ queryKey: ["developer-overview"] });
  };

  if (loadingSession) return <AsyncState mode="loading" />;
  if (!session?.is_developer) {
    return (
      <section className="developer-page">
        <div className="developer-panel">
          <h2>Developer Access Required</h2>
          <p className="photo-gallery-modal__status">This dashboard is separate from customer admin login.</p>
          <Link className="home-btn home-btn--primary" to="/developer-login">Developer Login</Link>
        </div>
      </section>
    );
  }
  if (loadingPlans || loadingUsers || loadingOverview) return <AsyncState mode="loading" />;
  if (plansError || usersError || overviewError) return <AsyncState mode="error" message={(plansError || usersError || overviewError)?.message} />;

  const stats = overview?.stats || {};
  const statCards = [
    ["Users", stats.users || 0],
    ["Active", stats.active_users || 0],
    ["Weddings", stats.weddings || 0],
    ["Functions", stats.functions || 0],
    ["Events", stats.events || 0],
    ["Photos", stats.photos || 0],
  ];

  return (
    <section className="developer-page">
      <div className="developer-page__header">
        <div>
          <p className="home-hero__kicker">Developer Admin</p>
          <h1>Control Center</h1>
        </div>
        {message && <p className="developer-page__message">{message}</p>}
      </div>

      <div className="developer-stats">
        {statCards.map(([label, value]) => (
          <article className="developer-stat" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>

      <div className="developer-grid developer-grid--overview">
        <section className="developer-panel">
          <h2>Plan Distribution</h2>
          <div className="developer-mini-list">
            {Object.entries(overview?.plan_counts || {}).map(([planId, count]) => (
              <div key={planId}><span>{planId}</span><strong>{count}</strong></div>
            ))}
          </div>
        </section>
        <section className="developer-panel">
          <h2>Recent Users</h2>
          <div className="developer-mini-list">
            {(overview?.recent_users || []).map((user) => (
              <div key={user._id}><span>{user.name || user.email}</span><strong>{user.plan_id}</strong></div>
            ))}
          </div>
        </section>
      </div>

      <div className="developer-grid developer-grid--plans">
        <form className="developer-panel developer-panel--plans" onSubmit={savePlan}>
          <h2>Create or Edit Plan</h2>
          <input value={planForm.plan_id} onChange={(e) => setPlanForm((p) => ({ ...p, plan_id: e.target.value }))} placeholder="plan id" />
          <input value={planForm.name} onChange={(e) => setPlanForm((p) => ({ ...p, name: e.target.value }))} placeholder="Plan name" />
          <input value={planForm.description} onChange={(e) => setPlanForm((p) => ({ ...p, description: e.target.value }))} placeholder="Description" />
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
          <label className="developer-check">
            <input
              type="checkbox"
              checked={!!planForm.features.allow_public_access}
              onChange={(e) => setPlanForm((p) => ({ ...p, features: { ...p.features, allow_public_access: e.target.checked } }))}
            />
            Allow public access
          </label>
          <label className="developer-check">
            <input
              type="checkbox"
              checked={!!planForm.features.allow_drive_import}
              onChange={(e) => setPlanForm((p) => ({ ...p, features: { ...p.features, allow_drive_import: e.target.checked } }))}
            />
            Allow Drive import
          </label>
          <button type="submit">Save Plan</button>
        </form>

        <section className="developer-panel">
          <h2>Plan Rules</h2>
          <p className="photo-gallery-modal__status">
            Users sign up from the normal Wedflix login and automatically become admins. Assign a plan here to control how many weddings, functions, events, and photos they can add.
          </p>
          <div className="developer-mini-list">
            {plans.map((plan) => (
              <div key={plan.plan_id}>
                <span>{plan.name}</span>
                <strong>{plan.limits?.program_limit || 0} functions</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="developer-panel developer-panel--wide">
        <h2>Users</h2>
        <div className="developer-table">
          {users.map((user) => (
            <div className="developer-row" key={user._id}>
              <div>
                <strong>{user.name || user.email}</strong>
                <span>{user.email} {user.phone ? ` | ${user.phone}` : ""}</span>
                <span>{user.details?.business_name || user.details?.city || "No extra details"}</span>
              </div>
              <div className="developer-usage">
                <span>{user.usage?.weddings || 0} weddings</span>
                <span>{user.usage?.programs || 0} functions</span>
                <span>{user.usage?.episodes || 0} events</span>
                <span>{user.usage?.photos || 0} photos</span>
              </div>
              <select value={user.plan_id} onChange={(e) => updateUser(user, { plan_id: e.target.value })}>
                {planOptions.map((planId) => <option key={planId} value={planId}>{planId}</option>)}
              </select>
              <select value={user.status} onChange={(e) => updateUser(user, { status: e.target.value })}>
                <option value="active">active</option>
                <option value="paused">paused</option>
              </select>
              <span className="developer-role-pill">{user.role === "developer" ? "developer" : "admin"}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
