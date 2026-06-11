import React, { useEffect, useMemo, useRef, useState } from "react";
import { mediaUrl } from "../api";

function placeholder(label) {
  const text = encodeURIComponent((label || "Wedflix Story").trim().slice(0, 28));
  return `data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1280 720'%3E%3Crect width='1280' height='720' fill='%23050505'/%3E%3CradialGradient id='g' cx='62%25' cy='22%25' r='80%25'%3E%3Cstop stop-color='%23e50914' stop-opacity='.36'/%3E%3Cstop offset='1' stop-color='%23e50914' stop-opacity='0'/%3E%3C/radialGradient%3E%3Crect width='1280' height='720' fill='url(%23g)'/%3E%3Ctext x='76' y='374' fill='%23fff' font-size='82' font-family='Georgia,serif'%3E${text}%3C/text%3E%3C/svg%3E`;
}

function mapsUrl(address) {
  if (/^https?:\/\//i.test(address || "")) return address;
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
  const formalTitle = "Welcome to the story of";
  return {
    first: first || names,
    second: second || "",
    title: savedTitle.length > 28 ? savedTitle : formalTitle,
  };
}

function getInvitationDate(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) {
    return { day: "", month: value || "Story Date", year: "", weekday: "" };
  }
  return {
    day: String(date.getDate()).padStart(2, "0"),
    month: date.toLocaleString("en", { month: "long" }),
    year: String(date.getFullYear()),
    weekday: date.toLocaleString("en", { weekday: "long" }),
  };
}

function splitCoupleNames(value) {
  const names = value || "Aarav & Diya";
  const parts = names.split("&").map((part) => part.trim()).filter(Boolean);
  return parts.length >= 2 ? parts.slice(0, 2) : [names, ""];
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
  const [venueSettingsOpen, setVenueSettingsOpen] = useState(false);
  const [isSavingVenue, setIsSavingVenue] = useState(false);
  const [isMusicOn, setIsMusicOn] = useState(() => localStorage.getItem("wedflix_music_on") !== "0");
  const audioRef = useRef(null);
  const invitationRef = useRef(null);
  const featuredProgram = programs[0] || null;
  const heroImage = mediaUrl(wedding?.hero_image || wedding?.profile_image || featuredProgram?.thumbnail || "") || placeholder(wedding?.couple_names);
  const venueImage = mediaUrl(wedding?.venue_image || "") || heroImage;
  const venueName = wedding?.venue_name || featuredProgram?.venue_name || "Story Location";
  const venueAddress = wedding?.event_address || featuredProgram?.event_address || "Location address";
  const venueEyebrow = wedding?.venue_eyebrow || "You're Invited To";
  const venueScript = wedding?.venue_script || "the story of";
  const venueSectionLabel = wedding?.venue_section_label || "Story Location";
  const mapLocation = wedding?.venue_map_location || venueAddress;
  const weddingTime = wedding?.wedding_time || featuredProgram?.event_time || "11:00 AM";
  const musicUrl = mediaUrl(wedding?.music_url || "");
  const invitation = getInvitationText(wedding);
  const invitationDate = getInvitationDate(wedding?.wedding_date);
  const invitationWebsiteUrl = wedding?.public_slug
    ? `${window.location.origin}/p/${wedding.public_slug}/invite`
    : window.location.href;
  const mapQuery = mapLocation || [venueName, venueAddress].filter(Boolean).join(", ");
  const venueBlocks = useMemo(() => {
    const saved = Array.isArray(wedding?.venue_blocks) ? wedding.venue_blocks : [];
    if (Array.isArray(wedding?.venue_blocks)) {
      return saved.map((block, index) => ({
        ...block,
        key: block.key || `venue_${index}`,
      }));
    }
    return [
      {
        key: "main_venue",
        title: "Story Location",
        meta: [wedding?.wedding_date, weddingTime].filter(Boolean).join(" | "),
        body: venueName,
        address: venueAddress,
      },
    ];
  }, [venueAddress, venueName, wedding?.venue_blocks, wedding?.wedding_date, weddingTime]);

  const scheduleCards = useMemo(() => {
    return venueBlocks.map((block, index) => ({
      key: block.key || `venue_${index}`,
      title: block.title || `Moment ${index + 1}`,
      date: block.meta || wedding?.wedding_date || "Story Date",
      time: block.body || "",
      address: block.address || "",
      source: block,
    }));
  }, [venueBlocks, wedding?.wedding_date]);

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
    const existing = venueBlocks;
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
    if (!window.confirm("Delete this location schedule item?")) return;
    const existing = venueBlocks;
    setIsSavingVenue(true);
    try {
      await onSaveWeddingField("venue_blocks", existing.filter((item) => item.key !== key));
    } finally {
      setIsSavingVenue(false);
    }
  };

  const saveVenueSettings = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setIsSavingVenue(true);
    try {
      await onSaveWeddingField("venue_details", {
        couple_names: String(form.get("couple_names") || "").trim(),
        wedding_date: String(form.get("wedding_date") || "").trim(),
        wedding_time: String(form.get("wedding_time") || "").trim(),
        venue_eyebrow: String(form.get("venue_eyebrow") || "").trim(),
        venue_script: String(form.get("venue_script") || "").trim(),
        venue_section_label: String(form.get("venue_section_label") || "").trim(),
        venue_name: String(form.get("venue_name") || "").trim(),
        event_address: String(form.get("event_address") || "").trim(),
        venue_map_location: String(form.get("venue_map_location") || "").trim(),
        venue_image: String(form.get("venue_image") || "").trim(),
        venue_image_file: form.get("venue_image_file"),
        venue_description: String(form.get("venue_description") || "").trim(),
      });
      setVenueSettingsOpen(false);
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

  const shareText = `${wedding?.couple_names || "Wedflix Story"} - ${wedding?.wedding_date || ""}`;
  const shareUrl = invitationWebsiteUrl;
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
      `SUMMARY:${wedding?.couple_names || "Wedflix Story"}`,
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
    window.alert("Location copied.");
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

  const goNav = (target) => {
    if (target === "invitation" || target === "venue") {
      setScreen(target);
      return;
    }
    continueToHome();
  };

  const premiumNav = (active) => (
    <nav className="premium-wedding__nav" aria-label="Premium wedding navigation">
      <button type="button" className="premium-wedding__brand" onClick={continueToHome}>WEDFLIX</button>
      <div className="premium-wedding__nav-links">
        {[
          ["Home", "home"],
          ["Live Moments", "venue"],
          ["Invitation", "invitation"],
        ].map(([label, target]) => (
          <button
            type="button"
            key={label}
            className={active === target && label === "Live Moments" ? "is-active" : ""}
            onClick={() => goNav(target)}
          >
            {label}
          </button>
        ))}
      </div>
    </nav>
  );

  const shell = (children) => (
    <section className={`premium-wedding premium-wedding--${screen}`}>
      <audio ref={audioRef} src={musicUrl} loop preload="metadata" />
      {children}
    </section>
  );

  if (screen === "intro") {
    return shell(
      <header className="premium-intro">
        <div className="premium-intro__media">
          <img src={heroImage} alt={wedding.couple_names} />
          <div className="premium-intro__shade" />
        </div>
        <button className="premium-sound" type="button" onClick={toggleMusic} disabled={!musicUrl} title={musicUrl ? "Toggle music" : "No music"}>
          {isMusicOn ? "Music On" : "Music Off"}
        </button>
        <div className="premium-intro__content">
          <p className="premium-kicker">A WEDFLIX WEDDING ORIGINAL</p>
          <div className="premium-intro__monogram" aria-hidden="true">
            {(invitation.first || "W").charAt(0)}
            {(invitation.second || "F").charAt(0)}
          </div>
          <h1>{wedding.couple_names || "Wedflix Story"}</h1>
          <p className="premium-intro__hashtag">
            #{(wedding.couple_names || "WedflixForever").replace(/[^a-z0-9]+/gi, "").slice(0, 22) || "WedflixForever"}
          </p>
          <p className="premium-intro__tagline">{wedding.description || "Together Forever"}</p>
          <div className="premium-intro__meta">
            <span>{wedding.wedding_date || "Story Date"}</span>
            <span>{venueAddress}</span>
          </div>
          <button type="button" className="premium-primary premium-primary--reveal" onClick={() => setScreen("invitation")}>Tap to Reveal</button>
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
            <span>{wedding.couple_names || "Wedflix Story"}</span>
            <small>{wedding.wedding_date || "Story Date"}</small>
          </div>
          <nav aria-label="Story journey">
            <button type="button" onClick={continueToHome}>Home</button>
            <button type="button" className="is-active">Invitation</button>
            <button type="button" onClick={continueToHome}>Episodes</button>
            <button type="button" onClick={continueToHome}>Gallery</button>
            <button type="button" onClick={continueToHome}>Videos</button>
            <button type="button" onClick={continueToHome}>Family</button>
            <button type="button" onClick={continueToHome}>Wishes</button>
            <button type="button" onClick={() => setScreen("venue")}>Location</button>
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
              <img className="premium-invitation__portrait" src={heroImage} alt={wedding.couple_names || "Couple"} />
              <div className="premium-invitation__intro">
                <span className="premium-invitation__monogram" aria-hidden="true">
                  {(invitation.first || "K").charAt(0)}
                  {(invitation.second || "N").charAt(0)}
                </span>
                <p>{invitation.title}</p>
              </div>
              <div className="premium-invitation__names">
                <h2>{invitation.first}</h2>
                {invitation.second && <em>&amp;</em>}
                {invitation.second && <h2>{invitation.second}</h2>}
              </div>
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
              <div className="premium-invitation__venue">
                <strong>{venueName}</strong>
                <span>{venueAddress}</span>
                <small>Reception to follow</small>
              </div>
            </div>
          </div>
          <aside className="premium-invitation__details">
            <p className="premium-kicker">Story Invitation</p>
            <h1>{wedding.couple_names || "Wedflix Story"}</h1>
            <div>
              <span>Date</span>
              <strong>{wedding.wedding_date || "Story Date"}</strong>
            </div>
            <div>
              <span>Location</span>
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
            <span aria-hidden="true">Location</span>
            <small>View Location</small>
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
    const [firstName, secondName] = splitCoupleNames(wedding?.couple_names);
    return shell(
      <>
        {premiumNav("venue")}
        <main className="premium-venue">
          <section className="premium-venue__hero premium-venue__hero--live">
            <img src={venueImage} alt={venueName} />
            <div className="premium-venue__hero-copy">
              <p className="premium-venue__eyebrow">{venueEyebrow}</p>
              <p className="premium-venue__script">{venueScript}</p>
              <h1>
                <span>{firstName}</span>
                {secondName && <em>&amp;</em>}
                {secondName && <span>{secondName}</span>}
              </h1>
              <div className="premium-venue__meta">
                <span>{wedding?.wedding_date || "Story Date"}</span>
                <span>{weddingTime}</span>
                <span>{venueName}</span>
              </div>
              <p className="premium-venue__lead">
                {wedding.venue_description || wedding.description || "Follow the places, moments, and memories that shape this story, from anywhere in the world."}
              </p>
              {canEdit && (
                <button type="button" className="premium-venue__edit" onClick={() => setVenueSettingsOpen((value) => !value)}>
                  Edit Location
                </button>
              )}
            </div>
          </section>
          <section className="premium-venue__spotlight">
            <img src={venueImage} alt="" />
            <div>
              <p>{venueSectionLabel}</p>
              <h2>{venueName}</h2>
              <span>{wedding.venue_description || "A meaningful place in this story, chosen for the memories it holds."}</span>
            </div>
            <a href={mapsUrl(mapQuery)} target="_blank" rel="noreferrer">Explore Location</a>
          </section>
        {canEdit && venueSettingsOpen && (
          <form className="premium-venue__editor premium-venue__settings" onSubmit={saveVenueSettings}>
            <label>
              <span>Top Heading</span>
              <input name="venue_eyebrow" defaultValue={venueEyebrow} placeholder="You're Invited To" disabled={isSavingVenue} />
            </label>
            <label>
              <span>Script Heading</span>
              <input name="venue_script" defaultValue={venueScript} placeholder="the story of" disabled={isSavingVenue} />
            </label>
            <label>
              <span>Story Title</span>
              <input name="couple_names" defaultValue={wedding?.couple_names || ""} placeholder="My Life Story" disabled={isSavingVenue} />
            </label>
            <label>
              <span>Story Date</span>
              <input name="wedding_date" defaultValue={wedding?.wedding_date || ""} placeholder="24 May 2025" disabled={isSavingVenue} />
            </label>
            <label>
              <span>Story Time</span>
              <input name="wedding_time" defaultValue={weddingTime} placeholder="7:00 PM IST" disabled={isSavingVenue} />
            </label>
            <label>
              <span>Location Label</span>
              <input name="venue_section_label" defaultValue={venueSectionLabel} placeholder="Story Location" disabled={isSavingVenue} />
            </label>
            <label>
              <span>Location Name</span>
              <input name="venue_name" defaultValue={venueName} placeholder="Royal Banquet" disabled={isSavingVenue} />
            </label>
            <label>
              <span>Display Address</span>
              <input name="event_address" defaultValue={venueAddress} placeholder="Address shown to guests" disabled={isSavingVenue} />
            </label>
            <label className="premium-venue__editor-wide">
              <span>Google Maps Location</span>
              <input name="venue_map_location" defaultValue={mapLocation} placeholder="Paste Google Maps link, plus code, or exact location" disabled={isSavingVenue} />
            </label>
            <label className="premium-venue__editor-wide">
              <span>Location Image URL</span>
              <input name="venue_image" defaultValue={wedding?.venue_image || ""} placeholder="https://..." disabled={isSavingVenue} />
            </label>
            <label className="premium-venue__editor-wide">
              <span>Upload Location Image</span>
              <input name="venue_image_file" type="file" accept="image/*" disabled={isSavingVenue} />
            </label>
            <label className="premium-venue__editor-wide">
              <span>Location Description</span>
              <textarea name="venue_description" defaultValue={wedding?.venue_description || ""} placeholder="Location note shown below the details" disabled={isSavingVenue} />
            </label>
            <div className="premium-venue__editor-actions">
              <button type="button" onClick={() => setVenueSettingsOpen(false)} disabled={isSavingVenue}>Cancel</button>
              <button type="submit" disabled={isSavingVenue}>{isSavingVenue ? "Saving..." : "Save Location"}</button>
            </div>
          </form>
        )}
        <h2 className="premium-venue__schedule-title">Moment Schedule</h2>
        <section className="premium-venue__schedule">
          {scheduleCards.map((card, index) => (
            <article className="premium-venue__event" key={card.key}>
              <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <div className="premium-venue__event-body">
                <strong>{card.title}</strong>
                <small>{card.date}</small>
                {card.time && <small>{card.time}</small>}
                {card.address && <small>{card.address}</small>}
                {canEdit && (
                  <div className="premium-venue__event-actions">
                    <button
                      type="button"
                      disabled={isSavingVenue}
                      onClick={() => setVenueEditor({ ...card.source, key: card.key })}
                    >
                      Edit
                    </button>
                    <button type="button" disabled={isSavingVenue} onClick={() => deleteVenueBlock(card.key)}>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
          {canEdit && (
            <button
              type="button"
              className="premium-venue__add"
              disabled={isSavingVenue}
              onClick={() => setVenueEditor({ key: `venue_${Date.now()}`, title: "", meta: "", body: "", address: "", isNew: true })}
            >
              Add Schedule
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
        </main>
      </>,
    );
  }

  return null;
}
