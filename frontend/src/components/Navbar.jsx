import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEditMode } from "./EditModeContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "../api";

export default function Navbar({ musicUrl }) {
  const navigate = useNavigate();
  const location = useLocation();
  const homeHref = "/";
  const { canEdit, editMode, toggleEditMode, cardSize, setCardSize } = useEditMode();
  const audioRef = useRef(null);
  const pausedForVideoRef = useRef(false);
  const [isMusicOn, setIsMusicOn] = useState(() => localStorage.getItem("wedflix_music_on") !== "0");
  const [showLogin, setShowLogin] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const apiHost = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
  const queryClient = useQueryClient();
  const navRef = useRef(null);
  const { data: session } = useQuery({ queryKey: ["session"], queryFn: () => apiGet("/api/session"), retry: false });
  const [backendAuthOk, setBackendAuthOk] = useState(() => localStorage.getItem("wedflix_backend_auth_ok") === "1");
  const isAuthenticated = !!session?.authenticated;

  useEffect(() => {
    if (session && !session.authenticated && backendAuthOk) {
      localStorage.setItem("wedflix_backend_auth_ok", "0");
      setBackendAuthOk(false);
      window.dispatchEvent(new Event("wedflix-auth-changed"));
    }
  }, [backendAuthOk, session]);

  useEffect(() => {
    document.body.classList.toggle("login-open", showLogin);
    return () => document.body.classList.remove("login-open");
  }, [showLogin]);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const close = () => setProfileMenuOpen(false);
    window.addEventListener("resize", close);
    const onPointerDown = (event) => {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("resize", close);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [profileMenuOpen]);

  useEffect(() => {
    setProfileMenuOpen(false);
  }, [location.pathname]);

  const normalizedMusicUrl = (musicUrl || "").trim();
  const resolvedMusicUrl = normalizedMusicUrl
    ? (/^https?:\/\//i.test(normalizedMusicUrl) ? normalizedMusicUrl : `${apiHost}${normalizedMusicUrl.startsWith("/") ? "" : "/"}${normalizedMusicUrl}`)
    : "";

  useEffect(() => {
    if (!resolvedMusicUrl) {
      setIsMusicOn(false);
      return;
    }
    const saved = localStorage.getItem("wedflix_music_on");
    setIsMusicOn(saved === "0" ? false : true);
  }, [resolvedMusicUrl]);

  useEffect(() => {
    const pauseMusicForVideo = () => {
      if (!audioRef.current || !resolvedMusicUrl) return;
      pausedForVideoRef.current = true;
      audioRef.current.pause();
    };
    const resumeMusicAfterVideo = () => {
      if (!resolvedMusicUrl || !isMusicOn || !pausedForVideoRef.current) return;
      pausedForVideoRef.current = false;
      audioRef.current?.play().catch(() => {});
    };
    window.addEventListener("wedflix-video-playing", pauseMusicForVideo);
    window.addEventListener("wedflix-video-stopped", resumeMusicAfterVideo);
    return () => {
      window.removeEventListener("wedflix-video-playing", pauseMusicForVideo);
      window.removeEventListener("wedflix-video-stopped", resumeMusicAfterVideo);
    };
  }, [resolvedMusicUrl, isMusicOn]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.load();
    if (isMusicOn && resolvedMusicUrl) {
      audioRef.current.play().catch(() => {});
    }
  }, [resolvedMusicUrl, isMusicOn]);

  useEffect(() => {
    if (!resolvedMusicUrl || !isMusicOn) return;
    const tryPlayOnGesture = () => {
      audioRef.current?.play().catch(() => {});
    };
    window.addEventListener("pointerdown", tryPlayOnGesture, { once: true });
    window.addEventListener("touchstart", tryPlayOnGesture, { once: true, passive: true });
    return () => {
      window.removeEventListener("pointerdown", tryPlayOnGesture);
      window.removeEventListener("touchstart", tryPlayOnGesture);
    };
  }, [resolvedMusicUrl, isMusicOn]);

  const toggleMusic = async () => {
    if (!audioRef.current || !resolvedMusicUrl) return;
    if (isMusicOn) {
      audioRef.current.pause();
      setIsMusicOn(false);
      localStorage.setItem("wedflix_music_on", "0");
      return;
    }
    try {
      await audioRef.current.play();
      setIsMusicOn(true);
      localStorage.setItem("wedflix_music_on", "1");
    } catch {
      setIsMusicOn(false);
      localStorage.setItem("wedflix_music_on", "0");
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      setIsFullscreen(!!document.fullscreenElement);
    } catch {}
  };

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const handleAuthClick = async () => {
    setProfileMenuOpen(false);
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

  const goBack = () => {
    if (location.pathname === "/") return;
    navigate(-1);
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
        setAuthError("Login failed. Check credentials.");
        return;
      }
      localStorage.setItem("wedflix_backend_auth_ok", "1");
      setBackendAuthOk(true);
      window.dispatchEvent(new Event("wedflix-auth-changed"));
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      setShowLogin(false);
      setAuthForm({ email: "", password: "" });
    } catch (err) {
      setAuthError(err.message || "Login failed");
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <>
      <nav className="nav nav-home" ref={navRef}>
        <div className="nav-home__top">
          <Link to={homeHref} className="nav-home__brand nav-home__brand--desktop">WEDFLIX</Link>
          <Link to={homeHref} className="nav-home__brand nav-home__brand--mobile" aria-label="Wedflix home">W</Link>

          <div className="nav-home__profile">
            <button
              type="button"
              className="nav-home__avatar"
              onClick={() => setProfileMenuOpen((v) => !v)}
              title={isAuthenticated ? "Admin menu" : "Sign in"}
              aria-expanded={profileMenuOpen}
              aria-haspopup="menu"
            >
              <span className="nav-home__avatar-face" aria-hidden="true">☺</span>
              <span className="nav-home__avatar-caret" aria-hidden="true">▾</span>
            </button>

            {profileMenuOpen && (
              <div className="nav-home__profile-menu" role="menu" aria-label="Profile actions">
                <button
                  type="button"
                  className="nav-home__profile-item"
                  onClick={async () => {
                    setProfileMenuOpen(false);
                    await toggleFullscreen();
                  }}
                >
                  <span aria-hidden="true">{isFullscreen ? "⤫" : "⛶"}</span>
                  {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                </button>
                <button
                  type="button"
                  className={`nav-home__profile-item ${editMode ? "is-active" : ""} ${!canEdit ? "is-disabled" : ""}`}
                  onClick={() => {
                    setProfileMenuOpen(false);
                    toggleEditMode();
                  }}
                  aria-disabled={!canEdit}
                  title={canEdit ? "Toggle edit mode" : "Edit mode unavailable"}
                >
                  <span aria-hidden="true">✎</span>
                  {editMode ? "Edit Mode On" : "Edit"}
                </button>
                <button
                  type="button"
                  className="nav-home__profile-item"
                  onClick={async () => {
                    setProfileMenuOpen(false);
                    await handleAuthClick();
                  }}
                >
                  <span aria-hidden="true">{isAuthenticated ? "↩" : "→"}</span>
                  {isAuthenticated ? "Logout" : "Login"}
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {showLogin && (
        <div className="cms-modal-backdrop auth-backdrop" onClick={() => setShowLogin(false)}>
          <div className="cms-modal auth-modal netflix-login" onClick={(e) => e.stopPropagation()}>
            <p className="netflix-login-brand">WEDFLIX</p>
            <h3>Sign In</h3>
            <form className="cms-form" onSubmit={submitLogin}>
              <input type="email" value={authForm.email} onChange={(e) => setAuthForm((p) => ({ ...p, email: e.target.value }))} placeholder="Email or phone number" />
              <input type="password" value={authForm.password} onChange={(e) => setAuthForm((p) => ({ ...p, password: e.target.value }))} placeholder="Password" />
              {!!authError && <p className="auth-error">{authError}</p>}
              <button type="submit" className="netflix-login-btn" disabled={authLoading}>{authLoading ? "Signing In..." : "Sign In"}</button>
              <div className="netflix-login-meta">
                <label><input type="checkbox" defaultChecked /> Remember me</label>
                <button type="button" className="netflix-help-btn">Need help?</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
