import threading

import numpy as np

from .config import config

_model = None
_model_loading = False
_model_error = None
_model_lock = threading.Lock()


class FaceEmbeddingError(RuntimeError):
    pass


def _load_insightface_model():
    global _model, _model_error, _model_loading
    with _model_lock:
        if _model is not None:
            return _model
        _model_loading = True
        _model_error = None
        try:
            from insightface.app import FaceAnalysis
        except Exception as exc:
            _model_loading = False
            _model_error = str(exc)
            raise FaceEmbeddingError(f"InsightFace is not installed correctly: {exc}") from exc
        try:
            app = FaceAnalysis(name=config.FACE_MODEL_NAME, providers=["CPUExecutionProvider"])
            app.prepare(ctx_id=-1, det_size=(640, 640))
            _model = app
            return _model
        except Exception as exc:
            _model_error = str(exc)
            raise
        finally:
            _model_loading = False


def preload_model():
    thread = threading.Thread(target=_load_insightface_model, name="face-model-preload", daemon=True)
    thread.start()
    return thread


def model_status():
    return {
        "ready": _model is not None,
        "loading": _model_loading,
        "error": _model_error,
        "model": config.FACE_MODEL_NAME,
        "provider": config.FACE_MODEL_PROVIDER,
    }


def model_ready():
    return _model is not None


def extract_faces(image_bgr):
    if config.FACE_MODEL_PROVIDER != "insightface":
        raise FaceEmbeddingError(f"Unsupported FACE_MODEL_PROVIDER: {config.FACE_MODEL_PROVIDER}")

    app = _load_insightface_model()
    faces = app.get(image_bgr)
    results = []
    for index, face in enumerate(faces):
        embedding = np.asarray(face.embedding, dtype=np.float32)
        norm = float(np.linalg.norm(embedding))
        if norm > 0:
            embedding = embedding / norm
        bbox = [float(value) for value in face.bbox.tolist()]
        results.append(
            {
                "face_index": index,
                "embedding": embedding.tolist(),
                "bbox": bbox,
                "det_score": float(getattr(face, "det_score", 0.0) or 0.0),
                "provider": config.FACE_MODEL_PROVIDER,
                "model": config.FACE_MODEL_NAME,
            }
        )
    return results
