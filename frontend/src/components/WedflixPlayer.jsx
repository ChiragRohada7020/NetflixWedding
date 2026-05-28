import React, { useEffect, useRef, useState } from "react";
import ReactPlayer from "react-player";
import { apiUrl } from "../api";

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
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
