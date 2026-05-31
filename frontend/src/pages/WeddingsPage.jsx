import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import Skeleton from "react-loading-skeleton";
import { motion } from "framer-motion";
import { apiGet, apiPostForm, apiPostFormJson } from "../api";
import ProgressiveImage from "../components/ProgressiveImage";
import { useEditMode } from "../components/EditModeContext";
import AsyncState from "../components/AsyncState";
import SeoHead from "../components/SeoHead";

const netflixLogoUrl = "https://images.icon-icons.com/2699/PNG/512/netflix_logo_icon_170919.png";

function WeddingPosterCard({ wedding, editMode }) {
  return (
    <motion.div key={wedding._id} whileHover={{ scale: 1.04 }} className="profile-wrap">
      <Link to={`/weddings/${wedding._id}`} className="home-poster profile-card profile-card--watching" onClick={(e) => editMode && e.preventDefault()}>
        <ProgressiveImage src={wedding.profile_image} alt={wedding.couple_names} className="profile-card__image" />
        <div className="home-poster__fade" />
        <div className="home-poster__content">
          <img src={netflixLogoUrl} alt="" aria-hidden="true" className="home-poster__logo" />
          <div className="home-poster__text">
            <p className="home-poster__title">{wedding.couple_names}</p>
            <p className="home-poster__subtitle">{wedding.wedding_date}</p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function WeddingsPage() {
  const queryClient = useQueryClient();
  const { canEdit, editMode } = useEditMode();
  const [modal, setModal] = useState(null);
  const { data: weddings = [], isLoading, error, refetch } = useQuery({
    queryKey: ["weddings"],
    queryFn: () => apiGet("/api/weddings"),
  });
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: () => apiGet("/api/session"),
    retry: false,
  });
  const weddingLimit = Number(session?.plan?.limits?.wedding_limit || 0);
  const weddingUsage = Number(session?.usage?.weddings ?? weddings.length);
  const canAddWedding = Boolean(session && (session.is_developer || !weddingLimit || weddingUsage < weddingLimit));

  const saveWedding = async (payload, weddingId) => {
    const fd = new FormData();
    Object.entries(payload).forEach(([k, v]) => {
      if (v instanceof File) fd.append(k, v);
      else fd.append(k, v || "");
    });
    await apiPostForm(`/admin/weddings/${weddingId}/update`, fd);
    await queryClient.invalidateQueries({ queryKey: ["weddings"] });
    setModal(null);
  };

  const createWedding = async (payload) => {
    const fd = new FormData();
    Object.entries(payload).forEach(([k, v]) => {
      if (v instanceof File) fd.append(k, v);
      else fd.append(k, v || "");
    });
    const result = await apiPostFormJson("/admin/weddings/create", fd);
    await queryClient.invalidateQueries({ queryKey: ["weddings"] });
    await queryClient.invalidateQueries({ queryKey: ["session"] });
    setModal(null);
    if (result?.public_home_path) {
      const publicUrl = `${window.location.origin}${result.public_home_path}`;
      try {
        await navigator.clipboard.writeText(publicUrl);
        window.alert(`Public home link copied:\n${publicUrl}`);
      } catch {
        window.prompt("Copy this public home link", publicUrl);
      }
    }
  };

  const deleteWedding = async (wedding) => {
    if (!window.confirm(`Delete ${wedding.couple_names}? This removes programs and events too.`)) return;
    await apiPostForm(`/admin/weddings/${wedding._id}/delete`, new FormData());
    await queryClient.invalidateQueries({ queryKey: ["weddings"] });
    await queryClient.invalidateQueries({ queryKey: ["session"] });
  };

  const copyShareLink = async (wedding) => {
    const shareUrl = wedding.public_slug
      ? `${window.location.origin}/p/${wedding.public_slug}`
      : `${window.location.origin}/share/${wedding._id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      window.alert("Public home link copied.");
    } catch {
      window.prompt("Copy this public home link", shareUrl);
    }
  };

  return (
    <section className="home-shell home-profiles-netflix">
      <SeoHead
        title="Wedflix | Who's Watching?"
        description="Choose a wedding story profile on Wedflix and start streaming programs, episodes, and wedding memories."
        canonicalPath="/"
      />
      {isLoading && weddings.length === 0 && <AsyncState mode="loading" />}
      {error && weddings.length === 0 && <AsyncState mode="error" message={error.message} onRetry={() => refetch()} />}
      <div className="home-center">
        <h1 className="home-title">Who&apos;s Watching?</h1>
      </div>
      {error && <p className="error">{error.message}</p>}
      <div className="profiles-grid">
        {canEdit && canAddWedding && (editMode || (!isLoading && weddings.length === 0)) && (
          <button className="add-card-tile" onClick={() => setModal({ type: "create", item: {} })}>
            <span className="add-card-plus">+</span>
            <span>Add Wedding</span>
          </button>
        )}
        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={`s-${i}`} className="profile-card">
              <Skeleton height={230} />
              <div style={{ padding: 10 }}><Skeleton count={2} /></div>
            </div>
          ))}
      {!isLoading &&
          weddings.map((w) => (
            <div key={w._id} className="profile-wrap">
              <WeddingPosterCard wedding={w} editMode={editMode} />
              {canEdit && editMode && (
                <div className="cms-overlay-actions" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="cms-fab" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setModal({ type: "edit", item: w }); }}>Edit</button>
                  <button type="button" className="cms-fab" onClick={(e) => { e.preventDefault(); e.stopPropagation(); copyShareLink(w); }}>Copy Link</button>
                  <button type="button" className="cms-fab danger" onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteWedding(w); }}>Delete</button>
                </div>
              )}
            </div>
          ))}
      </div>
      {modal && (
        <div className="cms-modal-backdrop" onClick={() => setModal(null)}>
          <div className="cms-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{modal.type === "create" ? "Add Wedding" : "Edit Wedding"}</h3>
            <WeddingForm
              initial={modal.item}
              isDeveloper={!!session?.is_developer}
              onCancel={() => setModal(null)}
              onSubmit={(values) => (modal.type === "create" ? createWedding(values) : saveWedding(values, modal.item._id))}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function WeddingForm({ initial, onSubmit, onCancel, isDeveloper = false }) {
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    couple_names: initial.couple_names || "",
    wedding_date: initial.wedding_date || "",
    hero_video_url: initial.hero_video_url || "",
    description: initial.description || "",
    profile_image: initial.profile_image || "",
    profile_image_file: null,
    music_url: initial.music_url || "",
    music_file: null,
    access_level: initial.access_level || "public",
    show_on_demo_home: initial.show_on_demo_home ? "1" : "",
    premium_experience_enabled: initial.premium_experience_enabled ? "1" : "",
  });
  return (
    <form
      className="cms-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaveError("");
        setIsSaving(true);
        try {
          await onSubmit(form);
        } catch (err) {
          setSaveError(err?.message || "Save failed. Please try again.");
        } finally {
          setIsSaving(false);
        }
      }}
    >
      <div className="cms-form-grid">
        <label className="cms-field">
          <span>Couple Names</span>
          <input value={form.couple_names} onChange={(e) => setForm((p) => ({ ...p, couple_names: e.target.value }))} placeholder="Aarav & Kavya" disabled={isSaving} />
        </label>
        <label className="cms-field">
          <span>Wedding Date</span>
          <input value={form.wedding_date} onChange={(e) => setForm((p) => ({ ...p, wedding_date: e.target.value }))} placeholder="2026-12-01" disabled={isSaving} />
        </label>
        <label className="cms-field cms-field-wide">
          <span>Profile Image URL</span>
          <input value={form.profile_image} onChange={(e) => setForm((p) => ({ ...p, profile_image: e.target.value }))} placeholder="https://..." disabled={isSaving} />
        </label>
        <label className="cms-field cms-field-wide">
          <span>Upload Profile Image</span>
          <input type="file" accept="image/*" onChange={(e) => setForm((p) => ({ ...p, profile_image_file: e.target.files?.[0] || null }))} disabled={isSaving} />
        </label>
        <label className="cms-field cms-field-wide">
          <span>Hero Video URL</span>
          <input value={form.hero_video_url} onChange={(e) => setForm((p) => ({ ...p, hero_video_url: e.target.value }))} placeholder="https://youtube.com/watch?v=..." disabled={isSaving} />
        </label>
        <label className="cms-field">
          <span>Access Level</span>
          <select value={form.access_level} onChange={(e) => setForm((p) => ({ ...p, access_level: e.target.value }))} disabled={isSaving}>
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
        </label>
        {isDeveloper && (
          <label className="cms-field cms-check-field">
            <input
              type="checkbox"
              checked={form.show_on_demo_home === "1"}
              onChange={(e) => setForm((p) => ({ ...p, show_on_demo_home: e.target.checked ? "1" : "" }))}
              disabled={isSaving}
            />
            <span>Show on demo home</span>
          </label>
        )}
        <label className="cms-field cms-check-field">
          <input
            type="checkbox"
            checked={form.premium_experience_enabled === "1"}
            onChange={(e) => setForm((p) => ({ ...p, premium_experience_enabled: e.target.checked ? "1" : "" }))}
            disabled={isSaving}
          />
          <span>Show Premium Wedding Experience First</span>
        </label>
        <label className="cms-field cms-field-wide">
          <span>Music URL</span>
          <input value={form.music_url} onChange={(e) => setForm((p) => ({ ...p, music_url: e.target.value }))} placeholder="https://cdn.example.com/song.mp3" disabled={isSaving} />
        </label>
        <label className="cms-field cms-field-wide">
          <span>Upload Music</span>
          <input type="file" accept="audio/*" onChange={(e) => setForm((p) => ({ ...p, music_file: e.target.files?.[0] || null }))} disabled={isSaving} />
        </label>
        <label className="cms-field cms-field-wide">
          <span>Description</span>
          <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Wedding story..." disabled={isSaving} />
        </label>
      </div>
      {saveError && <p className="error">{saveError}</p>}
      <div className="cms-form-actions">
        <button type="button" className="cms-fab" onClick={onCancel} disabled={isSaving}>Cancel</button>
        <button type="submit" className="cms-fab" disabled={isSaving}>{isSaving ? "Saving..." : "Save"}</button>
      </div>
    </form>
  );
}
