import os
import shutil
import subprocess
import tempfile
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image, ImageOps, UnidentifiedImageError


class TelegramMediaError(RuntimeError):
    pass


PHOTO_MAX_DIMENSION = int(os.getenv("TELEGRAM_PHOTO_MAX_DIMENSION", "1280"))
PHOTO_JPEG_QUALITY = int(os.getenv("TELEGRAM_PHOTO_JPEG_QUALITY", "72"))
MUSIC_TRIM_SECONDS = int(os.getenv("TELEGRAM_MUSIC_TRIM_SECONDS", "60"))
MUSIC_AUDIO_BITRATE = os.getenv("TELEGRAM_MUSIC_BITRATE", "64k")


def telegram_file_url(file_id):
    if not file_id:
        return ""
    return f"/api/media/telegram/{file_id}"


def _extract_file_id_from_message(message):
    if not isinstance(message, dict):
        return ""
    for key in ("document", "audio", "voice", "video", "animation", "video_note"):
        media = message.get(key) or {}
        if isinstance(media, dict) and media.get("file_id"):
            return media["file_id"]
    photos = message.get("photo") or []
    if photos:
        best = max(photos, key=lambda item: item.get("file_size") or 0)
        return best.get("file_id") or ""
    return message.get("file_id") or ""


def _post_telegram_file(endpoint, data, field_name, file_payload):
    try:
        return requests.post(
            endpoint,
            data=data,
            files={field_name: file_payload},
            timeout=(30, int(os.getenv("TELEGRAM_PHOTO_UPLOAD_TIMEOUT_SECONDS", "300"))),
        )
    except requests.RequestException as exc:
        raise TelegramMediaError(f"Telegram photo upload failed: {exc}") from exc


def _read_stream(stream):
    try:
        stream.seek(0)
    except (AttributeError, OSError):
        pass
    return stream.read()


def _compressed_photo_payload(filename, stream, mimetype="application/octet-stream"):
    original = _read_stream(stream)
    if not original:
        return filename, BytesIO(original), mimetype or "application/octet-stream", 0

    try:
        with Image.open(BytesIO(original)) as image:
            image = ImageOps.exif_transpose(image)
            if image.mode not in ("RGB", "L"):
                image = image.convert("RGB")
            image.thumbnail((PHOTO_MAX_DIMENSION, PHOTO_MAX_DIMENSION), Image.Resampling.LANCZOS)

            output = BytesIO()
            image.save(
                output,
                format="JPEG",
                quality=PHOTO_JPEG_QUALITY,
                optimize=True,
                progressive=True,
            )
            compressed = output.getvalue()
    except (UnidentifiedImageError, OSError):
        return filename, BytesIO(original), mimetype or "application/octet-stream", len(original)

    # Keep the original if conversion would make an already-small image heavier.
    if len(compressed) >= len(original):
        return filename, BytesIO(original), mimetype or "application/octet-stream", len(original)

    stem = Path(filename).stem or "wedflix-photo"
    return f"{stem}.jpg", BytesIO(compressed), "image/jpeg", len(compressed)


def _compressed_music_payload(filename, stream, mimetype):
    original = _read_stream(stream)
    if not original:
        return filename, BytesIO(original), mimetype or "application/octet-stream", 0

    ffmpeg_path = shutil.which("ffmpeg")
    if not ffmpeg_path:
        try:
            from imageio_ffmpeg import get_ffmpeg_exe

            ffmpeg_path = get_ffmpeg_exe()
        except Exception:
            ffmpeg_path = ""
    if not ffmpeg_path:
        return filename, BytesIO(original), mimetype or "application/octet-stream", len(original)

    suffix = Path(filename).suffix or ".audio"
    with tempfile.TemporaryDirectory() as temp_dir:
        input_path = os.path.join(temp_dir, f"input{suffix}")
        output_path = os.path.join(temp_dir, "wedflix-music.mp3")
        with open(input_path, "wb") as input_file:
            input_file.write(original)

        command = [
            ffmpeg_path,
            "-y",
            "-i",
            input_path,
            "-t",
            str(max(MUSIC_TRIM_SECONDS, 1)),
            "-vn",
            "-ac",
            "2",
            "-ar",
            "44100",
            "-b:a",
            MUSIC_AUDIO_BITRATE,
            output_path,
        ]
        try:
            subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            with open(output_path, "rb") as output_file:
                compressed = output_file.read()
        except (OSError, subprocess.CalledProcessError):
            return filename, BytesIO(original), mimetype or "application/octet-stream", len(original)

    if not compressed or len(compressed) >= len(original):
        return filename, BytesIO(original), mimetype or "application/octet-stream", len(original)

    stem = Path(filename).stem or "wedflix-music"
    return f"{stem}.mp3", BytesIO(compressed), "audio/mpeg", len(compressed)


def _upload_file_payload_to_telegram(filename, stream, mimetype, content_length=None, caption="", prefer_photo=True):
    token = (os.getenv("TELEGRAM_BOT_TOKEN") or "").strip()
    chat_id = (os.getenv("TELEGRAM_STORAGE_CHAT_ID") or "").strip()
    if not token or not chat_id:
        raise TelegramMediaError("Telegram photo storage is not configured.")
    if not filename or not stream:
        return ""
    max_upload_bytes = int(os.getenv("TELEGRAM_MAX_UPLOAD_BYTES", str(50 * 1024 * 1024)))
    if content_length and content_length > max_upload_bytes:
        actual_mb = round(content_length / (1024 * 1024), 1)
        max_mb = max_upload_bytes // (1024 * 1024)
        raise TelegramMediaError(f"{filename} is {actual_mb} MB. Telegram uploads must be under {max_mb} MB.")

    data = {"chat_id": chat_id}
    if caption:
        data["caption"] = caption[:1024]

    try:
        stream.seek(0)
    except (AttributeError, OSError):
        pass
    file_payload = (filename, stream, mimetype or "application/octet-stream")
    photo_error = ""
    if prefer_photo:
        endpoint = f"https://api.telegram.org/bot{token}/sendPhoto"
        response = _post_telegram_file(endpoint, data, "photo", file_payload)

        payload = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
        photo_error = payload.get("description") or response.text or "sendPhoto failed"
        if response.ok and payload.get("ok"):
            photos = (payload.get("result") or {}).get("photo") or []
            if photos:
                best = max(photos, key=lambda item: item.get("file_size") or 0)
                return telegram_file_url(best.get("file_id"))

    # Some user-selected images are rejected by sendPhoto due to size, dimensions,
    # or format. Store them as documents instead so the gallery still works.
    try:
        if hasattr(file_payload[1], "seek"):
            file_payload[1].seek(0)
    except (AttributeError, OSError):
        pass
    doc_endpoint = f"https://api.telegram.org/bot{token}/sendDocument"
    response = _post_telegram_file(doc_endpoint, data, "document", file_payload)
    payload = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
    if not response.ok or not payload.get("ok"):
        document_error = payload.get("description") or response.text or "sendDocument failed"
        details = f"{photo_error}; {document_error}" if photo_error else document_error
        raise TelegramMediaError(f"{filename}: {details}")

    file_id = _extract_file_id_from_message(payload.get("result") or {})
    if not file_id:
        raise TelegramMediaError("Telegram did not return a media file id.")
    return telegram_file_url(file_id)


def upload_photo_to_telegram(file_storage, caption=""):
    if not file_storage or not file_storage.filename:
        return ""
    filename, stream, mimetype, content_length = _compressed_photo_payload(
        file_storage.filename,
        file_storage.stream,
        file_storage.mimetype or "application/octet-stream",
    )
    return _upload_file_payload_to_telegram(
        filename,
        stream,
        mimetype,
        content_length,
        caption=caption,
    )


def upload_file_to_telegram(file_storage, caption=""):
    if not file_storage or not file_storage.filename:
        return ""
    filename, stream, mimetype, content_length = _compressed_music_payload(
        file_storage.filename,
        file_storage.stream,
        file_storage.mimetype or "application/octet-stream",
    )
    return _upload_file_payload_to_telegram(
        filename,
        stream,
        mimetype,
        content_length,
        caption=caption,
        prefer_photo=False,
    )


def upload_bytes_to_telegram(filename, content, mimetype="application/octet-stream", caption=""):
    content = content or b""
    filename, stream, mimetype, content_length = _compressed_photo_payload(filename, BytesIO(content), mimetype)
    return _upload_file_payload_to_telegram(
        filename,
        stream,
        mimetype,
        content_length,
        caption=caption,
    )
