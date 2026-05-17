import React, { useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Skeleton from "react-loading-skeleton";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { apiGet, apiPostForm } from "../api";
import ProgressiveImage from "../components/ProgressiveImage";
import { useEditMode } from "../components/EditModeContext";
import InlineEditableText from "../components/InlineEditableText";
import AsyncState from "../components/AsyncState";

const EMPTY_LIST = [];

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

function ProgramCard({ item, weddingId, editMode, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item._id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className="cms-card-wrap">
      <Link to={`/weddings/${weddingId}/programs/${item._id}`} className="card" onClick={(e) => editMode && e.preventDefault()}>
        <ProgressiveImage src={item.thumbnail} alt={item.title} />
        <h3>{item.title}</h3>
      </Link>
      {editMode && (
        <div className="cms-overlay-actions" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="cms-fab" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(item); }}>Edit</button>
          <button type="button" className="cms-fab danger" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(item); }}>Delete</button>
          <button type="button" className="cms-fab drag" onPointerDown={(e) => e.stopPropagation()} {...attributes} {...listeners}>Drag</button>
        </div>
      )}
    </div>
  );
}

export default function WeddingDetailPage({ onMusicUrlChange = () => {} }) {
  const { weddingId } = useParams();
  const queryClient = useQueryClient();
  const { canEdit, editMode } = useEditMode();
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null);
  const programsSectionRef = useRef(null);
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
  const programs = data?.programs ?? EMPTY_LIST;
  const mainPrograms = useMemo(() => programs.filter((p) => (p.section_key || "main") === "main"), [programs]);
  const customSections = useMemo(() => {
    const src = Array.isArray(wedding?.custom_sections) ? wedding.custom_sections : [];
    if (src.length) return src;
    if (wedding?.custom_section_label) return [{ key: "custom", label: wedding.custom_section_label }];
    return [{ key: "custom", label: "My Custom Box" }];
  }, [wedding?.custom_sections, wedding?.custom_section_label]);
  const programsBySection = useMemo(() => {
    const map = {};
    programs.forEach((p) => {
      const key = (p.section_key || "main").toLowerCase();
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    if (customSections.length && map.custom && !map[customSections[0].key]) {
      map[customSections[0].key] = map.custom;
    }
    return map;
  }, [programs, customSections]);
  const [ordered, setOrdered] = useState([]);

  React.useEffect(() => setOrdered(mainPrograms), [mainPrograms]);
  React.useEffect(() => {
    onMusicUrlChange(wedding?.music_url || "");
  }, [wedding?.music_url, onMusicUrlChange]);

  const filtered = useMemo(() => {
    const src = ordered.length ? ordered : mainPrograms;
    if (!q.trim()) return src;
    return src.filter((p) => (p.title || "").toLowerCase().includes(q.toLowerCase()));
  }, [ordered, mainPrograms, q]);

  const saveProgram = async (payload, programId) => {
    const fd = new FormData();
    Object.entries(payload).forEach(([k, v]) => fd.append(k, v || ""));
    await apiPostForm(`/admin/programs/${programId}/update`, fd);
    setModal(null);
  };
  const saveWeddingField = async (field, val) => {
    if (!wedding) return;
    const invitationTitle = field === "invitation_title" ? val : (wedding.invitation_title || "Wedding Invitation");
    const programsSectionTitle = field === "programs_section_title" ? val : (wedding.programs_section_title || "Wedding Programs");
    const customSectionsValue = field === "custom_sections" ? (Array.isArray(val) ? val : []) : customSections;
    const customSectionLabel = customSectionsValue[0]?.label || (wedding.custom_section_label || "My Custom Box");
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

  const onDragEnd = async ({ active, over }) => {
    if (!editMode || !over || active.id === over.id) return;
    const oldIndex = ordered.findIndex((x) => x._id === active.id);
    const newIndex = ordered.findIndex((x) => x._id === over.id);
    const next = arrayMove(ordered, oldIndex, newIndex).map((x, i) => ({ ...x, order: i }));
    setOrdered(next);
    for (const p of next) {
      await saveProgram({ ...p, thumbnail: p.thumbnail }, p._id);
    }
    await queryClient.invalidateQueries({ queryKey: ["wedding", weddingId] });
  };

  const addCustomSection = async () => {
    const nextIdx = customSections.length + 1;
    const key = `custom_${Date.now()}`;
    const next = [...customSections, { key, label: `Custom Box ${nextIdx}` }];
    await saveWeddingField("custom_sections", next);
  };

  const renameCustomSection = async (sectionKey, label) => {
    const next = customSections.map((s) => (s.key === sectionKey ? { ...s, label } : s));
    await saveWeddingField("custom_sections", next);
  };

  const deleteCustomSection = async (sectionKey) => {
    const next = customSections.filter((s) => s.key !== sectionKey);
    await saveWeddingField("custom_sections", next.length ? next : [{ key: "custom", label: "My Custom Box" }]);
  };

  if (isLoading && !data) return <AsyncState mode="loading" />;
  if (error && !data) return <AsyncState mode="error" message={error.message} onRetry={() => refetch()} />;

  return (
    <section className="page-wedding-detail">
      {wedding && (
        <header className="hero-netflix">
          {toEmbed(wedding.hero_video_url) && (
            <iframe className="hero-bg-video" src={withPlayerParams(toEmbed(wedding.hero_video_url))} title="Wedding Hero" allowFullScreen />
          )}
          <div className="hero-overlay" />
          <div className="hero-content">
            <InlineEditableText
              as="h1"
              className=""
              enabled={canEdit && editMode}
              value={wedding.couple_names}
              onSave={(v) => saveWeddingField("couple_names", v)}
            />
            <InlineEditableText
              as="h2"
              className="hero-title-block"
              enabled={canEdit && editMode}
              value={wedding.invitation_title || "Wedding Invitation"}
              onSave={(v) => saveWeddingField("invitation_title", v)}
            />
            <button
              type="button"
              className="hero-cta-btn"
              onClick={() => programsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              ▶ Play Wedding
            </button>
          </div>
        </header>
      )}
      <input className="search" placeholder="Search Programs" value={q} onChange={(e) => setQ(e.target.value)} />
      {error && <p className="error">{error.message}</p>}
      <>
          <div className="cms-row-head" ref={programsSectionRef}>
            <InlineEditableText
              as="h2"
              className="section-title"
              enabled={canEdit && editMode}
              value={wedding?.programs_section_title || "Wedding Programs"}
              placeholder="Programs section name"
              onSave={(v) => saveWeddingField("programs_section_title", v)}
            />
          </div>
          {isLoading && <Skeleton count={3} height={48} />}
          <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={filtered.map((p) => p._id)} strategy={rectSortingStrategy}>
              <div className="grid">
                {filtered.map((p) => (
                  <ProgramCard
                    key={p._id}
                    item={p}
                    weddingId={weddingId}
                    editMode={canEdit && editMode}
                    onEdit={(item) => setModal({ type: "edit", item, sectionKey: item.section_key || "main" })}
                    onDelete={deleteProgram}
                  />
                ))}
                {canEdit && editMode && (
                  <button className="add-card-tile" onClick={() => setModal({ type: "create", item: {}, sectionKey: "main" })}>
                    <span className="add-card-plus">+</span>
                    <span>Add Program</span>
                  </button>
                )}
              </div>
            </SortableContext>
          </DndContext>
          <>
            {customSections.map((section) => (
              <React.Fragment key={section.key}>
                <div className="cms-row-head">
                  <InlineEditableText
                    as="h2"
                    className="section-title"
                    enabled={canEdit && editMode}
                    value={section.label || "My Custom Box"}
                    placeholder="Section name"
                    onSave={(v) => renameCustomSection(section.key, v)}
                  />
                  {canEdit && editMode && (
                    <button type="button" className="cms-fab danger" onClick={() => deleteCustomSection(section.key)}>Delete Box</button>
                  )}
                </div>
                <div className="custom-blocks">
                  {(programsBySection[section.key] || []).map((p) => (
                    <ProgramCard
                      key={p._id}
                      item={p}
                      weddingId={weddingId}
                      editMode={canEdit && editMode}
                      onEdit={(item) => setModal({ type: "edit", item, sectionKey: section.key })}
                      onDelete={deleteProgram}
                    />
                  ))}
                  {canEdit && editMode && (
                    <button className="add-card-tile custom-add-tile" onClick={() => setModal({ type: "create", item: {}, sectionKey: section.key })}>
                      <span className="add-card-plus">+</span>
                      <span>Add Program</span>
                    </button>
                  )}
                </div>
              </React.Fragment>
            ))}
            {canEdit && editMode && (
              <div className="custom-blocks">
                <button className="add-card-tile custom-add-tile" onClick={addCustomSection}>
                  <span className="add-card-plus">+</span>
                  <span>Add Custom Box</span>
                </button>
              </div>
            )}
          </>
      </>
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
        <button type="button" className="cms-fab" onClick={onCancel}>Cancel</button>
        <button type="submit" className="cms-fab">Save</button>
      </div>
    </form>
  );
}
