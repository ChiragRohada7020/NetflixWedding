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
const DeveloperAdminPage = React.lazy(() => import("./pages/DeveloperAdminPage"));
const DeveloperLoginPage = React.lazy(() => import("./pages/DeveloperLoginPage"));
const ShareHomePage = React.lazy(() => import("./pages/ShareHomePage"));

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
  const isSiteRoute = location.pathname === "/site";
  const isDeveloperRoute = location.pathname.startsWith("/developer");
  const isShareRoute = location.pathname.startsWith("/share/");

  return (
    <>
      <ScrollToTop containerRef={containerRef} />
      {showIntro && (
        <div className="intro-screen" aria-hidden="true">
          <p className="intro-logo">WEDFLIX</p>
        </div>
      )}
      {!isSiteRoute && !isDeveloperRoute && !isShareRoute && <Navbar musicUrl={musicUrl} />}
      <main className={`container ${isSiteRoute ? "container--site" : ""}`} ref={containerRef}>
        <Suspense fallback={<AsyncState mode="loading" />}>
          <Routes>
            <Route path="/" element={<WeddingsPage />} />
            <Route path="/site" element={<SitePage />} />
            <Route path="/weddings/:weddingId" element={<WeddingDetailPage onMusicUrlChange={setMusicUrl} />} />
            <Route path="/weddings/:weddingId/programs/:programId" element={<ProgramDetailPage onMusicUrlChange={setMusicUrl} />} />
            <Route path="/weddings/:weddingId/programs/:programId/episodes/:episodeId" element={<EpisodeDetailPage />} />
            <Route path="/share/:weddingId" element={<ShareHomePage onMusicUrlChange={setMusicUrl} />} />
            <Route path="/share/:weddingId/programs/:programId" element={<ProgramDetailPage onMusicUrlChange={setMusicUrl} publicMode />} />
            <Route path="/share/:weddingId/programs/:programId/episodes/:episodeId" element={<EpisodeDetailPage publicMode />} />
            <Route path="/developer" element={<DeveloperAdminPage />} />
            <Route path="/developer-login" element={<DeveloperLoginPage />} />
          </Routes>
        </Suspense>
        {!isSiteRoute && (
          <footer className="wedflix-footer">
            <p>Wedflix &copy; {new Date().getFullYear()} All Rights Reserved.</p>
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
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return;
      try {
        const ctx = new AudioContextCtor();
        if (ctx.state === "suspended") {
          await ctx.resume();
        }
        const master = ctx.createGain();
        master.gain.value = 0.0001;
        master.connect(ctx.destination);
        master.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.04);
        master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.15);

        const notes = [
          { freq: 196, start: 0.0, dur: 0.28 },
          { freq: 247, start: 0.18, dur: 0.28 },
          { freq: 330, start: 0.36, dur: 0.5 },
        ];

        notes.forEach(({ freq, start, dur }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = freq;
          gain.gain.value = 0.0001;
          gain.gain.exponentialRampToValueAtTime(0.8, ctx.currentTime + start + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
          osc.connect(gain);
          gain.connect(master);
          osc.start(ctx.currentTime + start);
          osc.stop(ctx.currentTime + start + dur + 0.05);
        });

        setTimeout(() => {
          ctx.close().catch(() => {});
        }, 1700);
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


