import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { apiGetPublic } from "../api";
import AsyncState from "../components/AsyncState";
import ProgressiveImage from "../components/ProgressiveImage";
import SeoHead from "../components/SeoHead";
import { isFavouriteWedding, removeFavouriteWedding, saveFavouriteWedding } from "../utils/favourites";

const netflixLogoUrl = "https://images.icon-icons.com/2699/PNG/512/netflix_logo_icon_170919.png";

function getProfilePlaceholder(label = "Wedflix") {
  const text = encodeURIComponent((label || "Wedflix").trim().slice(0, 18) || "Wedflix");
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 780'%3E%3Crect width='600' height='780' fill='%23141414'/%3E%3Crect x='38' y='38' width='524' height='704' rx='34' fill='%23090909' stroke='%23e50914' stroke-width='8'/%3E%3Ctext x='300' y='372' text-anchor='middle' fill='%23e50914' font-size='84' font-family='Arial,sans-serif' font-weight='900'%3EW%3C/text%3E%3Ctext x='300' y='452' text-anchor='middle' fill='%23f5f5f5' font-size='34' font-family='Arial,sans-serif' font-weight='700'%3E${text}%3C/text%3E%3C/svg%3E`;
}

function PublicWedflixCard({ wedding, priority }) {
  const favouritePath = `/share/${wedding._id}/home`;
  const [saved, setSaved] = useState(() => isFavouriteWedding(favouritePath) || isFavouriteWedding(wedding._id));
  return (
    <motion.div whileHover={{ scale: 1.04 }} className="profile-wrap">
      <Link to={favouritePath} className="home-poster profile-card profile-card--watching">
        <ProgressiveImage
          src={wedding.profile_image}
          alt={wedding.couple_names}
          className="profile-card__image"
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          fallbackSrc={getProfilePlaceholder(wedding.couple_names)}
        />
        <div className="home-poster__fade" />
        <div className="home-poster__content">
          <img src={netflixLogoUrl} alt="" aria-hidden="true" className="home-poster__logo" />
          <div className="home-poster__text">
            <p className="home-poster__title">{wedding.couple_names}</p>
            <p className="home-poster__subtitle">{wedding.wedding_date || "Public Wedding"}</p>
          </div>
        </div>
      </Link>
      <button
        type="button"
        className={`favourite-card-heart ${saved ? "is-saved" : ""}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (saved) {
            removeFavouriteWedding(favouritePath);
            setSaved(false);
            return;
          }
          saveFavouriteWedding({ ...wedding, path: favouritePath });
          setSaved(true);
        }}
        aria-label={saved ? "Remove from favourites" : "Save to favourites"}
        title={saved ? "Remove from favourites" : "Save to favourites"}
      >
        <span aria-hidden="true">{saved ? "♥" : "♡"}</span>
      </button>
    </motion.div>
  );
}

export default function PublicUserWedflixPage() {
  const { userId } = useParams();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["public-user-wedflix", userId],
    queryFn: () => apiGetPublic(`/api/public-users/${userId}/weddings`),
  });

  const weddings = data?.weddings || [];
  const name = data?.user?.name || "Wedflix";

  if (isLoading && !data) return <AsyncState mode="loading" />;
  if (error && !data) return <AsyncState mode="error" title="Public Wedflix Unavailable" message={error.message} onRetry={() => refetch()} />;

  return (
    <section className="home-shell home-profiles-netflix public-profile-home">
      <SeoHead
        title={`${name} | Public Wedflix`}
        description={`Watch public wedding stories from ${name} on Wedflix.`}
        canonicalPath={`/u/${userId}`}
      />
      <div className="home-center">
        <h1 className="home-title">{name}&apos;s Wedflix</h1>
      </div>
      <div className="profiles-grid">
        {weddings.map((wedding, index) => (
          <PublicWedflixCard key={wedding._id} wedding={wedding} priority={index < 2} />
        ))}
      </div>
      {!weddings.length && <p className="favourites-empty public-wedflix-empty">No public weddings are available yet.</p>}
    </section>
  );
}
