document.addEventListener("DOMContentLoaded", () => {
  const wedflixIntro = document.getElementById("wedflix-intro");
  if (wedflixIntro) {
    setTimeout(() => {
      wedflixIntro.style.display = "none";
    }, 2400);
  }

  const episodeVideoIframe = document.getElementById("episode-video-iframe");
  const netflixIntro = document.getElementById("netflix-intro");
  if (episodeVideoIframe) {
    const sendEpisodeCommand = (func, args = []) => {
      episodeVideoIframe.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func, args }),
        "*"
      );
    };

    const tryStartEpisodeWithAudio = () => {
      sendEpisodeCommand("playVideo");
      sendEpisodeCommand("unMute");
      sendEpisodeCommand("setVolume", [70]);
    };

    setTimeout(() => {
      tryStartEpisodeWithAudio();
    }, 1900);

    const unlockEpisodeAudio = () => {
      tryStartEpisodeWithAudio();
      document.removeEventListener("click", unlockEpisodeAudio);
      document.removeEventListener("keydown", unlockEpisodeAudio);
      document.removeEventListener("touchstart", unlockEpisodeAudio);
    };
    document.addEventListener("click", unlockEpisodeAudio, { passive: true });
    document.addEventListener("keydown", unlockEpisodeAudio);
    document.addEventListener("touchstart", unlockEpisodeAudio, { passive: true });

    if (netflixIntro) {
      setTimeout(() => {
        netflixIntro.style.display = "none";
      }, 3700);
    }
  }

  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");

  document.querySelectorAll(".gallery-photo").forEach((photo) => {
    photo.addEventListener("click", () => {
      if (!lightbox || !lightboxImg) return;
      lightboxImg.src = photo.src;
      lightbox.classList.remove("hidden");
      lightbox.classList.add("flex");
    });
  });

  if (lightbox) {
    lightbox.addEventListener("click", () => {
      lightbox.classList.add("hidden");
      lightbox.classList.remove("flex");
    });
  }

  const commentForm = document.getElementById("comment-form");
  if (commentForm) {
    commentForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const episodeId = commentForm.dataset.episode;
      const input = document.getElementById("comment-input");
      const text = input.value.trim();
      if (!text) return;
      await fetch(`/api/episodes/${episodeId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      window.location.reload();
    });
  }

  const likeBtn = document.getElementById("like-btn");
  if (likeBtn) {
    likeBtn.addEventListener("click", async () => {
      const episodeId = likeBtn.dataset.episode;
      await fetch(`/api/episodes/${episodeId}/like`, { method: "POST" });
      likeBtn.textContent = "Liked";
    });
  }

  const bgMusic = document.getElementById("bg-music");
  const musicToggle = document.getElementById("music-toggle");
  if (bgMusic && musicToggle) {
    const pageMusic = document.body.dataset.pageMusic || "";
    const defaultMusic = "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0f4aa6738.mp3?filename=cinematic-documentary-piano-11120.mp3";
    const finalMusic = pageMusic || defaultMusic;
    if (bgMusic.src !== finalMusic) {
      bgMusic.src = finalMusic;
      bgMusic.load();
    }

    let storedRaw = localStorage.getItem("weddingflix_music_on");
    if (storedRaw === null) {
      // Default to ON for first-time visitors.
      localStorage.setItem("weddingflix_music_on", "1");
      storedRaw = "1";
    }
    const stored = storedRaw === "1";
    const musicIcon = musicToggle.querySelector("[data-music-icon]");
    const musicLabel = musicToggle.querySelector("[data-music-label]");

    const heroVideo = document.getElementById("hero-video-iframe");
    const useVideoAudio = !!heroVideo && !pageMusic;

    const syncLabel = (isOn) => {
      if (musicLabel) {
        musicLabel.textContent = isOn ? "Music On" : "Music Off";
      } else {
        musicToggle.textContent = isOn ? "Music On" : "Music Off";
      }
      if (musicIcon) {
        musicIcon.textContent = isOn ? "ON" : "OFF";
      }
      musicToggle.setAttribute("aria-pressed", isOn ? "true" : "false");
    };

    const sendYouTubeCommand = (func, args = []) => {
      if (!heroVideo) return;
      heroVideo.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func, args }),
        "*"
      );
    };

    const playVideoAudio = async () => {
      sendYouTubeCommand("playVideo");
      sendYouTubeCommand("unMute");
      sendYouTubeCommand("setVolume", [40]);
      syncLabel(true);
      localStorage.setItem("weddingflix_music_on", "1");
    };

    const stopVideoAudio = async () => {
      sendYouTubeCommand("mute");
      syncLabel(false);
      localStorage.setItem("weddingflix_music_on", "0");
    };

    const tryPlay = async () => {
      if (useVideoAudio) {
        await playVideoAudio();
        return;
      }
      try {
        bgMusic.volume = 0.35;
        await bgMusic.play();
        syncLabel(true);
        localStorage.setItem("weddingflix_music_on", "1");
      } catch (e) {
        syncLabel(false);
      }
    };

    if (stored) {
      tryPlay();
    } else {
      syncLabel(false);
    }

    // Browser autoplay policies can block background audio until user interacts.
    const unlockOnFirstInteraction = async () => {
      if (localStorage.getItem("weddingflix_music_on") === "1") {
        if (useVideoAudio) {
          await playVideoAudio();
        } else if (bgMusic.paused) {
          await tryPlay();
        }
      }
      document.removeEventListener("click", unlockOnFirstInteraction);
      document.removeEventListener("keydown", unlockOnFirstInteraction);
      document.removeEventListener("touchstart", unlockOnFirstInteraction);
    };
    document.addEventListener("click", unlockOnFirstInteraction, { passive: true });
    document.addEventListener("keydown", unlockOnFirstInteraction);
    document.addEventListener("touchstart", unlockOnFirstInteraction, { passive: true });

    musicToggle.addEventListener("click", async () => {
      if (useVideoAudio) {
        const isOn = localStorage.getItem("weddingflix_music_on") === "1";
        if (isOn) {
          await stopVideoAudio();
        } else {
          await playVideoAudio();
        }
      } else {
        if (bgMusic.paused) {
          await tryPlay();
        } else {
          bgMusic.pause();
          syncLabel(false);
          localStorage.setItem("weddingflix_music_on", "0");
        }
      }
    });
  }
});

