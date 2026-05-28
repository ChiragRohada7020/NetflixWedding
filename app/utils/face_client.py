import os

import requests


class FaceServiceError(RuntimeError):
    pass


def face_service_configured():
    return bool((os.getenv("FACE_SERVICE_URL") or "").strip())


def search_faces(reference_file, wedding_id=None):
    base_url = (os.getenv("FACE_SERVICE_URL") or "").strip().rstrip("/")
    if not base_url:
        raise FaceServiceError("Face search service is not configured.")

    headers = {}
    token = (os.getenv("FACE_SERVICE_TOKEN") or "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"

    data = {}
    if wedding_id:
        data["wedding_id"] = wedding_id

    try:
        reference_file.stream.seek(0)
    except (AttributeError, OSError):
        pass

    response = requests.post(
        f"{base_url}/search",
        headers=headers,
        data=data,
        files={
            "photo": (
                reference_file.filename or "reference.jpg",
                reference_file.stream,
                reference_file.mimetype or "application/octet-stream",
            )
        },
        timeout=(15, 120),
    )
    payload = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
    if not response.ok:
        raise FaceServiceError(payload.get("error") or f"Face search failed with HTTP {response.status_code}.")
    return payload
