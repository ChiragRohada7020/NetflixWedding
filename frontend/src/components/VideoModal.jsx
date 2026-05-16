import React from "react";
import ReactPlayer from "react-player";
import { AnimatePresence, motion } from "framer-motion";

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
            <h2>{title}</h2>
            <div className="player-wrap">
              <ReactPlayer
                url={url}
                controls
                playing
                width="100%"
                height="100%"
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
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
