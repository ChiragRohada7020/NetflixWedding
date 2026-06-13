const YOUTUBE_ID_PATTERN = /(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/;
const YOUTUBE_SHORTS_PATTERN = /(?:youtube\.com\/shorts\/|youtu\.be\/shorts\/)([a-zA-Z0-9_-]{11})/i;

export function getYouTubeVideoId(url) {
  if (!url) return "";
  const match = String(url).match(YOUTUBE_ID_PATTERN);
  return match ? match[1] : "";
}

export function isYouTubeShortsUrl(url) {
  if (!url) return false;
  return YOUTUBE_SHORTS_PATTERN.test(String(url));
}

export function toYouTubeEmbed(url, { fallback = "" } = {}) {
  const videoId = getYouTubeVideoId(url);
  return videoId ? `https://www.youtube.com/embed/${videoId}` : fallback;
}
