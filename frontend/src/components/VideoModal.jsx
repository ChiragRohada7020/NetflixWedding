import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import WedflixPlayer from "./WedflixPlayer";

export default function VideoModal({ open, url, title, onClose }) {
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
              onPlay={async () => {
                window.dispatchEvent(new Event("wedflix-video-playing"));
                if (!document.fullscreenElement) {
                  try {
                    await document.documentElement.requestFullscreen();
                  } catch {
                    // Browser may block auto fullscreen without direct gesture.
                  }
                }
              }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
