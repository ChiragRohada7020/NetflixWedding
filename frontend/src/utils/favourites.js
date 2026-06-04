const STORAGE_KEY = "wedflix_favourite_weddings";
export const FAVOURITES_CHANGED_EVENT = "wedflix-favourites-changed";

function storageKey(userId) {
  const suffix = String(userId || "").trim();
  return suffix ? `${STORAGE_KEY}:${suffix}` : STORAGE_KEY;
}

function cleanFavourite(item) {
  if (!item) return null;
  const id = String(item._id || item.id || "");
  const rawPath = item.path || (item.public_slug ? `/p/${item.public_slug}` : id ? `/share/${id}/home` : "");
  const path = id && rawPath.startsWith("/p/") ? `/share/${id}/home` : rawPath;
  if (!path) return null;
  return {
    id: id || path,
    path,
    title: item.couple_names || item.title || "Wedding",
    subtitle: item.wedding_date || item.subtitle || "",
    image: item.profile_image || item.image || "",
    ownerName: item.owner_name || item.ownerName || item.user?.name || "",
  };
}

export function getFavouriteWeddings(userId) {
  if (!userId) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(userId)) || "[]");
    return Array.isArray(parsed) ? parsed.map(cleanFavourite).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function isFavouriteWedding(idOrPath, userId) {
  const key = String(idOrPath || "");
  return getFavouriteWeddings(userId).some((item) => item.id === key || item.path === key);
}

export function saveFavouriteWedding(item, userId) {
  if (!userId) return [];
  const favourite = cleanFavourite(item);
  if (!favourite) return [];
  const existing = getFavouriteWeddings(userId).filter((saved) => saved.id !== favourite.id && saved.path !== favourite.path);
  const next = [favourite, ...existing].slice(0, 24);
  localStorage.setItem(storageKey(userId), JSON.stringify(next));
  window.dispatchEvent(new Event(FAVOURITES_CHANGED_EVENT));
  return next;
}

export function removeFavouriteWedding(idOrPath, userId) {
  if (!userId) return [];
  const key = String(idOrPath || "");
  const next = getFavouriteWeddings(userId).filter((item) => item.id !== key && item.path !== key);
  localStorage.setItem(storageKey(userId), JSON.stringify(next));
  window.dispatchEvent(new Event(FAVOURITES_CHANGED_EVENT));
  return next;
}
