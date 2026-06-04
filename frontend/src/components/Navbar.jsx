import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEditMode } from "./EditModeContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiAuthPost, apiGet, apiPost, mediaUrl } from "../api";
import useModalHistory from "../utils/useModalHistory";

export default function Navbar({ musicUrl }) {
  const navigate = useNavigate();
  const location = useLocation();
  const publicShareMatch = location.pathname.match(/^\/share\/([^/]+)/);
  const publicSlugMatch = location.pathname.match(/^\/p\/([^/]+)/);
  const isPublicRoute = Boolean(publicShareMatch || publicSlugMatch);
  const homeHref = "/";
  const isHomePage = location.pathname === "/";
  const { canEdit, editMode, toggleEditMode, cardSize, setCardSize } = useEditMode();
  const audioRef = useRef(null);
  const pausedForVideoRef = useRef(false);
  const [isMusicOn, setIsMusicOn] = useState(() => localStorage.getItem("wedflix_music_on") !== "0");
  const [showLogin, setShowLogin] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const emptyAuthForm = { name: "", phone: "", business_name: "", city: "", purpose: "", email: "", password: "", otp: "", current_password: "", new_password: "" };
  const [authForm, setAuthForm] = useState(emptyAuthForm);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [signupOtpSent, setSignupOtpSent] = useState(false);
  const [resetOtpSent, setResetOtpSent] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const queryClient = useQueryClient();
  const navRef = useRef(null);
  const { data: session } = useQuery({ queryKey: ["session"], queryFn: () => apiGet("/api/session"), retry: false });
  const [backendAuthOk, setBackendAuthOk] = useState(() => localStorage.getItem("wedflix_backend_auth_ok") === "1");
  const isAuthenticated = !!session?.authenticated;
  useModalHistory(showLogin, () => setShowLogin(false));

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
  const resolvedMusicUrl = mediaUrl(normalizedMusicUrl);

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
      await queryClient.invalidateQueries({ queryKey: ["weddings"] });
      await queryClient.invalidateQueries({ queryKey: ["wedding-programs"] });
      return;
    }
    setAuthError("");
    setAuthNotice("");
    setAuthMode("login");
    setSignupOtpSent(false);
    setResetOtpSent(false);
    setShowLogin(true);
  };

  const openAuthModal = (mode) => {
    setProfileMenuOpen(false);
    setAuthMode(mode);
    setAuthError("");
    setAuthNotice("");
    setSignupOtpSent(false);
    setResetOtpSent(false);
    setAuthForm(emptyAuthForm);
    setShowLogin(true);
  };

  const goBack = () => {
    if (location.pathname === "/") return;
    navigate(-1);
  };

  const submitLogin = async (e) => {
    e.preventDefault();
    if (authMode === "change") {
      if (!authForm.current_password.trim() || !authForm.new_password.trim()) {
        setAuthError("Current password and new password are required.");
        return;
      }
      setAuthLoading(true);
      setAuthError("");
      setAuthNotice("");
      try {
        const res = await apiAuthPost("/api/session/password/change", {
          current_password: authForm.current_password,
          new_password: authForm.new_password,
        });
        setAuthNotice(res?.message || "Password changed successfully.");
        setAuthForm(emptyAuthForm);
      } catch (err) {
        setAuthError(err.message || "Could not change password.");
      } finally {
        setAuthLoading(false);
      }
      return;
    }
    if (authMode === "forgot") {
      if (!authForm.email.trim()) {
        setAuthError("Email is required.");
        return;
      }
      if (resetOtpSent && (!authForm.otp.trim() || !authForm.password.trim())) {
        setAuthError("OTP and new password are required.");
        return;
      }
      setAuthLoading(true);
      setAuthError("");
      setAuthNotice("");
      try {
        if (!resetOtpSent) {
          const otpRes = await apiAuthPost("/api/session/password/request-otp", { email: authForm.email.trim() });
          setResetOtpSent(true);
          setAuthNotice(otpRes?.message || "OTP sent to your email.");
          return;
        }
        const res = await apiAuthPost("/api/session/password/reset", {
          email: authForm.email.trim(),
          otp: authForm.otp.trim(),
          password: authForm.password,
        });
        setAuthNotice(res?.message || "Password updated. You can sign in now.");
        setAuthMode("login");
        setResetOtpSent(false);
        setAuthForm((p) => ({ ...emptyAuthForm, email: p.email }));
      } catch (err) {
        setAuthError(err.message || "Could not reset password.");
      } finally {
        setAuthLoading(false);
      }
      return;
    }
    if (!authForm.email.trim() || !authForm.password.trim()) {
      setAuthError("Email and password are required.");
      return;
    }
    if (authMode === "signup" && (!authForm.name.trim() || !authForm.phone.trim())) {
      setAuthError("Name, phone, email, and password are required.");
      return;
    }
    if (authMode === "signup" && signupOtpSent && !authForm.otp.trim()) {
      setAuthError("Enter the OTP sent to your email.");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    setAuthNotice("");
    try {
      const signupPayload = {
        name: authForm.name.trim(),
        phone: authForm.phone.trim(),
        business_name: authForm.business_name.trim(),
        city: authForm.city.trim(),
        purpose: authForm.purpose.trim(),
        email: authForm.email.trim(),
        password: authForm.password,
      };
      if (authMode === "signup" && !signupOtpSent) {
        const otpRes = await apiAuthPost("/api/session/signup/request-otp", signupPayload);
        setSignupOtpSent(true);
        setAuthNotice(otpRes?.message || "OTP sent to your email.");
        return;
      }
      const endpoint = authMode === "signup" ? "/api/session/signup/verify-otp" : "/api/session/login";
      const loginRes = await apiAuthPost(endpoint, {
        ...signupPayload,
        otp: authForm.otp.trim(),
      });
      if (!loginRes?.authenticated || !loginRes?.is_admin) {
        setAuthError("Login failed. Check credentials.");
        return;
      }
      localStorage.setItem("wedflix_backend_auth_ok", "1");
      setBackendAuthOk(true);
      window.dispatchEvent(new Event("wedflix-auth-changed"));
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      await queryClient.invalidateQueries({ queryKey: ["weddings"] });
      await queryClient.invalidateQueries({ queryKey: ["wedding-programs"] });
      setShowLogin(false);
      setSignupOtpSent(false);
      setAuthNotice("");
      setAuthForm(emptyAuthForm);
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

          {!isPublicRoute && isHomePage && (
            <div className="nav-home__links">
              <Link to="/favourites">
                Favourites
              </Link>
            </div>
          )}

          {!isPublicRoute && (
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
                {isAuthenticated && (
                  <button
                    type="button"
                    className="nav-home__profile-item"
                    onClick={() => openAuthModal("change")}
                  >
                    <span aria-hidden="true">⌁</span>
                    Change Password
                  </button>
                )}
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
          )}
        </div>
      </nav>

      {showLogin && (
        <div className="cms-modal-backdrop auth-backdrop" onClick={() => setShowLogin(false)}>
          <div className="cms-modal auth-modal netflix-login" onClick={(e) => e.stopPropagation()}>
            <p className="netflix-login-brand">WEDFLIX</p>
            <h3>
              {authMode === "signup"
                ? (signupOtpSent ? "Verify Email OTP" : "Create Your Own Wedflix")
                : authMode === "forgot"
                  ? (resetOtpSent ? "Reset Password" : "Forgot Password")
                  : authMode === "change"
                    ? "Change Password"
                    : "Sign In"}
            </h3>
            <form className="cms-form" onSubmit={submitLogin}>
              {authMode === "signup" && (
                <>
                  <input type="text" value={authForm.name} onChange={(e) => setAuthForm((p) => ({ ...p, name: e.target.value }))} placeholder="Name" />
                  <input type="tel" value={authForm.phone} onChange={(e) => setAuthForm((p) => ({ ...p, phone: e.target.value }))} placeholder="Phone number" />
                  <input type="text" value={authForm.business_name} onChange={(e) => setAuthForm((p) => ({ ...p, business_name: e.target.value }))} placeholder="Business / studio name" />
                  <input type="text" value={authForm.city} onChange={(e) => setAuthForm((p) => ({ ...p, city: e.target.value }))} placeholder="City" />
                  <input type="text" value={authForm.purpose} onChange={(e) => setAuthForm((p) => ({ ...p, purpose: e.target.value }))} placeholder="Story / business use" />
                </>
              )}
              {authMode !== "change" && (
                <input type="email" value={authForm.email} onChange={(e) => setAuthForm((p) => ({ ...p, email: e.target.value }))} placeholder="Email address" />
              )}
              {authMode === "change" && (
                <>
                  <input type="password" value={authForm.current_password} onChange={(e) => setAuthForm((p) => ({ ...p, current_password: e.target.value }))} placeholder="Current password" />
                  <input type="password" value={authForm.new_password} onChange={(e) => setAuthForm((p) => ({ ...p, new_password: e.target.value }))} placeholder="New password" />
                </>
              )}
              {authMode !== "change" && (authMode !== "forgot" || resetOtpSent) && (
                <input type="password" value={authForm.password} onChange={(e) => setAuthForm((p) => ({ ...p, password: e.target.value }))} placeholder={authMode === "forgot" ? "New password" : "Password"} />
              )}
              {authMode === "signup" && signupOtpSent && (
                <input type="text" inputMode="numeric" maxLength="6" value={authForm.otp} onChange={(e) => setAuthForm((p) => ({ ...p, otp: e.target.value.replace(/\D/g, "").slice(0, 6) }))} placeholder="Enter 6-digit email OTP" />
              )}
              {authMode === "forgot" && resetOtpSent && (
                <input type="text" inputMode="numeric" maxLength="6" value={authForm.otp} onChange={(e) => setAuthForm((p) => ({ ...p, otp: e.target.value.replace(/\D/g, "").slice(0, 6) }))} placeholder="Enter 6-digit email OTP" />
              )}
              {!!authNotice && <p className="auth-subtitle">{authNotice}</p>}
              {!!authError && <p className="auth-error">{authError}</p>}
              <button type="submit" className="netflix-login-btn" disabled={authLoading}>
                {authLoading
                  ? "Please wait..."
                  : authMode === "signup"
                    ? (signupOtpSent ? "Verify & Create Account" : "Send Email OTP")
                    : authMode === "forgot"
                      ? (resetOtpSent ? "Reset Password" : "Send Reset OTP")
                      : authMode === "change"
                        ? "Change Password"
                        : "Sign In"}
              </button>
              {authMode === "signup" && signupOtpSent && (
                <button
                  type="button"
                  className="netflix-help-btn"
                  disabled={authLoading}
                  onClick={() => {
                    setSignupOtpSent(false);
                    setAuthForm((p) => ({ ...p, otp: "" }));
                    setAuthNotice("");
                    setAuthError("");
                  }}
                >
                  Change details or resend OTP
                </button>
              )}
              <div className="netflix-login-meta">
                {authMode === "login" ? <label><input type="checkbox" defaultChecked /> Remember me</label> : <span />}
                {authMode === "login" && (
                  <button type="button" className="netflix-help-btn" onClick={() => openAuthModal("forgot")}>
                    Forgot password?
                  </button>
                )}
                <button
                  type="button"
                  className="netflix-help-btn"
                  onClick={() => {
                    setAuthError("");
                    setAuthNotice("");
                    setSignupOtpSent(false);
                    setResetOtpSent(false);
                    setAuthForm((p) => ({ ...p, otp: "" }));
                    setAuthMode((mode) => (mode === "signup" || mode === "forgot" || mode === "change" ? "login" : "signup"));
                  }}
                >
                  {authMode === "signup" || authMode === "forgot" || authMode === "change" ? "Back to login" : "Create free client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
