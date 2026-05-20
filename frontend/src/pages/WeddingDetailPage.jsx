import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import Skeleton from "react-loading-skeleton";
import { apiGet, apiPostForm } from "../api";
import { useEditMode } from "../components/EditModeContext";
import InlineEditableText from "../components/InlineEditableText";
import AsyncState from "../components/AsyncState";

function toEmbed(url) {
  if (!url) return "";
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : url;
}

function getVideoId(url) {
  if (!url) return "";
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : "";
}

function withPlayerParams(url) {
  if (!url) return "";
  const joiner = url.includes("?") ? "&" : "?";
  const videoId = getVideoId(url);
  const loopParams = videoId ? `&playlist=${videoId}` : "";
  return `${url}${joiner}autoplay=1&mute=1&controls=0&loop=1${loopParams}&playsinline=1&start=0&rel=0&modestbranding=1`;
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

function RailPoster({ item, href, title, subtitle, editMode, onEdit, onDelete, dragProps = null }) {
  return (
    <motion.div className="home-poster-wrap" whileHover={{ y: -4, scale: 1.015 }} transition={{ type: "spring", stiffness: 240, damping: 20 }}>
      <Link to={href} className="home-poster" onClick={(e) => editMode && e.preventDefault()}>
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

      {editMode && item?._id && (
        <div className="cms-overlay-actions home-poster__admin" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="cms-fab"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit(item);
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className="cms-fab danger"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(item);
            }}
          >
            Delete
          </button>
          {dragProps && (
            <button type="button" className="cms-fab drag" onPointerDown={(e) => e.stopPropagation()} {...dragProps}>
              Drag
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

function SortableRailPoster({ item, href, title, subtitle, editMode, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item._id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style}>
      <RailPoster
        item={item}
        href={href}
        title={title}
        subtitle={subtitle}
        editMode={editMode}
        onEdit={onEdit}
        onDelete={onDelete}
        dragProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function StaticRailPoster({ item, href, title, subtitle, editMode, onEdit, onDelete }) {
  return <RailPoster item={item} href={href} title={title} subtitle={subtitle} editMode={editMode} onEdit={onEdit} onDelete={onDelete} />;
}

export default function WeddingDetailPage({ onMusicUrlChange = () => {} }) {
  const { weddingId } = useParams();
  const queryClient = useQueryClient();
  const { canEdit, editMode } = useEditMode();
  const [modal, setModal] = useState(null);
  const [ordered, setOrdered] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["wedding", weddingId],
    queryFn: async () => {
      const [wedding, programs] = await Promise.all([
        apiGet(`/api/weddings/${weddingId}`),
        apiGet(`/api/weddings/${weddingId}/programs`),
      ]);
      return { wedding, programs };
    },
  });

  const wedding = data?.wedding;
  const programs = data?.programs || [];

  const mainPrograms = useMemo(
    () => programs.filter((program) => (program.section_key || "main") === "main"),
    [programs],
  );

  const customSections = useMemo(() => {
    const src = Array.isArray(wedding?.custom_sections) ? wedding.custom_sections : [];
    if (src.length) return src;
    if (wedding?.custom_section_label) return [{ key: "custom", label: wedding.custom_section_label }];
    return [{ key: "custom", label: "My Custom Box" }];
  }, [wedding?.custom_sections, wedding?.custom_section_label]);

  const programsBySection = useMemo(() => {
    const map = {};
    programs.forEach((program) => {
      const key = (program.section_key || "main").toLowerCase();
      if (!map[key]) map[key] = [];
      map[key].push(program);
    });
    if (customSections.length && map.custom && !map[customSections[0].key]) {
      map[customSections[0].key] = map.custom;
    }
    return map;
  }, [programs, customSections]);

  const mainProgramIds = useMemo(() => mainPrograms.map((program) => program._id).join("|"), [mainPrograms]);
  useEffect(() => {
    setOrdered((prev) => {
      const prevIds = prev.map((program) => program._id).join("|");
      if (prevIds === mainProgramIds) return prev;
      return mainPrograms;
    });
  }, [mainProgramIds, mainPrograms]);
  useEffect(() => {
    onMusicUrlChange(wedding?.music_url || "");
  }, [wedding?.music_url, onMusicUrlChange]);

  const saveProgram = async (payload, programId) => {
    const fd = new FormData();
    Object.entries(payload).forEach(([k, v]) => fd.append(k, v || ""));
    await apiPostForm(`/admin/programs/${programId}/update`, fd);
    setModal(null);
  };

  const saveWeddingField = async (field, val) => {
    if (!wedding) return;
    const invitationTitle = field === "invitation_title" ? val : wedding.invitation_title || "Wedding Invitation";
    const programsSectionTitle = field === "programs_section_title" ? val : wedding.programs_section_title || "Wedding Programs";
    const customSectionsValue = field === "custom_sections" ? (Array.isArray(val) ? val : []) : customSections;
    const customSectionLabel = customSectionsValue[0]?.label || wedding.custom_section_label || "My Custom Box";

    const fd = new FormData();
    fd.append("couple_names", field === "couple_names" ? val : wedding.couple_names || "");
    fd.append("wedding_date", field === "wedding_date" ? val : wedding.wedding_date || "");
    fd.append("hero_video_url", wedding.hero_video_url || "");
    fd.append("description", wedding.description || "");
    fd.append("venue_name", wedding.venue_name || "");
    fd.append("event_address", wedding.event_address || "");
    fd.append("profile_image", wedding.profile_image || "");
    fd.append("music_url", wedding.music_url || "");
    fd.append("access_level", wedding.access_level || "private");
    fd.append("invitation_title", invitationTitle);
    fd.append("programs_section_title", programsSectionTitle);
    fd.append("custom_sections_json", JSON.stringify(customSectionsValue));
    fd.append("custom_section_label", customSectionLabel);
    await apiPostForm(`/admin/weddings/${weddingId}/update`, fd);
    await queryClient.invalidateQueries({ queryKey: ["wedding", weddingId] });
  };

  const createProgram = async (payload, sectionKey = "main") => {
    const fd = new FormData();
    fd.append("wedding_id", weddingId);
    fd.append("section_key", sectionKey);
    Object.entries(payload).forEach(([k, v]) => fd.append(k, v || ""));
    await apiPostForm("/admin/programs/create", fd);
    await queryClient.invalidateQueries({ queryKey: ["wedding", weddingId] });
    setModal(null);
  };

  const deleteProgram = async (program) => {
    if (!window.confirm(`Delete ${program.title}?`)) return;
    await apiPostForm(`/admin/programs/${program._id}/delete`, new FormData());
    await queryClient.invalidateQueries({ queryKey: ["wedding", weddingId] });
  };

  const deleteCustomSection = async (sectionKey, sectionLabel) => {
    const sectionPrograms = programs.filter((program) => (program.section_key || "main") === sectionKey);
    const confirmed = window.confirm(
      sectionPrograms.length
        ? `Delete ${sectionLabel}? ${sectionPrograms.length} program(s) will move back to the main section.`
        : `Delete ${sectionLabel}?`
    );
    if (!confirmed) return;

    for (const program of sectionPrograms) {
      await saveProgram({ ...program, section_key: "main", thumbnail: program.thumbnail }, program._id);
    }

    const nextSections = customSections.filter((section) => section.key !== sectionKey);
    await saveWeddingField("custom_sections", nextSections);
  };

  const onDragEnd = async ({ active, over }) => {
    if (!editMode || !over || active.id === over.id) return;
    const oldIndex = ordered.findIndex((x) => x._id === active.id);
    const newIndex = ordered.findIndex((x) => x._id === over.id);
    const next = arrayMove(ordered, oldIndex, newIndex).map((x, i) => ({ ...x, order: i }));
    setOrdered(next);
    for (const program of next) {
      await saveProgram({ ...program, thumbnail: program.thumbnail }, program._id);
    }
    await queryClient.invalidateQueries({ queryKey: ["wedding", weddingId] });
  };

  const featuredProgram = ordered[0] || mainPrograms[0] || programs[0] || null;
  const featuredVideoUrl = useMemo(() => withPlayerParams(toEmbed(wedding?.hero_video_url || featuredProgram?.hero_video_url)), [wedding?.hero_video_url, featuredProgram?.hero_video_url]);
  const heroImage = wedding?.hero_image || wedding?.profile_image || featuredProgram?.thumbnail || getPlaceholder(wedding?.couple_names);
  const pageMusicUrl = wedding?.music_url || "";
  const firstProgramHref = featuredProgram ? `/weddings/${weddingId}/programs/${featuredProgram._id}` : "#programs";
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const matchesSearch = (program) => {
    if (!normalizedSearch) return true;
    return [program?.title, program?.event_date, program?.event_time, program?.venue_name, program?.event_address]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch));
  };

  const mainRailCards = (ordered.length ? ordered : mainPrograms).slice(0, 3).map((program, index) => ({
    item: program,
    href: `/weddings/${weddingId}/programs/${program._id}`,
    title: program.title || `Season ${index + 1}`,
    subtitle: program.event_date || program.venue_name || `Season ${index + 1}`,
  }));

  const mainRailSource = ordered.length ? ordered : (mainPrograms.length ? mainPrograms : programs);
  const mainRailCardsVisible = mainRailSource.slice(0, 3).map((program, index) => ({
    item: program,
    href: `/weddings/${weddingId}/programs/${program._id}`,
    title: program.title || `Season ${index + 1}`,
    subtitle: program.event_date || program.venue_name || `Season ${index + 1}`,
  })).filter((card) => matchesSearch(card.item));

  const [isMusicOn, setIsMusicOn] = useState(false);
  const audioRef = useRef(null);

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

  if (isLoading && !data) return <AsyncState mode="loading" />;
  if (error && !data) return <AsyncState mode="error" message={error.message} onRetry={() => refetch()} />;

  return (
    <section className="home-page home-page--detail">
      <audio ref={audioRef} src={pageMusicUrl} loop preload="auto" />

      {isLoading && !wedding && <AsyncState mode="loading" />}
      {error && !wedding && <AsyncState mode="error" message={error.message} onRetry={() => refetch()} />}

      {!isLoading && wedding && (
        <header className="home-hero">
          <div className={`home-hero__media ${featuredVideoUrl ? "has-video" : ""}`}>
            {featuredVideoUrl ? (
              <iframe
                className="home-hero__video"
                src={featuredVideoUrl}
                title="Wedding Hero"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <img className="home-hero__image" src={heroImage} alt={wedding.couple_names} />
            )}
            <div
              className="home-hero__mobile-art"
              style={{ backgroundImage: `url(${heroImage})` }}
              aria-hidden="true"
            />
            <div className="home-hero__shade" />
          </div>

          <div className="home-hero__content">
            <p className="home-hero__kicker">A WEDDING ORIGINAL</p>
            <InlineEditableText
              as="h1"
              className="home-hero__names"
              enabled={canEdit && editMode}
              value={wedding.couple_names}
              placeholder="Wedding Couple"
              onSave={(v) => saveWeddingField("couple_names", v)}
            />
            <div className="home-hero__headline">
              <span className="home-hero__badge">
                <strong>TOP</strong>
                <strong>10</strong>
              </span>
              <InlineEditableText
                as="h2"
                className=""
                enabled={canEdit && editMode}
                value={wedding.invitation_title || "#1 Love In Every Frame"}
                placeholder="#1 Love In Every Frame"
                onSave={(v) => saveWeddingField("invitation_title", v)}
              />
            </div>
            <p className="home-hero__description">
              {wedding.description || "A simple hello turned into a lifetime together. Through laughter, memories, and countless moments, their story found its way to forever."}
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
              <a href="#programs" className="home-btn home-btn--secondary">
                <span aria-hidden="true">ⓘ</span>
                More Info
              </a>
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
        <section className="home-rail" id="programs">
          <div className="home-rail__header">
            <InlineEditableText
              as="h2"
              className="home-rail__heading-editable"
              enabled={canEdit && editMode}
              value={wedding?.programs_section_title || "The Celebration Series"}
              placeholder="The Celebration Series"
              onSave={(v) => saveWeddingField("programs_section_title", v)}
            />
          </div>
          <div className="wedding-detail-search-wrap">
            <input
              className="search wedding-detail-search"
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search programs, dates, venues..."
              aria-label="Search wedding programs"
            />
          </div>
          {isLoading && mainRailCardsVisible.length === 0 ? (
            <Skeleton height={220} count={1} />
          ) : (
            <div className="home-rail__grid">
              {mainRailCardsVisible.map((card) => (
                <StaticRailPoster
                  key={card.item._id}
                  item={card.item}
                  href={card.href}
                  title={card.title}
                  subtitle={card.subtitle}
                  editMode={canEdit && editMode}
                  onEdit={(item) => setModal({ type: "edit", item, sectionKey: item.section_key || "main" })}
                  onDelete={deleteProgram}
                />
              ))}
              {canEdit && editMode && (
                <button type="button" className="add-card-tile" onClick={() => setModal({ type: "create", item: {}, sectionKey: "main" })}>
                  <span className="add-card-plus">+</span>
                  <span>Add Program</span>
                </button>
              )}
            </div>
          )}
        </section>

        {customSections.map((section, index) => {
          const sectionPrograms = (programsBySection[section.key] || [])
            .filter((program) => (program.section_key || "main") !== "main")
            .filter(matchesSearch);
          const sectionId = section.key || `custom-${index}`;
          return (
            <section className="home-rail" key={sectionId} id={sectionId}>
              <div className="home-rail__header">
                <InlineEditableText
                  as="h2"
                  className="home-rail__heading-editable"
                  enabled={canEdit && editMode}
                  value={section.label || `Custom Box ${index + 1}`}
                  placeholder={`Custom Box ${index + 1}`}
                  onSave={(v) => {
                    const next = customSections.map((item, idx) => (idx === index ? { ...item, label: v } : item));
                    return saveWeddingField("custom_sections", next);
                  }}
                />
                {canEdit && editMode && (
                  <button
                    type="button"
                    className="cms-fab danger home-rail__delete-box"
                    onClick={() => deleteCustomSection(section.key, section.label || `Custom Box ${index + 1}`)}
                  >
                    Delete Box
                  </button>
                )}
              </div>
              <div className="home-rail__grid">
                {sectionPrograms.map((card) => (
                  <StaticRailPoster
                    key={card._id}
                    item={card}
                    href={`/weddings/${weddingId}/programs/${card._id}`}
                    title={card.title || "Program"}
                    subtitle={card.event_date || card.venue_name || "Custom Box"}
                    editMode={canEdit && editMode}
                    onEdit={(item) => setModal({ type: "edit", item, sectionKey: item.section_key || section.key })}
                    onDelete={deleteProgram}
                  />
                ))}
                {canEdit && editMode && (
                  <button className="add-card-tile" onClick={() => setModal({ type: "create", item: {}, sectionKey: section.key })}>
                    <span className="add-card-plus">+</span>
                    <span>Add Program</span>
                  </button>
                )}
              </div>
            </section>
          );
        })}

        {canEdit && editMode && (
          <div className="home-admin-fab-row">
            <button type="button" className="cms-fab" onClick={() => setModal({ type: "create", item: {}, sectionKey: "main" })}>
              Add Program
            </button>
            <button
              type="button"
              className="add-card-tile add-card-tile--compact"
              onClick={async () => {
                const nextIdx = customSections.length + 1;
                const key = `custom_${Date.now()}`;
                const next = [...customSections, { key, label: `Custom Box ${nextIdx}` }];
                await saveWeddingField("custom_sections", next);
              }}
            >
              <span className="add-card-plus">+</span>
              <span>Add Custom Box</span>
            </button>
          </div>
        )}
      </div>

      {modal && (
        <div className="cms-modal-backdrop" onClick={() => setModal(null)}>
          <div className="cms-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{modal.type === "create" ? "Add Program" : "Edit Program"}</h3>
            <ProgramForm
              initial={modal.item}
              onCancel={() => setModal(null)}
              onSubmit={async (values) => {
                if (modal.type === "create") {
                  await createProgram(values, modal.sectionKey || "main");
                  return;
                }
                await saveProgram(values, modal.item._id);
                await queryClient.invalidateQueries({ queryKey: ["wedding", weddingId] });
                setModal(null);
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function ProgramForm({ initial, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    title: initial.title || "",
    thumbnail: initial.thumbnail || "",
    hero_video_url: initial.hero_video_url || "",
    event_date: initial.event_date || "",
    event_time: initial.event_time || "",
    venue_name: initial.venue_name || "",
    event_address: initial.event_address || "",
    music_url: initial.music_url || "",
    order: initial.order || 0,
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
          <span>Program Title</span>
          <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Haldi Ceremony" />
        </label>
        <label className="cms-field">
          <span>Thumbnail URL</span>
          <input value={form.thumbnail} onChange={(e) => setForm((p) => ({ ...p, thumbnail: e.target.value }))} placeholder="https://..." />
        </label>
        <label className="cms-field">
          <span>Hero Video URL</span>
          <input value={form.hero_video_url} onChange={(e) => setForm((p) => ({ ...p, hero_video_url: e.target.value }))} placeholder="https://youtube.com/watch?v=..." />
        </label>
        <label className="cms-field">
          <span>Event Date</span>
          <input value={form.event_date} onChange={(e) => setForm((p) => ({ ...p, event_date: e.target.value }))} placeholder="2026-12-04" />
        </label>
        <label className="cms-field">
          <span>Event Time</span>
          <input value={form.event_time} onChange={(e) => setForm((p) => ({ ...p, event_time: e.target.value }))} placeholder="07:30 PM" />
        </label>
        <label className="cms-field">
          <span>Venue Name</span>
          <input value={form.venue_name} onChange={(e) => setForm((p) => ({ ...p, venue_name: e.target.value }))} placeholder="Grand Palace" />
        </label>
        <label className="cms-field cms-field-wide">
          <span>Event Address</span>
          <input value={form.event_address} onChange={(e) => setForm((p) => ({ ...p, event_address: e.target.value }))} placeholder="Full venue address..." />
        </label>
        <label className="cms-field cms-field-wide">
          <span>Music URL</span>
          <input value={form.music_url} onChange={(e) => setForm((p) => ({ ...p, music_url: e.target.value }))} placeholder="https://cdn.example.com/song.mp3" />
        </label>
        <label className="cms-field">
          <span>Display Order</span>
          <input value={form.order} onChange={(e) => setForm((p) => ({ ...p, order: e.target.value }))} placeholder="0" />
        </label>
      </div>
      <div className="cms-form-actions">
        <button type="button" className="cms-fab" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="cms-fab">
          Save
        </button>
      </div>
    </form>
  );
}
