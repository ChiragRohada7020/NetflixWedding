import React from "react";

export default function AsyncState({ mode = "loading", title, message, onRetry }) {
  return (
    <div className={`async-state ${mode === "error" ? "is-error" : ""}`}>
      <div className="async-orb" />
      <h2>{title || (mode === "error" ? "Connection Lost" : "Loading Memories...")}</h2>
      <p>{message || (mode === "error" ? "Server is waking up. Please retry in a moment." : "Preparing your wedding moments in cinematic style.")}</p>
      {mode === "loading" && <div className="async-shimmer" />}
      {mode === "error" && (
        <button type="button" className="cms-fab" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
