import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiPost, apiPostFormJson, mediaUrl } from "../api";
import ProgressiveImage from "./ProgressiveImage";

function createCapturedFaceFile(source) {
  const width = source.videoWidth || source.naturalWidth || source.width;
  const height = source.videoHeight || source.naturalHeight || source.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(source, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not capture face photo."));
        return;
      }
      resolve(new File([blob], "wedflix-face-reference.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
  });
}

export default function PhotoGalleryModal({ open, title = "Gallery", photos = [], canManage = false, onClose, onUpdatePhoto, onDeletePhoto }) {
  const [editingId, setEditingId] = useState("");
  const [captionDraft, setCaptionDraft] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState("");
  const [actionError, setActionError] = useState("");
  const [activePhoto, setActivePhoto] = useState(null);
  const [faceSearchOpen, setFaceSearchOpen] = useState(false);
  const [faceSearchStatus, setFaceSearchStatus] = useState("");
  const [faceSearchError, setFaceSearchError] = useState("");
  const [faceSearchActive, setFaceSearchActive] = useState(false);
  const [matchedPhotoIds, setMatchedPhotoIds] = useState(new Set());
  const [scanProgress, setScanProgress] = useState({ done: 0, total: 0 });
  const [isScanningFaces, setIsScanningFaces] = useState(false);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);

  const visiblePhotos = useMemo(() => {
    if (!faceSearchActive) return photos;
    return photos.filter((photo) => matchedPhotoIds.has(photo._id || photo.url));
  }, [faceSearchActive, matchedPhotoIds, photos]);

  useEffect(() => {
    if (!open) return undefined;
    document.body.classList.add("photo-gallery-open");
    return () => document.body.classList.remove("photo-gallery-open");
  }, [open]);

  useEffect(() => {
    if (!open || !photos.length) return;
    apiPost("/api/photos/face-index", {
      photo_ids: photos.map((photo) => photo._id).filter(Boolean),
    }).catch(() => {});
  }, [open, photos]);

  useEffect(() => {
    if (!open) {
      stopCamera();
      resetFaceSearch();
    }
    return () => stopCamera();
  }, [open]);

  if (!open) return null;

  function stopCamera() {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function resetFaceSearch() {
    setFaceSearchOpen(false);
    setFaceSearchStatus("");
    setFaceSearchError("");
    setFaceSearchActive(false);
    setMatchedPhotoIds(new Set());
    setScanProgress({ done: 0, total: 0 });
    setIsScanningFaces(false);
  }

  const openFaceSearch = async () => {
    setFaceSearchOpen(true);
    setFaceSearchError("");
    setFaceSearchStatus("Opening camera...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setFaceSearchStatus("Center your face and capture.");
    } catch (err) {
      setFaceSearchError(err?.message || "Camera is unavailable.");
      setFaceSearchStatus("");
      stopCamera();
    }
  };

  const matchGalleryWithReferenceFile = async (referenceFile) => {
    setFaceSearchStatus("Comparing saved face vectors...");
    setScanProgress({ done: 0, total: photos.length });

    const formData = new FormData();
    formData.append("reference", referenceFile);
    formData.append("photo_ids", JSON.stringify(photos.map((photo) => photo._id).filter(Boolean)));

    const result = await apiPostFormJson("/api/photos/face-match", formData);
    const nextMatches = new Set(result.matched_photo_ids || []);

    setMatchedPhotoIds(nextMatches);
    setFaceSearchActive(true);
    setFaceSearchOpen(false);
    setFaceSearchStatus("");
    setFaceSearchError(
      nextMatches.size
        ? ""
        : result.indexing_queued || result.missing_index?.length
          ? "Photos are being indexed. Try search again in a moment."
          : "No matching photos found."
    );
  };

  const captureAndMatchFaces = async () => {
    if (!videoRef.current || isScanningFaces) return;
    setFaceSearchError("");
    setFaceSearchStatus("Reading your face...");
    setIsScanningFaces(true);

    try {
      const referenceFile = await createCapturedFaceFile(videoRef.current);
      stopCamera();
      await matchGalleryWithReferenceFile(referenceFile);
    } catch (err) {
      setFaceSearchError(err?.message || "Could not match faces.");
    } finally {
      setIsScanningFaces(false);
    }
  };

  const matchFromReferencePhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || isScanningFaces) return;

    setFaceSearchOpen(true);
    setFaceSearchError("");
    setFaceSearchStatus("Reading selected photo...");
    setIsScanningFaces(true);

    try {
      stopCamera();
      await matchGalleryWithReferenceFile(file);
    } catch (err) {
      setFaceSearchError(err?.message || "Could not match faces from that photo.");
    } finally {
      setIsScanningFaces(false);
    }
  };

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
              {faceSearchActive ? `${visiblePhotos.length} of ${photos.length} Matched` : `${photos.length} Photos`}
            </span>
            <h2>{title}</h2>
          </div>
          <div className="photo-gallery-modal__header-actions">
            {faceSearchActive ? (
              <button type="button" className="photo-gallery-modal__face-btn" onClick={resetFaceSearch}>
                Show All
              </button>
            ) : (
              <button type="button" className="photo-gallery-modal__face-btn" onClick={openFaceSearch}>
                Find My Photos
              </button>
            )}
            <button type="button" className="photo-gallery-modal__close" onClick={onClose} aria-label="Close gallery">
              x
            </button>
          </div>
        </header>
        {(actionError || faceSearchError) && <p className="photo-gallery-modal__error">{actionError || faceSearchError}</p>}
        {faceSearchOpen && (
          <div className="photo-gallery-face-search">
            <video ref={videoRef} className="photo-gallery-face-search__video" playsInline muted />
            <div className="photo-gallery-face-search__controls">
              <span>{isScanningFaces ? `${scanProgress.done}/${scanProgress.total}` : faceSearchStatus}</span>
              <button type="button" onClick={captureAndMatchFaces} disabled={isScanningFaces}>
                {isScanningFaces ? "Scanning..." : "Capture Face"}
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isScanningFaces}>
                Use Photo
              </button>
              <button type="button" onClick={() => { stopCamera(); setFaceSearchOpen(false); }} disabled={isScanningFaces}>
                Cancel
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={matchFromReferencePhoto} hidden />
            </div>
          </div>
        )}
        <div className="photo-gallery-modal__grid">
          {visiblePhotos.map((photo, index) => (
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
        {faceSearchActive && !visiblePhotos.length && (
          <p className="photo-gallery-modal__empty">No matching photos found.</p>
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
