import React, { useEffect, useState } from "react";
import { Blurhash } from "react-blurhash";
import { mediaUrl } from "../api";

const DEFAULT_HASH = "LEHV6nWB2yk8pyo0adR*.7kCMdnj";

export default function ProgressiveImage({
  src,
  alt,
  className,
  hash = DEFAULT_HASH,
  loading = "lazy",
  fetchPriority,
  sizes = "(max-width: 640px) 46vw, (max-width: 1100px) 30vw, 220px",
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const resolvedSrc = mediaUrl(src);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [resolvedSrc]);

  return (
    <div className={`progressive ${className || ""} ${failed ? "is-failed" : ""}`}>
      {!loaded && !failed && (
        <div className="progressive-blur">
          <Blurhash hash={hash} width="100%" height="100%" resolutionX={32} resolutionY={32} punch={1} />
        </div>
      )}
      <img
        src={resolvedSrc}
        alt={alt}
        className={`progressive-img ${loaded ? "is-loaded" : ""}`}
        loading={loading}
        decoding="async"
        fetchPriority={fetchPriority || (loading === "eager" ? "high" : "auto")}
        sizes={sizes}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
