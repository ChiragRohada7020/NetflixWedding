import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import ProgressiveImage from "../components/ProgressiveImage";
import AsyncState from "../components/AsyncState";
import SeoHead from "../components/SeoHead";
import { apiGet } from "../api";
import { FAVOURITES_CHANGED_EVENT, getFavouriteWeddings, removeFavouriteWedding } from "../utils/favourites";

const netflixLogoUrl = "https://images.icon-icons.com/2699/PNG/512/netflix_logo_icon_170919.png";

function getProfilePlaceholder(label = "Wedflix") {
  const text = encodeURIComponent((label || "Wedflix").trim().slice(0, 18) || "Wedflix");
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 780'%3E%3Crect width='600' height='780' fill='%23141414'/%3E%3Crect x='38' y='38' width='524' height='704' rx='34' fill='%23090909' stroke='%23e50914' stroke-width='8'/%3E%3Ctext x='300' y='372' text-anchor='middle' fill='%23e50914' font-size='84' font-family='Arial,sans-serif' font-weight='900'%3EW%3C/text%3E%3Ctext x='300' y='452' text-anchor='middle' fill='%23f5f5f5' font-size='34' font-family='Arial,sans-serif' font-weight='700'%3E${text}%3C/text%3E%3C/svg%3E`;
}

function FavouritePosterCard({ favourite, isAuthenticated, onRemove }) {
  const href = isAuthenticated && favourite.id ? `/weddings/${favourite.id}` : favourite.path;
  const shareFavourite = async () => {
    const url = `${window.location.origin}${favourite.path || href}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: favourite.title || "Wedflix favourite", text: "Watch this wedding on Wedflix.", url });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
      window.alert("Favourite link copied.");
    } catch {
      window.prompt("Copy this favourite link", url);
    }
  };
  return (
    <motion.div whileHover={{ scale: 1.04 }} className="profile-wrap favourite-profile-wrap">
      <Link to={href} className="home-poster profile-card profile-card--watching">
        <ProgressiveImage
          src={favourite.image}
          alt={favourite.title}
          className="profile-card__image"
          fallbackSrc={getProfilePlaceholder(favourite.title)}
        />
        <div className="home-poster__fade" />
        <div className="home-poster__content">
          <img src={netflixLogoUrl} alt="" aria-hidden="true" className="home-poster__logo" />
          <div className="home-poster__text">
            <p className="home-poster__title">{favourite.title}</p>
            <p className="home-poster__subtitle">{favourite.subtitle || "Saved Wedding"}</p>
            {favourite.ownerName && <p className="home-poster__owner">Owner: {favourite.ownerName}</p>}
          </div>
        </div>
      </Link>
      <button type="button" className="favourite-remove-btn" onClick={() => onRemove(favourite)}>
        Remove
      </button>
      <button type="button" className="favourite-share-btn" onClick={shareFavourite}>
        Share
      </button>
    </motion.div>
  );
}

export default function FavouritesPage() {
  const { data: session, isLoading } = useQuery({
    queryKey: ["session"],
    queryFn: () => apiGet("/api/session"),
    retry: false,
  });
  const userId = session?.authenticated ? session.user_id : "";
  const [search, setSearch] = useState("");
  const [favourites, setFavourites] = useState(() => getFavouriteWeddings(userId));

  useEffect(() => {
    setFavourites(getFavouriteWeddings(userId));
  }, [userId]);

  useEffect(() => {
    const refreshFavourites = () => setFavourites(getFavouriteWeddings(userId));
    window.addEventListener(FAVOURITES_CHANGED_EVENT, refreshFavourites);
    window.addEventListener("storage", refreshFavourites);
    return () => {
      window.removeEventListener(FAVOURITES_CHANGED_EVENT, refreshFavourites);
      window.removeEventListener("storage", refreshFavourites);
    };
  }, [userId]);

  const filteredFavourites = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return favourites;
    return favourites.filter((item) =>
      [item.title, item.subtitle, item.ownerName].some((value) => String(value || "").toLowerCase().includes(query))
    );
  }, [favourites, search]);

  if (isLoading && !session) return <AsyncState mode="loading" />;

  return (
    <section className="home-shell home-profiles-netflix favourites-page">
      <SeoHead
        title="Wedflix | Favourites"
        description="Search and open your saved Wedflix wedding favourites."
        canonicalPath="/favourites"
      />
      <div className="home-center favourites-page__head">
        <h1 className="home-title">Favourites</h1>
        <input
          className="favourites-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search favourites"
          aria-label="Search favourites"
        />
      </div>
      {!session?.authenticated ? (
        <p className="favourites-empty">Login to see your saved favourites.</p>
      ) : filteredFavourites.length ? (
        <div className="profiles-grid profiles-grid--favourites">
          {filteredFavourites.map((favourite) => (
            <FavouritePosterCard
              key={`${favourite.id}-${favourite.path}`}
              favourite={favourite}
              isAuthenticated={Boolean(session?.authenticated)}
              onRemove={(item) => setFavourites(removeFavouriteWedding(item.path, userId))}
            />
          ))}
        </div>
      ) : (
        <p className="favourites-empty">{favourites.length ? "No favourites match your search." : "Saved public wedding cards will appear here."}</p>
      )}
    </section>
  );
}
