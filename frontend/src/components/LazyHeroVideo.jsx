import React, { useEffect, useState } from "react";

export default function LazyHeroVideo({ src, title, poster, alt = "", className = "home-hero__video" }) {
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);

  useEffect(() => {
    if (!src) return;
    const load = () => setShouldLoadVideo(true);
    const idleId = "requestIdleCallback" in window
      ? window.requestIdleCallback(load, { timeout: 1800 })
      : window.setTimeout(load, 1400);

    window.addEventListener("pointerdown", load, { once: true });
    window.addEventListener("keydown", load, { once: true });

    return () => {
      if ("cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      } else {
        window.clearTimeout(idleId);
      }
      window.removeEventListener("pointerdown", load);
      window.removeEventListener("keydown", load);
    };
  }, [src]);

  if (!src || !shouldLoadVideo) {
    return <img className="home-hero__image" src={poster} alt={alt} loading="eager" decoding="async" />;
  }

  return (
    <iframe
      className={className}
      src={src}
      title={title}
      loading="lazy"
      allow="autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
    />
  );
}
