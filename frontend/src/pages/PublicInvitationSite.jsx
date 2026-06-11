import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiGet, apiGetPublic, apiPostForm, mediaUrl } from "../api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import AsyncState from "../components/AsyncState";
import InlineEditableText from "../components/InlineEditableText";
import SeoHead from "../components/SeoHead";
import { useEditMode } from "../components/EditModeContext";
import { preparePhotoForUpload } from "../utils/imageUpload";

function placeholder(label) {
  const text = encodeURIComponent((label || "Wedding Invitation").trim().slice(0, 28));
  return `data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 900'%3E%3Cdefs%3E%3CradialGradient id='g' cx='50%25' cy='35%25' r='75%25'%3E%3Cstop stop-color='%23fff3eb'/%3E%3Cstop offset='1' stop-color='%23e9b6c5'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='1200' height='900' fill='url(%23g)'/%3E%3Ctext x='600' y='455' text-anchor='middle' fill='%2384132a' font-size='74' font-family='Georgia,serif' font-weight='700'%3E${text}%3C/text%3E%3C/svg%3E`;
}

function splitNames(value) {
  const parts = String(value || "The Couple").split("&").map((part) => part.trim()).filter(Boolean);
  return parts.length >= 2 ? parts.slice(0, 2) : [parts[0] || "The Couple", ""];
}

function dateParts(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return { day: "", month: value || "Wedding Date", year: "", weekday: "" };
  return {
    day: String(date.getDate()).padStart(2, "0"),
    month: date.toLocaleString("en", { month: "long" }),
    year: String(date.getFullYear()),
    weekday: date.toLocaleString("en", { weekday: "long" }),
  };
}

function inviteHash(names) {
  const compact = String(names || "WedflixForever").replace(/[^a-z0-9]+/gi, "");
  return `#${compact.slice(0, 24) || "WedflixForever"}`;
}

function mapsUrl(address) {
  if (/^https?:\/\//i.test(address || "")) return address;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || "")}`;
}

function readableDate(value, fallback) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return fallback || value || "Wedding Date";
  return date.toLocaleDateString("en", { day: "2-digit", month: "long", year: "numeric" });
}

function timelineEvents(programs, wedding, venueName, heroImage) {
  const fallbackDate = readableDate(wedding?.wedding_date, "Wedding Date");
  const fallback = [
    { title: "Carnival", event_time: "12:00 PM Onwards", event_date: fallbackDate, description: "Attire: Multicolor Outfits" },
    { title: "Reception Night", event_time: "08:30 PM Onwards", event_date: fallbackDate, description: "Attire: Blazer & One Piece" },
    { title: "Vedic Vidhi", event_time: "12:00 PM Onwards", event_date: fallbackDate, description: "Attire: Traditional" },
  ];
  const source = programs.length ? programs.slice(0, 6) : fallback;
  return source.map((event, index) => ({
    key: event._id || `timeline-${index}`,
    programId: event._id || "",
    title: event.title || fallback[index % fallback.length].title,
    time: event.event_time || event.time || fallback[index % fallback.length].event_time,
    rawDate: event.event_date || wedding?.wedding_date || "",
    date: readableDate(event.event_date || wedding?.wedding_date, fallback[index % fallback.length].event_date),
    attire: event.attire || event.dress_code || event.description || fallback[index % fallback.length].description,
    image: mediaUrl(event.thumbnail || "") || heroImage,
    raw: event,
  }));
}

function countdownParts(value) {
  const target = new Date(value || "");
  if (Number.isNaN(target.getTime())) return { days: "--", hours: "--", minutes: "--" };
  const diff = Math.max(0, target.getTime() - Date.now());
  return {
    days: String(Math.floor(diff / 86400000)).padStart(2, "0"),
    hours: String(Math.floor((diff % 86400000) / 3600000)).padStart(2, "0"),
    minutes: String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0"),
  };
}

function EditableImage({ src, alt, enabled, className = "", onFile }) {
  const inputRef = useRef(null);
  if (!enabled) {
    return <img src={src} alt={alt} className={className} />;
  }
  return (
    <button
      type="button"
      className={`invite-editable-image ${className}`.trim()}
      onClick={() => inputRef.current?.click()}
      title="Click to change image"
    >
      <img src={src} alt={alt} />
      <span>Change image</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
    </button>
  );
}

function editableGalleryItems(heroImage, programs) {
  return [
    { key: "hero", image: heroImage, program: null },
    ...programs
      .map((program) => ({ key: program._id, image: mediaUrl(program.thumbnail || ""), program }))
      .filter((item) => item.image),
  ].slice(0, 8);
}

function guessStorageKey(publicSlug) {
  return `wedflix_invite_guess_${publicSlug || "guest"}`;
}

function getGuessPercents(votes) {
  const total = Math.max(1, Object.values(votes).reduce((sum, value) => sum + value, 0));
  return {
    first: Math.round(((votes.first || 0) / total) * 100),
    second: Math.round(((votes.second || 0) / total) * 100),
    both: Math.round(((votes.both || 0) / total) * 100),
  };
}

export default function PublicInvitationSite() {
  const { publicSlug } = useParams();
  const queryClient = useQueryClient();
  const { canEdit, editMode, toggleEditMode } = useEditMode();
  const isEditing = canEdit && editMode;
  const [revealed, setRevealed] = useState(false);
  const [bursting, setBursting] = useState(false);
  const [scratchOpen, setScratchOpen] = useState(false);
  const [scratchProgress, setScratchProgress] = useState(0);
  const [scratchPoints, setScratchPoints] = useState([]);
  const [guessChoice, setGuessChoice] = useState("");
  const [guessVotes, setGuessVotes] = useState({ first: 4, second: 3, both: 7 });
  const bgInputRef = useRef(null);
  const audioRef = useRef(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["public-invitation-site", publicSlug],
    queryFn: async () => {
      const wedding = await apiGetPublic(`/api/public-weddings/${publicSlug}`);
      const programs = await apiGet(`/api/weddings/${wedding._id}/programs`);
      return { wedding, programs };
    },
  });

  const wedding = data?.wedding;
  const programs = data?.programs || [];
  const featured = programs[0] || {};
  const [firstName, secondName] = splitNames(wedding?.couple_names);
  const date = dateParts(wedding?.wedding_date);
  const heroImage = mediaUrl(wedding?.hero_image || wedding?.profile_image || featured.thumbnail || "") || placeholder(wedding?.couple_names);
  const venueName = wedding?.venue_name || featured.venue_name || "Wedding Venue";
  const venueAddress = wedding?.event_address || featured.event_address || "";
  const weddingTime = wedding?.wedding_time || featured.event_time || "";
  const musicUrl = mediaUrl(wedding?.music_url || "");
  const invitationBgImage = mediaUrl(wedding?.invitation_bg_image || "") || "/invite-floral-bg.png";
  const initials = `${(firstName || "W").charAt(0)}${(secondName || "F").charAt(0)}`;
  const inviteTitle = wedding?.invitation_title || "Wedding Invitation";
  const countdown = countdownParts(wedding?.wedding_date);
  const galleryItems = editableGalleryItems(heroImage, programs);
  const inviteEvents = useMemo(() => timelineEvents(programs, wedding, venueName, heroImage), [programs, wedding, venueName, heroImage]);

  const refreshInvite = async () => {
    await queryClient.invalidateQueries({ queryKey: ["public-invitation-site", publicSlug] });
  };

  const saveWeddingPatch = async (patch) => {
    if (!wedding?._id) return;
    const fd = new FormData();
    const value = (field, fallback = "") => patch[field] ?? wedding[field] ?? fallback;
    fd.append("couple_names", value("couple_names"));
    fd.append("wedding_date", value("wedding_date"));
    fd.append("wedding_time", value("wedding_time"));
    fd.append("hero_video_url", value("hero_video_url"));
    fd.append("description", value("description"));
    fd.append("venue_name", value("venue_name"));
    fd.append("event_address", value("event_address"));
    fd.append("venue_eyebrow", value("venue_eyebrow", "You're Invited To"));
    fd.append("venue_script", value("venue_script", "the wedding of"));
    fd.append("venue_section_label", value("venue_section_label", "Our Venue"));
    fd.append("venue_map_location", value("venue_map_location", wedding.event_address || ""));
    fd.append("venue_description", value("venue_description"));
    fd.append("venue_image", value("venue_image"));
    fd.append("invitation_bg_image", value("invitation_bg_image"));
    fd.append("profile_image", value("profile_image"));
    fd.append("music_url", value("music_url"));
    fd.append("access_level", value("access_level", "private"));
    fd.append("show_on_demo_home", wedding.show_on_demo_home ? "1" : "");
    fd.append("premium_experience_enabled", wedding.premium_experience_enabled ? "1" : "");
    fd.append("hero_kicker", value("hero_kicker", "A WEDDING ORIGINAL"));
    fd.append("hero_badge_top", value("hero_badge_top", "TOP"));
    fd.append("hero_badge_bottom", value("hero_badge_bottom", "10"));
    fd.append("hero_meta_one", value("hero_meta_one", "Celebration"));
    fd.append("hero_meta_two", value("hero_meta_two", "Family"));
    fd.append("hero_meta_three", value("hero_meta_three", "Romance"));
    fd.append("invitation_title", value("invitation_title", "Wedding Invitation"));
    fd.append("programs_section_title", value("programs_section_title", "Wedding Programs"));
    fd.append("custom_sections_json", JSON.stringify(Array.isArray(wedding.custom_sections) ? wedding.custom_sections : []));
    fd.append("venue_blocks_json", JSON.stringify(Array.isArray(wedding.venue_blocks) ? wedding.venue_blocks : []));
    fd.append("custom_section_label", value("custom_section_label"));
    if (patch.profile_image_file) {
      fd.append("profile_image_file", await preparePhotoForUpload(patch.profile_image_file));
    }
    if (patch.invitation_bg_image_file) {
      fd.append("invitation_bg_image_file", await preparePhotoForUpload(patch.invitation_bg_image_file));
    }
    await apiPostForm(`/admin/weddings/${wedding._id}/update`, fd);
    await refreshInvite();
  };

  const saveProgramPatch = async (program, patch) => {
    if (!program?._id) return;
    const fd = new FormData();
    const value = (field, fallback = "") => patch[field] ?? program[field] ?? fallback;
    fd.append("title", value("title"));
    fd.append("description", value("description"));
    fd.append("event_date", value("event_date"));
    fd.append("event_time", value("event_time"));
    fd.append("venue_name", value("venue_name", venueName));
    fd.append("event_address", value("event_address", venueAddress));
    fd.append("video_url", value("video_url"));
    fd.append("thumbnail", value("thumbnail"));
    fd.append("music_url", value("music_url"));
    fd.append("section_key", value("section_key", "main"));
    if (patch.thumbnail_file) {
      fd.append("thumbnail_file", await preparePhotoForUpload(patch.thumbnail_file));
    }
    await apiPostForm(`/admin/programs/${program._id}/update`, fd);
    await refreshInvite();
  };

  const addWeddingProgram = async () => {
    if (!wedding?._id) return;
    const fd = new FormData();
    fd.append("wedding_id", wedding._id);
    fd.append("title", `Wedding Program ${programs.length + 1}`);
    fd.append("event_date", wedding.wedding_date || "");
    fd.append("event_time", wedding.wedding_time || "");
    fd.append("venue_name", venueName);
    fd.append("event_address", venueAddress);
    fd.append("thumbnail", heroImage);
    fd.append("music_url", "");
    fd.append("section_key", "main");
    fd.append("order", String(programs.length));
    fd.append("event_sections_json", JSON.stringify([]));
    await apiPostForm("/admin/programs/create", fd);
    await refreshInvite();
  };

  const revealInvite = async () => {
    setBursting(true);
    if (musicUrl) {
      setTimeout(() => audioRef.current?.play().catch(() => {}), 120);
    }
    window.setTimeout(() => setRevealed(true), 920);
  };

  const scratchReveal = (event) => {
    if (scratchOpen) return;
    if (event.type === "click") {
      setScratchOpen(true);
      setScratchProgress(100);
      return;
    }
    if (event.type === "pointermove" && event.buttons !== 1) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.round(event.clientX - rect.left);
    const y = Math.round(event.clientY - rect.top);
    setScratchPoints((points) => [...points.slice(-10), `${x}px ${y}px`]);
    setScratchProgress((progress) => {
      const next = Math.min(100, progress + (event.type === "pointerdown" ? 8 : 4));
      if (next >= 78) setScratchOpen(true);
      return next;
    });
  };

  const chooseGuess = (choice) => {
    if (guessChoice) return;
    const next = { ...guessVotes, [choice]: (guessVotes[choice] || 0) + 1 };
    setGuessChoice(choice);
    setGuessVotes(next);
    localStorage.setItem(guessStorageKey(publicSlug), JSON.stringify({ choice, votes: next }));
  };

  const guessPercents = getGuessPercents(guessVotes);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(guessStorageKey(publicSlug)) || "null");
      if (saved?.votes) setGuessVotes(saved.votes);
      if (saved?.choice) setGuessChoice(saved.choice);
    } catch {
      setGuessChoice("");
    }
  }, [publicSlug]);

  if (isLoading && !data) return <AsyncState mode="loading" />;
  if (error && !data) return <AsyncState mode="error" message={error.message} onRetry={() => refetch()} />;

  return (
    <main className={`invite-site ${revealed ? "is-revealed" : ""}`} style={{ "--invite-bg-image": `url(${invitationBgImage})` }}>
      <SeoHead
        title={wedding ? `${wedding.couple_names} Wedding Invitation` : "Wedding Invitation"}
        description={wedding?.description || "You are invited to the wedding celebration."}
        canonicalPath={`/p/${publicSlug}/invite`}
        image={heroImage}
      />
      {canEdit && (
        <div className="invite-edit-tools">
          <button
            type="button"
            className={`invite-edit-toggle ${isEditing ? "is-on" : ""}`}
            onClick={() => {
              if (!revealed) setRevealed(true);
              toggleEditMode();
            }}
          >
            {isEditing ? "Done Editing" : "Edit Invitation"}
          </button>
          {isEditing && (
            <button type="button" className="invite-bg-edit" onClick={() => bgInputRef.current?.click()}>
              Change BG
              <input
                ref={bgInputRef}
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) saveWeddingPatch({ invitation_bg_image_file: file });
                }}
              />
            </button>
          )}
        </div>
      )}
      <audio ref={audioRef} src={musicUrl} loop preload="metadata" />
      <button
        type="button"
        className="invite-sound"
        onClick={() => {
          if (!audioRef.current) return;
          if (audioRef.current.paused) audioRef.current.play().catch(() => {});
          else audioRef.current.pause();
        }}
        aria-label="Toggle music"
      >
        {musicUrl ? "Music" : "Off"}
      </button>

      {!revealed && (
        <section className={`invite-reveal ${bursting ? "is-bursting" : ""}`} style={{ backgroundImage: `url(${heroImage})` }}>
          <div className="invite-reveal__shade" />
          <div className="invite-envelope">
            <div className="invite-envelope__back" />
            <div className="invite-envelope__letter">
              <p>Wedding Invitation</p>
              <strong>{firstName}{secondName ? ` & ${secondName}` : ""}</strong>
              <span>{date.day || ""} {date.month || ""} {date.year || ""}</span>
            </div>
            <div className="invite-envelope__pocket" />
            <div className="invite-envelope__flap" />
            <div className="invite-envelope__seal">{initials}</div>
            <button type="button" onClick={revealInvite} disabled={bursting}>
              {bursting ? "Opening..." : "Tap to Reveal"}
            </button>
          </div>
          <div className="invite-burst" aria-hidden="true">
            {Array.from({ length: 18 }).map((_, index) => <span key={index} />)}
          </div>
        </section>
      )}

      {revealed && (
        <>
          <div className="invite-florals invite-particles" aria-hidden="true">
            <span className="invite-florals__corner invite-florals__corner--tl" />
            <span className="invite-florals__corner invite-florals__corner--tr" />
            <span className="invite-florals__corner invite-florals__corner--bl" />
            <span className="invite-florals__corner invite-florals__corner--br" />
            {Array.from({ length: 16 }).map((_, index) => <i key={index} />)}
            {Array.from({ length: 14 }).map((_, index) => <b key={`heart-${index}`} />)}
          </div>
          <section className="invite-hero invite-luxury-hero" style={{ backgroundImage: `url(${heroImage})` }}>
            <div className="invite-hero__shade" />
            <motion.div
              className="invite-hero__content invite-luxury-card"
              initial={{ opacity: 0, y: 28, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            >
              <h1 className="invite-celebration-title">
                <InlineEditableText
                  as="span"
                  value={wedding?.hero_meta_one || "The Celebration"}
                  enabled={isEditing}
                  onSave={(value) => saveWeddingPatch({ hero_meta_one: value })}
                />
                <InlineEditableText
                  as="span"
                  value={wedding?.hero_meta_two || "Unfolds"}
                  enabled={isEditing}
                  onSave={(value) => saveWeddingPatch({ hero_meta_two: value })}
                />
              </h1>
              <div className="invite-soft-hearts" aria-hidden="true"><span /><span /></div>
              <motion.div
                className="invite-tab invite-sacred-badge"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.9, delay: 0.28, ease: "easeOut" }}
              >
                <InlineEditableText
                  as="span"
                  value={wedding?.hero_meta_three || "Sacred"}
                  enabled={isEditing}
                  onSave={(value) => saveWeddingPatch({ hero_meta_three: value })}
                />
                <InlineEditableText
                  as="em"
                  value={wedding?.programs_section_title || "Ceremonies"}
                  enabled={isEditing}
                  onSave={(value) => saveWeddingPatch({ programs_section_title: value })}
                />
              </motion.div>
              <div className="invite-luxury-couple">
                <EditableImage
                  src={heroImage}
                  alt={wedding?.couple_names || "Couple"}
                  enabled={isEditing}
                  onFile={(file) => saveWeddingPatch({ profile_image_file: file })}
                />
              </div>
              <motion.div
                className="invite-couple-date-card"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.45, ease: "easeOut" }}
              >
                <InlineEditableText
                  as="p"
                  value={inviteTitle}
                  enabled={isEditing}
                  onSave={(value) => saveWeddingPatch({ invitation_title: value })}
                />
                <InlineEditableText
                  as="h2"
                  value={`${firstName}${secondName ? ` weds ${secondName}` : ""}`}
                  enabled={isEditing}
                  onSave={(value) => saveWeddingPatch({ couple_names: value.replace(/\s+weds\s+/i, " & ") })}
                />
                <InlineEditableText
                  as="span"
                  value={wedding?.wedding_date || `${date.weekday || "Wedding Day"} / ${date.day || ""} ${date.month || ""} ${date.year || ""}`}
                  enabled={isEditing}
                  onSave={(value) => saveWeddingPatch({ wedding_date: value })}
                />
              </motion.div>
              <div className="invite-date">
                {date.day && <strong>{date.day}</strong>}
                <span>{date.month}{date.weekday && <small>{date.weekday}</small>}</span>
                {date.year && <strong>{date.year}</strong>}
              </div>
              {(weddingTime || isEditing) && (
                <InlineEditableText
                  as="p"
                  className="invite-time"
                  value={weddingTime}
                  placeholder="Add time"
                  enabled={isEditing}
                  onSave={(value) => saveWeddingPatch({ wedding_time: value })}
                />
              )}
              <InlineEditableText
                as="p"
                className="invite-luxury-description"
                value={wedding?.description || `${firstName}${secondName ? ` weds ${secondName}` : ""}. Join us as the celebration unfolds.`}
                enabled={isEditing}
                onSave={(value) => saveWeddingPatch({ description: value })}
              />
            </motion.div>
          </section>

          <section className="invite-section invite-events invite-timeline-section" id="events">
            {isEditing && (
              <div className="invite-program-editor">
                <p>Edit wedding programs here. Add a new function, then click any title, time, date, attire text, or image below to update it.</p>
                <button type="button" onClick={addWeddingProgram}>Add Wedding Program</button>
              </div>
            )}
            <div className="invite-event-grid invite-timeline">
              {inviteEvents.map((event, index) => (
                <motion.article
                  key={event.key}
                  className={index % 2 === 0 ? "is-left" : "is-right"}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                >
                  <div className="invite-heart-node" aria-hidden="true">♡</div>
                  <div className="invite-couple-art">
                    <EditableImage
                      src={event.image}
                      alt=""
                      enabled={Boolean(isEditing && event.programId)}
                      onFile={(file) => saveProgramPatch(event.raw, { thumbnail_file: file })}
                    />
                  </div>
                  <div className="invite-timeline-card">
                    <InlineEditableText as="h3" value={event.title} enabled={Boolean(isEditing && event.programId)} onSave={(value) => saveProgramPatch(event.raw, { title: value })} />
                    <InlineEditableText as="p" value={event.time} enabled={Boolean(isEditing && event.programId)} onSave={(value) => saveProgramPatch(event.raw, { event_time: value })} />
                    <InlineEditableText as="span" value={event.rawDate || event.date} enabled={Boolean(isEditing && event.programId)} onSave={(value) => saveProgramPatch(event.raw, { event_date: value })} />
                    <InlineEditableText as="small" value={event.attire} enabled={Boolean(isEditing && event.programId)} onSave={(value) => saveProgramPatch(event.raw, { description: value })} />
                  </div>
                </motion.article>
              ))}
            </div>
          </section>

          <section className="invite-section invite-story invite-card-panel" id="invitation">
            <InlineEditableText as="p" className="invite-kicker" value={inviteTitle} enabled={isEditing} onSave={(value) => saveWeddingPatch({ invitation_title: value })} />
            <InlineEditableText as="h2" value={`${firstName}${secondName ? ` weds ${secondName}` : ""}`} enabled={isEditing} onSave={(value) => saveWeddingPatch({ couple_names: value.replace(/\s+weds\s+/i, " & ") })} />
            <InlineEditableText as="p" value={wedding?.venue_description || "With the blessings of our families, we request your presence for love, laughter, rituals, and forever."} enabled={isEditing} onSave={(value) => saveWeddingPatch({ venue_description: value })} />
          </section>

          <section className="invite-section invite-memories invite-card-panel">
            <InlineEditableText
              as="p"
              className="invite-kicker"
              value={wedding?.custom_section_label || "A Little Story"}
              enabled={isEditing}
              onSave={(value) => saveWeddingPatch({ custom_section_label: value })}
            />
            <InlineEditableText
              as="h2"
              value={wedding?.programs_section_title || "Our memories before we create more memories"}
              enabled={isEditing}
              onSave={(value) => saveWeddingPatch({ programs_section_title: value })}
            />
            <div className="invite-memory-grid">
              {galleryItems.map((item, index) => (
                <EditableImage
                  key={`${item.key}-${index}`}
                  src={item.image}
                  alt=""
                  enabled={isEditing}
                  onFile={(file) => (
                    item.program
                      ? saveProgramPatch(item.program, { thumbnail_file: file })
                      : saveWeddingPatch({ profile_image_file: file })
                  )}
                />
              ))}
            </div>
          </section>

          <section className="invite-section invite-venue invite-card-panel" id="venue">
            <p className="invite-kicker">Venue</p>
            <InlineEditableText as="h2" value={venueName} enabled={isEditing} onSave={(value) => saveWeddingPatch({ venue_name: value })} />
            <InlineEditableText as="p" value={venueAddress || "Location details will be shared soon."} enabled={isEditing} onSave={(value) => saveWeddingPatch({ event_address: value })} />
            <div className="invite-map">
              <iframe
                title="Wedding venue map"
                src={`https://www.google.com/maps?q=${encodeURIComponent(venueAddress || venueName)}&output=embed`}
                loading="lazy"
              />
            </div>
            <a href={mapsUrl(venueAddress || venueName)} target="_blank" rel="noreferrer">Open Map</a>
          </section>

          <section className="invite-section invite-countdown invite-card-panel">
            <InlineEditableText
              as="p"
              className="invite-kicker"
              value={wedding?.venue_eyebrow || "Counting Every Moment"}
              enabled={isEditing}
              onSave={(value) => saveWeddingPatch({ venue_eyebrow: value })}
            />
            <InlineEditableText
              as="h2"
              value={wedding?.venue_script || "Until we say I do"}
              enabled={isEditing}
              onSave={(value) => saveWeddingPatch({ venue_script: value })}
            />
            <button
              type="button"
              className={`invite-scratch ${scratchOpen ? "is-open" : ""}`}
              style={{
                "--scratch-progress": `${scratchProgress}%`,
                "--scratch-mask": scratchPoints.length
                  ? scratchPoints.map((point) => `radial-gradient(circle 28px at ${point}, transparent 0 54%, #000 57%)`).join(", ")
                  : "linear-gradient(#000, #000)",
              }}
              onPointerDown={scratchReveal}
              onPointerMove={scratchReveal}
              onClick={scratchReveal}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") setScratchOpen(true);
              }}
              aria-label="Scratch countdown card to reveal wedding countdown"
            >
              {scratchOpen ? (
                <span>{countdown.days} Days / {countdown.hours} Hours / {countdown.minutes} Minutes</span>
              ) : (
                <span>Scratch to reveal</span>
              )}
            </button>
          </section>

          <section className="invite-section invite-fun invite-card-panel">
            <p className="invite-kicker">Join The Celebration</p>
            <h2>Celebrate With Us</h2>
            <p>A few fun questions before the big day.</p>
            <div className="invite-fun-card">
              <h3>Make a Guess</h3>
              <p>Who will get emotional first?</p>
              <div className="invite-guess-options">
                <button type="button" className={guessChoice === "first" ? "is-selected" : ""} onClick={() => chooseGuess("first")} disabled={Boolean(guessChoice)}>
                  <span aria-hidden="true">{"\uD83E\uDD79"}</span>
                  {firstName || "Bride"}
                  {guessChoice && <small>{guessPercents.first}%</small>}
                </button>
                {secondName && (
                  <button type="button" className={guessChoice === "second" ? "is-selected" : ""} onClick={() => chooseGuess("second")} disabled={Boolean(guessChoice)}>
                    <span aria-hidden="true">{"\uD83D\uDE2D"}</span>
                    {secondName}
                    {guessChoice && <small>{guessPercents.second}%</small>}
                  </button>
                )}
                <button type="button" className={guessChoice === "both" ? "is-selected" : ""} onClick={() => chooseGuess("both")} disabled={Boolean(guessChoice)}>
                  <span aria-hidden="true">{"\uD83D\uDC9E"}</span>
                  Both
                  {guessChoice && <small>{guessPercents.both}%</small>}
                </button>
              </div>
              <em>Reveal after the wedding</em>
            </div>
            <div className="invite-mood-grid">
              {["🍽️ The Food", "💃 Dance Floor", "💗 The Love", "✨ All of it"].map((item) => <button type="button" key={item}>{item}</button>)}
            </div>
          </section>

          <section className="invite-section invite-notes">
            <article>
              <h2>Leave Us a Note</h2>
              <p>Share a wish or memory.</p>
              <textarea placeholder="Write something from the heart..." />
            </article>
            <article>
              <h2>Words for Forever</h2>
              <p>Advice for married life.</p>
              <textarea placeholder="One piece of advice..." />
            </article>
            <button type="button">Send Love</button>
          </section>

          <section className="invite-hashtag">
            <span>Forever begins here</span>
            <strong>{inviteHash(wedding?.couple_names)}</strong>
            <Link className="invite-story-button" to={`/p/${publicSlug}/home`}>
              See Their Wedflix Story
            </Link>
          </section>
        </>
      )}
    </main>
  );
}
