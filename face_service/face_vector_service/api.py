from datetime import datetime, timezone

import numpy as np
from bson import ObjectId
from flask import Flask, Response, jsonify, request

from .config import config
from .db import db
from .embedding import extract_faces, model_status
from .image_io import image_bytes_to_bgr
from .worker import run_once


def utc_now():
    return datetime.now(timezone.utc)


def require_token():
    if not config.FACE_SERVICE_TOKEN:
        return True
    header = request.headers.get("Authorization", "")
    return header == f"Bearer {config.FACE_SERVICE_TOKEN}"


def cosine_similarity(a, b):
    vec_a = np.asarray(a, dtype=np.float32)
    vec_b = np.asarray(b, dtype=np.float32)
    denom = float(np.linalg.norm(vec_a) * np.linalg.norm(vec_b))
    if denom == 0:
        return 0.0
    return float(np.dot(vec_a, vec_b) / denom)


def create_app():
    app = Flask(__name__)
    app.config["PORT"] = config.PORT

    @app.before_request
    def check_auth():
        if request.path in {"/", "/health", "/favicon.ico"}:
            return None
        if not require_token():
            return jsonify({"error": "Unauthorized"}), 401
        return None

    @app.route("/", methods=["GET"])
    def root():
        return jsonify({"status": "ok", "service": "wedflix-face-service"})

    @app.route("/health", methods=["GET"])
    def health():
        return jsonify({"status": "ok", **model_status()})

    @app.route("/favicon.ico", methods=["GET"])
    def favicon():
        return Response(status=204)

    def model_not_ready_response(status):
        loading_seconds = status.get("loading_seconds")
        message = "Face model is still loading. Try again in a minute."
        if loading_seconds and loading_seconds > 180:
            message = (
                f"Face model is still loading after {loading_seconds}s. "
                "On Render free 512MB this usually means the instance does not have enough memory for InsightFace."
            )
        return jsonify({"error": message, **status}), 503

    @app.route("/embed", methods=["POST"])
    def embed():
        file_storage = request.files.get("photo")
        if not file_storage:
            return jsonify({"error": "photo file is required"}), 400
        status = model_status()
        if not status["ready"]:
            return model_not_ready_response(status)
        image_bgr = image_bytes_to_bgr(file_storage.read())
        faces = extract_faces(image_bgr)
        return jsonify({"faces": faces, "face_count": len(faces)})

    @app.route("/jobs/run-once", methods=["POST"])
    def jobs_run_once():
        return jsonify({"processed": run_once()})

    @app.route("/search", methods=["POST"])
    def search():
        file_storage = request.files.get("photo")
        wedding_id = request.form.get("wedding_id")
        limit = min(int(request.form.get("limit") or 80), 300)
        if not file_storage:
            return jsonify({"error": "photo file is required"}), 400
        status = model_status()
        if not status["ready"]:
            return model_not_ready_response(status)

        image_bgr = image_bytes_to_bgr(file_storage.read())
        faces = extract_faces(image_bgr)
        if not faces:
            return jsonify({"matches": [], "face_count": 0})

        query = {}
        if wedding_id:
            try:
                query["wedding_id"] = ObjectId(wedding_id)
            except Exception:
                return jsonify({"error": "Invalid wedding_id"}), 400

        indexed_faces = list(db.photo_faces.find(query, {"embedding": 1, "photo_id": 1}).limit(20000))
        matches_by_photo = {}
        for reference_face in faces[:3]:
            reference_embedding = reference_face["embedding"]
            for indexed_face in indexed_faces:
                score = cosine_similarity(reference_embedding, indexed_face.get("embedding") or [])
                if score < config.FACE_MATCH_THRESHOLD:
                    continue
                photo_id = str(indexed_face["photo_id"])
                if score > matches_by_photo.get(photo_id, 0):
                    matches_by_photo[photo_id] = score

        matches = [
            {"photo_id": photo_id, "score": score}
            for photo_id, score in sorted(matches_by_photo.items(), key=lambda item: item[1], reverse=True)[:limit]
        ]
        return jsonify({"matches": matches, "face_count": len(faces), "searched_at": utc_now().isoformat()})

    return app
