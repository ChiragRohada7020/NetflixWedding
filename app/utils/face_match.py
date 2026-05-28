import os
import math
import tempfile
import threading
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin

import requests
from bson import ObjectId


MODEL_NAME = "ArcFace"
DISTANCE_METRIC = "cosine"
DETECTOR_BACKEND = "opencv"
DEFAULT_THRESHOLD = 0.68

_deepface = None
_find_threshold = None
_threshold = None
_model_ready = False
_model_lock = threading.Lock()


class FaceMatchError(Exception):
    pass


def _load_deepface():
    global _deepface, _find_threshold, _threshold, _model_ready

    if _deepface and _find_threshold and _model_ready:
        return _deepface, _find_threshold, _threshold

    with _model_lock:
        if _deepface and _find_threshold and _model_ready:
            return _deepface, _find_threshold, _threshold

        os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
        try:
            from deepface import DeepFace
            from deepface.modules.verification import find_threshold
        except Exception as exc:
            raise FaceMatchError(
                "DeepFace is not available. Install requirements-face.txt on a larger server and set ENABLE_FACE_MATCH=1."
            ) from exc

        try:
            DeepFace.build_model(MODEL_NAME)
        except Exception:
            # DeepFace still keeps its own lazy cache during represent().
            pass

        _deepface = DeepFace
        _find_threshold = find_threshold
        _threshold = float(find_threshold(MODEL_NAME, DISTANCE_METRIC) or DEFAULT_THRESHOLD)
        _model_ready = True
        return _deepface, _find_threshold, _threshold


def _face_service_url():
    return (os.getenv("FACE_MATCH_SERVICE_URL") or "").strip().rstrip("/")


def _face_service_token():
    return (os.getenv("FACE_MATCH_SERVICE_TOKEN") or "").strip()


def _face_service_threshold():
    try:
        return float(os.getenv("FACE_MATCH_THRESHOLD", str(DEFAULT_THRESHOLD)))
    except ValueError:
        return DEFAULT_THRESHOLD


def _normalize_remote_faces(payload):
    faces = payload.get("faces") or payload.get("embeddings") or payload.get("results") or []
    normalized = []
    for face in faces:
        if isinstance(face, dict):
            embedding = face.get("embedding") or face.get("vector")
            facial_area = face.get("facial_area") or face.get("box") or {}
        else:
            embedding = face
            facial_area = {}
        if embedding:
            normalized.append(
                {
                    "embedding": [float(value) for value in embedding],
                    "facial_area": facial_area,
                }
            )
    return sorted(normalized, key=_face_area, reverse=True)


def _extract_face_embeddings_remote(image_path):
    service_url = _face_service_url()
    headers = {}
    token = _face_service_token()
    if token:
        headers["Authorization"] = f"Bearer {token}"

    with open(image_path, "rb") as image_file:
        response = requests.post(
            f"{service_url}/embed",
            files={"image": (Path(image_path).name, image_file)},
            headers=headers,
            timeout=(15, 120),
        )

    payload = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
    if not response.ok:
        raise FaceMatchError(payload.get("error") or "Face recognition service failed.")

    return _normalize_remote_faces(payload)


def _cosine_distance(left, right):
    left_vector = [float(value) for value in left or []]
    right_vector = [float(value) for value in right or []]
    if len(left_vector) != len(right_vector):
        return 1.0

    dot = sum(left_value * right_value for left_value, right_value in zip(left_vector, right_vector))
    left_norm = math.sqrt(sum(value * value for value in left_vector))
    right_norm = math.sqrt(sum(value * value for value in right_vector))
    if not left_norm or not right_norm:
        return 1.0
    return 1 - (dot / (left_norm * right_norm))


def preload_face_model():
    if _face_service_url():
        return True
    try:
        _load_deepface()
    except FaceMatchError:
        return False
    return True


def start_face_model_preload():
    thread = threading.Thread(target=preload_face_model, name="face-model-preload", daemon=True)
    thread.start()
    return thread


def _suffix_from_response(response, fallback=".jpg"):
    content_type = (response.headers.get("content-type") or "").split(";")[0].strip().lower()
    if content_type == "image/png":
        return ".png"
    if content_type == "image/webp":
        return ".webp"
    if content_type in {"image/jpeg", "image/jpg"}:
        return ".jpg"
    return fallback


def _download_photo(url, directory, index, base_url):
    if not url:
        raise FaceMatchError("Photo URL is missing.")
    absolute_url = url if url.startswith(("http://", "https://")) else urljoin(base_url, url)
    response = requests.get(absolute_url, timeout=(15, 90), allow_redirects=True)
    response.raise_for_status()
    path = Path(directory) / f"gallery-{index}{_suffix_from_response(response)}"
    path.write_bytes(response.content)
    return str(path)


def _write_upload(file_storage, directory):
    suffix = Path(file_storage.filename or "reference.jpg").suffix or ".jpg"
    path = Path(directory) / f"reference{suffix}"
    file_storage.save(path)
    return str(path)


def _face_area(item):
    facial_area = item.get("facial_area") or {}
    return (facial_area.get("w") or 0) * (facial_area.get("h") or 0)


def extract_face_embeddings(image_path):
    if _face_service_url():
        return _extract_face_embeddings_remote(image_path)

    deepface, _, _ = _load_deepface()
    representations = deepface.represent(
        img_path=image_path,
        model_name=MODEL_NAME,
        detector_backend=DETECTOR_BACKEND,
        enforce_detection=True,
        align=True,
    )
    representations = sorted(representations or [], key=_face_area, reverse=True)
    return [
        {
            "embedding": [float(value) for value in face.get("embedding", [])],
            "facial_area": face.get("facial_area") or {},
        }
        for face in representations
        if face.get("embedding")
    ]


def create_reference_embedding(reference_file):
    with tempfile.TemporaryDirectory(prefix="wedflix-face-ref-") as temp_dir:
        reference_path = _write_upload(reference_file, temp_dir)
        embeddings = extract_face_embeddings(reference_path)
        if not embeddings:
            raise FaceMatchError("No clear face found. Move closer and try again.")
        return embeddings[0]["embedding"]


def compare_reference_to_indexed_photos(reference_file, photos):
    threshold = _face_service_threshold()
    if not _face_service_url():
        _, _, threshold = _load_deepface()
    reference_embedding = create_reference_embedding(reference_file)

    matches = []
    missing_index = []
    skipped = 0
    indexed = 0
    for photo in photos:
        stored_faces = photo.get("face_embeddings") or []
        if not stored_faces:
            missing_index.append(str(photo.get("_id")))
            skipped += 1
            continue

        distances = [
            _cosine_distance(reference_embedding, face.get("embedding"))
            for face in stored_faces
            if face.get("embedding")
        ]
        if not distances:
            skipped += 1
            continue

        indexed += 1
        distance = min(distances)
        if distance <= threshold:
            matches.append(
                {
                    "photo_id": str(photo.get("_id")),
                    "distance": distance,
                    "threshold": threshold,
                    "detector": DETECTOR_BACKEND,
                    "verified": True,
                }
            )

    matches.sort(key=lambda item: item["distance"])
    return {
        "matched_photo_ids": [item["photo_id"] for item in matches],
        "matches": matches,
        "scanned": len(photos),
        "indexed": indexed,
        "missing_index": missing_index,
        "skipped": skipped,
        "model": MODEL_NAME,
        "detector": DETECTOR_BACKEND,
        "threshold": threshold,
    }


def queue_photo_embedding(app, photo_id, base_url, local_path=None):
    def worker():
        from app import mongo

        temp_dir = None
        image_path = local_path
        try:
            with app.app_context():
                object_id = ObjectId(photo_id)
                photo = mongo.db.photos.find_one({"_id": object_id})
                if not photo:
                    return
                if photo.get("face_index_status") == "ready" and photo.get("face_embeddings"):
                    return

                mongo.db.photos.update_one(
                    {"_id": object_id},
                    {
                        "$set": {
                            "face_index_status": "indexing",
                            "face_index_model": MODEL_NAME,
                            "face_index_detector": DETECTOR_BACKEND,
                        }
                    },
                )

                if not image_path:
                    temp_dir = tempfile.TemporaryDirectory(prefix="wedflix-face-index-")
                    image_path = _download_photo(photo.get("url"), temp_dir.name, 0, base_url)

                embeddings = extract_face_embeddings(image_path)
                mongo.db.photos.update_one(
                    {"_id": object_id},
                    {
                        "$set": {
                            "face_embeddings": embeddings,
                            "face_index_status": "ready" if embeddings else "no_face",
                            "face_index_model": MODEL_NAME,
                            "face_index_detector": DETECTOR_BACKEND,
                            "face_indexed_at": datetime.utcnow(),
                        },
                        "$unset": {"face_index_error": ""},
                    },
                )
        except Exception as exc:
            with app.app_context():
                mongo.db.photos.update_one(
                    {"_id": ObjectId(photo_id)},
                    {
                        "$set": {
                            "face_index_status": "failed",
                            "face_index_error": str(exc)[:240],
                            "face_indexed_at": datetime.utcnow(),
                        }
                    },
                )
        finally:
            if temp_dir:
                temp_dir.cleanup()
            if local_path:
                try:
                    Path(local_path).unlink(missing_ok=True)
                except OSError:
                    pass

    thread = threading.Thread(target=worker, name=f"face-index-{photo_id}", daemon=True)
    thread.start()
    return thread


def queue_missing_embeddings(app, photos, base_url):
    queued = 0
    for photo in photos:
        if photo.get("face_embeddings") or photo.get("face_index_status") == "indexing":
            continue
        queue_photo_embedding(app, str(photo.get("_id")), base_url)
        queued += 1
    return queued
