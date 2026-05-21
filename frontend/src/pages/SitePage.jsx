import React from "react";
import SeoHead from "../components/SeoHead";

const heroFrames = [
  {
    title: "Haldi",
    copy: "Warm color, laughter, and intimate close-ups.",
    image:
      "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Mehendi",
    copy: "Elegant hands, detailed decor, and cinematic framing.",
    image:
      "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Reception",
    copy: "Wide celebrations, dramatic light, and a premium finish.",
    image:
      "https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=1200&q=80",
  },
];

const storyCards = [
  {
    title: "Wedding Films",
    copy: "Cinematic edits, emotional trailers, and bold cover visuals that feel like a premiere.",
    image:
      "https://images.unsplash.com/photo-1523438097201-512ae7d59e2b?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Programs & Events",
    copy: "Haldi, Mehendi, Sangeet, Reception, and every chapter gets its own polished page.",
    image:
      "https://images.unsplash.com/photo-1504196606672-aef5c9cefc92?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Guest Memories",
    copy: "A beautiful place for photographs, clips, comments, and moments families will revisit.",
    image:
      "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Private or Public",
    copy: "Keep your story private or open selected pages for guests with a refined access model.",
    image:
      "https://images.unsplash.com/photo-1469371670807-013ccf25f16a?auto=format&fit=crop&w=1200&q=80",
  },
];

const reviews = [
  {
    name: "Jennifer Davis",
    handle: "@jennbunnylynn",
    quote:
      "The best part was that it never felt like a production. The team blended in and captured moments that still feel alive every time we watch them.",
    image:
      "https://images.unsplash.com/photo-1525338078858-d762b5e32f2c?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Laurie Roundtree",
    handle: "@laurieroundtree",
    quote:
      "Wedflix gave our wedding an unforgettable digital home. It felt premium, emotional, and incredibly easy to share with family.",
    image:
      "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Kelsey Agar",
    handle: "@kelseyagar",
    quote:
      "Their eye for details and pacing made the whole experience feel cinematic. It looked and felt like a film premiere.",
    image:
      "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=900&q=80",
  },
];

const contactPhone = "+91 98765 43210";
const contactEmail = "hello@wedflix.space";
const whatsappUrl = "https://wa.me/919876543210";

export default function SitePage() {
  const homeUrl = window.location.origin;
  return (
    <main className="site-page">
      <SeoHead
        title="Wedflix | Cinematic Wedding Websites"
        description="Wedflix creates premium, cinematic wedding websites with films, event pages, photo memories, and elegant contact-ready design."
        canonicalPath="/site"
      />

      <section className="site-hero site-hero--cinematic">
        <div className="site-hero__glow site-hero__glow--one" />
        <div className="site-hero__glow site-hero__glow--two" />

        <div className="site-hero__content">
          <div className="site-hero__copy">
            <p className="site-kicker">WEDFLIX STUDIO</p>
            <h1 className="site-title">Your wedding, presented like a premium streaming premiere.</h1>
            <p className="site-summary">
              Wedflix turns your story into a premium wedding experience with cinematic visuals, event pages, memory galleries, and a polished, SEO-friendly structure.
            </p>

            <div className="site-actions">
              <a href={homeUrl} className="site-btn site-btn--primary">
                Visit Home
              </a>
              <a href="#contact" className="site-btn site-btn--secondary">
                Contact Us
              </a>
              <a href="#what-we-do" className="site-btn site-btn--secondary">
                What We Do
              </a>
            </div>

            <div className="site-stats">
              <div className="site-stat">
                <strong>01</strong>
                <span>Cinematic storytelling</span>
              </div>
              <div className="site-stat">
                <strong>02</strong>
                <span>SEO-friendly structure</span>
              </div>
              <div className="site-stat">
                <strong>03</strong>
                <span>Private or public access</span>
              </div>
            </div>
          </div>

          <div className="site-hero__visuals">
            <div className="site-hero__card site-hero__card--wide">
              <img
                src={heroFrames[0].image}
                alt={heroFrames[0].title}
                className="site-hero__image"
              />
              <div className="site-hero__overlay">
                <span>{heroFrames[0].title}</span>
                <p>{heroFrames[0].copy}</p>
              </div>
            </div>

            <div className="site-hero__card site-hero__card--stack site-hero__card--one">
              <img
                src={heroFrames[1].image}
                alt={heroFrames[1].title}
                className="site-hero__image"
              />
              <div className="site-hero__overlay">
                <span>{heroFrames[1].title}</span>
                <p>{heroFrames[1].copy}</p>
              </div>
            </div>

            <div className="site-hero__card site-hero__card--stack site-hero__card--two">
              <img
                src={heroFrames[2].image}
                alt={heroFrames[2].title}
                className="site-hero__image"
              />
              <div className="site-hero__overlay">
                <span>{heroFrames[2].title}</span>
                <p>{heroFrames[2].copy}</p>
              </div>
            </div>

            <div className="site-hero__badge">
              <strong>Wedflix</strong>
              <span>Elegant wedding websites with cinematic depth</span>
            </div>
          </div>
        </div>

        <div className="site-reel">
          {["Films", "Programs", "Moments", "Memories", "Contact"].map((label) => (
            <span key={label} className="site-chip">
              {label}
            </span>
          ))}
        </div>
      </section>

      <section className="site-section site-philosophy">
        <div className="site-philosophy__copy">
          <p className="site-kicker">Our Philosophy</p>
          <h2>Beautifully capturing time through films and websites that become heirlooms.</h2>
          <p>
            We craft emotional wedding stories that preserve the small moments too. The flowers, the laughter, the first look, the dance floor, the details people forget, and the feelings they never do.
          </p>
          <p>
            Our mission is to create a digital experience that helps you relive your celebration for years, while giving guests an elegant place to watch, explore, and remember.
          </p>
          <div className="site-actions">
            <a href="#contact" className="site-btn site-btn--primary">Inquire</a>
            <a href="#reviews" className="site-btn site-btn--secondary">See Reviews</a>
          </div>
        </div>
        <div className="site-philosophy__visual">
          <img
            src="https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1400&q=80"
            alt="Wedding couple celebration"
          />
        </div>
      </section>

      <section id="what-we-do" className="site-section">
        <div className="site-section__header">
          <div>
            <p className="site-kicker">What we do</p>
            <h2>Built for weddings, designed to impress.</h2>
          </div>
          <p>
            Every Wedflix page is built to feel emotional, premium, and easy to browse on mobile or desktop.
          </p>
        </div>

        <div className="site-story-grid">
          {storyCards.map((card, index) => (
            <article key={card.title} className={`site-story-card site-story-card--${index + 1}`}>
              <img src={card.image} alt={card.title} className="site-story-card__image" />
              <div className="site-story-card__shade" />
              <div className="site-story-card__content">
                <span className="site-story-card__index">0{index + 1}</span>
                <h3>{card.title}</h3>
                <p>{card.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="site-band">
        <div className="site-band__content">
          <div>
            <p className="site-kicker">Why Wedflix</p>
            <h2>Professional UI, emotional storytelling, real results.</h2>
          </div>
          <div className="site-metrics">
            <div className="site-metric"><strong>100%</strong><span>mobile-ready</span></div>
            <div className="site-metric"><strong>SEO</strong><span>built in</span></div>
            <div className="site-metric"><strong>24/7</strong><span>memory access</span></div>
            <div className="site-metric"><strong>∞</strong><span>event pages</span></div>
          </div>
        </div>
      </section>

      <section id="reviews" className="site-section site-reviews">
        <div className="site-section__header">
          <div>
            <p className="site-kicker">Reviews</p>
            <h2>People remember how the film made them feel.</h2>
          </div>
          <p>
            Wedflix is built to feel intimate, premium, and deeply personal from the very first frame.
          </p>
        </div>

        <div className="site-review-grid">
          {reviews.map((review) => (
            <article key={review.handle} className="site-review-card">
              <div className="site-review-card__image-wrap">
                <img src={review.image} alt={review.name} className="site-review-card__image" />
              </div>
              <p className="site-review-card__quote">“{review.quote}”</p>
              <div className="site-review-card__meta">
                <strong>{review.name}</strong>
                <span>{review.handle}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="contact" className="site-section site-contact">
        <div className="site-contact__panel">
          <div>
            <p className="site-kicker">How to Contact</p>
            <h2>Let’s build your wedding website.</h2>
            <p>
              Need a cinematic wedding page, event details, or a full Wedflix-style site? Reach out and we’ll help you shape it beautifully.
            </p>
          </div>
          <div className="site-contact__cards">
            <a href={`tel:${contactPhone.replace(/\s+/g, "")}`} className="site-contact-card">
              <span>Call</span>
              <strong>{contactPhone}</strong>
            </a>
            <a href={`mailto:${contactEmail}`} className="site-contact-card">
              <span>Email</span>
              <strong>{contactEmail}</strong>
            </a>
            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="site-contact-card site-contact-card--primary">
              <span>WhatsApp</span>
              <strong>Chat Now</strong>
            </a>
            <a href={homeUrl} className="site-contact-card site-contact-card--home">
              <span>Home</span>
              <strong>Visit Wedflix</strong>
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
