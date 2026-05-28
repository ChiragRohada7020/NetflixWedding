import React, { useState } from "react";
import { Blurhash } from "react-blurhash";
import { mediaUrl } from "../api";

const DEFAULT_HASH = "LEHV6nWB2yk8pyo0adR*.7kCMdnj";

export default function ProgressiveImage({ src, alt, className, hash = DEFAULT_HASH }) {
  const [loaded, setLoaded] = useState(false);
  const resolvedSrc = mediaUrl(src);

  return (
    <div className={`progressive ${className || ""}`}>
      {!loaded && (
        <div className="progressive-blur">
          <Blurhash hash={hash} width="100%" height="100%" resolutionX={32} resolutionY={32} punch={1} />
        </div>
      )}
      <img
        src={resolvedSrc}
        alt={alt}
        className={`progressive-img ${loaded ? "is-loaded" : ""}`}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
