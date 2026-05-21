import { useEffect } from "react";

function setMeta(selector, attrs) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    Object.entries(attrs).forEach(([key, value]) => {
      if (key !== "content") el.setAttribute(key, value);
    });
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([key, value]) => {
    el.setAttribute(key, value);
  });
}

function setLink(selector, attrs) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("link");
    Object.entries(attrs).forEach(([key, value]) => {
      if (key !== "href") el.setAttribute(key, value);
    });
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([key, value]) => {
    el.setAttribute(key, value);
  });
}

export default function SeoHead({
  title,
  description,
  canonicalPath,
  image,
  type = "website",
}) {
  useEffect(() => {
    if (title) document.title = title;
    const canonicalUrl = canonicalPath ? `${window.location.origin}${canonicalPath}` : window.location.href;

    setMeta('meta[name="description"]', { name: "description", content: description || "" });
    setMeta('meta[property="og:title"]', { property: "og:title", content: title || document.title });
    setMeta('meta[property="og:description"]', { property: "og:description", content: description || "" });
    setMeta('meta[property="og:type"]', { property: "og:type", content: type });
    setMeta('meta[property="og:url"]', { property: "og:url", content: canonicalUrl });
    setMeta('meta[property="og:image"]', { property: "og:image", content: image || `${window.location.origin}/favicon.svg` });
    setMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
    setMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title || document.title });
    setMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description || "" });
    setMeta('meta[name="twitter:image"]', { name: "twitter:image", content: image || `${window.location.origin}/favicon.svg` });
    setLink('link[rel="canonical"]', { rel: "canonical", href: canonicalUrl });
  }, [title, description, canonicalPath, image, type]);

  return null;
}
