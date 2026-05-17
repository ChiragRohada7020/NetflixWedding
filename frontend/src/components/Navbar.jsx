import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEditMode } from "./EditModeContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "../api";

export default function Navbar({ musicUrl }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { canEdit, editMode, toggleEditMode, cardSize, setCardSize } = useEditMode();
  const audioRef = useRef(null);
  const [isMusicOn, setIsMusicOn] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const apiHost = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
  const queryClient = useQueryClient();
  const navRef = useRef(null);
  const { data: session } = useQuery({ queryKey: ["session"], queryFn: () => apiGet("/api/session"), retry: false });
  const [backendAuthOk, setBackendAuthOk] = useState(() => localStorage.getItem("wedflix_backend_auth_ok") === "1");
  const isAuthenticated = !!session?.authenticated || backendAuthOk;

  useEffect(() => {
    document.body.classList.toggle("login-open", showLogin);
    return () => document.body.classList.remove("login-open");
  }, [showLogin]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const close = () => setMobileMenuOpen(false);
    window.addEventListener("resize", close);
    const onPointerDown = (event) => {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("resize", close);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    setMobileMenuOpen(false);
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
    setIsMusicOn(true);
  }, [resolvedMusicUrl]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.load();
    if (isMusicOn && resolvedMusicUrl) {
      audioRef.current.play().catch(() => {});
    }
  }, [resolvedMusicUrl, isMusicOn]);

  useEffect(() => {
    const pauseMusicForVideo = () => {
      if (!audioRef.current) return;
      audioRef.current.pause();
      setIsMusicOn(false);
    };
    window.addEventListener("wedflix-video-playing", pauseMusicForVideo);
    return () => window.removeEventListener("wedflix-video-playing", pauseMusicForVideo);
  }, []);

  const toggleMusic = async () => {
    if (!audioRef.current || !resolvedMusicUrl) return;
    if (isMusicOn) {
      audioRef.current.pause();
      setIsMusicOn(false);
      return;
    }
    try {
      await audioRef.current.play();
      setIsMusicOn(true);
    } catch {
      setIsMusicOn(false);
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
    setMobileMenuOpen(false);
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
    setMobileMenuOpen(false);
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
      <nav className="nav" ref={navRef}>
        <audio ref={audioRef} src={resolvedMusicUrl} loop preload="auto" />
        <Link to="/" className="brand">Wedflix</Link>
        <button type="button" className="nav-hamburger" aria-label="Toggle menu" onClick={() => setMobileMenuOpen((v) => !v)}>☰</button>
        <div className={`nav-actions ${mobileMenuOpen ? "open" : ""}`}>
          {location.pathname !== "/" && (
            <button type="button" className="music-pill" onClick={goBack}>
              <span className="pill-icon" aria-hidden="true">←</span>
              Back
            </button>
          )}
          {canEdit && (
            <button className={`music-pill ${editMode ? "edit-on" : ""}`} type="button" onClick={() => { setMobileMenuOpen(false); toggleEditMode(); }}>
              <span className="pill-icon" aria-hidden="true">✎</span>
              {editMode ? "Edit Mode On" : "Edit Mode Off"}
            </button>
          )}
          {canEdit && editMode && (
            <select className="music-pill size-select" value={cardSize} onChange={(e) => { setCardSize(e.target.value); setMobileMenuOpen(false); }}>
              <option value="small">Small Cards</option>
              <option value="medium">Medium Cards</option>
              <option value="large">Large Cards</option>
            </select>
          )}
          <button type="button" className="music-pill music-icon-btn" onClick={() => { setMobileMenuOpen(false); toggleFullscreen(); }} title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}><span className="pill-icon" aria-hidden="true">{isFullscreen ? "⤫" : "⛶"}</span></button>
          <button className="music-pill music-icon-btn" type="button" disabled={!resolvedMusicUrl} onClick={() => { setMobileMenuOpen(false); toggleMusic(); }} title={resolvedMusicUrl ? (isMusicOn ? "Music On" : "Music Off") : "No Music URL"}><span className="pill-icon" aria-hidden="true">{isMusicOn ? "♪" : "♫"}</span></button>
          <button type="button" className="btn" onClick={handleAuthClick}><span className="pill-icon" aria-hidden="true">{isAuthenticated ? "↩" : "→"}</span>{isAuthenticated ? "Logout" : "Login"}</button>
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
