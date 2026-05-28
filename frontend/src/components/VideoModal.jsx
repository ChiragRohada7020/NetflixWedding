import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import WedflixPlayer from "./WedflixPlayer";
import { useEffect } from "react";

export default function VideoModal({ open, url, title, onClose }) {
  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new Event("wedflix-video-playing"));
    return () => {
      window.dispatchEvent(new Event("wedflix-video-stopped"));
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="video-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="video-modal-card"
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className="video-modal-back" onClick={onClose} aria-label="Back">
              <span aria-hidden="true">←</span>
              Back
            </button>
            <WedflixPlayer
              url={url}
              className="player-wrap"
              autoPlay
              onPlay={() => {
                window.dispatchEvent(new Event("wedflix-video-playing"));
              }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
