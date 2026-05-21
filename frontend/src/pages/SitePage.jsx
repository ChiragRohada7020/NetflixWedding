import React, { useEffect, useState } from "react";
import ReactPlayer from "react-player";
import SeoHead from "../components/SeoHead";

const heroVideoUrl = "https://vimeo.com/1017938196";

const featuredFilms = [
  {
    couple: "Anaya & Rohan",
    location: "Udaipur, Rajasthan",
    title: "a wedding story worth replaying",
    copy:
      "A Wedflix page can open with the main film, lead guests into the celebration, and keep every meaningful moment beautifully arranged in one place.",
    image:
      "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1400&q=80",
  },
];

const testimonials = [
  {
    quote:
      "It felt like the whole Sindhi family was sitting together again. From the sehra bandi to the dhol, every chacha, bua, and cousin found a moment that felt like ours.",
    couple: "Rohit & Neha Ahuja",
  },
  {
    quote:
      "Our Marwadi rituals were shown with so much warmth. The mehendi, bhaat, pithi, pheras, and bidaai all felt emotional without losing the family masti.",
    couple: "Kritika & Harsh Khandelwal",
  },
  {
    quote:
      "Our Marathi wedding felt complete on Wedflix. The sakhar puda, antarpat, mangalashtak, varmala, and every family blessing were shown with so much respect.",
    couple: "Aarohi & Nikhil Deshmukh",
  },
  {
    quote:
      "Every community has its own way of making a wedding special. Wedflix gave our rituals, prayers, family entries, and reception moments a premium place to shine.",
    couple: "Families Across Traditions",
  },
];

const navLinks = [
  { label: "Home", href: "#top" },
  { label: "Films", href: "#films" },
  { label: "About", href: "#about" },
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
        title="Wedflix | Luxury Wedding Films"
        description="Luxury wedding films and photography presented through a refined, cinematic Wedflix landing experience."
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
          <p className="site-lux__eyebrow">Wedflix Wedding Experience</p>
          <h1>wedding films, memories, and moments in one beautiful place</h1>
          <p className="site-lux__lede">
            Wedflix helps couples present their wedding story through cinematic films, elegant galleries, event pages, and a premium digital experience guests will love to revisit.
          </p>
          <p className="site-lux__trust">
            Trusted by <strong>1K+ reviews</strong>
          </p>
          <div className="site-lux__actions">
            <a href={wedflixStoryUrl} target="_blank" rel="noreferrer" className="site-lux__button site-lux__button--primary">
              View Films
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
            <span>Films, photos, wedding pages, and a polished space to relive every celebration.</span>
          </div>
        </div>
      </section>

      <section className="site-lux__section" id="films">
        <div className="site-lux__section-head" data-reveal>
          <p className="site-lux__eyebrow">What We Showcase</p>
          <h2>featured wedding stories on wedflix</h2>
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
                <img src={film.image} alt={`${film.couple} wedding film`} />
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
            alt="Bride and groom portrait"
          />
        </div>

        <div className="site-lux__about-copy" data-reveal>
          <p className="site-lux__eyebrow">What We Do</p>
          <h2>wedflix turns your wedding into a cinematic digital experience</h2>
          <p>
            We bring together wedding films, photographs, program highlights, and emotional
            moments into one refined destination that feels personal, premium, and easy to share.
          </p>
          <p>
            From the main love story to haldi, mehendi, sangeet, pithi, bhaat, sehra bandi, baraat, sakhar puda, antarpat, mangalashtak, nikaah, anand karaj, church vows, varmala, pheras, bidaai, and reception,
            Wedflix gives every part of the celebration a beautiful place to live online.
          </p>
        </div>
      </section>

      <section className="site-lux__section" id="testimonials">
        <div className="site-lux__section-head" data-reveal>
          <p className="site-lux__eyebrow">Testimonials</p>
          <h2>why couples love the wedflix experience</h2>
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

      <section className="site-lux__section site-lux__contact" id="contact" data-reveal>
        <div className="site-lux__contact-copy">
          <p className="site-lux__eyebrow">Contact</p>
          <h2>message wedflix on instagram</h2>
          <p>
            If you want your wedding story presented beautifully on Wedflix, send us a message on Instagram and tell us about your date, venue, and vision.
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
