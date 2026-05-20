import React from "react";
import { useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Navbar from "./components/Navbar";
import WeddingsPage from "./pages/WeddingsPage";
import HomePage from "./pages/HomePage";
import WeddingDetailPage from "./pages/WeddingDetailPage";
import ProgramDetailPage from "./pages/ProgramDetailPage";
import EpisodeDetailPage from "./pages/EpisodeDetailPage";
import "./styles.css";
import "react-loading-skeleton/dist/skeleton.css";
import { apiGet } from "./api";
import { EditModeProvider } from "./components/EditModeContext";

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

export default function App() {
  const [showIntro, setShowIntro] = useState(true);
  const [musicUrl, setMusicUrl] = useState("");
  const [backendAuthOk, setBackendAuthOk] = useState(() => localStorage.getItem("wedflix_backend_auth_ok") === "1");
  const containerRef = useRef(null);
  const fullscreenAttemptedRef = useRef(false);
  const introSoundAttemptedRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowIntro(false), 2200);
    return () => clearTimeout(timer);
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
    const tryEnterFullscreen = async () => {
      if (fullscreenAttemptedRef.current || document.fullscreenElement) return;
      fullscreenAttemptedRef.current = true;
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        fullscreenAttemptedRef.current = false;
      }
    };

    const onFirstGesture = () => {
      tryEnterFullscreen();
    };

    if (!showIntro) {
      tryEnterFullscreen();
    }

    window.addEventListener("pointerdown", onFirstGesture, { once: true });
    window.addEventListener("keydown", onFirstGesture, { once: true });
    window.addEventListener("touchstart", onFirstGesture, { once: true, passive: true });

    return () => {
      window.removeEventListener("pointerdown", onFirstGesture);
      window.removeEventListener("keydown", onFirstGesture);
      window.removeEventListener("touchstart", onFirstGesture);
    };
  }, [showIntro]);

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: () => apiGet("/api/session"),
    retry: false,
  });
  const canEdit = Boolean((session?.authenticated && session?.is_admin) || backendAuthOk);

  useEffect(() => {
    const onAuthChanged = () => setBackendAuthOk(localStorage.getItem("wedflix_backend_auth_ok") === "1");
    window.addEventListener("wedflix-auth-changed", onAuthChanged);
    return () => window.removeEventListener("wedflix-auth-changed", onAuthChanged);
  }, []);
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <EditModeProvider canEdit={canEdit}>
          <ScrollToTop containerRef={containerRef} />
          {showIntro && (
            <div className="intro-screen" aria-hidden="true">
              <p className="intro-logo">WEDFLIX</p>
            </div>
          )}
          <Navbar musicUrl={musicUrl} />
          <main className="container" ref={containerRef}>
            <Routes>
              <Route path="/" element={<WeddingsPage />} />
              <Route path="/weddings" element={<HomePage />} />
              <Route path="/weddings/:weddingId" element={<WeddingDetailPage onMusicUrlChange={setMusicUrl} />} />
              <Route path="/weddings/:weddingId/programs/:programId" element={<ProgramDetailPage onMusicUrlChange={setMusicUrl} />} />
              <Route path="/weddings/:weddingId/programs/:programId/episodes/:episodeId" element={<EpisodeDetailPage />} />
            </Routes>
          <footer className="wedflix-footer">
            <p>Wedflix &copy; {new Date().getFullYear()} All Rights Reserved.</p>
          </footer>
        </main>
      </EditModeProvider>
    </BrowserRouter>
  );
}


