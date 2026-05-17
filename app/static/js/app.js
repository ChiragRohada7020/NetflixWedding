document.addEventListener("DOMContentLoaded", () => {
  const loginModal = document.getElementById("frontend-login-modal");
  const closeLoginModalBtn = document.getElementById("close-login-modal");
  const loginOpeners = document.querySelectorAll("[data-open-login-modal='1']");

  const openLoginModal = () => {
    if (!loginModal) return;
    loginModal.classList.remove("hidden");
    document.body.classList.add("login-open"); document.body.style.overflow = "hidden";
  };

  const closeLoginModal = () => {
    if (!loginModal) return;
    loginModal.classList.add("hidden");
    document.body.classList.remove("login-open"); document.body.style.overflow = "";
  };

  loginOpeners.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      openLoginModal();
    });
  });

  if (closeLoginModalBtn) closeLoginModalBtn.addEventListener("click", closeLoginModal);
  if (loginModal) {
    loginModal.addEventListener("click", (e) => {
      if (e.target === loginModal || e.target.classList.contains("bg-black")) {
        closeLoginModal();
      }
    });
  }

  const wedflixIntro = document.getElementById("wedflix-intro");
  if (wedflixIntro) setTimeout(() => { wedflixIntro.style.display = "none"; }, 2400);

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
  if (lightbox) lightbox.addEventListener("click", () => { lightbox.classList.add("hidden"); lightbox.classList.remove("flex"); });

  document.querySelectorAll("img").forEach((img) => {
    img.addEventListener("error", () => {
      if (img.dataset.fallbackApplied === "1") return;
      img.dataset.fallbackApplied = "1";
      img.src = "https://picsum.photos/seed/weddingflix-fallback/800/450";
    });
  });

  const bgMusic = document.getElementById("bg-music");
  const musicToggle = document.getElementById("music-toggle");
  if (bgMusic && musicToggle) {
    const pageMusic = document.body.dataset.pageMusic || "";
    const defaultMusic = "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0f4aa6738.mp3?filename=cinematic-documentary-piano-11120.mp3";
    bgMusic.src = pageMusic || defaultMusic;
    bgMusic.loop = true;
    bgMusic.volume = 0.35;

    if (localStorage.getItem("weddingflix_music_on") === null) localStorage.setItem("weddingflix_music_on", "1");
    const musicIcon = musicToggle.querySelector("[data-music-icon]");
    const musicLabel = musicToggle.querySelector("[data-music-label]");
    const syncLabel = (on) => {
      if (musicLabel) musicLabel.textContent = on ? "Music On" : "Music Off";
      if (musicIcon) musicIcon.textContent = on ? "♪" : "♫";
      musicToggle.setAttribute("aria-pressed", on ? "true" : "false");
    };
    const ensurePlay = async () => { try { await bgMusic.play(); syncLabel(true); } catch { syncLabel(false); } };

    if (localStorage.getItem("weddingflix_music_on") === "1") ensurePlay(); else syncLabel(false);
    musicToggle.addEventListener("click", async () => {
      if (bgMusic.paused) { localStorage.setItem("weddingflix_music_on", "1"); await ensurePlay(); }
      else { bgMusic.pause(); localStorage.setItem("weddingflix_music_on", "0"); syncLabel(false); }
    });
  }
});
