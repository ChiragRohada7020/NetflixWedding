import React, { useState } from "react";
import { mediaUrl } from "../api";

export default function LazyHeroVideo({ src, title, poster, alt = "", className = "home-hero__video", isShort = false }) {
  const [frameLoaded, setFrameLoaded] = useState(false);
  const resolvedPoster = mediaUrl(poster);

  if (!src) {
    return <img className="home-hero__image" src={resolvedPoster} alt={alt} loading="eager" decoding="async" />;
  }

  return (
    <>
      {poster && (
        <img
          className={`home-hero__image home-hero__poster ${frameLoaded ? "is-hidden" : ""}`}
          src={resolvedPoster}
          alt={alt}
          loading="eager"
          decoding="async"
          fetchpriority="high"
        />
      )}
      <iframe
        className={`${className} ${isShort ? "is-short" : ""} ${frameLoaded ? "is-loaded" : ""}`}
        src={src}
        title={title}
        loading="eager"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        onLoad={() => setFrameLoaded(true)}
      />
    </>
  );
}
