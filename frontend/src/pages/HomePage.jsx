import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Skeleton from "react-loading-skeleton";
import { motion } from "framer-motion";
import { apiGet, apiPostForm, mediaUrl } from "../api";
import { useEditMode } from "../components/EditModeContext";
import AsyncState from "../components/AsyncState";
import SeoHead from "../components/SeoHead";

function toEmbed(url) {
  if (!url) return "";
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : url;
}

function withAutoplay(url) {
  if (!url) return "";
  const joiner = url.includes("?") ? "&" : "?";
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  const playlist = match ? `&playlist=${match[1]}` : "";
  return `${url}${joiner}autoplay=1&mute=1&controls=0&loop=1${playlist}&playsinline=1&start=0&rel=0&modestbranding=1`;
}

function getPlaceholder(label) {
  const text = (label || "Wedflix").trim().slice(0, 18) || "Wedflix";
  const encoded = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#161616" />
          <stop offset="100%" stop-color="#050505" />
        </linearGradient>
        <radialGradient id="glow" cx="70%" cy="18%" r="80%">
          <stop offset="0%" stop-color="#e50914" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#e50914" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="1280" height="720" fill="url(#bg)" />
      <rect width="1280" height="720" fill="url(#glow)" />
      <text x="70" y="360" fill="#e5e7eb" font-size="88" font-family="Georgia, serif">${text}</text>
      <text x="70" y="430" fill="#8b8b8b" font-size="36" font-family="Arial, sans-serif">Wedflix</text>
    </svg>
  `);
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

function imageFor(item, label) {
  return item?.thumbnail || item?.profile_image || item?.hero_image || getPlaceholder(label);
}

const netflixLogoUrl = "https://images.icon-icons.com/2699/PNG/512/netflix_logo_icon_170919.png";

function PosterCard({ item, title, subtitle, href, editMode, onEdit, onDelete }) {
  return (
    <motion.div className="home-poster-wrap" whileHover={{ y: -4, scale: 1.015 }} transition={{ type: "spring", stiffness: 240, damping: 20 }}>
      <Link to={href} className="home-poster">
        <img src={imageFor(item, title)} alt={title} className="home-poster__image" />
        <div className="home-poster__fade" />
        <div className="home-poster__content">
          <img src={netflixLogoUrl} alt="" aria-hidden="true" className="home-poster__logo" />
          <div className="home-poster__text">
            <p className="home-poster__title">{title}</p>
            <p className="home-poster__subtitle">{subtitle}</p>
          </div>
        </div>
      </Link>
      {editMode && item?.couple_names && (
        <div className="cms-overlay-actions home-poster__admin" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="cms-fab" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(item); }}>Edit</button>
          <button type="button" className="cms-fab danger" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(item); }}>Delete</button>
        </div>
      )}
    </motion.div>
  );
}

export default function HomePage() {
  const queryClient = useQueryClient();
  const { canEdit, editMode } = useEditMode();
  const [modal, setModal] = useState(null);
  const [isMusicOn, setIsMusicOn] = useState(false);
  const audioRef = useRef(null);

  const { data: weddings = [], isLoading, error, refetch } = useQuery({
    queryKey: ["weddings"],
    queryFn: () => apiGet("/api/weddings"),
  });

  const featuredWedding = weddings[0] || null;

  const { data: featuredPrograms = [] } = useQuery({
    queryKey: ["wedding-programs", featuredWedding?._id],
    queryFn: () => apiGet(`/api/weddings/${featuredWedding._id}/programs`),
    enabled: !!featuredWedding?._id,
  });

  const featuredVideoUrl = useMemo(() => withAutoplay(toEmbed(featuredWedding?.hero_video_url)), [featuredWedding?.hero_video_url]);
  const heroImage = featuredWedding?.hero_image || featuredWedding?.profile_image || getPlaceholder(featuredWedding?.couple_names);
  const pageMusicUrl = mediaUrl(featuredWedding?.music_url || "");

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.load();
    setIsMusicOn(false);
  }, [pageMusicUrl]);

  const toggleMusic = async () => {
    if (!audioRef.current || !pageMusicUrl) return;
    if (isMusicOn) {
      audioRef.current.pause();
      setIsMusicOn(false);
      return;
    }
    try {
      await audioRef.current.play();
      setIsMusicOn(true);
    } catch {
      setIsMusicOn(false);
    }
  };

  const cards = useMemo(() => {
    const programCards = featuredPrograms.map((program, index) => ({
      _id: program._id,
      href: `/weddings/${featuredWedding?._id}/programs/${program._id}`,
      title: program.title || `Season ${index + 1}`,
      subtitle: `Season ${index + 1}`,
      item: program,
    }));

    const weddingCards = weddings.slice(1).map((wedding, index) => ({
      _id: wedding._id,
      href: `/weddings/${wedding._id}`,
      title: wedding.couple_names || `Little Moment ${index + 1}`,
      subtitle: wedding.wedding_date || wedding.venue_name || "Little Moments",
      item: wedding,
    }));

    return [...programCards, ...weddingCards];
  }, [featuredPrograms, featuredWedding, weddings]);

  const rows = useMemo(() => {
    const take = (start, size = 3) => {
      const source = cards.length ? cards : [];
      if (!source.length) return [];
      const chunk = source.slice(start, start + size);
      if (chunk.length < size) chunk.push(...source.slice(0, size - chunk.length));
      return chunk.slice(0, size);
    };
    return [
      { id: "seasons", title: "The Celebration Series", cards: take(0) },
      { id: "our-films", title: "OUR FILM", cards: take(3) },
      { id: "little-moments", title: "Little Moments", cards: take(6) },
    ];
  }, [cards]);

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
    await apiPostForm("/admin/weddings/create", fd);
    await queryClient.invalidateQueries({ queryKey: ["weddings"] });
    setModal(null);
  };

  const deleteWedding = async (wedding) => {
    if (!window.confirm(`Delete ${wedding.couple_names}? This removes programs and events too.`)) return;
    await apiPostForm(`/admin/weddings/${wedding._id}/delete`, new FormData());
    await queryClient.invalidateQueries({ queryKey: ["weddings"] });
  };

  const firstProgramHref = featuredPrograms[0] ? `/weddings/${featuredWedding?._id}/programs/${featuredPrograms[0]._id}` : featuredWedding ? `/weddings/${featuredWedding._id}` : "#";
  const infoHref = featuredWedding ? `/weddings/${featuredWedding._id}` : "#";

  return (
    <section className="home-page">
      <SeoHead
        title={featuredWedding ? `${featuredWedding.couple_names} | Wedflix` : "Wedflix | Wedding Stories"}
        description={featuredWedding?.description || "Wedflix is a cinematic wedding streaming platform for wedding stories, programs, and episode galleries."}
        canonicalPath="/weddings"
        image={featuredWedding?.profile_image || featuredWedding?.hero_image || `${window.location.origin}/favicon.svg`}
      />
      <audio ref={audioRef} src={pageMusicUrl} loop preload="none" />

      {isLoading && weddings.length === 0 && <AsyncState mode="loading" />}
      {error && weddings.length === 0 && <AsyncState mode="error" message={error.message} onRetry={() => refetch()} />}

      {!isLoading && featuredWedding && (
        <header className="home-hero">
          <div className={`home-hero__media ${featuredVideoUrl ? "has-video" : ""}`}>
            {featuredVideoUrl ? (
              <iframe
                className="home-hero__video"
                src={featuredVideoUrl}
                title="Featured wedding trailer"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <img className="home-hero__image" src={heroImage} alt={featuredWedding.couple_names} />
            )}
            <img className="home-hero__image home-hero__image--mobile" src={heroImage} alt="" aria-hidden="true" />
            <div className="home-hero__shade" />
          </div>

          <div className="home-hero__content">
            <p className="home-hero__kicker">A WEDDING ORIGINAL</p>
            <h1 className="home-hero__names">{featuredWedding.couple_names}</h1>
            <div className="home-hero__headline">
              <span className="home-hero__badge">
                <strong>TOP</strong>
                <strong>10</strong>
              </span>
              <h2>#1 Love In Every Frame</h2>
            </div>
            <p className="home-hero__description">
              {featuredWedding.description || "A simple hello turned into a lifetime together. Through laughter, memories, and countless moments, their story found its way to forever."}
            </p>
            <div className="home-hero__meta">
              <span>Celebration</span>
              <span>Family</span>
              <span>Romance</span>
            </div>
            <div className="home-hero__actions">
              <Link to={firstProgramHref} className="home-btn home-btn--primary">
                <span aria-hidden="true">▶</span>
                Play
              </Link>
              <Link to={infoHref} className="home-btn home-btn--secondary">
                <span aria-hidden="true">ⓘ</span>
                More Info
              </Link>
            </div>
          </div>

          <button
            type="button"
            className={`home-sound-toggle ${isMusicOn ? "is-on" : ""}`}
            onClick={toggleMusic}
            disabled={!pageMusicUrl}
            title={pageMusicUrl ? (isMusicOn ? "Music On" : "Music Off") : "No page music"}
          >
            <span aria-hidden="true">{isMusicOn ? "♪" : "♫"}</span>
          </button>
        </header>
      )}

      <div className="home-rails">
        {rows.map((row) => (
          <section key={row.id} className="home-rail" id={row.id}>
            <div className="home-rail__header">
              <h2>{row.title}</h2>
            </div>
            {isLoading && row.cards.length === 0 ? (
              <Skeleton height={220} count={1} />
            ) : (
              <div className="home-rail__grid">
                {row.cards.map((card) => (
                  <PosterCard
                    key={card._id}
                    item={card.item}
                    href={card.href}
                    title={card.title}
                    subtitle={card.subtitle}
                    editMode={canEdit && editMode}
                    onEdit={(item) => setModal({ type: "edit", item })}
                    onDelete={deleteWedding}
                  />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      {canEdit && editMode && (
        <div className="home-admin-fab-row">
          <button type="button" className="cms-fab" onClick={() => setModal({ type: "create", item: {} })}>
            Add Wedding
          </button>
        </div>
      )}

      {modal && (
        <div className="cms-modal-backdrop" onClick={() => setModal(null)}>
          <div className="cms-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{modal.type === "create" ? "Add Wedding" : "Edit Wedding"}</h3>
            <WeddingForm
              initial={modal.item}
              onCancel={() => setModal(null)}
              onSubmit={(values) => (modal.type === "create" ? createWedding(values) : saveWedding(values, modal.item._id))}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function WeddingForm({ initial, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    couple_names: initial.couple_names || "",
    wedding_date: initial.wedding_date || "",
    hero_video_url: initial.hero_video_url || "",
    description: initial.description || "",
    profile_image: initial.profile_image || "",
    profile_image_file: null,
    music_url: initial.music_url || "",
    music_file: null,
    access_level: initial.access_level || "private",
    show_on_demo_home: initial.show_on_demo_home ? "1" : "",
  });

  return (
    <form
      className="cms-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
    >
      <div className="cms-form-grid">
        <label className="cms-field">
          <span>Couple Names</span>
          <input value={form.couple_names} onChange={(e) => setForm((p) => ({ ...p, couple_names: e.target.value }))} placeholder="Aarav & Kavya" />
        </label>
        <label className="cms-field">
          <span>Wedding Date</span>
          <input value={form.wedding_date} onChange={(e) => setForm((p) => ({ ...p, wedding_date: e.target.value }))} placeholder="2026-12-01" />
        </label>
        <label className="cms-field cms-field-wide">
          <span>Profile Image URL</span>
          <input value={form.profile_image} onChange={(e) => setForm((p) => ({ ...p, profile_image: e.target.value }))} placeholder="https://..." />
        </label>
        <label className="cms-field cms-field-wide">
          <span>Upload Profile Image</span>
          <input type="file" accept="image/*" onChange={(e) => setForm((p) => ({ ...p, profile_image_file: e.target.files?.[0] || null }))} />
        </label>
        <label className="cms-field cms-field-wide">
          <span>Hero Video URL</span>
          <input value={form.hero_video_url} onChange={(e) => setForm((p) => ({ ...p, hero_video_url: e.target.value }))} placeholder="https://youtube.com/watch?v=..." />
        </label>
        <label className="cms-field">
          <span>Access Level</span>
          <select value={form.access_level} onChange={(e) => setForm((p) => ({ ...p, access_level: e.target.value }))}>
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
        </label>
        <label className="cms-field cms-check-field">
          <input
            type="checkbox"
            checked={form.show_on_demo_home === "1"}
            onChange={(e) => setForm((p) => ({ ...p, show_on_demo_home: e.target.checked ? "1" : "" }))}
          />
          <span>Show on demo home</span>
        </label>
        <label className="cms-field cms-field-wide">
          <span>Music URL</span>
          <input value={form.music_url} onChange={(e) => setForm((p) => ({ ...p, music_url: e.target.value }))} placeholder="https://cdn.example.com/song.mp3" />
        </label>
        <label className="cms-field cms-field-wide">
          <span>Upload Music</span>
          <input type="file" accept="audio/*" onChange={(e) => setForm((p) => ({ ...p, music_file: e.target.files?.[0] || null }))} />
        </label>
        <label className="cms-field cms-field-wide">
          <span>Description</span>
          <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Wedding story..." />
        </label>
      </div>
      <div className="cms-form-actions">
        <button type="button" className="cms-fab" onClick={onCancel}>Cancel</button>
        <button type="submit" className="cms-fab">Save</button>
      </div>
    </form>
  );
}
