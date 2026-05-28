import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Skeleton from "react-loading-skeleton";
import { apiDelete, apiGet, apiPatch, apiPostForm } from "../api";
import ProgressiveImage from "../components/ProgressiveImage";
import VideoModal from "../components/VideoModal";
import { useEditMode } from "../components/EditModeContext";
import InlineEditableText from "../components/InlineEditableText";
import AsyncState from "../components/AsyncState";
import SeoHead from "../components/SeoHead";
import PhotoGalleryModal from "../components/PhotoGalleryModal";
import { preparePhotoForUpload, preparePhotosForUpload } from "../utils/imageUpload";

const noop = () => {};

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

const netflixLogoUrl = "https://images.icon-icons.com/2699/PNG/512/netflix_logo_icon_170919.png";

function EpisodeCard({ item, weddingId, programId, editMode, onEdit, onDelete, onPlay }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item._id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="cms-card-wrap">
      <Link
        to={`/weddings/${weddingId}/programs/${programId}/episodes/${item._id}`}
        className="home-poster program-card"
        onClick={(e) => {
          if (editMode) {
            e.preventDefault();
            return;
          }
          e.preventDefault();
          onPlay?.(item);
        }}
      >
        <ProgressiveImage src={item.thumbnail} alt={item.title} className="program-card__image" />
        <div className="home-poster__fade" />
        <div className="home-poster__content">
          <img src={netflixLogoUrl} alt="" aria-hidden="true" className="home-poster__logo" />
          <div className="home-poster__text">
            <h3 className="program-card__title">{item.title}</h3>
            <p className="program-card__subtitle">{item.description}</p>
          </div>
        </div>
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

export default function ProgramDetailPage({ onMusicUrlChange = noop }) {
  const { weddingId, programId } = useParams();
  const queryClient = useQueryClient();
  const { canEdit, editMode } = useEditMode();
  const [openVideo, setOpenVideo] = useState(false);
  const [activeEpisode, setActiveEpisode] = useState(null);
  const [episodeVideoOpen, setEpisodeVideoOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoEpisodeId, setPhotoEpisodeId] = useState("");
  const [photoUploadError, setPhotoUploadError] = useState("");
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [photoGalleryOpen, setPhotoGalleryOpen] = useState(false);
  const [isMusicOn, setIsMusicOn] = useState(() => localStorage.getItem("wedflix_music_on") !== "0");
  const audioRef = useRef(null);
  const pausedForVideoRef = useRef(false);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["program", weddingId, programId],
    queryFn: async () => {
      const [wedding, programs, episodes] = await Promise.all([
        apiGet(`/api/weddings/${weddingId}`),
        apiGet(`/api/weddings/${weddingId}/programs`),
        apiGet(`/api/programs/${programId}/episodes`),
      ]);
      const photoGroups = await Promise.all(
        episodes.map(async (episode) => {
          const photos = await apiGet(`/api/episodes/${episode._id}/photos`);
          return photos.map((photo) => ({
            ...photo,
            episode_title: episode.title || "Event",
          }));
        })
      );
      return { wedding, program: programs.find((p) => p._id === programId) || null, episodes, photos: photoGroups.flat() };
    },
  });
  const wedding = data?.wedding;
  const program = data?.program;
  const episodes = React.useMemo(() => data?.episodes || [], [data?.episodes]);
  const programPhotos = data?.photos || [];
  const visibleProgramPhotos = programPhotos.slice(0, 7);
  const hiddenProgramPhotoCount = Math.max(0, programPhotos.length - visibleProgramPhotos.length);
  const [ordered, setOrdered] = useState([]);
  React.useEffect(() => setOrdered(episodes), [episodes]);
  React.useEffect(() => {
    if (!photoEpisodeId && episodes[0]?._id) {
      setPhotoEpisodeId(episodes[0]._id);
    }
  }, [episodes, photoEpisodeId]);
  const filteredEpisodes = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return ordered;
    return ordered.filter((episode) => {
      const haystack = [
        episode.title,
        episode.description,
        episode.youtube_url,
        episode.video_provider,
        episode.season_number,
        episode.order,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [ordered, searchTerm]);
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.load();
    const saved = localStorage.getItem("wedflix_music_on");
    const shouldPlay = saved === "0" ? false : !!(program?.music_url || wedding?.music_url);
    setIsMusicOn(shouldPlay);
    if (shouldPlay && (program?.music_url || wedding?.music_url)) {
      audioRef.current.play().catch(() => {});
    }
  }, [program?.music_url, wedding?.music_url]);

  useEffect(() => {
    const pauseMusicForVideo = () => {
      if (!audioRef.current || !(program?.music_url || wedding?.music_url)) return;
      pausedForVideoRef.current = true;
      audioRef.current.pause();
    };
    const resumeMusicAfterVideo = () => {
      if (!audioRef.current || !(program?.music_url || wedding?.music_url) || !isMusicOn || !pausedForVideoRef.current) return;
      pausedForVideoRef.current = false;
      audioRef.current.play().catch(() => {});
    };
    window.addEventListener("wedflix-video-playing", pauseMusicForVideo);
    window.addEventListener("wedflix-video-stopped", resumeMusicAfterVideo);
    return () => {
      window.removeEventListener("wedflix-video-playing", pauseMusicForVideo);
      window.removeEventListener("wedflix-video-stopped", resumeMusicAfterVideo);
    };
  }, [program?.music_url, wedding?.music_url, isMusicOn]);
  React.useEffect(() => {
    onMusicUrlChange(program?.music_url || wedding?.music_url || "");
  }, [program?.music_url, wedding?.music_url, onMusicUrlChange]);

  const toggleMusic = async () => {
    if (!audioRef.current || !(program?.music_url || wedding?.music_url)) return;
    if (isMusicOn) {
      audioRef.current.pause();
      setIsMusicOn(false);
      localStorage.setItem("wedflix_music_on", "0");
      return;
    }
    try {
      await audioRef.current.play();
      setIsMusicOn(true);
      localStorage.setItem("wedflix_music_on", "1");
    } catch {
      setIsMusicOn(false);
      localStorage.setItem("wedflix_music_on", "0");
    }
  };

  const saveEpisode = async (values, episodeId) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(values)) {
      if (v === undefined || v === null) continue;
      if (k === "thumbnail_file" && v) {
        fd.append(k, await preparePhotoForUpload(v));
      } else {
        fd.append(k, v);
      }
    }
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
    for (const [k, v] of Object.entries(values)) {
      if (v === undefined || v === null) continue;
      if (k === "thumbnail_file" && v) {
        fd.append(k, await preparePhotoForUpload(v));
      } else {
        fd.append(k, v);
      }
    }
    await apiPostForm("/admin/episodes/create", fd);
    await queryClient.invalidateQueries({ queryKey: ["program", weddingId, programId] });
    setModal(null);
  };

  const deleteEpisode = async (item) => {
    if (!window.confirm(`Delete ${item.title}?`)) return;
    await apiPostForm(`/admin/episodes/${item._id}/delete`, new FormData());
    await queryClient.invalidateQueries({ queryKey: ["program", weddingId, programId] });
  };

  const uploadProgramPhotos = async (ev) => {
    ev.preventDefault();
    const formEl = ev.currentTarget;
    if (!photoEpisodeId || !photoFiles.length) return;
    const oversized = photoFiles.find((file) => file.size > 50 * 1024 * 1024);
    if (oversized) {
      setPhotoUploadError(`${oversized.name} is ${(oversized.size / (1024 * 1024)).toFixed(1)} MB. Please choose photos under 50 MB.`);
      return;
    }
    setPhotoUploadError("");
    setIsUploadingPhotos(true);
    try {
      const preparedPhotos = await preparePhotosForUpload(photoFiles);
      const fd = new FormData();
      preparedPhotos.forEach((file) => fd.append("photos", file));
      await apiPostForm(`/api/episodes/${photoEpisodeId}/photos`, fd);
      setPhotoFiles([]);
      formEl?.reset();
      await queryClient.invalidateQueries({ queryKey: ["program", weddingId, programId] });
    } catch (err) {
      const message = err?.message || "Photo upload failed. Please try again.";
      setPhotoUploadError(message);
    } finally {
      setIsUploadingPhotos(false);
    }
  };

  const updateProgramPhoto = async (photo, values) => {
    await apiPatch(`/api/photos/${photo._id}`, values);
    await queryClient.invalidateQueries({ queryKey: ["program", weddingId, programId] });
  };

  const deleteProgramPhoto = async (photo) => {
    await apiDelete(`/api/photos/${photo._id}`);
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
    <section className="home-page home-page--detail page-program-detail">
      <SeoHead
        title={program ? `${program.title} | ${wedding?.couple_names || "Wedflix"} | Wedflix` : "Wedflix | Wedding Program"}
        description={program?.event_date || program?.venue_name || "Watch wedding program highlights and events on Wedflix."}
        canonicalPath={program ? `/weddings/${weddingId}/programs/${programId}` : `/weddings/${weddingId}`}
        image={program?.thumbnail || wedding?.profile_image || `${window.location.origin}/favicon.svg`}
        type="article"
      />
      <audio ref={audioRef} src={program?.music_url || wedding?.music_url || ""} loop preload="auto" />
      <header className="home-hero page-program-hero">
        <div className={`home-hero__media ${toEmbed(program?.hero_video_url) || ordered[0]?.embed_url ? "has-video" : ""}`}>
          {(toEmbed(program?.hero_video_url) || ordered[0]?.embed_url) ? (
            <iframe
              className="home-hero__video"
              src={withPlayerParams(toEmbed(program?.hero_video_url) || ordered[0]?.embed_url)}
              title="Program Hero"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <ProgressiveImage
              src={program?.thumbnail || ordered[0]?.thumbnail || "https://picsum.photos/seed/program-hero/1200/800"}
              alt={program?.title || "Program"}
              className="home-hero__image"
            />
          )}
          <div className="home-hero__shade" />
        </div>
        <div className="home-hero__content page-program-hero__content">
          <p className="home-hero__kicker">{wedding?.couple_names || "Wedding Couple"}</p>
          <InlineEditableText
            as="h1"
            className="home-hero__names page-program-hero__title"
            enabled={canEdit && editMode}
            value={program?.title || "Program"}
            placeholder="Program"
            onSave={(v) => saveProgramField("title", v)}
          />
          <p className="home-hero__description">
            {program?.event_date || "Date TBD"}
          </p>
          <div className="home-hero__actions">
            {!!(toEmbed(program?.hero_video_url) || ordered[0]?.embed_url) && (
            <button
              type="button"
              className="home-btn home-btn--primary"
              onClick={() => {
                window.dispatchEvent(new Event("wedflix-video-playing"));
                setOpenVideo(true);
              }}
            >
              <span aria-hidden="true">▶</span>
              Play
            </button>
            )}
            <Link to={`/weddings/${weddingId}`} className="home-btn home-btn--secondary">
              <span aria-hidden="true">ⓘ</span>
              More Info
            </Link>
          </div>
        </div>
        <button
          type="button"
          className={`home-sound-toggle ${isMusicOn ? "is-on" : ""}`}
          onClick={toggleMusic}
          disabled={!(program?.music_url || wedding?.music_url)}
          title={program?.music_url || wedding?.music_url ? (isMusicOn ? "Music On" : "Music Off") : "No page music"}
        >
          <span aria-hidden="true">{isMusicOn ? "♪" : "♫"}</span>
        </button>
      </header>
      {error && <p className="error">{error.message}</p>}
      <div className="cms-row-head">
        <h2 className="section-title">Events</h2>
      </div>
      <div className="wedding-detail-search-wrap wedding-detail-search-wrap--events">
        <input
          className="search wedding-detail-search"
          type="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search events, videos, dates..."
          aria-label="Search program events"
        />
      </div>
      {isLoading && <Skeleton count={4} height={34} />}
      <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={filteredEpisodes.map((e) => e._id)} strategy={rectSortingStrategy}>
          <div className="grid">
            {filteredEpisodes.map((e) => (
              <EpisodeCard
                key={e._id}
                item={e}
                weddingId={weddingId}
                programId={programId}
                editMode={canEdit && editMode}
                onEdit={(item) => setModal({ type: "edit", item })}
                onDelete={deleteEpisode}
                onPlay={(item) => {
                  window.dispatchEvent(new Event("wedflix-video-playing"));
                  setActiveEpisode(item);
                  setEpisodeVideoOpen(true);
                }}
              />
            ))}
            {canEdit && editMode && (
              <button type="button" className="add-card-tile" onClick={() => setModal({ type: "create", item: {} })}>
                <span className="add-card-plus">+</span>
                <span>Add Event</span>
              </button>
            )}
          </div>
        </SortableContext>
      </DndContext>
      {!isLoading && filteredEpisodes.length === 0 && (
        <p className="empty-rail">No events matched your search.</p>
      )}

      <div className="episode-section-shell program-photo-gallery">
        <div className="cms-row-head">
          <h2 className="section-title">Photo Gallery</h2>
        </div>
        {canEdit && editMode && (
          <>
            <form onSubmit={uploadProgramPhotos} className="photo-upload-row">
              <select value={photoEpisodeId} onChange={(e) => setPhotoEpisodeId(e.target.value)} disabled={!episodes.length}>
                {episodes.map((episode) => (
                  <option key={episode._id} value={episode._id}>
                    {episode.title || "Untitled Event"}
                  </option>
                ))}
              </select>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setPhotoFiles(Array.from(e.target.files || []))}
              />
              <button type="submit" disabled={!photoEpisodeId || !photoFiles.length || isUploadingPhotos}>
                {isUploadingPhotos ? "Uploading..." : `Upload${photoFiles.length ? ` ${photoFiles.length}` : ""} Photos`}
              </button>
            </form>
            {photoUploadError && <p className="error">{photoUploadError}</p>}
          </>
        )}
        {programPhotos.length ? (
          <div className="program-gallery-diary" aria-label="Program photo gallery preview">
            <div className="program-gallery-diary__topline">
              <span>{programPhotos.length} photos</span>
              <button type="button" onClick={() => setPhotoGalleryOpen(true)}>View All</button>
            </div>
            <div className="program-gallery-diary__stage">
              {visibleProgramPhotos.map((photo, index) => (
                <div
                  key={photo._id}
                  className={`program-gallery-diary__card program-gallery-diary__card--${index}`}
                  onClick={() => setPhotoGalleryOpen(true)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setPhotoGalleryOpen(true);
                  }}
                >
                  <ProgressiveImage src={photo.url} alt={photo.caption || photo.episode_title || "Event photo"} className="program-gallery-diary__image" />
                  {index === 3 && (
                    <span className="program-gallery-diary__label">{photo.episode_title}</span>
                  )}
                  {index === visibleProgramPhotos.length - 1 && hiddenProgramPhotoCount > 0 && (
                    <span className="program-gallery-diary__more">+{hiddenProgramPhotoCount}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="program-gallery-diary__dots" aria-hidden="true">
              <span />
              <span />
            </div>
          </div>
        ) : (
          <p className="empty-rail">No photos uploaded in this program yet.</p>
        )}
      </div>

      <VideoModal open={openVideo} title={program?.title || "Event Video"} url={toEmbed(program?.hero_video_url) || ordered[0]?.embed_url} onClose={() => setOpenVideo(false)} />
      <PhotoGalleryModal
        open={photoGalleryOpen}
        title={program?.title ? `${program.title} Gallery` : "Photo Gallery"}
        photos={programPhotos}
        canManage={canEdit && editMode}
        onUpdatePhoto={updateProgramPhoto}
        onDeletePhoto={deleteProgramPhoto}
        onClose={() => setPhotoGalleryOpen(false)}
      />
      <VideoModal
        open={episodeVideoOpen}
        title={activeEpisode?.title || "Event Video"}
        url={activeEpisode?.embed_url || activeEpisode?.youtube_url || activeEpisode?.video_url || ""}
        onClose={() => {
          setEpisodeVideoOpen(false);
          setActiveEpisode(null);
        }}
      />
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
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    title: String(initial.title || ""),
    description: String(initial.description || ""),
    youtube_url: String(initial.youtube_url || ""),
    season_number: String(initial.season_number || 1),
    order: String(initial.order || 1),
    thumbnail: String(initial.thumbnail || ""),
    thumbnail_file: null,
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
          <span>Event Title</span>
          <input value={form.title ?? ""} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Sangeet Entry" />
        </label>
        <label className="cms-field">
          <span>YouTube URL</span>
          <input value={form.youtube_url ?? ""} onChange={(e) => setForm((p) => ({ ...p, youtube_url: e.target.value }))} placeholder="https://youtube.com/watch?v=..." />
        </label>
        <label className="cms-field cms-field-wide">
          <span>Thumbnail URL</span>
          <input value={form.thumbnail ?? ""} onChange={(e) => setForm((p) => ({ ...p, thumbnail: e.target.value }))} placeholder="https://..." />
        </label>
        <label className="cms-field cms-field-wide">
          <span>Thumbnail Photo</span>
          <input type="file" accept="image/*" onChange={(e) => setForm((p) => ({ ...p, thumbnail_file: e.target.files?.[0] || null }))} />
        </label>
        <label className="cms-field cms-field-wide">
          <span>Description</span>
          <textarea value={form.description ?? ""} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Write event details..." />
        </label>
        <label className="cms-field">
          <span>Season</span>
          <input value={form.season_number ?? "1"} onChange={(e) => setForm((p) => ({ ...p, season_number: e.target.value }))} placeholder="1" />
        </label>
        <label className="cms-field">
          <span>Display Order</span>
          <input value={form.order ?? "1"} onChange={(e) => setForm((p) => ({ ...p, order: e.target.value }))} placeholder="1" />
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
