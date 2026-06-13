export function publicWeddingPath(wedding) {
  if (!wedding?.public_slug) return "";
  return wedding.premium_experience_enabled ? `/p/${wedding.public_slug}/invite` : `/p/${wedding.public_slug}/home`;
}

export function publicWeddingLink(wedding) {
  const path = publicWeddingPath(wedding);
  return path ? `${window.location.origin}${path}` : "";
}
