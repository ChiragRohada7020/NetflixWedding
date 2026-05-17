import React from "react";
import { useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Navbar from "./components/Navbar";
import WeddingsPage from "./pages/WeddingsPage";
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

  useEffect(() => {
    const timer = setTimeout(() => setShowIntro(false), 2200);
    return () => clearTimeout(timer);
  }, []);

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
    <BrowserRouter>
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


