import React from "react";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Skeleton from "react-loading-skeleton";
import { Link, useParams } from "react-router-dom";
import { apiGet, apiPost } from "../api";
import ProgressiveImage from "../components/ProgressiveImage";
import AsyncState from "../components/AsyncState";
import WedflixPlayer from "../components/WedflixPlayer";
import VideoModal from "../components/VideoModal";
import SeoHead from "../components/SeoHead";

const netflixLogoUrl = "https://images.icon-icons.com/2699/PNG/512/netflix_logo_icon_170919.png";

const requestFullscreenFromClick = async () => {
  if (document.fullscreenElement) return;
  try {
    await document.documentElement.requestFullscreen();
  } catch {
    // Browsers may reject fullscreen if the gesture context is lost.
  }
};

function NextEventCard({ item, weddingId, programId, onPlay }) {
  return (
    <Link
      to={`/weddings/${weddingId}/programs/${programId}/episodes/${item._id}`}
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
          <h3>{item.title || "Untitled Event"}</h3>
          {item.description && <p>{item.description}</p>}
        </div>
      </div>
    </Link>
  );
}

export default function EpisodeDetailPage() {
  const { weddingId, programId, episodeId } = useParams();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [activeEpisode, setActiveEpisode] = useState(null);
  const [episodeVideoOpen, setEpisodeVideoOpen] = useState(false);
  const queryClient = useQueryClient();
  const watchedKey = `wedflix_watched_episodes_${programId}`;

  const { data, isLoading, isError, error: loadError, refetch } = useQuery({
    queryKey: ["episode", weddingId, programId, episodeId],
    queryFn: async () => {
      const [episode, comments, programEpisodes] = await Promise.all([
        apiGet(`/api/episodes/${episodeId}`),
        apiGet(`/api/episodes/${episodeId}/comments`),
        apiGet(`/api/programs/${programId}/episodes`),
      ]);
      return {
        episode,
        comments,
        programEpisodes,
      };
    },
  });
  const episode = data?.episode;
  const comments = data?.comments || [];
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

  if (isLoading && !data) return <AsyncState mode="loading" />;
  if (isError && !data) return <AsyncState mode="error" message={loadError?.message} onRetry={() => refetch()} />;

  return (
    <section className="page-episode-detail">
      <SeoHead
        title={episode ? `${episode.title} | Wedflix` : "Wedflix | Episode"}
        description={episode?.description || "Watch wedding episodes, comments, and behind-the-scenes memories on Wedflix."}
        canonicalPath={episode ? `/weddings/${weddingId}/programs/${programId}/episodes/${episodeId}` : `/weddings/${weddingId}`}
        image={episode?.thumbnail || `${window.location.origin}/favicon.svg`}
        type="video.other"
      />
      <div className="episode-watch-shell">
        {episode && (
          <>
            <WedflixPlayer
              url={episode.embed_url}
              className="video-wrap video-watch-stage"
              onPlay={() => window.dispatchEvent(new Event("wedflix-video-playing"))}
            />
          </>
        )}
      </div>
      {isLoading && <Skeleton count={3} height={36} />}

      {error && <p className="error">{error}</p>}
      <VideoModal
        open={episodeVideoOpen}
        title={activeEpisode?.title || "Event Video"}
        url={activeEpisode?.embed_url || activeEpisode?.youtube_url || activeEpisode?.video_url || ""}
        onClose={() => {
          setEpisodeVideoOpen(false);
          setActiveEpisode(null);
        }}
      />

      <div className="episode-section-shell">
        <div className="cms-row-head">
          <h2 className="section-title">Next Events</h2>
        </div>
        {nextEpisodes.length ? (
          <div className="next-events-rail">
            {nextEpisodes.map((item) => (
              <NextEventCard
                key={item._id}
                item={item}
                weddingId={weddingId}
                programId={programId}
                onPlay={(nextItem) => {
                  requestFullscreenFromClick();
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
        <h2 className="section-title">Comments</h2>
        <form onSubmit={submitComment} className="comment-row">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a memory..." />
          <button>Post</button>
        </form>
        <div>
          {comments.map((c) => (
            <div key={c._id} className="comment">
              <strong>{c.user_name}</strong>
              <p>{c.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
