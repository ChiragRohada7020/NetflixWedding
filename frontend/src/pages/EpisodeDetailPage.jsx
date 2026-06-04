import React, { Suspense } from "react";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Skeleton from "react-loading-skeleton";
import { Link, useParams } from "react-router-dom";
import { apiDelete, apiGet, apiPatch, apiPost, apiPostForm } from "../api";
import ProgressiveImage from "../components/ProgressiveImage";
import AsyncState from "../components/AsyncState";
import SeoHead from "../components/SeoHead";
import { useEditMode } from "../components/EditModeContext";
import PhotoGalleryModal from "../components/PhotoGalleryModal";
import { preparePhotosForUpload } from "../utils/imageUpload";

const netflixLogoUrl = "https://images.icon-icons.com/2699/PNG/512/netflix_logo_icon_170919.png";
const WedflixPlayer = React.lazy(() => import("../components/WedflixPlayer"));
const VideoModal = React.lazy(() => import("../components/VideoModal"));

function NextEventCard({ item, weddingId, programId, publicMode, onPlay }) {
  const weddingBasePath = publicMode ? `/share/${weddingId}` : `/weddings/${weddingId}`;
  return (
    <Link
      to={`${weddingBasePath}/programs/${programId}/episodes/${item._id}`}
      className="home-poster next-event-card"
      onClick={(e) => {
        e.preventDefault();
        onPlay?.(item);
      }}
    >
      <ProgressiveImage src={item.thumbnail || "https://picsum.photos/seed/next-event/800/450"} alt={item.title || "Next event"} className="next-event-card__image" />
      <div className="home-poster__fade" />
      <div className="home-poster__content">
        <img src={netflixLogoUrl} alt="" aria-hidden="true" className="home-poster__logo" />
        <div className="home-poster__text next-event-copy">
          <span className="next-event-kicker">Next Event</span>
          <h3>{item.title || "Untitled Episode"}</h3>
          {item.description && <p>{item.description}</p>}
        </div>
      </div>
    </Link>
  );
}

export default function EpisodeDetailPage({ publicMode = false }) {
  const { weddingId, programId, episodeId } = useParams();
  const weddingBasePath = publicMode ? `/share/${weddingId}` : `/weddings/${weddingId}`;
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [activeEpisode, setActiveEpisode] = useState(null);
  const [episodeVideoOpen, setEpisodeVideoOpen] = useState(false);
  const [photoFiles, setPhotoFiles] = useState([]);
  const [driveLink, setDriveLink] = useState("");
  const [photoUploadError, setPhotoUploadError] = useState("");
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [isImportingDrivePhotos, setIsImportingDrivePhotos] = useState(false);
  const [photoGalleryOpen, setPhotoGalleryOpen] = useState(false);
  const { canEdit, editMode } = useEditMode();
  const canManage = canEdit && !publicMode;
  const isEditing = canManage && editMode;
  const queryClient = useQueryClient();
  const watchedKey = `wedflix_watched_episodes_${programId}`;

  const { data, isLoading, isError, error: loadError, refetch } = useQuery({
    queryKey: ["episode", weddingId, programId, episodeId, publicMode ? "public" : "admin"],
    queryFn: async () => {
      const [episode, comments, programEpisodes, photos] = await Promise.all([
        apiGet(`/api/episodes/${episodeId}`),
        apiGet(`/api/episodes/${episodeId}/comments`),
        apiGet(`/api/programs/${programId}/episodes`),
        apiGet(`/api/episodes/${episodeId}/photos`),
      ]);
      return {
        episode,
        comments,
        programEpisodes,
        photos,
      };
    },
  });
  const episode = data?.episode;
  const comments = data?.comments || [];
  const photos = data?.photos || [];
  const visiblePhotos = photos.slice(0, 7);
  const hiddenPhotoCount = Math.max(0, photos.length - visiblePhotos.length);
  const programEpisodes = data?.programEpisodes || [];
  const watchedEpisodeIds = useMemo(() => {
    try {
      const list = JSON.parse(localStorage.getItem(watchedKey) || "[]");
      return new Set(Array.isArray(list) ? list : []);
    } catch {
      return new Set();
    }
  }, [watchedKey]);
  const nextEpisodes = useMemo(() => {
    const sorted = [...programEpisodes].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || String(a.title || "").localeCompare(String(b.title || "")));
    const currentIndex = sorted.findIndex((item) => item._id === episodeId);
    const next = currentIndex >= 0 ? [...sorted.slice(currentIndex + 1), ...sorted.slice(0, currentIndex)] : sorted;
    return next
      .filter((item) => item._id !== episodeId)
      .filter((item) => !watchedEpisodeIds.has(item._id))
      .slice(0, 6);
  }, [programEpisodes, episodeId, watchedEpisodeIds]);

  useEffect(() => {
    if (!episode?._id) return;
    try {
      const list = JSON.parse(localStorage.getItem(watchedKey) || "[]");
      const next = [episode._id, ...list.filter((id) => id !== episode._id)].slice(0, 50);
      localStorage.setItem(watchedKey, JSON.stringify(next));
    } catch {
      localStorage.setItem(watchedKey, JSON.stringify([episode._id]));
    }
    const list = JSON.parse(localStorage.getItem("continueWatching") || "[]");
    const next = [
      { id: episode._id, title: episode.title || "Event", at: Date.now() },
      ...list.filter((x) => x.id !== episode._id),
    ].slice(0, 8);
    localStorage.setItem("continueWatching", JSON.stringify(next));
  }, [episode, watchedKey]);

  const submitComment = async (ev) => {
    ev.preventDefault();
    if (!text.trim()) return;
    try {
      await apiPost(`/api/episodes/${episodeId}/comments`, { text });
      await queryClient.invalidateQueries({ queryKey: ["episode", episodeId] });
      setText("");
    } catch (e) {
      setError(e.message);
    }
  };

  const uploadPhotos = async (ev) => {
    ev.preventDefault();
    const formEl = ev.currentTarget;
    if (!photoFiles.length) return;
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
      await apiPostForm(`/api/episodes/${episodeId}/photos`, fd);
      setPhotoFiles([]);
      formEl?.reset();
      await queryClient.invalidateQueries({ queryKey: ["episode", weddingId, programId, episodeId] });
    } catch (err) {
      const message = err?.message || "Photo upload failed. Please try again.";
      setPhotoUploadError(message);
    } finally {
      setIsUploadingPhotos(false);
    }
  };

  const importDrivePhotos = async (ev) => {
    ev.preventDefault();
    if (!driveLink.trim()) return;
    setPhotoUploadError("");
    setIsImportingDrivePhotos(true);
    try {
      const result = await apiPost(`/api/episodes/${episodeId}/photos/import-drive`, { drive_url: driveLink.trim() });
      setDriveLink("");
      await queryClient.invalidateQueries({ queryKey: ["episode", weddingId, programId, episodeId] });
      if (!result?.imported) {
        setPhotoUploadError("No photos were imported from that Drive link.");
      }
    } catch (err) {
      const message = err?.message || "Drive import failed. Please check the link and try again.";
      setPhotoUploadError(message);
    } finally {
      setIsImportingDrivePhotos(false);
    }
  };

  const updatePhoto = async (photo, values) => {
    await apiPatch(`/api/photos/${photo._id}`, values);
    await queryClient.invalidateQueries({ queryKey: ["episode", weddingId, programId, episodeId] });
  };

  const deletePhoto = async (photo) => {
    queryClient.setQueryData(["episode", weddingId, programId, episodeId], (current) => {
      if (!current?.photos) return current;
      return { ...current, photos: current.photos.filter((item) => item._id !== photo._id) };
    });
    await apiDelete(`/api/photos/${photo._id}`);
    await queryClient.invalidateQueries({ queryKey: ["episode", weddingId, programId, episodeId] });
  };

  if (isLoading && !data) return <AsyncState mode="loading" />;
  if (isError && !data) return <AsyncState mode="error" message={loadError?.message} onRetry={() => refetch()} />;

  return (
    <section className="page-episode-detail">
      <SeoHead
        title={episode ? `${episode.title} | Wedflix` : "Wedflix | Episode"}
        description={episode?.description || "Watch wedding episodes, comments, and behind-the-scenes memories on Wedflix."}
        canonicalPath={episode ? `${weddingBasePath}/programs/${programId}/episodes/${episodeId}` : weddingBasePath}
        image={episode?.thumbnail || `${window.location.origin}/favicon.svg`}
        type="video.other"
      />
      <div className="episode-watch-shell">
        {episode && (
          <Suspense fallback={<AsyncState mode="loading" />}>
            <WedflixPlayer
              url={episode.embed_url || episode.video_url || episode.youtube_url}
              downloadUrl={episode.download_url || episode.video_download_url || ""}
              className="video-wrap video-watch-stage"
              onPlay={() => window.dispatchEvent(new Event("wedflix-video-playing"))}
            />
          </Suspense>
        )}
      </div>
      {isLoading && <Skeleton count={3} height={36} />}

      {error && <p className="error">{error}</p>}
      <Suspense fallback={null}>
        <VideoModal
          open={episodeVideoOpen}
          title={activeEpisode?.title || "Episode Video"}
          url={activeEpisode?.embed_url || activeEpisode?.youtube_url || activeEpisode?.video_url || ""}
          downloadUrl={activeEpisode?.download_url || activeEpisode?.video_download_url || ""}
          onClose={() => {
            setEpisodeVideoOpen(false);
            setActiveEpisode(null);
          }}
        />
      </Suspense>

      <div className="episode-section-shell">
        <div className="cms-row-head">
          <h2 className="section-title">Next Episodes</h2>
        </div>
        {nextEpisodes.length ? (
          <div className="next-events-rail">
            {nextEpisodes.map((item) => (
              <NextEventCard
                key={item._id}
                item={item}
                weddingId={weddingId}
                programId={programId}
                publicMode={publicMode}
                onPlay={(nextItem) => {
                  window.dispatchEvent(new Event("wedflix-video-playing"));
                  setActiveEpisode(nextItem);
                  setEpisodeVideoOpen(true);
                }}
              />
            ))}
          </div>
        ) : (
          <p className="empty-rail">No more unwatched events in this program yet.</p>
        )}
      </div>

      <div className="episode-section-shell">
        <div className="cms-row-head">
          <h2 className="section-title">Photo Gallery</h2>
        </div>
        {isEditing && (
          <>
            <form onSubmit={uploadPhotos} className="photo-upload-row">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setPhotoFiles(Array.from(e.target.files || []))}
              />
              <button type="submit" disabled={!photoFiles.length || isUploadingPhotos}>
                {isUploadingPhotos ? "Uploading..." : `Upload${photoFiles.length ? ` ${photoFiles.length}` : ""} Photos`}
              </button>
            </form>
            <form onSubmit={importDrivePhotos} className="photo-upload-row photo-drive-row">
              <input
                type="url"
                value={driveLink}
                onChange={(e) => setDriveLink(e.target.value)}
                placeholder="Paste Google Drive file or folder link"
                aria-label="Google Drive photo link"
              />
              <button type="submit" disabled={!driveLink.trim() || isImportingDrivePhotos}>
                {isImportingDrivePhotos ? "Importing..." : "Import From Drive"}
              </button>
            </form>
            {photoUploadError && <p className="error">{photoUploadError}</p>}
          </>
        )}
        {photos.length ? (
          <div className="program-gallery-diary" aria-label="Episode photo gallery preview">
            <div className="program-gallery-diary__topline">
              <span>{photos.length} photos</span>
              <button type="button" onClick={() => setPhotoGalleryOpen(true)}>View All</button>
            </div>
            <div className="program-gallery-diary__stage">
              {visiblePhotos.map((photo, index) => (
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
                  <ProgressiveImage src={photo.url} alt={photo.caption || episode?.title || "Episode photo"} className="program-gallery-diary__image" />
                  {index === 3 && (
                    <span className="program-gallery-diary__label">{episode?.title}</span>
                  )}
                  {index === visiblePhotos.length - 1 && hiddenPhotoCount > 0 && (
                    <span className="program-gallery-diary__more">+{hiddenPhotoCount}</span>
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
          <p className="empty-rail">No photos uploaded for this event yet.</p>
        )}
      </div>

      <div className="episode-section-shell">
        <h2 className="section-title">Comments</h2>
        {!publicMode && (
          <form onSubmit={submitComment} className="comment-row">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a memory..." />
            <button>Post</button>
          </form>
        )}
        <div>
          {comments.map((c) => (
            <div key={c._id} className="comment">
              <strong>{c.user_name}</strong>
              <p>{c.text}</p>
            </div>
          ))}
        </div>
      </div>
      <PhotoGalleryModal
        open={photoGalleryOpen}
        title={episode?.title ? `${episode.title} Gallery` : "Photo Gallery"}
        weddingId={weddingId}
        photos={photos}
        canManage={isEditing}
        onUpdatePhoto={updatePhoto}
        onDeletePhoto={deletePhoto}
        onClose={() => setPhotoGalleryOpen(false)}
      />
    </section>
  );
}
