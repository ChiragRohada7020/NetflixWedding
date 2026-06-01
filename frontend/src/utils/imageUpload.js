const MAX_PHOTO_EDGE = 1800;
const PHOTO_QUALITY = 0.84;
const AUDIO_BITRATE = 96000;

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not prepare photo for upload."));
    }, type, quality);
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not read ${file.name}.`));
    };
    image.src = url;
  });
}

export async function preparePhotoForUpload(file) {
  if (!file?.type?.startsWith("image/") || file.type === "image/gif") {
    return file;
  }

  const image = await loadImage(file);
  const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, "image/jpeg", PHOTO_QUALITY);
  if (blob.size >= file.size && file.size < 8 * 1024 * 1024) {
    return file;
  }

  const baseName = file.name.replace(/\.[^.]+$/, "") || "wedflix-photo";
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}

export async function preparePhotosForUpload(files) {
  return Promise.all(files.map((file) => preparePhotoForUpload(file)));
}

function pickAudioMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  return candidates.find((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) || "";
}

export async function prepareAudioForUpload(file) {
  if (!file?.type?.startsWith("audio/")) {
    return file;
  }
  if (typeof window === "undefined" || typeof AudioContext === "undefined" || typeof MediaRecorder === "undefined") {
    return file;
  }

  const audioContext = new AudioContext();
  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const source = audioContext.createBufferSource();
    const destination = audioContext.createMediaStreamDestination();
    const mimeType = pickAudioMimeType();
    if (!mimeType) {
      return file;
    }

    source.buffer = audioBuffer;
    source.connect(destination);

    const chunks = [];
    const recorder = new MediaRecorder(destination.stream, {
      mimeType,
      audioBitsPerSecond: AUDIO_BITRATE,
    });

    const recorded = new Promise((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => reject(new Error("Could not compress audio for upload."));
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const ext = mimeType.includes("ogg") ? "ogg" : "webm";
        resolve(new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "wedflix-audio"}.${ext}`, { type: mimeType, lastModified: Date.now() }));
      };
    });

    source.start(0);
    recorder.start(250);
    source.onended = () => {
      try {
        recorder.stop();
      } catch {
        // ignore double-stop races
      }
    };

    const timeout = Math.max(1000, Math.ceil((audioBuffer.duration || 1) * 1000) + 1000);
    return await Promise.race([
      recorded,
      new Promise((resolve) => {
        setTimeout(() => {
          try {
            recorder.stop();
          } catch {
            // ignore
          }
          resolve(file);
        }, timeout);
      }),
    ]);
  } catch {
    return file;
  } finally {
    try {
      await audioContext.close();
    } catch {
      // ignore
    }
  }
}
