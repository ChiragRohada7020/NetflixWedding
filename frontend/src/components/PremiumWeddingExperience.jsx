import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import LazyHeroVideo from "./LazyHeroVideo";

function toEmbed(url) {
  if (!url) return "";
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : url;
}

function getVideoId(url) {
  if (!url) return "";
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : "";
}

function withHeroParams(url) {
  if (!url) return "";
  const joiner = url.includes("?") ? "&" : "?";
  const videoId = getVideoId(url);
  const loopParams = videoId ? `&playlist=${videoId}` : "";
  return `${url}${joiner}autoplay=1&mute=1&controls=0&loop=1${loopParams}&playsinline=1&start=0&rel=0&modestbranding=1`;
}

function placeholder(label) {
  const text = encodeURIComponent((label || "Wedflix Wedding").trim().slice(0, 28));
  return `data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1280 720'%3E%3Crect width='1280' height='720' fill='%23050505'/%3E%3CradialGradient id='g' cx='62%25' cy='22%25' r='80%25'%3E%3Cstop stop-color='%23e50914' stop-opacity='.36'/%3E%3Cstop offset='1' stop-color='%23e50914' stop-opacity='0'/%3E%3C/radialGradient%3E%3Crect width='1280' height='720' fill='url(%23g)'/%3E%3Ctext x='76' y='374' fill='%23fff' font-size='82' font-family='Georgia,serif'%3E${text}%3C/text%3E%3C/svg%3E`;
}

function mapsUrl(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || "")}`;
}

function calendarDate(value, fallbackTime = "11:00 AM") {
  const text = `${value || ""} ${fallbackTime || ""}`.trim();
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function toIcsDate(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function getInvitationText(wedding) {
  const names = wedding?.couple_names || "The Couple";
  const [first, second] = names.split("&").map((part) => part.trim());
  const savedTitle = (wedding?.invitation_title || "").trim();
  const formalTitle = "Together with their families, we invite you to celebrate the wedding of";
  return {
    first: first || names,
    second: second || "",
    title: savedTitle.length > 28 ? savedTitle : formalTitle,
  };
}

function getInvitationDate(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) {
    return { day: "", month: value || "Wedding Date", year: "", weekday: "" };
  }
  return {
    day: String(date.getDate()).padStart(2, "0"),
    month: date.toLocaleString("en", { month: "long" }),
    year: String(date.getFullYear()),
    weekday: date.toLocaleString("en", { weekday: "long" }),
  };
}

export default function PremiumWeddingExperience({
  wedding,
  programs = [],
  basePath,
  initialScreen = "intro",
  canEdit = false,
  onSaveWeddingField = async () => {},
  onMusicUrlChange = () => {},
  onComplete = () => {},
}) {
  const seenKey = `wedflix_premium_seen_${wedding?._id || basePath}`;
  const [screen, setScreen] = useState(initialScreen);
  const [zoom, setZoom] = useState(1);
  const [distance, setDistance] = useState("");
  const [venueEditor, setVenueEditor] = useState(null);
  const [isSavingVenue, setIsSavingVenue] = useState(false);
  const [isMusicOn, setIsMusicOn] = useState(() => localStorage.getItem("wedflix_music_on") !== "0");
  const audioRef = useRef(null);
  const invitationRef = useRef(null);
  const featuredProgram = programs[0] || null;
  const heroImage = wedding?.hero_image || wedding?.profile_image || featuredProgram?.thumbnail || placeholder(wedding?.couple_names);
  const heroVideo = withHeroParams(toEmbed(wedding?.hero_video_url || ""));
  const venueImage = wedding?.venue_image || heroImage;
  const venueName = wedding?.venue_name || featuredProgram?.venue_name || "Wedding Venue";
  const venueAddress = wedding?.event_address || featuredProgram?.event_address || "Venue address";
  const weddingTime = wedding?.wedding_time || featuredProgram?.event_time || "11:00 AM";
  const musicUrl = wedding?.music_url || "";
  const invitation = getInvitationText(wedding);
  const invitationDate = getInvitationDate(wedding?.wedding_date);
  const mapQuery = [venueName, venueAddress].filter(Boolean).join(", ");
  const venueBlocks = useMemo(() => {
    const saved = Array.isArray(wedding?.venue_blocks) ? wedding.venue_blocks : [];
    if (Array.isArray(wedding?.venue_blocks)) return saved;
    const programBlocks = programs
      .filter((program) => program.title || program.event_date || program.event_time || program.venue_name || program.event_address)
      .map((program, index) => ({
        key: program._id || `program_${index}`,
        title: program.title || `Function ${index + 1}`,
        meta: [program.event_date, program.event_time].filter(Boolean).join(" | "),
        body: program.venue_name || "",
        address: program.event_address || "",
      }));
    if (programBlocks.length) return programBlocks;
    return [
      {
        key: "main_venue",
        title: "Wedding Venue",
        meta: [wedding?.wedding_date, weddingTime].filter(Boolean).join(" | "),
        body: venueName,
        address: venueAddress,
      },
    ];
  }, [programs, venueAddress, venueName, wedding?.venue_blocks, wedding?.wedding_date, weddingTime]);

  const saveVenueBlock = async (event) => {
    event.preventDefault();
    if (!venueEditor) return;
    const form = new FormData(event.currentTarget);
    const block = {
      key: venueEditor.key || `venue_${Date.now()}`,
      title: String(form.get("title") || "").trim(),
      meta: String(form.get("meta") || "").trim(),
      body: String(form.get("body") || "").trim(),
      address: String(form.get("address") || "").trim(),
    };
    if (!block.title && !block.meta && !block.body && !block.address) {
      setVenueEditor(null);
      return;
    }
    const existing = Array.isArray(wedding?.venue_blocks) ? wedding.venue_blocks : venueBlocks;
    const next = venueEditor.isNew
      ? [...existing, block]
      : existing.map((item) => (item.key === venueEditor.key ? block : item));
    setIsSavingVenue(true);
    try {
      await onSaveWeddingField("venue_blocks", next);
      setVenueEditor(null);
    } finally {
      setIsSavingVenue(false);
    }
  };

  const deleteVenueBlock = async (key) => {
    const existing = Array.isArray(wedding?.venue_blocks) ? wedding.venue_blocks : venueBlocks;
    setIsSavingVenue(true);
    try {
      await onSaveWeddingField("venue_blocks", existing.filter((item) => item.key !== key));
    } finally {
      setIsSavingVenue(false);
    }
  };

  useEffect(() => {
    onMusicUrlChange(musicUrl);
  }, [musicUrl, onMusicUrlChange]);

  useEffect(() => {
    document.body.classList.add("premium-flow-open");
    return () => document.body.classList.remove("premium-flow-open");
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.load();
    if (musicUrl && isMusicOn) audioRef.current.play().catch(() => {});
  }, [musicUrl]);

  const toggleMusic = async () => {
    if (!audioRef.current || !musicUrl) return;
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
    }
  };

  const shareText = `${wedding?.couple_names || "Wedding"} - ${wedding?.wedding_date || ""}`;
  const shareUrl = window.location.href;
  const shareInvitation = async () => {
    if (navigator.share) {
      await navigator.share({ title: shareText, text: "You are invited to the wedding celebration.", url: shareUrl }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(shareUrl);
    window.alert("Invitation link copied.");
  };

  const downloadInvitation = () => {
    if (wedding?.invitation_pdf_url) {
      window.open(wedding.invitation_pdf_url, "_blank", "noopener,noreferrer");
      return;
    }
    window.print();
  };

  const addToCalendar = () => {
    const start = calendarDate(wedding?.wedding_date, weddingTime);
    const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      `SUMMARY:${wedding?.couple_names || "Wedding Celebration"}`,
      `DTSTART:${toIcsDate(start)}`,
      `DTEND:${toIcsDate(end)}`,
      `LOCATION:${venueName}, ${venueAddress}`,
      `DESCRIPTION:${wedding?.description || "Wedflix wedding invitation"}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "wedflix-wedding.ics";
    link.click();
    URL.revokeObjectURL(url);
  };

  const shareLocation = async () => {
    const url = mapsUrl(mapQuery);
    if (navigator.share) {
      await navigator.share({ title: venueName, text: venueAddress, url }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(url);
    window.alert("Venue location copied.");
  };

  const findDistance = () => {
    if (!navigator.geolocation) {
      setDistance("Location is not available on this device.");
      return;
    }
    setDistance("Finding distance...");
    navigator.geolocation.getCurrentPosition(
      () => setDistance("Open navigation for live distance and ETA."),
      () => setDistance("Allow location access to estimate distance."),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  };

  const continueToHome = () => {
    localStorage.setItem(seenKey, "1");
    onComplete();
  };

  const navItems = [
    ["Home", "home"],
    ["Invitation", "invitation"],
    ["Events", "home"],
    ["Gallery", "home"],
    ["Videos", "home"],
    ["Family", "home"],
    ["Wishes", "home"],
    ["Venue", "venue"],
  ];

  const eventCards = useMemo(() => {
    const cards = programs.map((program, index) => ({
      id: program._id,
      title: program.title || `Event ${index + 1}`,
      subtitle: program.event_date || program.venue_name || "Wedding Event",
      image: program.thumbnail || heroImage,
      href: `${basePath}/programs/${program._id}`,
    }));
    return cards.length ? cards : [
      { id: "invitation", title: "Invitation", subtitle: "Date, time, venue", image: heroImage, action: () => setScreen("invitation") },
      { id: "venue", title: "Venue", subtitle: venueName, image: venueImage, action: () => setScreen("venue") },
    ];
  }, [basePath, heroImage, programs, venueImage, venueName]);

  const shell = (children) => (
    <section className={`premium-wedding premium-wedding--${screen}`}>
      <audio ref={audioRef} src={musicUrl} loop preload="none" />
      {children}
    </section>
  );

  if (screen === "intro") {
    return shell(
      <header className="premium-intro">
        <div className={`premium-intro__media ${heroVideo ? "has-video" : ""}`}>
          {heroVideo ? <LazyHeroVideo src={heroVideo} poster={heroImage} title="Wedding Introduction" alt={wedding.couple_names} /> : <img src={heroImage} alt={wedding.couple_names} />}
          <div className="premium-intro__shade" />
        </div>
        <button className="premium-sound" type="button" onClick={toggleMusic} disabled={!musicUrl} title={musicUrl ? "Toggle music" : "No music"}>
          {isMusicOn ? "Music On" : "Music Off"}
        </button>
        <div className="premium-intro__content">
          <p className="premium-kicker">A WEDFLIX WEDDING ORIGINAL</p>
          <h1>{wedding.couple_names || "Wedding Celebration"}</h1>
          <p className="premium-intro__tagline">{wedding.description || "Together Forever"}</p>
          <div className="premium-intro__meta">
            <span>{wedding.wedding_date || "Wedding Date"}</span>
            <span>{venueAddress}</span>
          </div>
          <button type="button" className="premium-primary" onClick={() => setScreen("invitation")}>Enter Wedding</button>
        </div>
      </header>,
    );
  }

  if (screen === "invitation") {
    return shell(
      <main className="premium-invitation">
        <div className="premium-invitation__backdrop" style={{ backgroundImage: `url(${heroImage})` }} aria-hidden="true" />
        <aside className="premium-invitation__sidebar">
          <strong>WEDFLIX</strong>
          <div className="premium-invitation__couple">
            <img src={heroImage} alt="" />
            <span>{wedding.couple_names || "Wedding"}</span>
            <small>{wedding.wedding_date || "Wedding Date"}</small>
          </div>
          <nav aria-label="Wedding journey">
            <button type="button" onClick={continueToHome}>Home</button>
            <button type="button" className="is-active">Invitation</button>
            <button type="button" onClick={continueToHome}>Events</button>
            <button type="button" onClick={continueToHome}>Gallery</button>
            <button type="button" onClick={continueToHome}>Videos</button>
            <button type="button" onClick={continueToHome}>Family</button>
            <button type="button" onClick={continueToHome}>Wishes</button>
            <button type="button" onClick={() => setScreen("venue")}>Venue</button>
          </nav>
        </aside>
        <div className="premium-invitation__top">
          <span>WEDFLIX</span>
          <button type="button" className="premium-invitation__back" onClick={continueToHome}>Back to Home</button>
        </div>
        <div className="premium-invitation__layout">
          <div className="premium-invitation__stage">
            <div className="premium-invitation__card" ref={invitationRef} style={{ transform: `scale(${zoom})` }}>
              <img className="premium-invitation__couple-watermark" src={heroImage} alt="" aria-hidden="true" />
              <span className="premium-invitation__flower premium-invitation__flower--top" aria-hidden="true" />
              <span className="premium-invitation__flower premium-invitation__flower--bottom" aria-hidden="true" />
              <button
                type="button"
                className={`premium-invitation__music ${isMusicOn ? "is-on" : ""}`}
                onClick={toggleMusic}
                disabled={!musicUrl}
                aria-label={musicUrl ? (isMusicOn ? "Turn music off" : "Turn music on") : "No music available"}
                title={musicUrl ? (isMusicOn ? "Music On" : "Music Off") : "No music"}
              >
                <span aria-hidden="true">{isMusicOn ? "Music" : "Mute"}</span>
              </button>
              <span className="premium-invitation__ribbon" aria-hidden="true">You are cordially invited</span>
              <span className="premium-invitation__monogram" aria-hidden="true">
                {(invitation.first || "K").charAt(0)}
                {(invitation.second || "N").charAt(0)}
              </span>
              <p>{invitation.title}</p>
              <h2>{invitation.first}</h2>
              {invitation.second && <em>&amp;</em>}
              {invitation.second && <h2>{invitation.second}</h2>}
              <div className="premium-invitation__quote premium-invitation__quote--left" aria-hidden="true">
                <strong>Two hearts, one love, a lifetime of togetherness.</strong>
              </div>
              <div className="premium-invitation__quote premium-invitation__quote--right" aria-hidden="true">
                <strong>The best thing to hold onto in life is each other.</strong>
              </div>
              <div className="premium-invitation__date">
                {invitationDate.day && <span>{invitationDate.day}</span>}
                <strong>
                  {invitationDate.month}
                  {invitationDate.weekday && <small>{invitationDate.weekday}</small>}
                </strong>
                {invitationDate.year && <span>{invitationDate.year}</span>}
              </div>
              <strong>{venueName}</strong>
              <span>{venueAddress}</span>
              <small>Reception to follow</small>
            </div>
          </div>
          <aside className="premium-invitation__details">
            <p className="premium-kicker">Wedding Invitation</p>
            <h1>{wedding.couple_names || "Wedding Celebration"}</h1>
            <div>
              <span>Date</span>
              <strong>{wedding.wedding_date || "Wedding Date"}</strong>
            </div>
            <div>
              <span>Venue</span>
              <strong>{venueName}</strong>
              <small>{venueAddress}</small>
            </div>
            <p>{wedding.description || "Together with family and friends, join us for a celebration of love, laughter, and forever."}</p>
          </aside>
        </div>
        <div className="premium-actionbar">
          <button type="button" onClick={downloadInvitation}>
            <span aria-hidden="true">Download</span>
            <small>Download</small>
          </button>
          <button type="button" onClick={shareInvitation}>
            <span aria-hidden="true">Share</span>
            <small>Share</small>
          </button>
          <button type="button" onClick={() => setScreen("venue")}>
            <span aria-hidden="true">Venue</span>
            <small>View Venue</small>
          </button>
          <button type="button" className="premium-actionbar__primary" onClick={continueToHome}>
            <span aria-hidden="true">Continue</span>
            <small>Continue</small>
          </button>
        </div>
      </main>,
    );
  }

  if (screen === "venue") {
    return shell(
      <main className="premium-venue">
        <section className="premium-venue__hero">
          <img src={venueImage} alt={venueName} />
          <div>
            <p className="premium-kicker">Venue</p>
            <h1>{venueName}</h1>
            <p>{venueAddress}</p>
          </div>
        </section>
        <section className="premium-venue__details premium-venue__details--blocks">
          {venueBlocks.map((block) => (
            <article className="premium-venue__block" key={block.key}>
              <div>
                {block.meta && <span>{block.meta}</span>}
                <strong>{block.title}</strong>
                {block.body && <p>{block.body}</p>}
                {block.address && <small>{block.address}</small>}
              </div>
              {canEdit && (
                <div className="premium-venue__block-actions">
                  <button type="button" onClick={() => setVenueEditor(block)} disabled={isSavingVenue}>Edit</button>
                  <button type="button" onClick={() => deleteVenueBlock(block.key)} disabled={isSavingVenue}>Delete</button>
                </div>
              )}
            </article>
          ))}
          {canEdit && (
            <button
              type="button"
              className="premium-venue__add"
              disabled={isSavingVenue}
              onClick={() => setVenueEditor({ key: `venue_${Date.now()}`, title: "", meta: "", body: "", address: "", isNew: true })}
            >
              Add Venue Detail
            </button>
          )}
        </section>
        {canEdit && venueEditor && (
          <form className="premium-venue__editor" onSubmit={saveVenueBlock}>
            <label>
              <span>Head</span>
              <input name="title" defaultValue={venueEditor.title || ""} placeholder="Haldi, Reception, Parking..." disabled={isSavingVenue} />
            </label>
            <label>
              <span>Time / Label</span>
              <input name="meta" defaultValue={venueEditor.meta || ""} placeholder="10 April | 7:00 PM" disabled={isSavingVenue} />
            </label>
            <label className="premium-venue__editor-wide">
              <span>Block Details</span>
              <textarea name="body" defaultValue={venueEditor.body || ""} placeholder="Write dress code, entry note, food, host contact..." disabled={isSavingVenue} />
            </label>
            <label className="premium-venue__editor-wide">
              <span>Address / Location Note</span>
              <input name="address" defaultValue={venueEditor.address || ""} placeholder="Garden lawn, banquet hall, full address..." disabled={isSavingVenue} />
            </label>
            <div className="premium-venue__editor-actions">
              <button type="button" onClick={() => setVenueEditor(null)} disabled={isSavingVenue}>Cancel</button>
              <button type="submit" disabled={isSavingVenue}>{isSavingVenue ? "Saving..." : "Save Detail"}</button>
            </div>
          </form>
        )}
        <p className="premium-venue__copy">{wedding.venue_description || wedding.description || "A premium celebration venue prepared for family, friends, and unforgettable memories."}</p>
        <div className="premium-map">
          <iframe title="Wedding venue map" loading="lazy" src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`} />
        </div>
        <div className="premium-actionbar">
          <a href={mapsUrl(mapQuery)} target="_blank" rel="noreferrer">Open in Google Maps</a>
          <button type="button" onClick={shareLocation}>Share Location</button>
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapQuery)}`} target="_blank" rel="noreferrer">Start Navigation</a>
          <button type="button" onClick={findDistance}>Distance From Me</button>
          <button type="button" className="premium-actionbar__primary" onClick={continueToHome}>Continue</button>
        </div>
        {distance && <p className="premium-distance">{distance}</p>}
      </main>,
    );
  }

  return null;
}
