import React from "react";
import { Link } from "react-router-dom";
import SeoHead from "../components/SeoHead";

const sections = [
  {
    title: "Wedding Films",
    copy: "We turn your wedding into a cinematic story with a premium Netflix-style visual language, emotional pacing, and polished motion.",
  },
  {
    title: "Programs & Events",
    copy: "Each ceremony gets its own beautifully designed page so guests can browse Haldi, Mehendi, Sangeet, Reception, and more.",
  },
  {
    title: "Memories & Galleries",
    copy: "Photo galleries, comments, memories, and event pages are organized in a clean, elegant experience that people want to explore.",
  },
  {
    title: "SEO & Sharing",
    copy: "Every page is built with titles, descriptions, canonical URLs, sitemap support, and social previews for better discoverability.",
  },
];

const features = [
  "Netflix-inspired dark premium theme",
  "Mobile-first responsive UI",
  "Public wedding pages",
  "Private access options",
  "Music and video support",
  "Admin editing tools",
];

const contactPhone = "+91 98765 43210";
const contactEmail = "hello@wedflix.space";
const whatsappUrl = "https://wa.me/919876543210";

export default function SitePage() {
  return (
    <main className="site-page">
      <SeoHead
        title="Wedflix | Wedding Website Design, Films & Memories"
        description="Wedflix builds premium wedding websites with cinematic visuals, films, programs, memories, and contact-ready pages."
        canonicalPath="/site"
      />

      <section className="site-hero">
        <div className="site-hero__glow site-hero__glow--one" />
        <div className="site-hero__glow site-hero__glow--two" />
        <div className="site-hero__content">
          <div className="site-hero__copy">
            <p className="site-kicker">WEDFLIX STUDIO</p>
            <h1 className="site-title">
              A wedding website that feels like a premium streaming platform.
            </h1>
            <p className="site-summary">
              Wedflix gives your wedding a cinematic online home with beautiful storytelling, event pages, memory galleries, and a strong SEO foundation.
            </p>
            <div className="site-actions">
              <Link to="/weddings" className="site-btn site-btn--primary">
                View Weddings
              </Link>
              <a href="#contact" className="site-btn site-btn--secondary">
                Contact Us
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

          <div className="site-panel">
            <div className="site-panel__header">
              <div>
                <p className="site-panel__eyebrow">What Wedflix does</p>
                <h2>A complete wedding web experience</h2>
              </div>
              <span className="site-live-pill">Live</span>
            </div>
            <div className="site-panel__list">
              {sections.map((section) => (
                <article key={section.title} className="site-panel__item">
                  <h3>{section.title}</h3>
                  <p>{section.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="site-section">
        <div className="site-section__header">
          <div>
            <p className="site-kicker">What we do</p>
            <h2>Built for weddings, designed to impress.</h2>
          </div>
          <p>
            Every Wedflix page is crafted to feel emotional, premium, and easy to browse on mobile or desktop.
          </p>
        </div>

        <div className="site-feature-grid">
          {features.map((feature) => (
            <article key={feature} className="site-feature-card">
              <div className="site-feature-icon">N</div>
              <h3>{feature}</h3>
              <p>
                Clean navigation, bold imagery, and a high-end presentation that keeps people engaged longer.
              </p>
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

      <section id="contact" className="site-section site-contact">
        <div className="site-contact__panel">
          <div>
            <p className="site-kicker">Contact</p>
            <h2>Let’s build your wedding website.</h2>
            <p>
              Need a cinematic wedding page, event details, or a full Wedflix-style site? Reach out and we’ll shape it beautifully.
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
          </div>
        </div>
      </section>
    </main>
  );
}
