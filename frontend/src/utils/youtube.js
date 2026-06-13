const YOUTUBE_ID_PATTERN = /(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/;

export function getYouTubeVideoId(url) {
  if (!url) return "";
  const match = String(url).match(YOUTUBE_ID_PATTERN);
  return match ? match[1] : "";
}

export function toYouTubeEmbed(url, { fallback = "" } = {}) {
  const videoId = getYouTubeVideoId(url);
  return videoId ? `https://www.youtube.com/embed/${videoId}` : fallback;
}
