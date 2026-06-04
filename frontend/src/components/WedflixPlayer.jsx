import React, { useEffect, useRef, useState } from "react";
import ReactPlayer from "react-player";
import { apiUrl } from "../api";

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function isYouTubeUrl(url = "") {
  return /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i.test(url);
}

function publicYouTubeUrl(url = "") {
  const match = String(url).match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? `https://www.youtube.com/watch?v=${match[1]}` : url;
}

export default function WedflixPlayer({
  url,
  autoPlay = true,
  onPlay,
  onPause,
  className = "",
}) {
  const playerUrl = apiUrl(url);
  const playerRef = useRef(null);
  const [playing, setPlaying] = useState(autoPlay);
  const [duration, setDuration] = useState(0);
  const [playedSeconds, setPlayedSeconds] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [showCover, setShowCover] = useState(true);

  useEffect(() => {
    setIsReady(false);
    setShowCover(true);
    setPlaying(autoPlay);
  }, [url]);

  useEffect(() => {
    if (!isReady) return;
    const timer = setTimeout(() => setShowCover(false), 150);
    return () => clearTimeout(timer);
  }, [isReady]);

  const seekTo = (value) => {
    const player = playerRef.current;
    if (!player) return;
    const next = Math.min(Math.max(Number(value) || 0, 0), duration || Number(value) || 0);
    player.seekTo(next, "seconds");
    setPlayedSeconds(next);
  };
  const progressPercent = duration ? Math.min(100, Math.max(0, (playedSeconds / duration) * 100)) : 0;
  const shareUrl = isYouTubeUrl(url) ? publicYouTubeUrl(url) : playerUrl;
  const canDownload = Boolean(playerUrl && !isYouTubeUrl(url));

  const shareVideoLink = async () => {
    if (!shareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Wedflix video", text: "Watch this video on Wedflix.", url: shareUrl });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      window.alert("Video link copied.");
    } catch {
      window.prompt("Copy this video link", shareUrl);
    }
  };

  const downloadVideo = () => {
    if (!canDownload) return;
    const separator = playerUrl.includes("?") ? "&" : "?";
    const link = document.createElement("a");
    link.href = `${playerUrl}${separator}download=1`;
    link.download = "wedflix-video";
    link.rel = "noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className={`wedflix-player ${className}`.trim()}>
      <div className="wedflix-player-surface">
        <ReactPlayer
          ref={playerRef}
          url={playerUrl}
          playing={playing}
          controls={false}
          width="100%"
          height="100%"
          config={{
            youtube: {
              playerVars: {
                autoplay: 1,
                modestbranding: 1,
                rel: 0,
                iv_load_policy: 3,
                fs: 0,
                disablekb: 1,
                playsinline: 1,
                vq: "hd1080",
              },
            },
          }}
          onPlay={() => {
            setPlaying(true);
            setShowCover(false);
            onPlay?.();
          }}
          onPause={() => {
            setPlaying(false);
            onPause?.();
          }}
          onReady={() => {
            setIsReady(true);
            if (autoPlay) {
              setPlaying(true);
            }
          }}
          onProgress={({ playedSeconds: current }) => setPlayedSeconds(current)}
          onDuration={(value) => setDuration(value)}
        />
        {showCover && (
          <div className="wedflix-player-cover" aria-hidden="true">
            <span className="wedflix-player-cover-brand">WEDFLIX</span>
            <span className="wedflix-player-cover-text">Loading video</span>
          </div>
        )}
        <div className="wedflix-player-top-mask" aria-hidden="true" />
        <div className="wedflix-player-chrome-mask" aria-hidden="true" />
      </div>
      <div className="wedflix-player-controls">
        <div className="wedflix-player-actions">
          <button type="button" onClick={shareVideoLink} disabled={!shareUrl}>
            Share Link
          </button>
          {isYouTubeUrl(url) ? (
            <a href={shareUrl} target="_blank" rel="noreferrer">
              Open YouTube
            </a>
          ) : (
            <button type="button" onClick={downloadVideo} disabled={!canDownload}>
              Download
            </button>
          )}
        </div>
        <div className="wedflix-player-progress">
          <input
            type="range"
            min="0"
            max={duration || 0}
            step="0.1"
            value={Math.min(playedSeconds, duration || playedSeconds || 0)}
            style={{ "--progress": `${progressPercent}%` }}
            onChange={(e) => seekTo(e.target.value)}
            aria-label="Video progress"
          />
          <div className="wedflix-player-time">
            <span>{formatTime(playedSeconds)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
