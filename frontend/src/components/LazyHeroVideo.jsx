import React, { useState } from "react";

export default function LazyHeroVideo({ src, title, poster, alt = "", className = "home-hero__video" }) {
  const [frameLoaded, setFrameLoaded] = useState(false);

  if (!src) {
    return <img className="home-hero__image" src={poster} alt={alt} loading="eager" decoding="async" />;
  }

  return (
    <>
      {poster && (
        <img
          className={`home-hero__image home-hero__poster ${frameLoaded ? "is-hidden" : ""}`}
          src={poster}
          alt={alt}
          loading="eager"
          decoding="async"
          fetchpriority="high"
        />
      )}
      <iframe
        className={`${className} ${frameLoaded ? "is-loaded" : ""}`}
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
