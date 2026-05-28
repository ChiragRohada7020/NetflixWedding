import os

from dotenv import load_dotenv

load_dotenv()


class Config:
    MONGO_URI = os.getenv("MONGO_URI", "")
    FACE_SERVICE_TOKEN = os.getenv("FACE_SERVICE_TOKEN", "")
    FACE_MODEL_NAME = os.getenv("FACE_MODEL_NAME", "buffalo_s")
    FACE_MODEL_PROVIDER = os.getenv("FACE_MODEL_PROVIDER", "insightface")
    FACE_PRELOAD_MODEL = os.getenv("FACE_PRELOAD_MODEL", "1") == "1"
    FACE_WORKER_POLL_SECONDS = int(os.getenv("FACE_WORKER_POLL_SECONDS", "5"))
    FACE_WORKER_BATCH_SIZE = int(os.getenv("FACE_WORKER_BATCH_SIZE", "1"))
    FACE_DOWNLOAD_TIMEOUT_SECONDS = int(os.getenv("FACE_DOWNLOAD_TIMEOUT_SECONDS", "60"))
    FACE_MAX_IMAGE_BYTES = int(os.getenv("FACE_MAX_IMAGE_BYTES", str(15 * 1024 * 1024)))
    FACE_MATCH_THRESHOLD = float(os.getenv("FACE_MATCH_THRESHOLD", "0.55"))
    PORT = int(os.getenv("PORT", "7100"))


config = Config()
