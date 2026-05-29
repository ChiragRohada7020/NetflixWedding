import mimetypes
import os
import re
from urllib.parse import parse_qs, urlparse

import requests


class GoogleDriveImportError(RuntimeError):
    pass


DRIVE_FILE_RE = re.compile(r"drive\.google\.com/(?:file/d/|uc\?(?:[^#]*&)?id=)([A-Za-z0-9_-]+)")
DRIVE_FOLDER_RE = re.compile(r"drive\.google\.com/(?:drive/(?:u/\d+/)?folders/|folderview\?(?:[^#]*&)?id=)([A-Za-z0-9_-]+)")
IMAGE_MIME_PREFIX = "image/"


def _extract_id_from_url(url):
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    if query.get("id"):
        return query["id"][0]

    file_match = re.search(r"/file/d/([A-Za-z0-9_-]+)", parsed.path)
    if file_match:
        return file_match.group(1)

    folder_match = re.search(r"/folders/([A-Za-z0-9_-]+)", parsed.path)
    if folder_match:
        return folder_match.group(1)

    return ""


def _is_folder_link(url):
    return bool(DRIVE_FOLDER_RE.search(url))


def _find_drive_links(text):
    return re.findall(r"https?://[^\s,]+", text or "")


def _api_key():
    return (os.getenv("GOOGLE_DRIVE_API_KEY") or "").strip()


def _download_response(file_id, api_key=""):
    if api_key:
        url = f"https://www.googleapis.com/drive/v3/files/{file_id}"
        return requests.get(url, params={"alt": "media", "key": api_key}, stream=True, timeout=(20, 180))

    session = requests.Session()
    response = session.get(
        "https://drive.google.com/uc",
        params={"export": "download", "id": file_id},
        stream=True,
        timeout=(20, 180),
    )
    token = next((value for key, value in response.cookies.items() if key.startswith("download_warning")), None)
    if token:
        response = session.get(
            "https://drive.google.com/uc",
            params={"export": "download", "confirm": token, "id": file_id},
            stream=True,
            timeout=(20, 180),
        )
    return response


def _download_file(file_item, api_key=""):
    response = _download_response(file_item["id"], api_key=api_key)
    if not response.ok:
        raise GoogleDriveImportError(f"Could not download {file_item.get('name') or file_item['id']} from Google Drive.")

    content_type = (response.headers.get("content-type") or file_item.get("mimeType") or "").split(";")[0].strip()
    if not content_type.startswith(IMAGE_MIME_PREFIX):
        raise GoogleDriveImportError(f"{file_item.get('name') or file_item['id']} is not an image or is not publicly accessible.")

    content = response.content
    max_bytes = int(os.getenv("TELEGRAM_MAX_UPLOAD_BYTES", str(50 * 1024 * 1024)))
    if len(content) > max_bytes:
        max_mb = max_bytes // (1024 * 1024)
        raise GoogleDriveImportError(f"{file_item.get('name') or file_item['id']} is larger than {max_mb} MB.")

    filename = file_item.get("name") or f"{file_item['id']}{mimetypes.guess_extension(content_type) or '.jpg'}"
    return {"filename": filename, "content": content, "mimetype": content_type}


def _list_folder_images(folder_id, api_key):
    if not api_key:
        raise GoogleDriveImportError("Google Drive folder import needs GOOGLE_DRIVE_API_KEY on the server. Direct public file links can import without it.")

    limit = max(1, min(int(os.getenv("GOOGLE_DRIVE_IMPORT_LIMIT", "100")), 500))
    files = []
    page_token = None
    while len(files) < limit:
        params = {
            "key": api_key,
            "q": f"'{folder_id}' in parents and trashed = false and mimeType contains 'image/'",
            "fields": "nextPageToken, files(id, name, mimeType, size)",
            "pageSize": min(100, limit - len(files)),
        }
        if page_token:
            params["pageToken"] = page_token
        response = requests.get("https://www.googleapis.com/drive/v3/files", params=params, timeout=30)
        payload = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
        if not response.ok:
            message = payload.get("error", {}).get("message") or "Google Drive folder lookup failed."
            raise GoogleDriveImportError(message)
        files.extend(payload.get("files") or [])
        page_token = payload.get("nextPageToken")
        if not page_token:
            break
    return files


def download_drive_images(drive_link):
    links = _find_drive_links(drive_link)
    if not links and drive_link:
        links = [drive_link.strip()]
    if not links:
        raise GoogleDriveImportError("Please paste a Google Drive file or folder link.")

    api_key = _api_key()
    file_items = []
    for link in links:
        drive_id = _extract_id_from_url(link)
        if not drive_id:
            continue
        if _is_folder_link(link):
            file_items.extend(_list_folder_images(drive_id, api_key))
        else:
            file_items.append({"id": drive_id, "name": "", "mimeType": "image/jpeg"})

    if not file_items:
        raise GoogleDriveImportError("No Google Drive photos found in that link.")

    images = []
    for item in file_items:
        images.append(_download_file(item, api_key=api_key if item.get("name") else ""))
    return images
