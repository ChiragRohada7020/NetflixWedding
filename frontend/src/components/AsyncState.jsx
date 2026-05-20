import React from "react";

export default function AsyncState({ mode = "loading", title, message, onRetry }) {
  if (mode === "loading") {
    return (
      <div className="async-state async-state--loading" aria-label="Loading">
        <div className="async-spinner" />
      </div>
    );
  }

  return (
    <div className={`async-state ${mode === "error" ? "is-error" : ""}`}>
      <div className="async-stage">
        <div className="async-orb" />
        <div className="async-ring async-ring-a" />
        <div className="async-ring async-ring-b" />
      </div>
      <div className="async-copy">
        <p className="async-kicker">{mode === "error" ? "Signal Interrupted" : "Wedflix Sequence"}</p>
        <h2>{title || "Connection Lost"}</h2>
        <p>{message || "Server is waking up. Please retry in a moment."}</p>
      </div>
      <button type="button" className="cms-fab" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
