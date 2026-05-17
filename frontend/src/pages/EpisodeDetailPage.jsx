import React from "react";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Swiper, SwiperSlide } from "swiper/react";
import Skeleton from "react-loading-skeleton";
import ReactPlayer from "react-player";
import { useParams } from "react-router-dom";
import { apiGet, apiPost } from "../api";
import "swiper/css";
import VideoModal from "../components/VideoModal";
import ProgressiveImage from "../components/ProgressiveImage";
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
  return `${url}${joiner}autoplay=1&mute=1&controls=0&loop=1${loopParams}&playsinline=1`;
}

export default function EpisodeDetailPage() {
  const { weddingId, programId, episodeId } = useParams();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [openVideo, setOpenVideo] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error: loadError, refetch } = useQuery({
    queryKey: ["episode", weddingId, programId, episodeId],
    queryFn: async () => {
      const [episode, photos, comments, wedding] = await Promise.all([
        apiGet(`/api/episodes/${episodeId}`),
        apiGet(`/api/episodes/${episodeId}/photos`),
        apiGet(`/api/episodes/${episodeId}/comments`),
        apiGet(`/api/weddings/${weddingId}`),
      ]);
      return { episode, photos, comments, wedding };
    },
  });
  const episode = data?.episode;
  const photos = data?.photos || [];
  const comments = data?.comments || [];
  const wedding = data?.wedding;

  useEffect(() => {
    if (!episode?._id) return;
    const list = JSON.parse(localStorage.getItem("continueWatching") || "[]");
    const next = [
      { id: episode._id, title: episode.title || "Event", at: Date.now() },
      ...list.filter((x) => x.id !== episode._id),
    ].slice(0, 8);
    localStorage.setItem("continueWatching", JSON.stringify(next));
  }, [episode]);

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
    <section>
      {episode && (
        <>
          <div className="video-wrap">
            <ReactPlayer
              url={episode.embed_url}
              controls
              playing
              width="100%"
              height="100%"
              onPlay={() => window.dispatchEvent(new Event("wedflix-video-playing"))}
            />
          </div>
          <button className="play-btn" onClick={() => setOpenVideo(true)}>Play Event Video</button>
          <h1>{episode.title}</h1>
          <p>{episode.description}</p>
        </>
      )}
      {isLoading && <Skeleton count={3} height={36} />}

      {error && <p className="error">{error}</p>}

      <h2>Gallery</h2>
      <Swiper spaceBetween={12} slidesPerView={1.2} breakpoints={{ 640: { slidesPerView: 2 }, 1024: { slidesPerView: 3 } }}>
        {photos.map((p) => (
          <SwiperSlide key={p._id}>
            <ProgressiveImage src={p.image_url} alt="memory" className="photo" />
          </SwiperSlide>
        ))}
      </Swiper>

      <h2>Comments</h2>
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
      <VideoModal open={openVideo} url={episode?.embed_url} title={episode?.title} onClose={() => setOpenVideo(false)} />
    </section>
  );
}
