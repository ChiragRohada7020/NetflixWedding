import React, { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { apiGet, apiGetPublic } from "../api";
import AsyncState from "../components/AsyncState";
import ProgressiveImage from "../components/ProgressiveImage";
import SeoHead from "../components/SeoHead";
import FavouriteLoginToast, { useFavouriteLoginToast } from "../components/FavouriteLoginToast";
import { isFavouriteWedding, removeFavouriteWedding, saveFavouriteWedding } from "../utils/favourites";

const netflixLogoUrl = "https://images.icon-icons.com/2699/PNG/512/netflix_logo_icon_170919.png";

function PublicWeddingPoster({ wedding, href }) {
  return (
    <motion.div whileHover={{ scale: 1.04 }} className="profile-wrap">
      <Link to={href} className="home-poster profile-card profile-card--watching">
        <ProgressiveImage src={wedding.profile_image} alt={wedding.couple_names} className="profile-card__image" />
        <div className="home-poster__fade" />
        <div className="home-poster__content">
          <img src={netflixLogoUrl} alt="" aria-hidden="true" className="home-poster__logo" />
          <div className="home-poster__text">
            <p className="home-poster__title">{wedding.couple_names}</p>
            <p className="home-poster__subtitle">{wedding.wedding_date}</p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function PublicWeddingProfilePage({ openHome = false }) {
  const { publicSlug, weddingId } = useParams();
  const publicPath = publicSlug ? `/p/${publicSlug}` : `/share/${weddingId}`;
  const [saved, setSaved] = useState(false);
  const favouriteToast = useFavouriteLoginToast();
  const { data: session } = useQuery({ queryKey: ["session"], queryFn: () => apiGet("/api/session"), retry: false });
  const userId = session?.authenticated ? session.user_id : "";
  const { data: wedding, isLoading, error, refetch } = useQuery({
    queryKey: ["public-wedding-profile", publicSlug || weddingId],
    queryFn: () => (
      publicSlug
        ? apiGetPublic(`/api/public-weddings/${publicSlug}`)
        : apiGetPublic(`/api/weddings/${weddingId}`)
    ),
  });
  useEffect(() => {
    setSaved(isFavouriteWedding(publicPath, userId) || (wedding?._id ? isFavouriteWedding(`/share/${wedding._id}/home`, userId) : false));
  }, [publicPath, userId, wedding?._id]);

  if (isLoading && !wedding) return <AsyncState mode="loading" />;
  if (error && !wedding) {
    const isPrivate = error.status === 401 || error.status === 403;
    return (
      <AsyncState
        mode="error"
        title={isPrivate ? "Wedding Is Private" : "Public Link Unavailable"}
        message={
          isPrivate
            ? "Login as admin, edit this wedding, and set Access Level to Public. Then the /p public link will open for guests."
            : error.message
        }
        onRetry={() => refetch()}
      />
    );
  }

  const publicHomePath = wedding?._id ? `/share/${wedding._id}/home` : `${publicPath}/home`;
  if (openHome && wedding?._id) {
    return <Navigate to={publicHomePath} replace />;
  }

  return (
    <section className="home-shell home-profiles-netflix public-profile-home">
      <SeoHead
        title={wedding ? `${wedding.couple_names} | Wedflix` : "Wedflix"}
        description={wedding?.description || "Choose this wedding profile on Wedflix."}
        canonicalPath={publicPath}
        image={wedding?.profile_image || `${window.location.origin}/favicon.svg`}
      />
      <div className="home-center">
        <h1 className="home-title">Who&apos;s Watching?</h1>
        {wedding && (
          <button
            type="button"
            className={`favourite-heart-btn ${saved ? "is-saved" : ""}`}
            onClick={() => {
              if (saved) {
                removeFavouriteWedding(publicHomePath, userId);
                setSaved(false);
                return;
              }
              if (!userId) {
                favouriteToast.show();
                return;
              }
              saveFavouriteWedding({ ...wedding, path: publicHomePath }, userId);
              setSaved(true);
            }}
            aria-label={userId ? (saved ? "Remove from favourites" : "Save to favourites") : "Login to save favourites"}
            title={userId ? (saved ? "Remove from favourites" : "Save to favourites") : "Login to save favourites"}
          >
            <span aria-hidden="true">{saved ? "♥" : "♡"}</span>
          </button>
        )}
      </div>
      <div className="profiles-grid">
        {wedding && <PublicWeddingPoster wedding={wedding} href={publicHomePath} />}
      </div>
      <FavouriteLoginToast visible={favouriteToast.visible} onClose={favouriteToast.hide} />
    </section>
  );
}
