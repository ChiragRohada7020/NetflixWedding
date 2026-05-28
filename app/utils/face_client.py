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
        message = payload.get("error") or f"Face search failed with HTTP {response.status_code}."
        if response.status_code == 503 and payload.get("loading"):
            loading_seconds = payload.get("loading_seconds")
            if loading_seconds and loading_seconds > 180:
                message = (
                    "Face search service is still loading the AI model. "
                    "This Render instance likely needs more memory than the free 512MB plan."
                )
            else:
                message = "Face search is still warming up. Please try again in a minute."
        raise FaceServiceError(message)
    return payload
