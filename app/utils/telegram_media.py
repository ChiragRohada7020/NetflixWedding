import os
from io import BytesIO

import requests


class TelegramMediaError(RuntimeError):
    pass


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
    return _upload_file_payload_to_telegram(
        file_storage.filename,
        file_storage.stream,
        file_storage.mimetype or "application/octet-stream",
        getattr(file_storage, "content_length", None),
        caption=caption,
    )


def upload_file_to_telegram(file_storage, caption=""):
    if not file_storage or not file_storage.filename:
        return ""
    return _upload_file_payload_to_telegram(
        file_storage.filename,
        file_storage.stream,
        file_storage.mimetype or "application/octet-stream",
        getattr(file_storage, "content_length", None),
        caption=caption,
        prefer_photo=False,
    )


def upload_bytes_to_telegram(filename, content, mimetype="application/octet-stream", caption=""):
    return _upload_file_payload_to_telegram(
        filename,
        BytesIO(content),
        mimetype,
        len(content) if content is not None else None,
        caption=caption,
    )
