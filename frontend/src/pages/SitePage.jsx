import React, { useEffect, useState } from "react";
import ReactPlayer from "react-player";
import SeoHead from "../components/SeoHead";

const heroVideoUrl = "https://vimeo.com/1017938196";

const featuredFilms = [
  {
    couple: "Life In Episodes",
    location: "Creator Series",
    title: "your stories, arranged like a streaming series",
    copy:
      "A Wedflix profile can open with your feature story, then lead viewers into episodes, albums, highlights, and moments that feel easy to watch and share.",
    image:
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1400&q=80",
  },
];

const testimonials = [
  {
    quote:
      "I added my travel, family memories, college events, and short films in one place. It finally felt like my life had a home page, not just scattered links.",
    couple: "A creator using Wedflix",
  },
  {
    quote:
      "We shared one Wedflix link in our Instagram bio and everyone could watch the series, open albums, and revisit the moments without asking for files.",
    couple: "Instagram bio audience",
  },
  {
    quote:
      "The Netflix-style layout made our brand story feel premium. Each launch, behind-the-scenes clip, and event became a clean episode.",
    couple: "Small brand showcase",
  },
  {
    quote:
      "Trips, birthdays, school memories, weddings, business journeys, and personal films can all live together without feeling messy.",
    couple: "Stories across life",
  },
];

const navLinks = [
  { label: "Home", href: "#top" },
  { label: "Stories", href: "#films" },
  { label: "About", href: "#about" },
  { label: "Blog", href: "/site/blog" },
  { label: "Contact", href: "#contact" },
];

function InstagramIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
    </svg>
  );
}

function useScrollReveal() {
  useEffect(() => {
    const nodes = document.querySelectorAll("[data-reveal]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -40px 0px" },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);
}

export default function SitePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const instagramHandle = "@wed_flixx";
  const instagramUrl = "https://www.instagram.com/wed_flixx/";
  const wedflixStoryUrl = "https://www.wedflix.space/";

  useScrollReveal();

  useEffect(() => {
    const closeMenu = () => setMenuOpen(false);
    window.addEventListener("resize", closeMenu);
    return () => window.removeEventListener("resize", closeMenu);
  }, []);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="site-lux" id="top">
      <SeoHead
        title="Wedflix | Your Life As A Series"
        description="Create a Netflix-style page for your stories, videos, albums, events, and memories. Share one link in your bio with anyone."
        canonicalPath="/site"
      />

      <header className={`site-lux__header ${isScrolled ? "is-scrolled" : ""}`}>
        <div className="site-lux__header-bar">
          <a href="#top" className="site-lux__logo" aria-label="Wedflix home">
            WEDFLIX
          </a>

          <nav className={`site-lux__nav ${menuOpen ? "is-open" : ""}`} aria-label="Primary">
            {navLinks.map((item) => (
              <a key={item.label} href={item.href} onClick={() => setMenuOpen(false)}>
                {item.label}
              </a>
            ))}
            <a href="#contact" className="site-lux__nav-cta" onClick={() => setMenuOpen(false)}>
              Inquire
            </a>
          </nav>

          <button
            type="button"
            className={`site-lux__menu-toggle ${menuOpen ? "is-open" : ""}`}
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>

      <section className="site-lux__hero">
        <div className="site-lux__hero-copy" data-reveal>
          <p className="site-lux__eyebrow">Wedflix Story Experience</p>
          <h1>turn your life, brand, or event into a shareable series</h1>
          <p className="site-lux__lede">
            Wedflix lets anyone upload stories, arrange videos like episodes, add albums, and share one beautiful Netflix-style link with friends, clients, followers, or family.
          </p>
          <p className="site-lux__trust">
            Trusted by <strong>1K+ reviews</strong>
          </p>
          <div className="site-lux__actions">
            <a href={wedflixStoryUrl} target="_blank" rel="noreferrer" className="site-lux__button site-lux__button--primary">
              View Stories
            </a>
          </div>
        </div>

        <div className="site-lux__hero-visual" data-reveal>
          <div className="site-lux__hero-card">
            <div className="site-lux__hero-video-frame" aria-hidden="true">
              <ReactPlayer
                className="site-lux__hero-video"
                url={heroVideoUrl}
                playing
                muted
                loop
                playsinline
                controls={false}
                width="100%"
                height="100%"
                config={{
                  vimeo: {
                    playerOptions: {
                      autoplay: true,
                      background: true,
                      autopause: false,
                      byline: false,
                      controls: false,
                      loop: true,
                      muted: true,
                      portrait: false,
                      title: false,
                    },
                  },
                }}
              />
              <span className="site-lux__hero-mask site-lux__hero-mask--top" />
              <span className="site-lux__hero-mask site-lux__hero-mask--bottom" />
              <span className="site-lux__hero-mask site-lux__hero-mask--left" />
              <span className="site-lux__hero-mask site-lux__hero-mask--right" />
            </div>
          </div>
          <div className="site-lux__hero-note">
            <strong>what wedflix provides</strong>
            <span>Videos, albums, episodes, profile pages, and one polished link for your Instagram bio.</span>
          </div>
        </div>
      </section>

      <section className="site-lux__section" id="films">
        <div className="site-lux__section-head" data-reveal>
          <p className="site-lux__eyebrow">What You Can Showcase</p>
          <h2>personal stories, creator journeys, events, and memories</h2>
        </div>

        <div className="site-lux__story-list">
          {featuredFilms.map((film, index) => (
            <article
              key={`${film.couple}-${film.location}`}
              className={`site-lux__story-block ${index % 2 === 1 ? "is-reversed" : ""}`}
              data-reveal
              style={{ transitionDelay: `${index * 70}ms` }}
            >
              <div className="site-lux__story-media">
                <img src={film.image} alt={`${film.couple} Wedflix story`} />
              </div>
              <div className="site-lux__story-copy">
                <p className="site-lux__story-kicker">{film.location}</p>
                <h3>{film.title}</h3>
                <p>{film.copy}</p>
                <strong>{film.couple}</strong>
                <a href={wedflixStoryUrl} target="_blank" rel="noreferrer" className="site-lux__story-link">
                  Explore The Story
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="site-lux__section site-lux__about" id="about">
        <div className="site-lux__about-media" data-reveal>
          <img
            src="https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1400&q=80"
            alt="People celebrating a memorable story"
          />
        </div>

        <div className="site-lux__about-copy" data-reveal>
          <p className="site-lux__eyebrow">What We Do</p>
          <h2>wedflix turns your content into a cinematic digital experience</h2>
          <p>
            Bring together videos, photos, event pages, behind-the-scenes clips, launch stories,
            travel diaries, family memories, and personal milestones in one refined destination.
          </p>
          <p>
            Use Wedflix like a premium link-in-bio for your life: one profile, many stories,
            organized like seasons and episodes, ready to share with anyone.
          </p>
        </div>
      </section>

      <section className="site-lux__section" id="testimonials">
        <div className="site-lux__section-head" data-reveal>
          <p className="site-lux__eyebrow">Testimonials</p>
          <h2>why people love the wedflix experience</h2>
        </div>

        <div className="site-lux__testimonial-grid">
          {testimonials.map((item, index) => (
            <article
              key={item.couple}
              className="site-lux__testimonial-card"
              data-reveal
              style={{ transitionDelay: `${index * 80}ms` }}
            >
              <span className="site-lux__quote-mark">"</span>
              <p>{item.quote}</p>
              <strong>{item.couple}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="site-lux__section site-lux__blog-strip" id="blog" data-reveal>
        <div>
          <p className="site-lux__eyebrow">Stories & Sharing Blog</p>
          <h2>guides for digital albums, story pages, captions, videos, and bio links</h2>
        </div>
        <a href="/site/blog" className="site-lux__button site-lux__button--secondary">
          Read Blog
        </a>
      </section>

      <section className="site-lux__section site-lux__contact" id="contact" data-reveal>
        <div className="site-lux__contact-copy">
          <p className="site-lux__eyebrow">Contact</p>
          <h2>message wedflix on instagram</h2>
          <p>
            If you want your stories, event, brand, or memories presented beautifully on Wedflix, send us a message on Instagram and tell us what you want to share.
          </p>
          <a
            href={instagramUrl}
            target="_blank"
            rel="noreferrer"
            className="site-lux__button site-lux__button--primary"
          >
            <InstagramIcon className="site-lux__button-icon" />
            DM {instagramHandle}
          </a>
        </div>
        <div className="site-lux__contact-card">
          <p className="site-lux__contact-label">
            <InstagramIcon className="site-lux__contact-icon" />
            Instagram
          </p>
          <a href={instagramUrl} target="_blank" rel="noreferrer" className="site-lux__contact-handle">
            {instagramHandle}
          </a>
          <p className="site-lux__contact-note">
            Send a direct message and we will continue the conversation there.
          </p>
        </div>
      </section>

      <footer className="site-lux__footer">
        <p>Wedflix &copy; {new Date().getFullYear()} All Rights Reserved.</p>
      </footer>
    </div>
  );
}
