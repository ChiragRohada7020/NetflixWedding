import React, { useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { apiGet, apiGetPublic, mediaUrl } from "../api";
import { useQuery } from "@tanstack/react-query";
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

function venueBlocks(wedding, programs, venueName, venueAddress) {
  if (Array.isArray(wedding?.venue_blocks) && wedding.venue_blocks.length) {
    return wedding.venue_blocks.map((block, index) => ({
      key: block.key || `venue-${index}`,
      title: block.title || `Event ${index + 1}`,
      meta: block.meta || wedding?.wedding_date || "",
      body: block.body || "",
      address: block.address || venueAddress,
    }));
  }
  if (programs.length) {
    return programs.slice(0, 5).map((program, index) => ({
      key: program._id || `program-${index}`,
      title: program.title || `Event ${index + 1}`,
      meta: [program.event_date, program.event_time].filter(Boolean).join(" | "),
      body: program.description || program.venue_name || venueName,
      address: program.event_address || venueAddress,
    }));
  }
  return [{
    key: "main-wedding",
    title: "Wedding Ceremony",
    meta: wedding?.wedding_date || "",
    body: venueName,
    address: venueAddress,
  }];
}

function mapsUrl(address) {
  if (/^https?:\/\//i.test(address || "")) return address;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || "")}`;
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
  const galleryImages = [heroImage, ...programs.map((program) => mediaUrl(program.thumbnail || "")).filter(Boolean)].slice(0, 4);
  const schedule = useMemo(() => venueBlocks(wedding, programs, venueName, venueAddress), [wedding, programs, venueName, venueAddress]);
  const inviteEvents = useMemo(() => {
    if (programs.length) return programs.slice(0, 6);
    return [{ _id: "wedding", title: "Wedding Celebration", event_date: wedding?.wedding_date, venue_name: venueName, thumbnail: heroImage }];
  }, [programs, wedding?.wedding_date, venueName, heroImage]);

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
          <div className="invite-reveal__couple">
            <img src={heroImage} alt={wedding?.couple_names || "Couple"} />
          </div>
          <div className="invite-reveal__card">
            <p className="invite-reveal__brand">Wedding Invitation</p>
            <div className="invite-reveal__monogram">{initials}</div>
            <p>You are invited to celebrate</p>
            <h1>{firstName}{secondName ? ` & ${secondName}` : ""}</h1>
            <strong>{inviteHash(wedding?.couple_names)}</strong>
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
          <div className="invite-florals" aria-hidden="true">
            <span className="invite-florals__corner invite-florals__corner--tl" />
            <span className="invite-florals__corner invite-florals__corner--tr" />
            <span className="invite-florals__corner invite-florals__corner--bl" />
            <span className="invite-florals__corner invite-florals__corner--br" />
          </div>
          <section className="invite-hero" style={{ backgroundImage: `url(${heroImage})` }}>
            <div className="invite-hero__shade" />
            <nav className="invite-nav">
              <span>{initials}</span>
              <a href="#invitation">Invitation</a>
              <a href="#events">Events</a>
              <a href="#venue">Venue</a>
            </nav>
            <div className="invite-hero__content invite-card-panel">
              <div className="invite-hero__portrait">
                <img src={heroImage} alt="" />
              </div>
              <p className="invite-kicker">Together with their families</p>
              <h1>
                <span>{firstName}</span>
                {secondName && <em>&amp;</em>}
                {secondName && <span>{secondName}</span>}
              </h1>
              <p className="invite-hash">{inviteHash(wedding?.couple_names)}</p>
              <div className="invite-date">
                {date.day && <strong>{date.day}</strong>}
                <span>{date.month}{date.weekday && <small>{date.weekday}</small>}</span>
                {date.year && <strong>{date.year}</strong>}
              </div>
              {weddingTime && <p className="invite-time">{weddingTime}</p>}
              <p>{wedding?.description || "We request the pleasure of your presence as we begin our forever."}</p>
            </div>
          </section>

          <section className="invite-section invite-story invite-card-panel" id="invitation">
            <p className="invite-kicker">{inviteTitle}</p>
            <h2>With love, laughter, and blessings</h2>
            <p>
              Join us for a celebration filled with family, music, memories, and the beginning of a beautiful forever.
            </p>
          </section>

          <section className="invite-section invite-blessings invite-card-panel">
            <h2>|| Shri Ganeshay Namah ||</h2>
            <p>With the blessings of our families</p>
            <p>
              We will be delighted to have your presence as {firstName}{secondName ? ` and ${secondName}` : ""} take their vows around the sacred fire.
            </p>
            <div className="invite-divider"><span>Love</span></div>
            <div className="invite-blessing-names">
              <strong>{firstName}</strong>
              {secondName && <strong>{secondName}</strong>}
            </div>
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

          <section className="invite-section invite-schedule invite-card-panel">
            <p className="invite-kicker">Save The Date</p>
            <h2>Celebration Schedule</h2>
            <div className="invite-schedule__list">
              {schedule.map((item, index) => (
                <article key={item.key}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{item.title}</h3>
                    {item.meta && <p>{item.meta}</p>}
                    {item.body && <strong>{item.body}</strong>}
                    {item.address && <small>{item.address}</small>}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="invite-section invite-events invite-card-panel" id="events">
            <p className="invite-kicker">Celebrations</p>
            <h2>The Celebration Unfolds</h2>
            <div className="invite-tab">Sacred <em>Ceremonies</em></div>
            <div className="invite-event-grid">
              {inviteEvents.map((event) => (
                <article key={event._id}>
                  <img src={mediaUrl(event.thumbnail || heroImage)} alt="" />
                  <div>
                    <h3>{event.title || "Wedding Event"}</h3>
                    <p>{event.event_date || wedding?.wedding_date || "Wedding Date"}</p>
                    <span>{event.venue_name || venueName}</span>
                  </div>
                </article>
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
                <span>{countdown.days} Days · {countdown.hours} Hours · {countdown.minutes} Minutes</span>
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
