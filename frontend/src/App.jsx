import React, { Suspense } from "react";
import { useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Navbar from "./components/Navbar";
import "./styles.css";
import "react-loading-skeleton/dist/skeleton.css";
import { apiGet } from "./api";
import { EditModeProvider } from "./components/EditModeContext";
import AsyncState from "./components/AsyncState";

const WeddingsPage = React.lazy(() => import("./pages/WeddingsPage"));
const WeddingDetailPage = React.lazy(() => import("./pages/WeddingDetailPage"));
const ProgramDetailPage = React.lazy(() => import("./pages/ProgramDetailPage"));
const EpisodeDetailPage = React.lazy(() => import("./pages/EpisodeDetailPage"));
const SitePage = React.lazy(() => import("./pages/SitePage"));
const BlogPage = React.lazy(() => import("./pages/BlogPage"));
const DeveloperAdminPage = React.lazy(() => import("./pages/DeveloperAdminPage"));
const DeveloperLoginPage = React.lazy(() => import("./pages/DeveloperLoginPage"));
const ShareHomePage = React.lazy(() => import("./pages/ShareHomePage"));
const PublicWeddingProfilePage = React.lazy(() => import("./pages/PublicWeddingProfilePage"));
const PublicInvitationSite = React.lazy(() => import("./pages/PublicInvitationSite"));
const PublicUserWedflixPage = React.lazy(() => import("./pages/PublicUserWedflixPage"));
const FavouritesPage = React.lazy(() => import("./pages/FavouritesPage"));

function ScrollToTop({ containerRef }) {
  const { pathname } = useLocation();
  useEffect(() => {
    if (containerRef?.current) {
      containerRef.current.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, containerRef]);
  return null;
}

function AppShell({ containerRef, musicUrl, setMusicUrl, showIntro }) {
  const location = useLocation();
  const isSiteRoute = location.pathname.startsWith("/site");
  const isDeveloperRoute = location.pathname.startsWith("/developer");

  return (
    <>
      <ScrollToTop containerRef={containerRef} />
      {showIntro && (
        <div className="intro-screen" aria-hidden="true">
          <p className="intro-logo">WEDFLIX</p>
        </div>
      )}
      {!isSiteRoute && !isDeveloperRoute && <Navbar musicUrl={musicUrl} />}
      <main className={`container ${isSiteRoute ? "container--site" : ""}`} ref={containerRef}>
        <Suspense fallback={<AsyncState mode="loading" />}>
          <Routes>
            <Route path="/" element={<WeddingsPage />} />
            <Route path="/favourites" element={<FavouritesPage />} />
            <Route path="/site" element={<SitePage />} />
            <Route path="/site/blog" element={<BlogPage />} />
            <Route path="/site/blog/:slug" element={<BlogPage />} />
            <Route path="/weddings/:weddingId" element={<WeddingDetailPage onMusicUrlChange={setMusicUrl} />} />
            <Route path="/weddings/:weddingId/programs/:programId" element={<ProgramDetailPage onMusicUrlChange={setMusicUrl} />} />
            <Route path="/weddings/:weddingId/programs/:programId/episodes/:episodeId" element={<EpisodeDetailPage />} />
            <Route path="/share/:weddingId" element={<PublicWeddingProfilePage />} />
            <Route path="/share/:weddingId/home" element={<WeddingDetailPage onMusicUrlChange={setMusicUrl} publicMode />} />
            <Route path="/share/:weddingId/programs/:programId" element={<ProgramDetailPage onMusicUrlChange={setMusicUrl} publicMode />} />
            <Route path="/share/:weddingId/programs/:programId/episodes/:episodeId" element={<EpisodeDetailPage publicMode />} />
            <Route path="/p/:publicSlug" element={<PublicWeddingProfilePage />} />
            <Route path="/p/:publicSlug/home" element={<PublicWeddingProfilePage openHome />} />
            <Route path="/p/:publicSlug/invite" element={<PublicInvitationSite />} />
            <Route path="/u/:userId" element={<PublicUserWedflixPage />} />
            <Route path="/developer" element={<DeveloperAdminPage />} />
            <Route path="/developer-login" element={<DeveloperLoginPage />} />
          </Routes>
        </Suspense>
        {!isSiteRoute && (
          <footer className="wedflix-footer">
            <p>
              Developed by Chirag Rohada &copy; {new Date().getFullYear()} All Rights Reserved.
            </p>
          </footer>
        )}
      </main>
    </>
  );
}

export default function App() {
  const [showIntro, setShowIntro] = useState(true);
  const [musicUrl, setMusicUrl] = useState("");
  const [backendAuthOk, setBackendAuthOk] = useState(() => localStorage.getItem("wedflix_backend_auth_ok") === "1");
  const containerRef = useRef(null);
  const introSoundAttemptedRef = useRef(false);
  const fullscreenAttemptedRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowIntro(false), 2200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const prefetchRoutes = () => {
      import("./pages/WeddingDetailPage");
      import("./pages/ProgramDetailPage");
      import("./pages/EpisodeDetailPage");
    };
    const idleId = "requestIdleCallback" in window
      ? window.requestIdleCallback(prefetchRoutes, { timeout: 3500 })
      : window.setTimeout(prefetchRoutes, 2500);
    return () => {
      if ("cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      } else {
        window.clearTimeout(idleId);
      }
    };
  }, []);

  useEffect(() => {
    if (introSoundAttemptedRef.current) return;

    const playIntroChime = async () => {
      const audio = new Audio("/wedflix-intro.mp3");
      audio.preload = "auto";
      audio.volume = 0.9;
      try {
        audio.currentTime = 0;
        await audio.play();
        introSoundAttemptedRef.current = true;
      } catch {
        introSoundAttemptedRef.current = false;
      }
    };

    const retryOnGesture = () => {
      if (introSoundAttemptedRef.current) return;
      playIntroChime();
    };

    window.addEventListener("pointerdown", retryOnGesture, { once: true });
    window.addEventListener("touchstart", retryOnGesture, { once: true, passive: true });
    window.addEventListener("keydown", retryOnGesture, { once: true });
    playIntroChime();

    return () => {
      window.removeEventListener("pointerdown", retryOnGesture);
      window.removeEventListener("touchstart", retryOnGesture);
      window.removeEventListener("keydown", retryOnGesture);
    };
  }, []);

  useEffect(() => {
    const requestFullscreen = async () => {
      if (fullscreenAttemptedRef.current) return;
      if (document.fullscreenElement || document.webkitFullscreenElement) return;

      const el = document.documentElement;
      const enterFullscreen = el.requestFullscreen || el.webkitRequestFullscreen;
      if (!enterFullscreen) return;

      fullscreenAttemptedRef.current = true;
      try {
        await enterFullscreen.call(el);
      } catch {
        fullscreenAttemptedRef.current = false;
      }
    };

    window.addEventListener("pointerdown", requestFullscreen);
    window.addEventListener("touchstart", requestFullscreen, { passive: true });
    window.addEventListener("keydown", requestFullscreen);

    return () => {
      window.removeEventListener("pointerdown", requestFullscreen);
      window.removeEventListener("touchstart", requestFullscreen);
      window.removeEventListener("keydown", requestFullscreen);
    };
  }, []);

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: () => apiGet("/api/session"),
    retry: false,
  });
  const canEdit = Boolean(session?.authenticated && session?.is_admin);

  useEffect(() => {
    if (session && (!session.authenticated || !session.is_admin) && backendAuthOk) {
      localStorage.setItem("wedflix_backend_auth_ok", "0");
      setBackendAuthOk(false);
      window.dispatchEvent(new Event("wedflix-auth-changed"));
    }
  }, [backendAuthOk, session]);

  useEffect(() => {
    const onAuthChanged = () => setBackendAuthOk(localStorage.getItem("wedflix_backend_auth_ok") === "1");
    window.addEventListener("wedflix-auth-changed", onAuthChanged);
    return () => window.removeEventListener("wedflix-auth-changed", onAuthChanged);
  }, []);
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <EditModeProvider canEdit={canEdit}>
        <AppShell
          containerRef={containerRef}
          musicUrl={musicUrl}
          setMusicUrl={setMusicUrl}
          showIntro={showIntro}
        />
      </EditModeProvider>
    </BrowserRouter>
  );
}


