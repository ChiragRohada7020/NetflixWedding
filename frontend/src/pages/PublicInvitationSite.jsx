import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiGetPublic, apiPostForm, mediaUrl } from "../api";
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

function parseInviteDate(value, timeValue = "") {
  const raw = String(value || "").trim();
  if (!raw) return new Date("");
  const time = String(timeValue || "").trim();
  const candidates = [time ? `${raw} ${time}` : raw, raw];
  const monthFirst = raw.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (monthFirst) candidates.unshift(`${monthFirst[1]} ${monthFirst[2]}, ${monthFirst[3]} ${time}`.trim());
  const dayFirst = raw.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (dayFirst) candidates.unshift(`${dayFirst[2]} ${dayFirst[1]}, ${dayFirst[3]} ${time}`.trim());
  for (const candidate of candidates) {
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date("");
}

function dateParts(value) {
  const date = parseInviteDate(value);
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
  const date = parseInviteDate(value);
  if (Number.isNaN(date.getTime())) return fallback || value || "Wedding Date";
  return date.toLocaleDateString("en", { day: "2-digit", month: "long", year: "numeric" });
}

function timelineEvents(programs, wedding, venueName, heroImage) {
  const fallback = [
    { title: "Bhog Saheb", event_time: "9:00 AM", event_date: "24 June 2026", description: "At Our Residence" },
    { title: "Haldi & Jivana", event_time: "1:00 PM onwards", event_date: "24 June 2026", description: "" },
    { title: "Sangeet Lada", event_time: "6:00 PM onwards", event_date: "24 June 2026", description: "Venue: Navjavan Seva Mandal (Shiv Mandir), Pachora" },
    { title: "Muhurat", event_time: "10:00 AM", event_date: "25 June 2026", description: "" },
    { title: "Baraat", event_time: "11:00 AM", event_date: "25 June 2026", description: "Departure from our residence to Sai Moksh Resort" },
    { title: "Reception", event_time: "8:00 PM onwards", event_date: "25 June 2026", description: "Followed by Dinner. Sai Moksh Resort, Pachora" },
  ];
  const source = programs.length ? programs.slice(0, 6) : fallback;
  return source.map((event, index) => ({
    key: event._id || `timeline-${index}`,
    programId: event._id || "",
    title: event.title || fallback[index % fallback.length].title,
    time: event.event_time || event.time || fallback[index % fallback.length].event_time,
    rawDate: event.event_date || wedding?.wedding_date || "",
    date: readableDate(event.event_date || "", fallback[index % fallback.length].event_date),
    attire: event.attire || event.dress_code || event.description || fallback[index % fallback.length].description,
    image: mediaUrl(event.thumbnail || "") || heroImage,
    raw: event,
  }));
}

function countdownParts(value, timeValue = "") {
  const target = parseInviteDate(value, timeValue || "10:00 AM");
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

function sectionKey(value) {
  return String(value || "main").toLowerCase();
}

function customSections(wedding) {
  const src = Array.isArray(wedding?.custom_sections) ? wedding.custom_sections : [];
  if (src.length) return src;
  if (wedding?.custom_section_label) return [{ key: "custom", label: wedding.custom_section_label }];
  return [];
}

function preweddingSectionKeys(wedding) {
  const keys = customSections(wedding)
    .filter((section) => /pre\s*-?\s*wedding/i.test(`${section.key || ""} ${section.label || ""}`))
    .map((section) => sectionKey(section.key));
  return Array.from(new Set([...keys, "prewedding", "pre-wedding"]));
}

function invitationSectionKeys(wedding) {
  const keys = customSections(wedding)
    .filter((section) => /invitation|invite/i.test(`${section.key || ""} ${section.label || ""}`))
    .map((section) => sectionKey(section.key));
  return Array.from(new Set([...keys, "invitation", "invite"]));
}

function editableGalleryItems(heroImage, programs) {
  const source = programs.length ? programs : [];
  const items = source
    .map((program, index) => ({
      key: program._id || `gallery-${index}`,
      image: mediaUrl(program.thumbnail || ""),
      program,
    }))
    .filter((item) => item.image)
    .slice(0, 8);
  if (items.length) return items;
  return heroImage ? [{ key: "hero", image: heroImage, program: null }] : [];
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
  const [revealChoice, setRevealChoice] = useState("");
  const [reasonChoice, setReasonChoice] = useState("");
  const [guessVotes, setGuessVotes] = useState({ first: 4, second: 3, both: 7 });
  const [countdownTick, setCountdownTick] = useState(Date.now());
  const bgInputRef = useRef(null);
  const musicInputRef = useRef(null);
  const memoryInputRef = useRef(null);
  const audioRef = useRef(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["public-invitation-site", publicSlug],
    queryFn: async () => {
      const wedding = await apiGetPublic(`/api/public-weddings/${publicSlug}`);
      const programs = await apiGetPublic(`/api/weddings/${wedding._id}/invitation-programs`);
      return { wedding, programs };
    },
  });

  const wedding = data?.wedding;
  const programs = data?.programs || [];
  const invitationKeys = useMemo(() => invitationSectionKeys(wedding), [wedding]);
  const invitationPrograms = useMemo(
    () => programs.filter((program) => invitationKeys.includes(sectionKey(program.section_key))),
    [programs, invitationKeys],
  );
  const preweddingKeys = useMemo(() => preweddingSectionKeys(wedding), [wedding]);
  const preweddingPrograms = useMemo(
    () => programs.filter((program) => preweddingKeys.includes(sectionKey(program.section_key))),
    [programs, preweddingKeys],
  );
  const [firstName, secondName] = splitNames(wedding?.couple_names);
  const heroImage = mediaUrl(wedding?.hero_image || wedding?.profile_image || "") || placeholder(wedding?.couple_names);
  const venueName = wedding?.venue_name || invitationPrograms[0]?.venue_name || "Wedding Venue";
  const venueAddress = wedding?.event_address || invitationPrograms[0]?.event_address || "";
  const weddingTime = wedding?.wedding_time || invitationPrograms[0]?.event_time || "";
  const savedWeddingDate = parseInviteDate(wedding?.wedding_date, weddingTime || "10:00 AM");
  const inviteDateValue = !Number.isNaN(savedWeddingDate.getTime()) && savedWeddingDate.getTime() > Date.now()
    ? wedding?.wedding_date
    : "25 June 2026";
  const date = dateParts(inviteDateValue);
  const musicUrl = mediaUrl(wedding?.invitation_music_url || "");
  const invitationBgImage = mediaUrl(wedding?.invitation_bg_image || "") || "/invite-floral-bg.png";
  const initials = `${(firstName || "W").charAt(0)}${(secondName || "F").charAt(0)}`;
  const inviteTitle = wedding?.invitation_title || "Wedding Invitation";
  const countdown = useMemo(() => countdownParts(inviteDateValue, weddingTime || "10:00 AM"), [countdownTick, inviteDateValue, weddingTime]);
  const galleryItems = editableGalleryItems(heroImage, preweddingPrograms);
  const inviteEvents = useMemo(() => timelineEvents(invitationPrograms, wedding, venueName, heroImage), [invitationPrograms, wedding, venueName, heroImage]);

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
    fd.append("invitation_music_url", value("invitation_music_url"));
    fd.append("access_level", value("access_level", wedding.access_level || "public"));
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
    fd.append("invite_envelope_label", value("invite_envelope_label", "Wedding Invitation"));
    fd.append("invite_venue_label", value("invite_venue_label", "Venue"));
    fd.append("invite_map_label", value("invite_map_label", "Open Map"));
    fd.append("invite_scratch_label", value("invite_scratch_label", "Scratch to reveal"));
    fd.append("invite_fun_kicker", value("invite_fun_kicker", "Join The Celebration"));
    fd.append("invite_fun_title", value("invite_fun_title", "Celebrate With Us"));
    fd.append("invite_fun_intro", value("invite_fun_intro", "A few fun questions before the big day."));
    fd.append("invite_guess_title", value("invite_guess_title", "Make a Guess"));
    fd.append("invite_guess_question", value("invite_guess_question", "Who will get emotional first?"));
    fd.append("invite_reason_question", value("invite_reason_question", "Why are you coming?"));
    fd.append("invite_notes_title", value("invite_notes_title", "Leave Us a Note"));
    fd.append("invite_notes_prompt", value("invite_notes_prompt", "Share a wish or memory."));
    fd.append("invite_note_placeholder", value("invite_note_placeholder", "Write something from the heart..."));
    fd.append("invite_send_label", value("invite_send_label", "Send Love"));
    fd.append("invite_hashtag_label", value("invite_hashtag_label", "Forever begins here"));
    fd.append("invite_story_button_label", value("invite_story_button_label", "See Their Wedflix Story"));
    fd.append("invite_main_kicker", value("invite_main_kicker", "Main Invitation"));
    fd.append("invite_main_title", value("invite_main_title", "The Wedding of Ashwin & Tisha"));
    fd.append("invite_groom_name", value("invite_groom_name", "Ashwin"));
    fd.append("invite_groom_details", value("invite_groom_details", "S/o Late Mrs. Reshma & Late Mr. Mahesh Pinjani"));
    fd.append("invite_groom_guardian", value("invite_groom_guardian", "Guardian: Smt. Bhavika & Shri Manojkumar Pinjani"));
    fd.append("invite_bride_name", value("invite_bride_name", "Tisha"));
    fd.append("invite_bride_details", value("invite_bride_details", "D/o Smt. Jaya & Late Shri Dhiraj Ratnani"));
    fd.append("invite_residence_title", value("invite_residence_title", "Residence Address"));
    fd.append("invite_residence_line_one", value("invite_residence_line_one", "Lal Keshav Niwas"));
    fd.append("invite_residence_line_two", value("invite_residence_line_two", "Sindhi Colony, Pachora"));
    fd.append("invite_by_title", value("invite_by_title", "Regards"));
    fd.append("invite_by_line_one", value("invite_by_line_one", "Mr. Manoj Lalchand Pinjani"));
    fd.append("invite_by_line_two", value("invite_by_line_two", "& All Pinjani Family"));
    fd.append("invite_by_line_three", value("invite_by_line_three", "Friends & Relatives"));
    fd.append("invite_by_line_four", value("invite_by_line_four", ""));
    fd.append("custom_sections_json", JSON.stringify(Array.isArray(wedding.custom_sections) ? wedding.custom_sections : []));
    fd.append("venue_blocks_json", JSON.stringify(Array.isArray(wedding.venue_blocks) ? wedding.venue_blocks : []));
    fd.append("custom_section_label", value("custom_section_label"));
    if (patch.profile_image_file) {
      fd.append("profile_image_file", await preparePhotoForUpload(patch.profile_image_file));
    }
    if (patch.invitation_bg_image_file) {
      fd.append("invitation_bg_image_file", await preparePhotoForUpload(patch.invitation_bg_image_file));
    }
    if (patch.invitation_music_file) {
      fd.append("invitation_music_file", patch.invitation_music_file);
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
    fd.append("section_key", value("section_key", program.section_key || "invitation"));
    if (patch.thumbnail_file) {
      fd.append("thumbnail_file", await preparePhotoForUpload(patch.thumbnail_file));
    }
    await apiPostForm(`/admin/invitation-programs/${program._id}/update`, fd);
    await refreshInvite();
  };

  const addWeddingProgram = async () => {
    if (!wedding?._id) return;
    const fd = new FormData();
    fd.append("wedding_id", wedding._id);
    fd.append("title", `Invitation Program ${invitationPrograms.length + 1}`);
    fd.append("event_date", wedding.wedding_date || "");
    fd.append("event_time", wedding.wedding_time || "");
    fd.append("venue_name", venueName);
    fd.append("event_address", venueAddress);
    fd.append("thumbnail", heroImage);
    fd.append("music_url", "");
    fd.append("section_key", "invitation");
    fd.append("order", String(programs.length));
    fd.append("event_sections_json", JSON.stringify([]));
    await apiPostForm("/admin/invitation-programs/create", fd);
    await refreshInvite();
  };

  const addMemoryPhoto = async (file) => {
    if (!wedding?._id || !file) return;
    const fd = new FormData();
    fd.append("wedding_id", wedding._id);
    fd.append("title", `Prewedding Photo ${preweddingPrograms.length + 1}`);
    fd.append("description", "");
    fd.append("event_date", wedding.wedding_date || "");
    fd.append("event_time", "");
    fd.append("venue_name", venueName);
    fd.append("event_address", venueAddress);
    fd.append("thumbnail", "");
    fd.append("thumbnail_file", await preparePhotoForUpload(file));
    fd.append("music_url", "");
    fd.append("section_key", "prewedding");
    fd.append("order", String(programs.length));
    fd.append("event_sections_json", JSON.stringify([]));
    await apiPostForm("/admin/invitation-programs/create", fd);
    await refreshInvite();
  };

  const revealInvite = async () => {
    if (bursting) return;
    setBursting(true);
    if (musicUrl) {
      setTimeout(() => audioRef.current?.play().catch(() => {}), 120);
    }
    window.setTimeout(() => setRevealed(true), 2300);
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

  useEffect(() => {
    const timer = window.setInterval(() => setCountdownTick(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

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
            <>
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
              <button type="button" className="invite-bg-edit" onClick={() => musicInputRef.current?.click()}>
                Upload Music
                <input
                  ref={musicInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) saveWeddingPatch({ invitation_music_file: file });
                  }}
                />
              </button>
            </>
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
        <section className={`invite-reveal ${bursting ? "is-bursting" : ""}`} style={{ backgroundImage: `url(${invitationBgImage})` }}>
          <div className="invite-reveal__shade" />
          <div
            className="invite-envelope"
            role="button"
            tabIndex={0}
            onClick={revealInvite}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                revealInvite();
              }
            }}
            aria-label="Open wedding invitation"
          >
            <div className="invite-envelope__paper" aria-hidden="true">
              <p>{wedding?.invite_envelope_label || "Wedding Invitation"}</p>
              <strong>{firstName}{secondName ? ` & ${secondName}` : ""}</strong>
              <span>{date.day || ""} {date.month || ""} {date.year || ""}</span>
            </div>
            <img src="/invite-premium-envelope.png" alt="Wedding invitation envelope" />
            <button type="button" disabled={bursting}>
              {bursting ? "Opening..." : "Open Invitation"}
            </button>
          </div>
          <div className="invite-burst" aria-hidden="true">
            {Array.from({ length: 30 }).map((_, index) => <span key={index} />)}
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
                  value={inviteDateValue || `${date.weekday || "Wedding Day"} / ${date.day || ""} ${date.month || ""} ${date.year || ""}`}
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
                <p>Invitation programs are separate from the Wedflix story functions. Add an invitation program, then click its title, time, date, attire text, or image below to edit it.</p>
                {!invitationPrograms.length && <small>Add your first invitation program to replace the sample cards.</small>}
                <button type="button" onClick={addWeddingProgram}>Add Invitation Program</button>
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
                  <div className="invite-heart-node" aria-hidden="true">{"\u2661"}</div>
                  <div className="invite-couple-art">
                    <EditableImage
                      src={event.image}
                      alt=""
                      enabled={isEditing}
                      onFile={(file) => (
                        event.programId
                          ? saveProgramPatch(event.raw, { thumbnail_file: file })
                          : saveWeddingPatch({ profile_image_file: file })
                      )}
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
            <InlineEditableText as="p" className="invite-kicker" value={wedding?.invite_main_kicker || "Main Invitation"} enabled={isEditing} onSave={(value) => saveWeddingPatch({ invite_main_kicker: value })} />
            <InlineEditableText as="h2" value={wedding?.invite_main_title || "The Wedding of Ashwin & Tisha"} enabled={isEditing} onSave={(value) => saveWeddingPatch({ invite_main_title: value })} />
            <div className="invite-family-grid">
              <article>
                <InlineEditableText as="strong" value={wedding?.invite_groom_name || "Ashwin"} enabled={isEditing} onSave={(value) => saveWeddingPatch({ invite_groom_name: value })} />
                <InlineEditableText as="span" value={wedding?.invite_groom_details || "S/o Late Mrs. Reshma & Late Mr. Mahesh Pinjani"} enabled={isEditing} onSave={(value) => saveWeddingPatch({ invite_groom_details: value })} />
                <InlineEditableText as="span" value={wedding?.invite_groom_guardian || "Guardian: Smt. Bhavika & Shri Manojkumar Pinjani"} enabled={isEditing} onSave={(value) => saveWeddingPatch({ invite_groom_guardian: value })} />
              </article>
              <article>
                <InlineEditableText as="strong" value={wedding?.invite_bride_name || "Tisha"} enabled={isEditing} onSave={(value) => saveWeddingPatch({ invite_bride_name: value })} />
                <InlineEditableText as="span" value={wedding?.invite_bride_details || "D/o Smt. Jaya & Late Shri Dhiraj Ratnani"} enabled={isEditing} onSave={(value) => saveWeddingPatch({ invite_bride_details: value })} />
              </article>
            </div>
          </section>

          <section className="invite-section invite-residence invite-card-panel">
            <InlineEditableText as="p" className="invite-kicker" value={wedding?.invite_residence_title || "Residence Address"} enabled={isEditing} onSave={(value) => saveWeddingPatch({ invite_residence_title: value })} />
            <div className="invite-by__lines">
              <InlineEditableText as="strong" value={wedding?.invite_residence_line_one || "Lal Keshav Niwas"} enabled={isEditing} onSave={(value) => saveWeddingPatch({ invite_residence_line_one: value })} />
              <InlineEditableText as="span" value={wedding?.invite_residence_line_two || "Sindhi Colony, Pachora"} enabled={isEditing} onSave={(value) => saveWeddingPatch({ invite_residence_line_two: value })} />
            </div>
          </section>

          <section className="invite-section invite-by invite-card-panel">
            <InlineEditableText
              as="p"
              className="invite-kicker"
              value={wedding?.invite_by_title || "Regards"}
              enabled={isEditing}
              onSave={(value) => saveWeddingPatch({ invite_by_title: value })}
            />
            <div className="invite-by__lines">
              <InlineEditableText as="strong" value={wedding?.invite_by_line_one || "Mr. Manoj Lalchand Pinjani"} enabled={isEditing} onSave={(value) => saveWeddingPatch({ invite_by_line_one: value })} />
              <InlineEditableText as="span" value={wedding?.invite_by_line_two || "& All Pinjani Family"} enabled={isEditing} onSave={(value) => saveWeddingPatch({ invite_by_line_two: value })} />
              <InlineEditableText as="span" value={wedding?.invite_by_line_three || "Friends & Relatives"} enabled={isEditing} onSave={(value) => saveWeddingPatch({ invite_by_line_three: value })} />
              {(wedding?.invite_by_line_four || isEditing) && <InlineEditableText as="span" value={wedding?.invite_by_line_four || ""} enabled={isEditing} onSave={(value) => saveWeddingPatch({ invite_by_line_four: value })} />}
            </div>
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
              {isEditing && (
                <button type="button" className="invite-add-photo-tile" onClick={() => memoryInputRef.current?.click()}>
                  <span aria-hidden="true">+</span>
                  <strong>Add Photo</strong>
                  <small>Explore the story</small>
                  <input
                    ref={memoryInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) addMemoryPhoto(file);
                    }}
                  />
                </button>
              )}
            </div>
          </section>

          <section className="invite-section invite-venue invite-card-panel" id="venue">
            <InlineEditableText as="p" className="invite-kicker" value={wedding?.invite_venue_label || "Venue"} enabled={isEditing} onSave={(value) => saveWeddingPatch({ invite_venue_label: value })} />
            <InlineEditableText as="h2" value={venueName} enabled={isEditing} onSave={(value) => saveWeddingPatch({ venue_name: value })} />
            <InlineEditableText as="p" value={venueAddress || "Location details will be shared soon."} enabled={isEditing} onSave={(value) => saveWeddingPatch({ event_address: value })} />
            <div className="invite-map">
              <iframe
                title="Wedding venue map"
                src={`https://www.google.com/maps?q=${encodeURIComponent(venueAddress || venueName)}&output=embed`}
                loading="lazy"
              />
            </div>
            <a href={mapsUrl(venueAddress || venueName)} target="_blank" rel="noreferrer">
              <InlineEditableText as="span" value={wedding?.invite_map_label || "Open Map"} enabled={isEditing} onSave={(value) => saveWeddingPatch({ invite_map_label: value })} />
            </a>
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
                <span>{readableDate(inviteDateValue, "25 June 2026")} / {countdown.days} Days / {countdown.hours} Hours / {countdown.minutes} Minutes</span>
              ) : (
                <InlineEditableText as="span" value={wedding?.invite_scratch_label || "Scratch to reveal"} enabled={isEditing} onSave={(value) => saveWeddingPatch({ invite_scratch_label: value })} />
              )}
            </button>
          </section>

          <section className="invite-section invite-fun invite-card-panel">
            <InlineEditableText as="p" className="invite-kicker" value={wedding?.invite_fun_kicker || "Join The Celebration"} enabled={isEditing} onSave={(value) => saveWeddingPatch({ invite_fun_kicker: value })} />
            <InlineEditableText as="h2" value={wedding?.invite_fun_title || "Celebrate With Us"} enabled={isEditing} onSave={(value) => saveWeddingPatch({ invite_fun_title: value })} />
            <InlineEditableText as="p" value={wedding?.invite_fun_intro || "A few fun questions before the big day."} enabled={isEditing} onSave={(value) => saveWeddingPatch({ invite_fun_intro: value })} />
            <div className="invite-fun-card">
              <InlineEditableText as="h3" value={wedding?.invite_guess_title || "Make a Guess"} enabled={isEditing} onSave={(value) => saveWeddingPatch({ invite_guess_title: value })} />
              <InlineEditableText as="p" value={wedding?.invite_guess_question || "Who will get emotional first?"} enabled={isEditing} onSave={(value) => saveWeddingPatch({ invite_guess_question: value })} />
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
              <div className="invite-reveal-options" aria-label="Choose your reveal answer">
                {[
                  `😊 ${firstName || "Bride"} will smile first`,
                  `🥹 ${secondName || "Groom"} will tear up`,
                  "💞 Both, obviously",
                  "🎉 Family will cry first",
                ].map((answer) => (
                  <button
                    type="button"
                    key={answer}
                    className={revealChoice === answer ? "is-selected" : ""}
                    onClick={() => setRevealChoice(answer)}
                  >
                    {answer}
                  </button>
                ))}
              </div>
            </div>
            <div className="invite-reason-poll">
              <InlineEditableText as="h3" value={wedding?.invite_reason_question || "Why are you coming?"} enabled={isEditing} onSave={(value) => saveWeddingPatch({ invite_reason_question: value })} />
              <div className="invite-mood-grid" aria-label="Choose why you are coming">
                {[
                  "🙏 To bless the couple",
                  "👨‍👩‍👧 To celebrate with family",
                  "💃 To dance all night",
                  "📸 To make memories",
                ].map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={reasonChoice === item ? "is-selected" : ""}
                    onClick={() => setReasonChoice(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="invite-section invite-notes">
            <article className="invite-note-card">
              <InlineEditableText as="h2" value={wedding?.invite_notes_title || "Leave Us a Note"} enabled={isEditing} onSave={(value) => saveWeddingPatch({ invite_notes_title: value })} />
              <InlineEditableText as="p" value={wedding?.invite_notes_prompt || "Share a wish or memory."} enabled={isEditing} onSave={(value) => saveWeddingPatch({ invite_notes_prompt: value })} />
              <textarea placeholder={wedding?.invite_note_placeholder || "Write something from the heart..."} />
            </article>
            <button type="button">
              <InlineEditableText as="span" value={wedding?.invite_send_label || "Send Love"} enabled={isEditing} onSave={(value) => saveWeddingPatch({ invite_send_label: value })} />
            </button>
          </section>

          <section className="invite-hashtag">
            <InlineEditableText as="span" value={wedding?.invite_hashtag_label || "Forever begins here"} enabled={isEditing} onSave={(value) => saveWeddingPatch({ invite_hashtag_label: value })} />
            <strong>{inviteHash(wedding?.couple_names)}</strong>
            <Link className="invite-story-button" to={`/p/${publicSlug}/home`}>
              <InlineEditableText as="span" value={wedding?.invite_story_button_label || "See Their Wedflix Story"} enabled={isEditing} onSave={(value) => saveWeddingPatch({ invite_story_button_label: value })} />
            </Link>
          </section>
        </>
      )}
    </main>
  );
}
