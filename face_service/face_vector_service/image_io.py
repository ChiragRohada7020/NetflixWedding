from io import BytesIO

import cv2
import numpy as np
import requests
from PIL import Image

from .config import config


class ImageLoadError(RuntimeError):
    pass


def download_image(url):
    response = requests.get(url, timeout=(10, config.FACE_DOWNLOAD_TIMEOUT_SECONDS))
    if not response.ok:
        raise ImageLoadError(f"Image download failed with HTTP {response.status_code}.")
    content = response.content
    if len(content) > config.FACE_MAX_IMAGE_BYTES:
        mb = round(len(content) / (1024 * 1024), 1)
        raise ImageLoadError(f"Image is too large for indexing ({mb} MB).")
    return content


def image_bytes_to_bgr(image_bytes):
    try:
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
    except Exception as exc:
        raise ImageLoadError(f"Could not decode image: {exc}") from exc
    rgb = np.asarray(image)
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
