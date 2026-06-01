import React, { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import SeoHead from "../components/SeoHead";

const posts = [
  {
    slug: "how-to-create-a-wedding-website-in-india",
    title: "How to Create a Wedding Website in India",
    category: "Wedding Website",
    description: "A simple guide for Indian couples who want a beautiful wedding website for events, photos, videos, and guest sharing.",
    keywords: "How to Create a Wedding Website in India, Indian wedding website, digital wedding invitation",
    sections: [
      ["Start With The Wedding Story", "A good wedding website should feel personal before it feels technical. Add the couple name, wedding date, city, a short story, and one strong hero photo or film that sets the mood."],
      ["Add Events Clearly", "Indian weddings usually have multiple functions like haldi, mehendi, sangeet, engagement, pheras, reception, or nikah. Create one clean section for each function with date, time, venue, dress code, and map details."],
      ["Make Photos Easy To Share", "Instead of sending many files across WhatsApp groups, use one online gallery where family members can open albums, watch videos, and revisit memories anytime."],
      ["Keep It Mobile First", "Most guests will open the wedding website on mobile. Use large images, short text, simple buttons, and fast-loading albums so relatives can browse easily even on slower internet."],
    ],
  },
  {
    slug: "best-digital-wedding-album-platform-in-india",
    title: "Best Digital Wedding Album Platform in India",
    category: "Digital Albums",
    description: "What couples and photographers should look for when choosing a digital wedding album platform in India.",
    keywords: "Best Digital Wedding Album Platform in India, online wedding album, wedding gallery India",
    sections: [
      ["Look Beyond Storage", "A digital wedding album should do more than store photos. It should present the wedding like a story, with events, films, highlights, and easy sharing."],
      ["Choose Fast Mobile Galleries", "Many guests browse from phones and family networks. A good platform compresses images, loads important visuals first, and keeps the album pleasant on low connectivity."],
      ["Protect The Emotional Flow", "Wedding memories feel better when they are arranged by function: haldi, mehendi, sangeet, wedding ceremony, reception, and candid moments."],
      ["Why Wedflix Helps", "Wedflix brings videos, photos, event pages, and a premium viewing experience into one link that families can share and revisit."],
    ],
  },
  {
    slug: "wedding-website-vs-traditional-album",
    title: "Wedding Website vs Traditional Album",
    category: "Wedding Website",
    description: "A practical comparison between printed wedding albums and online wedding websites for modern families.",
    keywords: "Wedding Website vs Traditional Album, online wedding album benefits",
    sections: [
      ["Traditional Albums Are Beautiful", "Printed albums still have emotional value. They are physical, premium, and perfect for home memories."],
      ["Wedding Websites Are Easier To Share", "A wedding website can reach family in different cities instantly. Guests can open photos, watch films, and view function details without waiting for printed copies."],
      ["Use Both Together", "The strongest approach is not always one or the other. Keep a printed album for home and use a digital album for sharing, discovery, and long-term access."],
      ["Better For Videos", "Traditional albums cannot hold films. A website can show the trailer, full ceremony, reels, and event highlights in one place."],
    ],
  },
  {
    slug: "benefits-of-online-wedding-albums",
    title: "Benefits of Online Wedding Albums",
    category: "Digital Albums",
    description: "Why online wedding albums are becoming the easiest way to preserve and share wedding photos with family.",
    keywords: "Benefits of Online Wedding Albums, online wedding photos, share wedding album",
    sections: [
      ["Instant Family Sharing", "One link can be shared with relatives, friends, and guests. Everyone can open the album without downloading huge folders."],
      ["Organized By Function", "Online albums can separate mehendi, haldi, sangeet, pheras, reception, candid photos, and family portraits."],
      ["Always Available", "A digital album is useful when family wants to revisit memories months or years later from another city."],
      ["Works With Video", "Online albums can include highlight films, trailers, speeches, and full event videos along with photos."],
    ],
  },
  {
    slug: "best-wedding-photographers-in-pachora",
    title: "Best Wedding Photographers in Pachora",
    category: "Local Wedding SEO",
    description: "How to choose the best wedding photographers in Pachora for cinematic films, candid photos, and family coverage.",
    keywords: "Best Wedding Photographers in Pachora, Pachora wedding photography",
    sections: [
      ["Check Full Wedding Stories", "Before booking, ask to see a complete wedding gallery or film, not only Instagram highlights. Full work shows consistency."],
      ["Look For Ritual Understanding", "A good photographer in Pachora should understand Maharashtrian wedding rituals, family moments, and local venue lighting."],
      ["Ask About Delivery Format", "Couples should ask whether photos are delivered through Drive, printed album, online gallery, or a Wedflix-style digital wedding page."],
      ["Choose Shareable Memories", "Families often want to send photos to relatives quickly. A digital album makes Pachora wedding memories easier to share."],
    ],
  },
  {
    slug: "best-wedding-photographers-in-jalgaon",
    title: "Best Wedding Photographers in Jalgaon",
    category: "Local Wedding SEO",
    description: "A couple-friendly guide to finding wedding photographers in Jalgaon for photos, films, and online albums.",
    keywords: "Best Wedding Photographers in Jalgaon, Jalgaon wedding photographer",
    sections: [
      ["Compare Style First", "Some photographers focus on cinematic films, some on candid photos, and some on traditional family coverage. Choose the style that matches your family."],
      ["Confirm Event Coverage", "Jalgaon weddings can include engagement, haldi, mehendi, sangeet, wedding ceremony, and reception. Make sure every event is covered clearly."],
      ["Ask For Online Delivery", "A digital wedding album helps relatives open the photos and videos from any city without needing large downloads."],
      ["Think About Long-Term Access", "The best wedding coverage is easy to revisit. A structured online album keeps memories organized beyond the wedding week."],
    ],
  },
  {
    slug: "wedding-venues-in-nashik",
    title: "Wedding Venues in Nashik",
    category: "Local Wedding SEO",
    description: "What to consider while shortlisting wedding venues in Nashik for photography, guest experience, and digital memories.",
    keywords: "Wedding Venues in Nashik, Nashik wedding venue guide",
    sections: [
      ["Check Light And Space", "A beautiful venue should also photograph well. Look for natural light, clean backgrounds, and enough space for family rituals."],
      ["Plan Guest Movement", "For multi-function weddings, confirm where haldi, mehendi, pheras, dinner, and reception entries will happen."],
      ["Ask About Decoration Rules", "Venue policies can affect mandap design, lighting, sound, and camera movement. Clarify these before booking."],
      ["Capture The Venue Story", "Add the venue details, map, and event photos to a wedding website so guests and family remember the complete celebration."],
    ],
  },
  {
    slug: "wedding-planning-checklist-in-maharashtra",
    title: "Wedding Planning Checklist in Maharashtra",
    category: "Planning",
    description: "A practical checklist for planning a Maharashtrian wedding with venues, rituals, photos, and guest sharing.",
    keywords: "Wedding Planning Checklist in Maharashtra, Maharashtrian wedding checklist",
    sections: [
      ["6 To 9 Months Before", "Finalize the date, venue, photographer, videographer, makeup artist, outfits, guest list, and broad function plan."],
      ["2 To 3 Months Before", "Prepare invitations, book decor, plan music, confirm rituals, arrange accommodation, and create a wedding website for guests."],
      ["Wedding Week", "Share event timings, maps, contact numbers, and dress codes. Keep a digital page ready for photos and videos after every function."],
      ["After The Wedding", "Organize albums by function and share one online link with family instead of sending hundreds of files separately."],
    ],
  },
  {
    slug: "100-best-wedding-captions-for-instagram",
    title: "100 Best Wedding Captions for Instagram",
    category: "Captions",
    description: "Wedding caption ideas for couples, families, photographers, and wedding reels.",
    keywords: "100 Best Wedding Captions for Instagram, wedding captions India",
    sections: [
      ["Romantic Captions", "Forever starts here. Two hearts, one story. Married to my favorite person. A lifetime of us. The best chapter begins."],
      ["Family Captions", "Two families, one celebration. Love, laughter, and blessings. The people who made this day complete."],
      ["Photography Captions", "A frame full of forever. Candid hearts, timeless memories. Every ritual, every smile, every tear."],
      ["Wedflix Tip", "Use short captions for Instagram and keep the full wedding story, gallery, and videos on your Wedflix page."],
    ],
  },
  {
    slug: "best-songs-for-wedding-pheras",
    title: "Best Songs for Wedding Pheras",
    category: "Wedding Music",
    description: "Song ideas for emotional, cinematic, and traditional wedding pheras.",
    keywords: "Best Songs for Wedding Pheras, phere songs, Indian wedding music",
    sections: [
      ["Choose Emotion Over Trend", "Phera music should support the moment. Pick songs that feel soft, sacred, and meaningful for the couple and family."],
      ["Popular Mood Ideas", "Instrumental shehnai, soft classical vocals, romantic acoustic tracks, and slow cinematic background scores work beautifully."],
      ["Coordinate With Video Team", "Tell your videographer which songs matter to you so the final wedding film matches the emotion of the ceremony."],
      ["Keep A Memory Copy", "Add the phera film to your digital wedding album so family can revisit the ceremony anytime."],
    ],
  },
  {
    slug: "best-marathi-wedding-songs",
    title: "Best Marathi Wedding Songs",
    category: "Wedding Music",
    description: "Marathi wedding song ideas for sakhar puda, haldi, antarpat, mangalashtak, and reception memories.",
    keywords: "Best Marathi Wedding Songs, Marathi wedding music, Maharashtrian wedding songs",
    sections: [
      ["For Traditional Rituals", "Use soulful, devotional, or classical Marathi tracks for antarpat, mangalashtak, and family blessing moments."],
      ["For Haldi And Fun Events", "Choose upbeat Marathi and Bollywood tracks that bring out family energy, dance, and candid laughter."],
      ["For Couple Entries", "A soft romantic Marathi song or instrumental theme can make the entry feel personal and cinematic."],
      ["Preserve The Feeling", "When your wedding video is uploaded online, the music helps the family relive the exact emotion of every ritual."],
    ],
  },
  {
    slug: "wedding-hashtag-ideas",
    title: "Wedding Hashtag Ideas",
    category: "Captions",
    description: "Simple wedding hashtag ideas for Indian couples, families, and photographers.",
    keywords: "Wedding Hashtag Ideas, Indian wedding hashtags",
    sections: [
      ["Use Couple Names", "Combine first names, nicknames, initials, or surnames. Short and easy hashtags are easier for guests to remember."],
      ["Add Wedding Words", "Try words like wedding, forever, shaadi, vivah, hitched, together, or celebration with the couple name."],
      ["Keep It Readable", "Avoid long hashtags that guests will misspell. Capitalize each word when displaying it on invites."],
      ["Use It With Your Album", "Place the hashtag on your wedding website and invite cards so guests know where to tag photos and reels."],
    ],
  },
  {
    slug: "how-wedflix-preserves-your-wedding-memories",
    title: "How Wedflix Preserves Your Wedding Memories",
    category: "Wedflix",
    description: "How Wedflix helps couples keep wedding films, photos, events, and family memories in one shareable place.",
    keywords: "How WedFlix Preserves Your Wedding Memories, Wedflix wedding album",
    sections: [
      ["One Place For Everything", "Wedflix brings wedding videos, event pages, photo galleries, and important details together in one polished experience."],
      ["Designed For Families", "Relatives can open the wedding link from mobile, browse functions, watch films, and revisit photos without searching through chats."],
      ["Event-Based Memories", "Haldi, mehendi, sangeet, pheras, reception, and candid moments can each have their own space."],
      ["A Modern Wedding Archive", "Instead of memories being scattered across phones, Wedflix gives the wedding a lasting digital home."],
    ],
  },
  {
    slug: "why-couples-are-choosing-digital-wedding-albums",
    title: "Why Couples Are Choosing Digital Wedding Albums",
    category: "Wedflix",
    description: "Why modern couples prefer digital wedding albums for sharing, video, mobile access, and long-term memories.",
    keywords: "Why Couples Are Choosing Digital Wedding Albums, digital wedding memories",
    sections: [
      ["Fast Sharing", "A digital album is easier to send to relatives in different cities, especially after destination or multi-day weddings."],
      ["Video-Friendly", "Couples want trailers, reels, full films, and speeches along with photos. Digital albums handle all formats in one flow."],
      ["Better Organization", "Albums can be grouped by events, people, rituals, and highlights so family members can find what they love."],
      ["More Useful After The Wedding", "A digital album remains available when guests ask for photos long after the celebration is over."],
    ],
  },
  {
    slug: "how-to-share-wedding-photos-with-family-online",
    title: "How to Share Wedding Photos with Family Online",
    category: "Wedflix",
    description: "The easiest ways to share wedding photos and videos with family online without sending huge folders.",
    keywords: "How to Share Wedding Photos with Family Online, share wedding photos online",
    sections: [
      ["Avoid Large Chat Dumps", "Sending hundreds of photos on messaging apps reduces quality and makes memories hard to find later."],
      ["Use One Organized Link", "Create a digital album or wedding website where every function has its own section and family can browse at their pace."],
      ["Make It Mobile Friendly", "Use compressed images, clear thumbnails, and simple navigation so relatives can open the album even on slower internet."],
      ["Add Videos Too", "Wedding photos feel complete when paired with films, speeches, rituals, and highlight clips in the same place."],
    ],
  },
];

function BlogHeader() {
  return (
    <header className="blog-site__header">
      <Link to="/site" className="blog-site__logo">WEDFLIX</Link>
      <nav aria-label="Blog navigation">
        <Link to="/site">Site</Link>
        <Link to="/site/blog">Blog</Link>
      </nav>
    </header>
  );
}

function BlogIndex() {
  return (
    <div className="blog-site">
      <SeoHead
        title="Wedflix Blog | Wedding Website, Digital Albums, Captions and Planning"
        description="Helpful wedding website, digital album, local wedding planning, captions, songs, and Wedflix memory guides for Indian couples."
        canonicalPath="/site/blog"
      />
      <BlogHeader />
      <main className="blog-site__shell">
        <section className="blog-site__hero">
          <p className="site-lux__eyebrow">Wedding Memory Guides</p>
          <h1>simple wedding blogs for couples, families, and photographers</h1>
          <p>
            Guides on wedding websites, digital albums, local planning, captions, songs, hashtags,
            and preserving memories online with Wedflix.
          </p>
        </section>
        <section className="blog-site__grid" aria-label="Wedflix blog articles">
          {posts.map((post) => (
            <Link to={`/site/blog/${post.slug}`} className="blog-site__card" key={post.slug}>
              <span>{post.category}</span>
              <h2>{post.title}</h2>
              <p>{post.description}</p>
              <strong>Read Article</strong>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}

function getRelatedPosts(post) {
  return posts
    .filter((item) => item.slug !== post.slug)
    .filter((item) => item.category === post.category || item.keywords.includes(post.category.split(" ")[0]))
    .slice(0, 3);
}

function getDeepDiveSections(post) {
  const topic = post.title.toLowerCase();
  return [
    [
      `Why ${post.title} Matters`,
      `${post.title} is not only a search topic; it is a real decision couples, families, and photographers make while planning a wedding. In India, wedding memories are spread across ceremonies, relatives, venues, rituals, videos, mobile photos, and professional albums. A strong digital plan helps all of these memories stay organized instead of getting lost in chat groups, phone galleries, and hard drives.`,
    ],
    [
      "What Couples Should Prepare First",
      `Before choosing a platform or finalizing a plan for ${topic}, collect the important basics: couple names, wedding date, city, venue names, function list, photographer details, video links, photo folders, and family sharing needs. This makes it easier to create a useful wedding website, online wedding album, or digital memory page that guests can understand quickly.`,
    ],
    [
      "How To Make It Useful For Guests",
      "The best wedding content is simple for guests to open on mobile. Keep event names clear, place the most important photos and videos first, use short descriptions, and avoid making relatives download large files. When albums are sorted by functions like haldi, mehendi, sangeet, pheras, reception, and candid moments, families find memories faster.",
    ],
    [
      "SEO And Sharing Advantage",
      `Content around ${post.keywords} works well when it answers practical questions. Search engines prefer pages that explain the topic clearly, include related phrases naturally, and help visitors take the next step. For photographers and couples, a digital wedding page can also become a portfolio, guest guide, and family archive at the same time.`,
    ],
    [
      "Wedflix Recommendation",
      "Use Wedflix as the polished home for the wedding story, then use Instagram, WhatsApp, and invitations to send people to that one link. This keeps the main experience premium while still making photos, films, captions, venue details, and family memories easy to discover.",
    ],
  ];
}

function getChecklist(post) {
  const base = [
    "Use one clear title that includes the main wedding keyword naturally.",
    "Add helpful details for Indian wedding functions, family sharing, and mobile browsing.",
    "Keep photos compressed enough to load on slower internet connections.",
    "Group memories by event so guests can find the right function quickly.",
    "Add internal links to related wedding guides and the main Wedflix site page.",
  ];

  if (post.category === "Local Wedding SEO") {
    return [
      "Mention the city, nearby areas, venue type, and wedding season where relevant.",
      "Show complete wedding stories, not only short highlight reels.",
      "Ask photographers about delivery timelines, album formats, and online gallery options.",
      ...base.slice(2),
    ];
  }

  if (post.category === "Wedding Music" || post.category === "Captions") {
    return [
      "Match captions or songs to the actual function mood.",
      "Use simple words guests and family members can remember.",
      "Save final captions, songs, reels, and videos together on the wedding page.",
      ...base.slice(2),
    ];
  }

  return base;
}

function getFaqs(post) {
  return [
    {
      question: `Is ${post.title} useful for Indian weddings?`,
      answer: `Yes. ${post.title} is useful because Indian weddings usually include multiple functions, large families, and many photos and videos. A structured online approach keeps everything easier to share and revisit.`,
    },
    {
      question: "Can this help with sharing wedding photos online?",
      answer: "Yes. Instead of sending large folders through chat apps, couples can use a digital wedding album or Wedflix page where guests open one link and browse photos, videos, and event memories.",
    },
    {
      question: "Does Wedflix replace a traditional printed album?",
      answer: "Wedflix does not need to replace a printed album. Many couples keep a physical album for home and use Wedflix as the shareable online version for family, guests, and videos.",
    },
    {
      question: "Why is mobile speed important for wedding albums?",
      answer: "Most guests open wedding links on mobile networks. Compressed images, clear thumbnails, and organized event pages help the album load faster and feel easier to use.",
    },
  ];
}

function ArticleSchema({ post, faqs }) {
  useEffect(() => {
    const id = "wedflix-blog-schema";
    document.getElementById(id)?.remove();
    const script = document.createElement("script");
    script.id = id;
    script.type = "application/ld+json";
    script.textContent = JSON.stringify([
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: post.title,
        description: post.description,
        keywords: post.keywords,
        author: { "@type": "Organization", name: "Wedflix" },
        publisher: { "@type": "Organization", name: "Wedflix" },
        mainEntityOfPage: `${window.location.origin}/site/blog/${post.slug}`,
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
        })),
      },
    ]);
    document.head.appendChild(script);
    return () => document.getElementById(id)?.remove();
  }, [post, faqs]);

  return null;
}

function BlogArticle({ post }) {
  const deepSections = getDeepDiveSections(post);
  const checklist = getChecklist(post);
  const faqs = getFaqs(post);
  const related = getRelatedPosts(post);

  return (
    <div className="blog-site">
      <SeoHead
        title={`${post.title} | Wedflix Blog`}
        description={post.description}
        canonicalPath={`/site/blog/${post.slug}`}
        type="article"
      />
      <ArticleSchema post={post} faqs={faqs} />
      <BlogHeader />
      <main className="blog-site__article">
        <Link to="/site/blog" className="blog-site__back">Back to Blog</Link>
        <p className="site-lux__eyebrow">{post.category}</p>
        <h1>{post.title}</h1>
        <p className="blog-site__description">{post.description}</p>
        <p className="blog-site__keywords">{post.keywords}</p>
        {post.sections.map(([heading, body]) => (
          <section key={heading}>
            <h2>{heading}</h2>
            <p>{body}</p>
          </section>
        ))}
        {deepSections.map(([heading, body]) => (
          <section key={heading}>
            <h2>{heading}</h2>
            <p>{body}</p>
          </section>
        ))}
        <section>
          <h2>Practical Checklist</h2>
          <ul className="blog-site__list">
            {checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section>
          <h2>Frequently Asked Questions</h2>
          <div className="blog-site__faq">
            {faqs.map((faq) => (
              <article key={faq.question}>
                <h3>{faq.question}</h3>
                <p>{faq.answer}</p>
              </article>
            ))}
          </div>
        </section>
        {!!related.length && (
          <section>
            <h2>Related Wedding Guides</h2>
            <div className="blog-site__related">
              {related.map((item) => (
                <Link to={`/site/blog/${item.slug}`} key={item.slug}>
                  <span>{item.category}</span>
                  <strong>{item.title}</strong>
                </Link>
              ))}
            </div>
          </section>
        )}
        <aside className="blog-site__cta">
          <h2>Create a digital home for your wedding memories</h2>
          <p>
            Wedflix helps couples and photographers share wedding photos, films, functions,
            and family memories in one polished online experience.
          </p>
          <Link to="/site">Explore Wedflix</Link>
        </aside>
      </main>
    </div>
  );
}

export default function BlogPage() {
  const { slug } = useParams();
  if (!slug) return <BlogIndex />;

  const post = posts.find((item) => item.slug === slug);
  if (!post) {
    return (
      <div className="blog-site">
        <SeoHead title="Blog Not Found | Wedflix" description="This Wedflix blog article could not be found." canonicalPath="/site/blog" />
        <BlogHeader />
        <main className="blog-site__article">
          <h1>Article not found</h1>
          <p>The blog article you are looking for is not available.</p>
          <Link to="/site/blog" className="blog-site__back">Back to Blog</Link>
        </main>
      </div>
    );
  }

  return <BlogArticle post={post} />;
}
