import React, { useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { apiGet, apiGetPublic, mediaUrl } from "../api";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import AsyncState from "../components/AsyncState";
import SeoHead from "../components/SeoHead";

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
    title: event.title || fallback[index % fallback.length].title,
    time: event.event_time || event.time || fallback[index % fallback.length].event_time,
    date: readableDate(event.event_date || wedding?.wedding_date, fallback[index % fallback.length].event_date),
    attire: event.attire || event.dress_code || event.description || fallback[index % fallback.length].description,
    image: mediaUrl(event.thumbnail || "") || heroImage,
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

export default function PublicInvitationSite() {
  const { publicSlug } = useParams();
  const [revealed, setRevealed] = useState(false);
  const [bursting, setBursting] = useState(false);
  const [scratchOpen, setScratchOpen] = useState(false);
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
  const initials = `${(firstName || "W").charAt(0)}${(secondName || "F").charAt(0)}`;
  const inviteTitle = wedding?.invitation_title || "Wedding Invitation";
  const countdown = countdownParts(wedding?.wedding_date);
  const galleryImages = [heroImage, ...programs.map((program) => mediaUrl(program.thumbnail || "")).filter(Boolean)].slice(0, 8);
  const inviteEvents = useMemo(() => timelineEvents(programs, wedding, venueName, heroImage), [programs, wedding, venueName, heroImage]);

  const revealInvite = async () => {
    setBursting(true);
    if (musicUrl) {
      setTimeout(() => audioRef.current?.play().catch(() => {}), 120);
    }
    window.setTimeout(() => setRevealed(true), 920);
  };

  if (isLoading && !data) return <AsyncState mode="loading" />;
  if (error && !data) return <AsyncState mode="error" message={error.message} onRetry={() => refetch()} />;

  return (
    <main className={`invite-site ${revealed ? "is-revealed" : ""}`}>
      <SeoHead
        title={wedding ? `${wedding.couple_names} Wedding Invitation` : "Wedding Invitation"}
        description={wedding?.description || "You are invited to the wedding celebration."}
        canonicalPath={`/p/${publicSlug}/invite`}
        image={heroImage}
      />
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
                <span>The Celebration</span>
                <span>Unfolds</span>
              </h1>
              <div className="invite-soft-hearts" aria-hidden="true"><span /><span /></div>
              <motion.div
                className="invite-tab invite-sacred-badge"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.9, delay: 0.28, ease: "easeOut" }}
              >
                Sacred <em>Ceremonies</em>
              </motion.div>
              <div className="invite-luxury-couple">
                <img src={heroImage} alt={wedding?.couple_names || "Couple"} />
              </div>
              <motion.div
                className="invite-couple-date-card"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.45, ease: "easeOut" }}
              >
                <p>{inviteTitle}</p>
                <h2>{firstName}{secondName ? ` weds ${secondName}` : ""}</h2>
                <span>{date.weekday || "Wedding Day"} / {date.day || ""} {date.month || ""} {date.year || ""}</span>
              </motion.div>
              <div className="invite-date">
                {date.day && <strong>{date.day}</strong>}
                <span>{date.month}{date.weekday && <small>{date.weekday}</small>}</span>
                {date.year && <strong>{date.year}</strong>}
              </div>
              {weddingTime && <p className="invite-time">{weddingTime}</p>}
              <p className="invite-luxury-description">{wedding?.description || `${firstName}${secondName ? ` weds ${secondName}` : ""}. Join us as the celebration unfolds.`}</p>
            </motion.div>
          </section>

          <section className="invite-section invite-events invite-timeline-section" id="events">
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
                    <img src={event.image} alt="" />
                  </div>
                  <div className="invite-timeline-card">
                    <h3>{event.title}</h3>
                    <p>{event.time}</p>
                    <span>{event.date}</span>
                    <small>{event.attire}</small>
                  </div>
                </motion.article>
              ))}
            </div>
          </section>

          <section className="invite-section invite-story invite-card-panel" id="invitation">
            <p className="invite-kicker">{inviteTitle}</p>
            <h2>{firstName}{secondName ? ` weds ${secondName}` : ""}</h2>
            <p>With the blessings of our families, we request your presence for love, laughter, rituals, and forever.</p>
          </section>

          <section className="invite-section invite-memories invite-card-panel">
            <p className="invite-kicker">A Little Story</p>
            <h2>Our memories before we create more memories</h2>
            <div className="invite-memory-grid">
              {galleryImages.map((image, index) => (
                <img key={`${image}-${index}`} src={image} alt="" />
              ))}
            </div>
          </section>

          <section className="invite-section invite-venue invite-card-panel" id="venue">
            <p className="invite-kicker">Venue</p>
            <h2>{venueName}</h2>
            <p>{venueAddress || "Location details will be shared soon."}</p>
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
            <p className="invite-kicker">Counting Every Moment</p>
            <h2>Until we say I do</h2>
            <button type="button" className={`invite-scratch ${scratchOpen ? "is-open" : ""}`} onClick={() => setScratchOpen(true)}>
              {scratchOpen ? (
                <span>{countdown.days} Days / {countdown.hours} Hours / {countdown.minutes} Minutes</span>
              ) : (
                <span>Scratch here to reveal</span>
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
              <div>
                <button>{firstName.charAt(0)}</button>
                {secondName && <button>{secondName.charAt(0)}</button>}
                <button>B</button>
              </div>
              <em>Reveal after the wedding</em>
            </div>
            <div className="invite-mood-grid">
              {["The Food", "Dance Floor", "The Love", "All of it"].map((item) => <button key={item}>{item}</button>)}
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
        </>
      )}
    </main>
  );
}
