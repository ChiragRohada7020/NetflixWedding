import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useEditMode } from "./EditModeContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "../api";

export default function Navbar({ musicUrl }) {
  const { canEdit, editMode, toggleEditMode, cardSize, setCardSize } = useEditMode();
  const audioRef = useRef(null);
  const [isMusicOn, setIsMusicOn] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [musicError, setMusicError] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const apiHost = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
  const queryClient = useQueryClient();
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: () => apiGet("/api/session"),
    retry: false,
  });
  const [backendAuthOk, setBackendAuthOk] = useState(() => localStorage.getItem("wedflix_backend_auth_ok") === "1");
  const isAuthenticated = !!session?.authenticated || backendAuthOk;

  const normalizedMusicUrl = (musicUrl || "").trim();
  const resolvedMusicUrl = normalizedMusicUrl
    ? (/^https?:\/\//i.test(normalizedMusicUrl) ? normalizedMusicUrl : `${apiHost}${normalizedMusicUrl.startsWith("/") ? "" : "/"}${normalizedMusicUrl}`)
    : "";

  useEffect(() => {
    if (!resolvedMusicUrl) {
      setIsMusicOn(false);
      return;
    }
    // Try to auto-start whenever a valid page music URL becomes available.
    setIsMusicOn(true);
  }, [resolvedMusicUrl]);

  useEffect(() => {
    if (!audioRef.current) return;
    setMusicError("");
    audioRef.current.pause();
    audioRef.current.load();
    if (isMusicOn && resolvedMusicUrl) {
      audioRef.current.play().catch((err) => {
        setMusicError(err?.message || "Autoplay blocked by browser. Click music icon once.");
      });
    }
  }, [resolvedMusicUrl, isMusicOn]);

  useEffect(() => {
    const stopBgMusic = () => {
      if (!audioRef.current) return;
      audioRef.current.pause();
      setIsMusicOn(false);
    };
    window.addEventListener("wedflix-video-playing", stopBgMusic);
    return () => window.removeEventListener("wedflix-video-playing", stopBgMusic);
  }, []);

  const toggleMusic = async () => {
    if (!audioRef.current || !resolvedMusicUrl) return;
    if (isMusicOn) {
      audioRef.current.pause();
      setIsMusicOn(false);
      setMusicError("");
      return;
    }
    try {
      await audioRef.current.play();
      setIsMusicOn(true);
      setMusicError("");
    } catch {
      setIsMusicOn(false);
      setMusicError("Audio could not play. Use a direct public .mp3/.wav/.ogg URL.");
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
      setIsFullscreen(!!document.fullscreenElement);
    } catch {
      // Ignore browser restriction errors.
    }
  };

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const handleAuthClick = async () => {
    if (isAuthenticated) {
      await apiPost("/api/session/logout", {});
      localStorage.setItem("wedflix_backend_auth_ok", "0");
      setBackendAuthOk(false);
      window.dispatchEvent(new Event("wedflix-auth-changed"));
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      return;
    }
    setAuthError("");
    setShowLogin(true);
  };

  const submitLogin = async (e) => {
    e.preventDefault();
    if (!authForm.email.trim() || !authForm.password.trim()) {
      setAuthError("Email and password are required.");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    try {
      const loginRes = await apiPost("/api/session/login", { email: authForm.email.trim(), password: authForm.password });
      if (!loginRes?.authenticated || !loginRes?.is_admin) {
        setAuthError("Login succeeded partially. Please try once more.");
        return;
      }
      localStorage.setItem("wedflix_backend_auth_ok", "1");
      setBackendAuthOk(true);
      window.dispatchEvent(new Event("wedflix-auth-changed"));
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      setShowLogin(false);
      setAuthForm({ email: "", password: "" });
    } catch (e) {
      setAuthError(e.message || "Login failed");
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <nav className="nav">
      <audio
        ref={audioRef}
        src={resolvedMusicUrl}
        loop
        preload="auto"
        onError={() => setMusicError("Audio failed to load. Use a direct public audio file URL (Cloudinary raw/video URL).")}
      />
      <Link to="/" className="brand">Wedflix</Link>
      <div className="nav-actions">
        {canEdit && (
          <button className={`music-pill ${editMode ? "edit-on" : ""}`} type="button" onClick={toggleEditMode}>
            <span className="pill-icon" aria-hidden="true">✎</span>
            {editMode ? "Edit Mode On" : "Edit Mode Off"}
          </button>
        )}
        {canEdit && editMode && (
          <select className="music-pill size-select" value={cardSize} onChange={(e) => setCardSize(e.target.value)}>
            <option value="small">Small Cards</option>
            <option value="medium">Medium Cards</option>
            <option value="large">Large Cards</option>
          </select>
        )}
        <button type="button" className="music-pill music-icon-btn" onClick={toggleFullscreen} title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}>
          <span className="pill-icon" aria-hidden="true">{isFullscreen ? "⤫" : "⛶"}</span>
        </button>
        <button
          className="music-pill music-icon-btn"
          type="button"
          disabled={!resolvedMusicUrl}
          onClick={toggleMusic}
          title={resolvedMusicUrl ? (isMusicOn ? "Music On" : "Music Off") : "No Music URL"}
        >
          <span className="pill-icon" aria-hidden="true">{isMusicOn ? "♪" : "♬"}</span>
        </button>
        <button type="button" className="btn" onClick={handleAuthClick}>
          <span className="pill-icon" aria-hidden="true">{isAuthenticated ? "↩" : "→"}</span>
          {isAuthenticated ? "Logout" : "Login"}
        </button>
      </div>
      {showLogin && (
        <div className="cms-modal-backdrop" onClick={() => setShowLogin(false)}>
          <div className="cms-modal auth-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Welcome Back</h3>
            <p className="auth-subtitle">Login with admin email and password.</p>
            <form className="cms-form" onSubmit={submitLogin}>
              <label className="cms-field">
                <span>Email</span>
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(e) => setAuthForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="admin@weddingflix.com"
                />
              </label>
              <label className="cms-field">
                <span>Password</span>
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(e) => setAuthForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="Enter password"
                />
              </label>
              {!!authError && <p className="auth-error">{authError}</p>}
              <div className="cms-form-actions">
                <button type="button" className="cms-fab" onClick={() => setShowLogin(false)}>Cancel</button>
                <button type="submit" className="cms-fab" disabled={authLoading}>{authLoading ? "Signing In..." : "Login"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </nav>
  );
}
