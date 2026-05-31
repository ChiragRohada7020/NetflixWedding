import React from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { apiGet } from "../api";
import AsyncState from "../components/AsyncState";
import ProgressiveImage from "../components/ProgressiveImage";
import SeoHead from "../components/SeoHead";

const netflixLogoUrl = "https://images.icon-icons.com/2699/PNG/512/netflix_logo_icon_170919.png";

function PublicWeddingPoster({ wedding }) {
  return (
    <motion.div whileHover={{ scale: 1.04 }} className="profile-wrap">
      <Link to={`/share/${wedding._id}/home`} className="home-poster profile-card profile-card--watching">
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

export default function PublicWeddingProfilePage() {
  const { publicSlug, weddingId } = useParams();
  const publicPath = publicSlug ? `/p/${publicSlug}` : `/share/${weddingId}`;
  const { data: wedding, isLoading, error, refetch } = useQuery({
    queryKey: ["public-wedding-profile", publicSlug || weddingId],
    queryFn: () => (
      publicSlug
        ? apiGet(`/api/public-weddings/${publicSlug}`)
        : apiGet(`/api/weddings/${weddingId}`)
    ),
  });

  if (isLoading && !wedding) return <AsyncState mode="loading" />;
  if (error && !wedding) return <AsyncState mode="error" message={error.message} onRetry={() => refetch()} />;

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
      </div>
      <div className="profiles-grid">
        {wedding && <PublicWeddingPoster wedding={wedding} />}
      </div>
    </section>
  );
}
