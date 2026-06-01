const MAX_PHOTO_EDGE = 1280;
const PHOTO_QUALITY = 0.72;

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

export async function prepareAudioForUpload(file) {
  return file;
}
