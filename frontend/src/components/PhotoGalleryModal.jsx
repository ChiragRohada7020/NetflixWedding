import React, { useEffect, useState } from "react";
import { mediaUrl } from "../api";
import ProgressiveImage from "./ProgressiveImage";

export default function PhotoGalleryModal({ open, title = "Gallery", photos = [], canManage = false, onClose, onUpdatePhoto, onDeletePhoto }) {
  const [editingId, setEditingId] = useState("");
  const [captionDraft, setCaptionDraft] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState("");
  const [actionError, setActionError] = useState("");
  const [activePhoto, setActivePhoto] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEvent, setSelectedEvent] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    document.body.classList.add("photo-gallery-open");
    return () => document.body.classList.remove("photo-gallery-open");
  }, [open]);

  useEffect(() => {
    if (!open) {
      setEditingId("");
      setCaptionDraft("");
      setConfirmDeleteId("");
      setActionError("");
      setActivePhoto(null);
      setSearchTerm("");
      setSelectedEvent("all");
      setFiltersOpen(false);
    }
  }, [open]);

  if (!open) return null;

  const eventOptions = Array.from(new Set(photos.map((photo) => photo.episode_title || "Event").filter(Boolean)));
  const filteredPhotos = photos.filter((photo) => {
    const eventTitle = photo.episode_title || "Event";
    const matchesEvent = selectedEvent === "all" || eventTitle === selectedEvent;
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = !term || [eventTitle, photo.caption, photo.uploaded_by]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
    return matchesEvent && matchesSearch;
  });

  const startEdit = (photo) => {
    setActionError("");
    setConfirmDeleteId("");
    setEditingId(photo._id);
    setCaptionDraft(photo.caption || "");
  };

  const saveEdit = async (photo) => {
    try {
      await onUpdatePhoto?.(photo, { caption: captionDraft });
      setEditingId("");
      setCaptionDraft("");
    } catch (err) {
      setActionError(err?.message || "Could not update photo.");
    }
  };

  const deletePhoto = async (photo) => {
    if (confirmDeleteId !== photo._id) {
      setActionError("");
      setEditingId("");
      setConfirmDeleteId(photo._id);
      return;
    }
    try {
      await onDeletePhoto?.(photo);
      setConfirmDeleteId("");
      if (activePhoto?._id === photo._id) setActivePhoto(null);
    } catch (err) {
      setActionError(err?.message || "Could not delete photo.");
    }
  };

  const downloadPhoto = async (photo) => {
    const separator = photo.url?.includes("?") ? "&" : "?";
    const url = mediaUrl(`${photo.url}${separator}download=1`);
    const safeName = (photo.caption || photo.episode_title || "wedflix-photo")
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .slice(0, 80) || "wedflix-photo";
    try {
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Download failed.");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const extension = blob.type?.includes("png") ? "png" : blob.type?.includes("webp") ? "webp" : "jpg";
      link.href = objectUrl;
      link.download = `${safeName}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setActionError(err?.message || "Could not download photo.");
    }
  };

  return (
    <div className="photo-gallery-modal" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="photo-gallery-modal__panel" onClick={(e) => e.stopPropagation()}>
        <header className="photo-gallery-modal__header">
          <div>
            <span className="photo-gallery-modal__kicker">
              {`${filteredPhotos.length} of ${photos.length} Photos`}
            </span>
            <h2>{title}</h2>
          </div>
          <div className="photo-gallery-modal__header-actions">
            <button type="button" className="photo-gallery-modal__close" onClick={onClose} aria-label="Close gallery">
              x
            </button>
          </div>
        </header>
        <div className="photo-gallery-modal__tools">
          <label className="photo-gallery-modal__search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by event or caption..."
              aria-label="Search photos by event or caption"
            />
          </label>
          <div className="photo-gallery-modal__filter-wrap">
            <button
              type="button"
              className={`photo-gallery-modal__filter-btn ${filtersOpen ? "is-active" : ""}`}
              onClick={() => setFiltersOpen((value) => !value)}
              aria-label="Show photo filters"
              aria-expanded={filtersOpen}
            >
              ⚙
            </button>
            {filtersOpen && (
              <div className="photo-gallery-modal__filter-panel">
                <span>Event</span>
                <button type="button" className={selectedEvent === "all" ? "is-active" : ""} onClick={() => setSelectedEvent("all")}>
                  All Episodes
                </button>
                {eventOptions.map((eventTitle) => (
                  <button
                    type="button"
                    key={eventTitle}
                    className={selectedEvent === eventTitle ? "is-active" : ""}
                    onClick={() => setSelectedEvent(eventTitle)}
                  >
                    {eventTitle}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {actionError && <p className="photo-gallery-modal__error">{actionError}</p>}
        {filteredPhotos.length ? (
          <div className="photo-gallery-modal__grid">
            {filteredPhotos.map((photo, index) => (
            <figure
              key={photo._id || `${photo.url}-${index}`}
              className={`photo-gallery-modal__item photo-gallery-modal__item--${index % 6}`}
              onClick={() => editingId !== photo._id && setActivePhoto(photo)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && editingId !== photo._id) setActivePhoto(photo);
              }}
            >
              <ProgressiveImage src={photo.url} alt={photo.caption || photo.episode_title || title} className="photo-gallery-modal__image" />
              {editingId === photo._id ? (
                <div className="photo-gallery-modal__editor" onClick={(e) => e.stopPropagation()}>
                  <input value={captionDraft} onChange={(e) => setCaptionDraft(e.target.value)} placeholder="Caption" autoFocus />
                  <div>
                    <button type="button" onClick={() => saveEdit(photo)}>Save</button>
                    <button type="button" onClick={() => setEditingId("")}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  {(photo.caption || photo.episode_title) && (
                    <figcaption>{photo.caption || photo.episode_title}</figcaption>
                  )}
                  <div className="photo-gallery-modal__actions" onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => downloadPhoto(photo)}>
                      Download
                    </button>
                    {canManage && (
                      <>
                        <button type="button" onClick={() => startEdit(photo)}>Edit</button>
                        <button type="button" className="danger" onClick={() => deletePhoto(photo)}>
                          {confirmDeleteId === photo._id ? "Confirm" : "Delete"}
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </figure>
            ))}
          </div>
        ) : (
          <p className="photo-gallery-modal__empty">No photos matched this filter.</p>
        )}
      </div>
      {activePhoto && (
        <div className="photo-gallery-zoom" role="dialog" aria-modal="true" aria-label="Photo preview" onClick={() => setActivePhoto(null)}>
          <div className="photo-gallery-zoom__frame" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="photo-gallery-zoom__close" onClick={() => setActivePhoto(null)} aria-label="Close photo preview">
              x
            </button>
            <img src={mediaUrl(activePhoto.url)} alt={activePhoto.caption || activePhoto.episode_title || title} />
            <div className="photo-gallery-zoom__bar">
              <span>{activePhoto.caption || activePhoto.episode_title || title}</span>
              <button type="button" onClick={() => downloadPhoto(activePhoto)}>Download</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
