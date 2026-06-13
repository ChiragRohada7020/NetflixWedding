export function publicWeddingStoryPath(wedding) {
  if (!wedding?.public_slug) return "";
  return `/p/${wedding.public_slug}/home`;
}

export function publicWeddingStoryLink(wedding) {
  const path = publicWeddingStoryPath(wedding);
  return path ? `${window.location.origin}${path}` : "";
}

export function publicWeddingInvitationPath(wedding) {
  if (!wedding?.public_slug) return "";
  return `/p/${wedding.public_slug}/invite`;
}

export function publicWeddingInvitationLink(wedding) {
  const path = publicWeddingInvitationPath(wedding);
  return path ? `${window.location.origin}${path}` : "";
}
