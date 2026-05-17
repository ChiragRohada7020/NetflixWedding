import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Skeleton from "react-loading-skeleton";
import { apiGet, apiPostForm } from "../api";
import ProgressiveImage from "../components/ProgressiveImage";
import VideoModal from "../components/VideoModal";
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

function EpisodeCard({ item, weddingId, programId, editMode, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item._id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="cms-card-wrap">
      <Link to={`/weddings/${weddingId}/programs/${programId}/episodes/${item._id}`} className="card" onClick={(e) => editMode && e.preventDefault()}>
        <ProgressiveImage src={item.thumbnail} alt={item.title} />
        <h3>{item.title}</h3>
        <p>{item.description}</p>
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

export default function ProgramDetailPage({ onMusicUrlChange = () => {} }) {
  const { weddingId, programId } = useParams();
  const queryClient = useQueryClient();
  const { canEdit, editMode } = useEditMode();
  const [openVideo, setOpenVideo] = useState(false);
  const [modal, setModal] = useState(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["program", weddingId, programId],
    queryFn: async () => {
      const [wedding, programs, episodes] = await Promise.all([
        apiGet(`/api/weddings/${weddingId}`),
        apiGet(`/api/weddings/${weddingId}/programs`),
        apiGet(`/api/programs/${programId}/episodes`),
      ]);
      return { wedding, program: programs.find((p) => p._id === programId) || null, episodes };
    },
  });
  const wedding = data?.wedding;
  const program = data?.program;
  const episodes = data?.episodes || [];
  const [ordered, setOrdered] = useState([]);
  React.useEffect(() => setOrdered(episodes), [episodes]);
  React.useEffect(() => {
    onMusicUrlChange(program?.music_url || wedding?.music_url || "");
  }, [program?.music_url, wedding?.music_url, onMusicUrlChange]);

  const saveEpisode = async (values, episodeId) => {
    const fd = new FormData();
    Object.entries(values).forEach(([k, v]) => {
      if (v !== undefined && v !== null) fd.append(k, v);
    });
    await apiPostForm(`/admin/episodes/${episodeId}/update`, fd);
    setModal(null);
  };
  const saveProgramField = async (field, val) => {
    if (!program) return;
    const fd = new FormData();
    fd.append("title", field === "title" ? val : program.title || "");
    fd.append("thumbnail", program.thumbnail || "");
    fd.append("hero_video_url", program.hero_video_url || "");
    fd.append("event_date", field === "event_date" ? val : program.event_date || "");
    fd.append("event_time", program.event_time || "");
    fd.append("venue_name", program.venue_name || "");
    fd.append("event_address", program.event_address || "");
    fd.append("music_url", program.music_url || "");
    fd.append("order", program.order || 0);
    await apiPostForm(`/admin/programs/${programId}/update`, fd);
    await queryClient.invalidateQueries({ queryKey: ["program", weddingId, programId] });
  };

  const createEpisode = async (values) => {
    const fd = new FormData();
    fd.append("program_id", programId);
    Object.entries(values).forEach(([k, v]) => {
      if (v !== undefined && v !== null) fd.append(k, v);
    });
    await apiPostForm("/admin/episodes/create", fd);
    await queryClient.invalidateQueries({ queryKey: ["program", weddingId, programId] });
    setModal(null);
  };

  const deleteEpisode = async (item) => {
    if (!window.confirm(`Delete ${item.title}?`)) return;
    await apiPostForm(`/admin/episodes/${item._id}/delete`, new FormData());
    await queryClient.invalidateQueries({ queryKey: ["program", weddingId, programId] });
  };

  const onDragEnd = async ({ active, over }) => {
    if (!editMode || !over || active.id === over.id) return;
    const oldIndex = ordered.findIndex((x) => x._id === active.id);
    const newIndex = ordered.findIndex((x) => x._id === over.id);
    const next = arrayMove(ordered, oldIndex, newIndex).map((x, i) => ({ ...x, order: i + 1 }));
    setOrdered(next);
    for (const e of next) {
      await saveEpisode({ ...e, youtube_url: e.youtube_url || e.embed_url }, e._id);
    }
    await queryClient.invalidateQueries({ queryKey: ["program", weddingId, programId] });
  };

  if (isLoading && !data) return <AsyncState mode="loading" />;
  if (error && !data) return <AsyncState mode="error" message={error.message} onRetry={() => refetch()} />;

  return (
    <section className="page-program-detail">
      <header className="hero-netflix hero-program">
        {(toEmbed(program?.hero_video_url) || ordered[0]?.embed_url) && (
          <iframe className="hero-bg-video" src={withPlayerParams(toEmbed(program?.hero_video_url) || ordered[0]?.embed_url)} title="Program Hero" allowFullScreen />
        )}
        <div className="hero-overlay" />
        <div className="hero-content">
          <h2 className="hero-couple">{wedding?.couple_names || "Wedding Couple"}</h2>
          <InlineEditableText
            as="h1"
            enabled={canEdit && editMode}
            value={program?.title || "Program"}
            onSave={(v) => saveProgramField("title", v)}
          />
          <InlineEditableText
            as="p"
            enabled={canEdit && editMode}
            value={program?.event_date || "Date TBD"}
            onSave={(v) => saveProgramField("event_date", v)}
          />
          {!!(toEmbed(program?.hero_video_url) || ordered[0]?.embed_url) && <button className="play-btn" onClick={() => setOpenVideo(true)}>Play Fullscreen</button>}
        </div>
      </header>
      {error && <p className="error">{error.message}</p>}
      <div className="cms-row-head">
        <h2 className="section-title">Events</h2>
      </div>
      {isLoading && <Skeleton count={4} height={34} />}
      <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ordered.map((e) => e._id)} strategy={rectSortingStrategy}>
          <div className="grid">
            {ordered.map((e) => (
              <EpisodeCard
                key={e._id}
                item={e}
                weddingId={weddingId}
                programId={programId}
                editMode={canEdit && editMode}
                onEdit={(item) => setModal({ type: "edit", item })}
                onDelete={deleteEpisode}
              />
            ))}
            {canEdit && editMode && (
              <button className="add-card-tile" onClick={() => setModal({ type: "create", item: {} })}>
                <span className="add-card-plus">+</span>
                <span>Add Event</span>
              </button>
            )}
          </div>
        </SortableContext>
      </DndContext>
      <VideoModal open={openVideo} title={program?.title || "Event Video"} url={toEmbed(program?.hero_video_url) || ordered[0]?.embed_url} onClose={() => setOpenVideo(false)} />
      {modal && (
        <div className="cms-modal-backdrop" onClick={() => setModal(null)}>
          <div className="cms-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{modal.type === "create" ? "Add Event" : "Edit Event"}</h3>
            <EpisodeForm
              initial={modal.item}
              onCancel={() => setModal(null)}
              onSubmit={async (values) => {
                if (modal.type === "create") {
                  await createEpisode(values);
                  return;
                }
                await saveEpisode(values, modal.item._id);
                await queryClient.invalidateQueries({ queryKey: ["program", weddingId, programId] });
                setModal(null);
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function EpisodeForm({ initial, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    title: initial.title || "",
    description: initial.description || "",
    youtube_url: initial.youtube_url || "",
    season_number: initial.season_number || 1,
    order: initial.order || 1,
    thumbnail: initial.thumbnail || "",
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
          <span>Event Title</span>
          <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Sangeet Entry" />
        </label>
        <label className="cms-field">
          <span>YouTube URL</span>
          <input value={form.youtube_url} onChange={(e) => setForm((p) => ({ ...p, youtube_url: e.target.value }))} placeholder="https://youtube.com/watch?v=..." />
        </label>
        <label className="cms-field cms-field-wide">
          <span>Thumbnail URL</span>
          <input value={form.thumbnail} onChange={(e) => setForm((p) => ({ ...p, thumbnail: e.target.value }))} placeholder="https://..." />
        </label>
        <label className="cms-field cms-field-wide">
          <span>Description</span>
          <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Write event details..." />
        </label>
        <label className="cms-field">
          <span>Season</span>
          <input value={form.season_number} onChange={(e) => setForm((p) => ({ ...p, season_number: e.target.value }))} placeholder="1" />
        </label>
        <label className="cms-field">
          <span>Display Order</span>
          <input value={form.order} onChange={(e) => setForm((p) => ({ ...p, order: e.target.value }))} placeholder="1" />
        </label>
      </div>
      <div className="cms-form-actions">
        <button type="button" className="cms-fab" onClick={onCancel}>Cancel</button>
        <button type="submit" className="cms-fab">Save</button>
      </div>
    </form>
  );
}
