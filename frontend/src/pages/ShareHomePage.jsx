import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Skeleton from "react-loading-skeleton";
import { motion } from "framer-motion";
import { apiGet, apiGetPublic, mediaUrl } from "../api";
import AsyncState from "../components/AsyncState";
import LazyHeroVideo from "../components/LazyHeroVideo";
import SeoHead from "../components/SeoHead";
import PremiumWeddingExperience from "../components/PremiumWeddingExperience";
import FavouriteLoginToast, { useFavouriteLoginToast } from "../components/FavouriteLoginToast";
import { isFavouriteWedding, removeFavouriteWedding, saveFavouriteWedding } from "../utils/favourites";

function toEmbed(url) {
  if (!url) return "";
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : "";
}

function getVideoId(url) {
  if (!url) return "";
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : "";
}

function withHeroParams(url, { muted = true } = {}) {
  if (!url) return "";
  const joiner = url.includes("?") ? "&" : "?";
  const videoId = getVideoId(url);
  const loopParams = videoId ? `&playlist=${videoId}` : "";
  return `${url}${joiner}autoplay=1&mute=${muted ? "1" : "0"}&controls=0&loop=1${loopParams}&playsinline=1&start=0&rel=0&modestbranding=1`;
}

function getPlaceholder(label) {
  const text = (label || "Wedflix").trim().slice(0, 18) || "Wedflix";
  const encoded = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <rect width="1280" height="720" fill="#050505" />
      <radialGradient id="glow" cx="75%" cy="18%" r="80%">
        <stop offset="0%" stop-color="#e50914" stop-opacity="0.35" />
        <stop offset="100%" stop-color="#e50914" stop-opacity="0" />
      </radialGradient>
      <rect width="1280" height="720" fill="url(#glow)" />
      <text x="72" y="365" fill="#f5f5f5" font-size="86" font-family="Georgia, serif">${text}</text>
      <text x="72" y="432" fill="#a3a3a3" font-size="34" font-family="Arial, sans-serif">Wedflix</text>
    </svg>
  `);
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

const netflixLogoUrl = "https://images.icon-icons.com/2699/PNG/512/netflix_logo_icon_170919.png";

function SharePoster({ item, href, title, subtitle }) {
  const image = mediaUrl(item?.thumbnail || item?.profile_image || item?.hero_image || getPlaceholder(title));
  return (
    <motion.div className="home-poster-wrap" whileHover={{ y: -4, scale: 1.015 }} transition={{ type: "spring", stiffness: 240, damping: 20 }}>
      <Link to={href} className="home-poster">
        <img src={image} alt={title} className="home-poster__image" />
        <div className="home-poster__fade" />
        <div className="home-poster__content">
          <img src={netflixLogoUrl} alt="" aria-hidden="true" className="home-poster__logo" />
          <div className="home-poster__text">
            <p className="home-poster__title">{title}</p>
            <p className="home-poster__subtitle">{subtitle}</p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function ShareHomePage({ onMusicUrlChange = () => {} }) {
  const { weddingId, publicSlug } = useParams();
  const publicHome = Boolean(publicSlug);
  const [isMusicOn, setIsMusicOn] = useState(() => localStorage.getItem("wedflix_music_on") !== "0");
  const premiumSeenKey = `wedflix_premium_seen_${weddingId || publicSlug}`;
  const [premiumSeen, setPremiumSeen] = useState(() => localStorage.getItem(premiumSeenKey) === "1");
  const [premiumPanel, setPremiumPanel] = useState("");
  const sharePath = publicSlug ? `/p/${publicSlug}` : `/share/${weddingId}`;
  const [savedFavourite, setSavedFavourite] = useState(false);
  const audioRef = useRef(null);
  const favouriteToast = useFavouriteLoginToast();
  const { data: session } = useQuery({ queryKey: ["session"], queryFn: () => apiGet("/api/session"), retry: false });
  const favouriteUserId = session?.authenticated ? session.user_id : "";

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["share-home", weddingId || publicSlug],
    queryFn: async () => {
      const wedding = publicSlug
        ? await apiGetPublic(`/api/public-weddings/${publicSlug}`)
        : await apiGet(`/api/weddings/${weddingId}`);
      const programs = await apiGet(`/api/weddings/${wedding._id}/programs`);
      return { wedding, programs };
    },
  });

  const wedding = data?.wedding;
  const programs = data?.programs || [];
  const shareBasePath = publicSlug ? `/p/${publicSlug}` : `/share/${weddingId}/home`;
  const favouritePath = wedding?._id ? `/share/${wedding._id}/home` : sharePath;
  const nestedBasePath = wedding?._id ? `/share/${wedding._id}` : shareBasePath;
  const featuredProgram = programs[0] || null;
  const heroImage = mediaUrl(wedding?.hero_image || wedding?.profile_image || featuredProgram?.thumbnail || getPlaceholder(wedding?.couple_names));
  const pageMusicUrl = mediaUrl(wedding?.music_url || "");
  const heroVideo = withHeroParams(toEmbed(wedding?.hero_video_url), { muted: Boolean(pageMusicUrl) });
  const scrollToFunctions = () => {
    document.getElementById("celebration-series")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const rows = useMemo(() => {
    const cards = programs.map((program, index) => ({
      id: program._id,
      href: `${nestedBasePath}/programs/${program._id}`,
      title: program.title || `Function ${index + 1}`,
      subtitle: program.event_date || program.venue_name || "Wedding Function",
      item: program,
    }));
    if (!cards.length) return [];
    return [
      { id: "celebration-series", title: wedding?.programs_section_title || "The Celebration Series", cards },
      { id: "wedding-films", title: "Wedding Films", cards: [...cards].reverse() },
    ];
  }, [programs, wedding?.programs_section_title, nestedBasePath]);

  useEffect(() => {
    onMusicUrlChange(pageMusicUrl);
  }, [pageMusicUrl, onMusicUrlChange]);

  useEffect(() => {
    setSavedFavourite(isFavouriteWedding(favouritePath, favouriteUserId) || isFavouriteWedding(sharePath, favouriteUserId));
  }, [favouritePath, favouriteUserId, sharePath]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.load();
    const saved = localStorage.getItem("wedflix_music_on");
    const shouldPlay = saved === "0" ? false : !!pageMusicUrl;
    setIsMusicOn(shouldPlay);
    if (shouldPlay && pageMusicUrl) {
      audioRef.current.play().catch(() => {});
    }
  }, [pageMusicUrl]);

  const toggleMusic = async () => {
    if (!audioRef.current || !pageMusicUrl) return;
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

  if (isLoading && !data) return <AsyncState mode="loading" />;
  if (error && !data) return <AsyncState mode="error" message={error.message} onRetry={() => refetch()} />;

  if (!publicHome && wedding?.premium_experience_enabled && !premiumSeen) {
    return (
      <PremiumWeddingExperience
        wedding={wedding}
        programs={programs}
        basePath={shareBasePath}
        onMusicUrlChange={onMusicUrlChange}
        onComplete={() => setPremiumSeen(true)}
      />
    );
  }

  if (wedding?.premium_experience_enabled && premiumPanel) {
    return (
      <PremiumWeddingExperience
        wedding={wedding}
        programs={programs}
        basePath={shareBasePath}
        initialScreen={premiumPanel}
        onMusicUrlChange={onMusicUrlChange}
        onComplete={() => setPremiumPanel("")}
      />
    );
  }

  return (
    <section className="home-page share-home-page">
      <SeoHead
        title={wedding ? `${wedding.couple_names} | Wedflix` : "Wedflix | Wedding Home"}
        description={wedding?.description || "Watch this private wedding story on Wedflix."}
        canonicalPath={shareBasePath}
        image={mediaUrl(wedding?.profile_image || heroImage)}
        type="article"
      />
      <audio ref={audioRef} src={pageMusicUrl} loop preload="metadata" />

      <nav className="share-home-nav" aria-label="Wedding home">
        <Link to={shareBasePath} className="share-home-nav__brand">WEDFLIX</Link>
        <a href="#celebration-series" className="share-home-nav__link">Home</a>
        {wedding?.premium_experience_enabled && (
          <>
            <button type="button" className="share-home-nav__link share-home-nav__button" onClick={() => setPremiumPanel("invitation")}>Invitation</button>
            <button type="button" className="share-home-nav__link share-home-nav__button" onClick={() => setPremiumPanel("venue")}>Location</button>
          </>
        )}
        {wedding && (
          <button
            type="button"
            className={`share-home-nav__link share-home-nav__button share-home-nav__favourite share-home-nav__heart ${savedFavourite ? "is-saved" : ""}`}
            onClick={() => {
              if (savedFavourite) {
                removeFavouriteWedding(favouritePath, favouriteUserId);
                setSavedFavourite(false);
                return;
              }
              if (!favouriteUserId) {
                favouriteToast.show();
                return;
              }
              saveFavouriteWedding({ ...wedding, path: favouritePath }, favouriteUserId);
              setSavedFavourite(true);
            }}
            aria-label={favouriteUserId ? (savedFavourite ? "Remove from favourites" : "Save to favourites") : "Login to save favourites"}
            title={favouriteUserId ? (savedFavourite ? "Remove from favourites" : "Save to favourites") : "Login to save favourites"}
          >
            <span aria-hidden="true">{savedFavourite ? "♥" : "♡"}</span>
          </button>
        )}
      </nav>

      {wedding && (
        <header className="home-hero share-home-hero">
          <div className={`home-hero__media ${heroVideo ? "has-video" : ""}`}>
            {heroVideo ? (
              <LazyHeroVideo src={heroVideo} title="Wedding Home Trailer" poster={heroImage} alt={wedding.couple_names} />
            ) : (
              <img className="home-hero__image" src={heroImage} alt={wedding.couple_names} loading="eager" decoding="async" />
            )}
            <img className="home-hero__image home-hero__image--mobile" src={heroImage} alt="" aria-hidden="true" />
            <div className="home-hero__shade" />
          </div>

          <div className="home-hero__content">
            <p className="home-hero__kicker">{wedding.hero_kicker || "A WEDFLIX ORIGINAL"}</p>
            <h1 className="home-hero__names">{wedding.couple_names}</h1>
            <div className="home-hero__headline">
              <span className="home-hero__badge">
                <strong>TOP</strong>
                <strong>10</strong>
              </span>
              <h2>{wedding.invitation_title || "#1 Love In Every Frame"}</h2>
            </div>
            <p className="home-hero__description">
              {wedding.description || "A celebration of love, family, and every moment worth watching again."}
            </p>
            <div className="home-hero__meta">
              <span>{wedding.hero_meta_one || "Memories"}</span>
              <span>{wedding.hero_meta_two || "People"}</span>
              <span>{wedding.hero_meta_three || "Moments"}</span>
            </div>
            <div className="home-hero__actions">
              <button type="button" className="home-btn home-btn--primary" onClick={scrollToFunctions}>
                <span aria-hidden="true">&#9654;</span>
                Play
              </button>
              <button type="button" className="home-btn home-btn--secondary" onClick={scrollToFunctions}>
                <span aria-hidden="true">i</span>
                Browse
              </button>
            </div>
          </div>

          <button
            type="button"
            className={`home-sound-toggle ${isMusicOn ? "is-on" : ""}`}
            onClick={toggleMusic}
            disabled={!pageMusicUrl}
            title={pageMusicUrl ? (isMusicOn ? "Music On" : "Music Off") : "No page music"}
          >
            <span aria-hidden="true">{isMusicOn ? "\u266a" : "\u266b"}</span>
          </button>
        </header>
      )}
      <FavouriteLoginToast visible={favouriteToast.visible} onClose={favouriteToast.hide} />

      <div className="home-rails">
        {rows.map((row) => (
          <section key={row.id} className="home-rail" id={row.id}>
            <div className="home-rail__header">
              <h2>{row.title}</h2>
            </div>
            {isLoading && row.cards.length === 0 ? (
              <Skeleton height={220} count={1} />
            ) : (
              <div className="home-rail__grid">
                {row.cards.map((card) => (
                  <SharePoster key={`${row.id}-${card.id}`} item={card.item} href={card.href} title={card.title} subtitle={card.subtitle} />
                ))}
              </div>
            )}
          </section>
        ))}
        {!isLoading && !rows.length && <p className="empty-rail">No functions are published yet.</p>}
      </div>
    </section>
  );
}
