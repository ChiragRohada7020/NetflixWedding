import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Skeleton from "react-loading-skeleton";
import { apiGet, apiPostForm, mediaUrl } from "../api";
import { useEditMode } from "../components/EditModeContext";
import InlineEditableText from "../components/InlineEditableText";
import AsyncState from "../components/AsyncState";
import SeoHead from "../components/SeoHead";
import LazyHeroVideo from "../components/LazyHeroVideo";
import PremiumWeddingExperience from "../components/PremiumWeddingExperience";
import { prepareAudioForUpload, preparePhotoForUpload } from "../utils/imageUpload";
import useModalHistory from "../utils/useModalHistory";

function toEmbed(url) {
  if (!url) return "";
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : url;
}

function getVideoId(url) {
  if (!url) return "";
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : "";
}

function withPlayerParams(url) {
  if (!url) return "";
  const joiner = url.includes("?") ? "&" : "?";
  const videoId = getVideoId(url);
  const loopParams = videoId ? `&playlist=${videoId}` : "";
  return `${url}${joiner}autoplay=1&mute=1&controls=0&loop=1${loopParams}&playsinline=1&start=0&rel=0&modestbranding=1`;
}

function getPlaceholder(label) {
  const text = (label || "Wedflix").trim().slice(0, 18) || "Wedflix";
  const encoded = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#161616" />
          <stop offset="100%" stop-color="#050505" />
        </linearGradient>
        <radialGradient id="glow" cx="70%" cy="18%" r="80%">
          <stop offset="0%" stop-color="#e50914" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#e50914" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="1280" height="720" fill="url(#bg)" />
      <rect width="1280" height="720" fill="url(#glow)" />
      <text x="70" y="360" fill="#e5e7eb" font-size="88" font-family="Georgia, serif">${text}</text>
      <text x="70" y="430" fill="#8b8b8b" font-size="36" font-family="Arial, sans-serif">Wedflix</text>
    </svg>
  `);
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

function imageFor(item, label) {
  return mediaUrl(item?.thumbnail || item?.profile_image || item?.hero_image || getPlaceholder(label));
}

const netflixLogoUrl = "https://images.icon-icons.com/2699/PNG/512/netflix_logo_icon_170919.png";

function RailPoster({ item, href, title, subtitle, editMode, onEdit, onDelete, dragProps = null }) {
  return (
    <motion.div className="home-poster-wrap" whileHover={{ y: -4, scale: 1.015 }} transition={{ type: "spring", stiffness: 240, damping: 20 }}>
      <Link to={href} className="home-poster" onClick={(e) => editMode && e.preventDefault()}>
        <img src={imageFor(item, title)} alt={title} className="home-poster__image" />
        <div className="home-poster__fade" />
        <div className="home-poster__content">
          <img src={netflixLogoUrl} alt="" aria-hidden="true" className="home-poster__logo" />
          <div className="home-poster__text">
            <p className="home-poster__title">{title}</p>
            <p className="home-poster__subtitle">{subtitle}</p>
          </div>
        </div>
      </Link>

      {editMode && item?._id && (
        <div className="cms-overlay-actions home-poster__admin" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="cms-fab"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit(item);
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className="cms-fab danger"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(item);
            }}
          >
            Delete
          </button>
          {dragProps && (
            <button type="button" className="cms-fab drag" onPointerDown={(e) => e.stopPropagation()} {...dragProps}>
              Drag
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

function StaticRailPoster({ item, href, title, subtitle, editMode, onEdit, onDelete }) {
  return <RailPoster item={item} href={href} title={title} subtitle={subtitle} editMode={editMode} onEdit={onEdit} onDelete={onDelete} />;
}

export default function WeddingDetailPage({ onMusicUrlChange = () => {}, publicMode = false }) {
  const { weddingId } = useParams();
  const queryClient = useQueryClient();
  const { canEdit, editMode } = useEditMode();
  const canManage = canEdit && !publicMode;
  const isEditing = canManage && editMode;
  const weddingBasePath = publicMode ? `/share/${weddingId}` : `/weddings/${weddingId}`;
  const [modal, setModal] = useState(null);
  useModalHistory(Boolean(modal), () => setModal(null));
  const [ordered, setOrdered] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [premiumSeen, setPremiumSeen] = useState(() => localStorage.getItem(`wedflix_premium_seen_${weddingId}`) === "1");
  const [premiumPanel, setPremiumPanel] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["wedding", weddingId, publicMode ? "public" : "admin"],
    queryFn: async () => {
      const [wedding, programs] = await Promise.all([
        apiGet(`/api/weddings/${weddingId}`),
        apiGet(`/api/weddings/${weddingId}/programs`),
      ]);
      return { wedding, programs };
    },
  });
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: () => apiGet("/api/session"),
    retry: false,
    enabled: canManage,
  });

  const wedding = data?.wedding;
  const programs = data?.programs || [];
  const programLimit = Number(session?.plan?.limits?.program_limit || 0);
  const programUsage = Number(session?.usage?.programs ?? programs.length);
  const canAddProgram = Boolean(isEditing && session && (session.is_developer || !programLimit || programUsage < programLimit));

  const mainPrograms = useMemo(
    () => programs.filter((program) => (program.section_key || "main") === "main"),
    [programs],
  );

  const customSections = useMemo(() => {
    const src = Array.isArray(wedding?.custom_sections) ? wedding.custom_sections : [];
    if (src.length) return src;
    if (wedding?.custom_section_label) return [{ key: "custom", label: wedding.custom_section_label }];
    return [];
  }, [wedding?.custom_sections, wedding?.custom_section_label]);

  const programsBySection = useMemo(() => {
    const map = {};
    programs.forEach((program) => {
      const key = (program.section_key || "main").toLowerCase();
      if (!map[key]) map[key] = [];
      map[key].push(program);
    });
    if (customSections.length && map.custom && !map[customSections[0].key]) {
      map[customSections[0].key] = map.custom;
    }
    return map;
  }, [programs, customSections]);

  const mainProgramIds = useMemo(() => mainPrograms.map((program) => program._id).join("|"), [mainPrograms]);
  useEffect(() => {
    setOrdered((prev) => {
      const prevIds = prev.map((program) => program._id).join("|");
      if (prevIds === mainProgramIds) return prev;
      return mainPrograms;
    });
  }, [mainProgramIds, mainPrograms]);
  useEffect(() => {
    onMusicUrlChange(wedding?.music_url || "");
  }, [wedding?.music_url, onMusicUrlChange]);

  const saveProgram = async (payload, programId) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(payload)) {
      if (v === undefined || v === null) continue;
      if (k === "thumbnail_file" && v) {
        fd.append(k, await preparePhotoForUpload(v));
      } else if (k === "music_file" && v) {
        fd.append(k, await prepareAudioForUpload(v));
      } else {
        fd.append(k, v);
      }
    }
    await apiPostForm(`/admin/programs/${programId}/update`, fd);
    setModal(null);
  };

  const saveWeddingField = async (field, val) => {
    if (!wedding) return;
    const invitationTitle = field === "invitation_title" ? val : wedding.invitation_title || "Story Highlight";
    const programsSectionTitle = field === "programs_section_title" ? val : wedding.programs_section_title || "Story Series";
    const fieldValue = (name, fallback = "") => (field === name ? val : (wedding[name] ?? fallback));
    const customSectionsValue = field === "custom_sections" ? (Array.isArray(val) ? val : []) : customSections;
    const customSectionLabel = customSectionsValue[0]?.label || "";
    const venueBlocksValue = field === "venue_blocks" ? (Array.isArray(val) ? val : []) : (Array.isArray(wedding.venue_blocks) ? wedding.venue_blocks : []);
    const venueDetailsValue = field === "venue_details" && val && typeof val === "object" ? val : {};

    const fd = new FormData();
    fd.append("couple_names", field === "couple_names" ? val : wedding.couple_names || "");
    fd.append("wedding_date", field === "wedding_date" ? val : wedding.wedding_date || "");
    fd.append("wedding_time", venueDetailsValue.wedding_time ?? wedding.wedding_time ?? "");
    fd.append("hero_video_url", wedding.hero_video_url || "");
    fd.append("description", wedding.description || "");
    fd.append("venue_eyebrow", venueDetailsValue.venue_eyebrow ?? wedding.venue_eyebrow ?? "You're Invited To");
    fd.append("venue_script", venueDetailsValue.venue_script ?? wedding.venue_script ?? "the story of");
    fd.append("venue_section_label", venueDetailsValue.venue_section_label ?? wedding.venue_section_label ?? "Story Location");
    if (venueDetailsValue.couple_names !== undefined) {
      fd.set("couple_names", venueDetailsValue.couple_names);
    }
    if (venueDetailsValue.wedding_date !== undefined) {
      fd.set("wedding_date", venueDetailsValue.wedding_date);
    }
    fd.append("venue_name", venueDetailsValue.venue_name ?? wedding.venue_name ?? "");
    fd.append("event_address", venueDetailsValue.event_address ?? wedding.event_address ?? "");
    fd.append("venue_map_location", venueDetailsValue.venue_map_location ?? wedding.venue_map_location ?? wedding.event_address ?? "");
    fd.append("venue_description", venueDetailsValue.venue_description ?? wedding.venue_description ?? "");
    fd.append("venue_image", venueDetailsValue.venue_image ?? wedding.venue_image ?? "");
    if (venueDetailsValue.venue_image_file) {
      fd.append("venue_image_file", venueDetailsValue.venue_image_file);
    }
    fd.append("profile_image", wedding.profile_image || "");
    fd.append("music_url", wedding.music_url || "");
    fd.append("access_level", wedding.access_level || "private");
    fd.append("show_on_demo_home", wedding.show_on_demo_home ? "1" : "");
    fd.append("premium_experience_enabled", wedding.premium_experience_enabled ? "1" : "");
    fd.append("hero_kicker", fieldValue("hero_kicker", "A WEDFLIX ORIGINAL"));
    fd.append("hero_badge_top", fieldValue("hero_badge_top", "TOP"));
    fd.append("hero_badge_bottom", fieldValue("hero_badge_bottom", "10"));
    fd.append("hero_meta_one", fieldValue("hero_meta_one", "Celebration"));
    fd.append("hero_meta_two", fieldValue("hero_meta_two", "Family"));
    fd.append("hero_meta_three", fieldValue("hero_meta_three", "Romance"));
    fd.append("invitation_title", invitationTitle);
    fd.append("programs_section_title", programsSectionTitle);
    fd.append("custom_sections_json", JSON.stringify(customSectionsValue));
    fd.append("venue_blocks_json", JSON.stringify(venueBlocksValue));
    fd.append("custom_section_label", customSectionLabel);
    await apiPostForm(`/admin/weddings/${weddingId}/update`, fd);
    await queryClient.invalidateQueries({ queryKey: ["wedding", weddingId] });
  };

  const createProgram = async (payload, sectionKey = "main") => {
    const fd = new FormData();
    fd.append("wedding_id", weddingId);
    fd.append("section_key", sectionKey);
    for (const [k, v] of Object.entries(payload)) {
      if (v === undefined || v === null) continue;
      if (k === "thumbnail_file" && v) {
        fd.append(k, await preparePhotoForUpload(v));
      } else if (k === "music_file" && v) {
        fd.append(k, await prepareAudioForUpload(v));
      } else {
        fd.append(k, v);
      }
    }
    await apiPostForm("/admin/programs/create", fd);
    await queryClient.invalidateQueries({ queryKey: ["wedding", weddingId] });
    await queryClient.invalidateQueries({ queryKey: ["session"] });
    setModal(null);
  };

  const deleteProgram = async (program) => {
    if (!window.confirm(`Delete ${program.title}?`)) return;
    await apiPostForm(`/admin/programs/${program._id}/delete`, new FormData());
    await queryClient.invalidateQueries({ queryKey: ["wedding", weddingId] });
    await queryClient.invalidateQueries({ queryKey: ["session"] });
  };

  const deleteCustomSection = async (sectionKey, sectionLabel) => {
    const sectionPrograms = programs.filter((program) => (program.section_key || "main") === sectionKey);
    const confirmed = window.confirm(
      sectionPrograms.length
        ? `Delete ${sectionLabel}? ${sectionPrograms.length} program(s) will move back to the main section.`
        : `Delete ${sectionLabel}?`
    );
    if (!confirmed) return;

    for (const program of sectionPrograms) {
      await saveProgram({ ...program, section_key: "main", thumbnail: program.thumbnail }, program._id);
    }

    const nextSections = customSections.filter((section) => section.key !== sectionKey);
    await saveWeddingField("custom_sections", nextSections);
  };

  const featuredProgram = ordered[0] || mainPrograms[0] || programs[0] || null;
  const featuredVideoUrl = useMemo(() => withPlayerParams(toEmbed(wedding?.hero_video_url || featuredProgram?.hero_video_url)), [wedding?.hero_video_url, featuredProgram?.hero_video_url]);
  const heroImage = mediaUrl(wedding?.hero_image || wedding?.profile_image || featuredProgram?.thumbnail || getPlaceholder(wedding?.couple_names));
  const pageMusicUrl = mediaUrl(wedding?.music_url || "");
  const scrollToFunctions = () => {
    document.getElementById("programs")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const matchesSearch = (program) => {
    if (!normalizedSearch) return true;
    return [program?.title, program?.event_date, program?.event_time, program?.venue_name, program?.event_address]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch));
  };

  const mainRailSource = ordered.length ? ordered : (mainPrograms.length ? mainPrograms : programs);
  const mainRailCardsVisible = mainRailSource.slice(0, 3).map((program, index) => ({
    item: program,
    href: `${weddingBasePath}/programs/${program._id}`,
    title: program.title || `Season ${index + 1}`,
    subtitle: program.event_date || program.venue_name || `Season ${index + 1}`,
  })).filter((card) => matchesSearch(card.item));

  const [isMusicOn, setIsMusicOn] = useState(() => localStorage.getItem("wedflix_music_on") !== "0");
  const audioRef = useRef(null);
  const pausedForVideoRef = useRef(false);

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

  useEffect(() => {
    const pauseMusicForVideo = () => {
      if (!audioRef.current || !pageMusicUrl) return;
      pausedForVideoRef.current = true;
      audioRef.current.pause();
    };
    const resumeMusicAfterVideo = () => {
      if (!audioRef.current || !pageMusicUrl || !isMusicOn || !pausedForVideoRef.current) return;
      pausedForVideoRef.current = false;
      audioRef.current.play().catch(() => {});
    };
    window.addEventListener("wedflix-video-playing", pauseMusicForVideo);
    window.addEventListener("wedflix-video-stopped", resumeMusicAfterVideo);
    return () => {
      window.removeEventListener("wedflix-video-playing", pauseMusicForVideo);
      window.removeEventListener("wedflix-video-stopped", resumeMusicAfterVideo);
    };
  }, [pageMusicUrl, isMusicOn]);

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

  if (wedding?.premium_experience_enabled && !premiumSeen) {
    return (
      <PremiumWeddingExperience
        wedding={wedding}
        programs={programs}
        basePath={weddingBasePath}
        canEdit={isEditing}
        onSaveWeddingField={saveWeddingField}
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
        basePath={weddingBasePath}
        initialScreen={premiumPanel}
        canEdit={isEditing}
        onSaveWeddingField={saveWeddingField}
        onMusicUrlChange={onMusicUrlChange}
        onComplete={() => setPremiumPanel("")}
      />
    );
  }

  return (
    <section className="home-page home-page--detail">
      <SeoHead
        title={wedding ? `${wedding.couple_names} | Wedflix` : "Wedflix | Story"}
        description={wedding?.description || "Watch story sections, episodes, and cinematic memories on Wedflix."}
        canonicalPath={wedding ? weddingBasePath : "/"}
        image={mediaUrl(wedding?.profile_image || heroImage)}
        type="article"
      />
      <audio ref={audioRef} src={pageMusicUrl} loop preload="metadata" />

      {isLoading && !wedding && <AsyncState mode="loading" />}
      {error && !wedding && <AsyncState mode="error" message={error.message} onRetry={() => refetch()} />}

      {wedding?.premium_experience_enabled && (
        <div className="wedding-top-actions" aria-label="Story quick links">
          <button type="button" onClick={() => setPremiumPanel("invitation")}>Invitation</button>
          <button type="button" onClick={() => setPremiumPanel("venue")}>Location</button>
        </div>
      )}

      {!isLoading && wedding && (
        <header className="home-hero">
          <div className={`home-hero__media ${featuredVideoUrl ? "has-video" : ""}`}>
            {featuredVideoUrl ? (
              <LazyHeroVideo
                src={featuredVideoUrl}
                title="Story Hero"
                poster={heroImage}
                alt={wedding.couple_names}
              />
            ) : (
              <img className="home-hero__image" src={heroImage} alt={wedding.couple_names} loading="eager" decoding="async" />
            )}
            <div
              className="home-hero__mobile-art"
              style={{ backgroundImage: `url(${heroImage})` }}
              aria-hidden="true"
            />
            <div className="home-hero__shade" />
          </div>

          <div className="home-hero__content">
            <InlineEditableText
              as="p"
              className="home-hero__kicker"
              enabled={isEditing}
              value={wedding.hero_kicker ?? "A WEDFLIX ORIGINAL"}
              placeholder="A WEDFLIX ORIGINAL"
              onSave={(v) => saveWeddingField("hero_kicker", v)}
            />
            <InlineEditableText
              as="h1"
              className="home-hero__names"
              enabled={isEditing}
              value={wedding.couple_names}
              placeholder="Story Title"
              onSave={(v) => saveWeddingField("couple_names", v)}
            />
            <div className="home-hero__headline">
              <span className="home-hero__badge">
                <InlineEditableText
                  as="strong"
                  enabled={isEditing}
                  value={wedding.hero_badge_top ?? "TOP"}
                  placeholder="TOP"
                  onSave={(v) => saveWeddingField("hero_badge_top", v)}
                />
                <InlineEditableText
                  as="strong"
                  enabled={isEditing}
                  value={wedding.hero_badge_bottom ?? "10"}
                  placeholder="10"
                  onSave={(v) => saveWeddingField("hero_badge_bottom", v)}
                />
              </span>
              <InlineEditableText
                as="h2"
                className=""
                enabled={isEditing}
                value={wedding.invitation_title || "#1 Love In Every Frame"}
                placeholder="#1 Love In Every Frame"
                onSave={(v) => saveWeddingField("invitation_title", v)}
              />
            </div>
            <p className="home-hero__description">
              {wedding.description || "A simple hello turned into a lifetime together. Through laughter, memories, and countless moments, their story found its way to forever."}
            </p>
            <div className="home-hero__meta">
              <InlineEditableText
                as="span"
                enabled={isEditing}
                value={wedding.hero_meta_one ?? "Celebration"}
                placeholder="Celebration"
                onSave={(v) => saveWeddingField("hero_meta_one", v)}
              />
              <InlineEditableText
                as="span"
                enabled={isEditing}
                value={wedding.hero_meta_two ?? "Family"}
                placeholder="Family"
                onSave={(v) => saveWeddingField("hero_meta_two", v)}
              />
              <InlineEditableText
                as="span"
                enabled={isEditing}
                value={wedding.hero_meta_three ?? "Romance"}
                placeholder="Romance"
                onSave={(v) => saveWeddingField("hero_meta_three", v)}
              />
            </div>
            <div className="home-hero__actions">
              <button type="button" className="home-btn home-btn--primary" onClick={scrollToFunctions}>
                <span aria-hidden="true">▶</span>
                Play
              </button>
              <button type="button" className="home-btn home-btn--secondary" onClick={scrollToFunctions}>
                <span aria-hidden="true">ⓘ</span>
                More Info
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
            <span aria-hidden="true">{isMusicOn ? "♪" : "♫"}</span>
          </button>
        </header>
      )}

      <div className="home-rails">
        <section className="home-rail" id="programs">
          <div className="wedding-detail-search-wrap">
            <input
              className="search wedding-detail-search"
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search sections, dates, locations..."
              aria-label="Search story sections"
            />
          </div>
          <div className="home-rail__header">
            <InlineEditableText
              as="h2"
              className="home-rail__heading-editable"
              enabled={isEditing}
              value={wedding?.programs_section_title || "The Celebration Series"}
              placeholder="The Celebration Series"
              onSave={(v) => saveWeddingField("programs_section_title", v)}
            />
          </div>
          {isLoading && mainRailCardsVisible.length === 0 ? (
            <Skeleton height={220} count={1} />
          ) : (
            <div className="home-rail__grid">
              {mainRailCardsVisible.map((card) => (
                <StaticRailPoster
                  key={card.item._id}
                  item={card.item}
                  href={card.href}
                  title={card.title}
                  subtitle={card.subtitle}
                  editMode={isEditing}
                  onEdit={(item) => setModal({ type: "edit", item, sectionKey: item.section_key || "main" })}
                  onDelete={deleteProgram}
                />
              ))}
              {canAddProgram && (
                <button type="button" className="add-card-tile" onClick={() => setModal({ type: "create", item: {}, sectionKey: "main" })}>
                  <span className="add-card-plus">+</span>
                  <span>Add Section</span>
                </button>
              )}
            </div>
          )}
        </section>

        {customSections.map((section, index) => {
          const sectionPrograms = (programsBySection[section.key] || [])
            .filter((program) => (program.section_key || "main") !== "main")
            .filter(matchesSearch);
          const sectionId = section.key || `custom-${index}`;
          return (
            <section className="home-rail" key={sectionId} id={sectionId}>
              <div className="home-rail__header">
                <InlineEditableText
                  as="h2"
                  className="home-rail__heading-editable"
                  enabled={isEditing}
                  value={section.label || `Custom Box ${index + 1}`}
                  placeholder={`Custom Box ${index + 1}`}
                  onSave={(v) => {
                    const next = customSections.map((item, idx) => (idx === index ? { ...item, label: v } : item));
                    return saveWeddingField("custom_sections", next);
                  }}
                />
                {isEditing && (
                  <button
                    type="button"
                    className="cms-fab danger home-rail__delete-box"
                    onClick={() => deleteCustomSection(section.key, section.label || `Custom Box ${index + 1}`)}
                  >
                    Delete Box
                  </button>
                )}
              </div>
              <div className="home-rail__grid">
                {sectionPrograms.map((card) => (
                  <StaticRailPoster
                    key={card._id}
                    item={card}
                    href={`${weddingBasePath}/programs/${card._id}`}
                    title={card.title || "Program"}
                    subtitle={card.event_date || card.venue_name || "Custom Box"}
                    editMode={isEditing}
                    onEdit={(item) => setModal({ type: "edit", item, sectionKey: item.section_key || section.key })}
                    onDelete={deleteProgram}
                  />
                ))}
                {canAddProgram && (
                  <button className="add-card-tile" onClick={() => setModal({ type: "create", item: {}, sectionKey: section.key })}>
                    <span className="add-card-plus">+</span>
                    <span>Add Section</span>
                  </button>
                )}
              </div>
            </section>
          );
        })}

        {isEditing && (
          <div className="home-admin-fab-row">
            {canAddProgram && (
              <button type="button" className="cms-fab" onClick={() => setModal({ type: "create", item: {}, sectionKey: "main" })}>
                Add Section
              </button>
            )}
            <button
              type="button"
              className="add-card-tile add-card-tile--compact"
              onClick={async () => {
                const nextIdx = customSections.length + 1;
                const key = `custom_${Date.now()}`;
                const next = [...customSections, { key, label: `Custom Box ${nextIdx}` }];
                await saveWeddingField("custom_sections", next);
              }}
            >
              <span className="add-card-plus">+</span>
              <span>Add Custom Box</span>
            </button>
          </div>
        )}
      </div>

      {modal && (
        <div className="cms-modal-backdrop" onClick={() => setModal(null)}>
          <div className="cms-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{modal.type === "create" ? "Add Section" : "Edit Section"}</h3>
            <ProgramForm
              initial={modal.item}
              onCancel={() => setModal(null)}
              onSubmit={async (values) => {
                if (modal.type === "create") {
                  await createProgram(values, modal.sectionKey || "main");
                  return;
                }
                await saveProgram(values, modal.item._id);
                await queryClient.invalidateQueries({ queryKey: ["wedding", weddingId] });
                setModal(null);
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function ProgramForm({ initial, onSubmit, onCancel }) {
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    title: initial.title || "",
    thumbnail: initial.thumbnail || "",
    thumbnail_file: null,
    hero_video_url: initial.hero_video_url || "",
    event_date: initial.event_date || "",
    event_time: initial.event_time || "",
    venue_name: initial.venue_name || "",
    event_address: initial.event_address || "",
    music_url: initial.music_url || "",
    music_file: null,
    order: initial.order || 0,
  });

  return (
    <form
      className="cms-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaveError("");
        setIsSaving(true);
        try {
          await onSubmit(form);
        } catch (err) {
          setSaveError(err?.message || "Save failed. Please try again.");
        } finally {
          setIsSaving(false);
        }
      }}
    >
      <div className="cms-form-grid">
        <label className="cms-field">
          <span>Section Title</span>
          <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Haldi Ceremony" disabled={isSaving} />
        </label>
        <label className="cms-field">
          <span>Thumbnail URL</span>
          <input value={form.thumbnail} onChange={(e) => setForm((p) => ({ ...p, thumbnail: e.target.value }))} placeholder="https://..." disabled={isSaving} />
        </label>
        <label className="cms-field">
          <span>Upload Thumbnail</span>
          <input type="file" accept="image/*" onChange={(e) => setForm((p) => ({ ...p, thumbnail_file: e.target.files?.[0] || null }))} disabled={isSaving} />
        </label>
        <label className="cms-field">
          <span>Feature Video URL</span>
          <input value={form.hero_video_url} onChange={(e) => setForm((p) => ({ ...p, hero_video_url: e.target.value }))} placeholder="https://youtube.com/watch?v=..." disabled={isSaving} />
        </label>
        <label className="cms-field">
          <span>Date</span>
          <input value={form.event_date} onChange={(e) => setForm((p) => ({ ...p, event_date: e.target.value }))} placeholder="2026-12-04" disabled={isSaving} />
        </label>
        <label className="cms-field">
          <span>Time</span>
          <input value={form.event_time} onChange={(e) => setForm((p) => ({ ...p, event_time: e.target.value }))} placeholder="07:30 PM" disabled={isSaving} />
        </label>
        <label className="cms-field">
          <span>Location Name</span>
          <input value={form.venue_name} onChange={(e) => setForm((p) => ({ ...p, venue_name: e.target.value }))} placeholder="Grand Palace" disabled={isSaving} />
        </label>
        <label className="cms-field cms-field-wide">
          <span>Address</span>
          <input value={form.event_address} onChange={(e) => setForm((p) => ({ ...p, event_address: e.target.value }))} placeholder="Full venue address..." disabled={isSaving} />
        </label>
        <label className="cms-field cms-field-wide">
          <span>Music URL</span>
          <input value={form.music_url} onChange={(e) => setForm((p) => ({ ...p, music_url: e.target.value }))} placeholder="https://cdn.example.com/song.mp3" disabled={isSaving} />
        </label>
        <label className="cms-field cms-field-wide">
          <span>Upload Music</span>
          <input type="file" accept="audio/*" onChange={(e) => setForm((p) => ({ ...p, music_file: e.target.files?.[0] || null }))} disabled={isSaving} />
        </label>
        <label className="cms-field">
          <span>Display Order</span>
          <input value={form.order} onChange={(e) => setForm((p) => ({ ...p, order: e.target.value }))} placeholder="0" disabled={isSaving} />
        </label>
      </div>
      {saveError && <p className="error">{saveError}</p>}
      <div className="cms-form-actions">
        <button type="button" className="cms-fab" onClick={onCancel} disabled={isSaving}>
          Cancel
        </button>
        <button type="submit" className="cms-fab" disabled={isSaving}>
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}
