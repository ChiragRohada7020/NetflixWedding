import time
from datetime import datetime, timezone

from bson import ObjectId
from pymongo import ReturnDocument

from .config import config
from .db import db
from .embedding import extract_faces, model_ready
from .image_io import download_image, image_bytes_to_bgr


def utc_now():
    return datetime.now(timezone.utc)


def claim_job():
    now = utc_now()
    return db.face_jobs.find_one_and_update(
        {"status": "queued"},
        {
            "$set": {"status": "processing", "updated_at": now, "started_at": now},
            "$inc": {"attempts": 1},
        },
        sort=[("created_at", 1)],
        return_document=ReturnDocument.AFTER,
    )


def mark_photo(photo_id, status, error=None):
    update = {
        "face_index_status": status,
        "face_indexed_at": utc_now(),
    }
    if error:
        update["face_index_error"] = error[:500]
    else:
        update["face_index_error"] = ""
    db.photos.update_one({"_id": ObjectId(photo_id)}, {"$set": update})


def process_job(job):
    photo_id = job["photo_id"]
    image_bytes = download_image(job["image_url"])
    image_bgr = image_bytes_to_bgr(image_bytes)
    faces = extract_faces(image_bgr)

    db.photo_faces.delete_many({"photo_id": photo_id})
    if faces:
        now = utc_now()
        docs = []
        for face in faces:
            docs.append(
                {
                    **face,
                    "photo_id": photo_id,
                    "episode_id": job.get("episode_id"),
                    "wedding_id": job.get("wedding_id"),
                    "created_at": now,
                    "updated_at": now,
                }
            )
        db.photo_faces.insert_many(docs)

    status = "ready" if faces else "no_face"
    mark_photo(str(photo_id), status)
    db.face_jobs.update_one(
        {"_id": job["_id"]},
        {"$set": {"status": "done", "result_status": status, "face_count": len(faces), "updated_at": utc_now()}},
    )
    return len(faces)


def fail_job(job, exc):
    message = str(exc)
    db.face_jobs.update_one(
        {"_id": job["_id"]},
        {"$set": {"status": "failed", "error": message[:500], "updated_at": utc_now()}},
    )
    mark_photo(str(job["photo_id"]), "failed", message)


def run_once():
    if not model_ready():
        return 0
    processed = 0
    for _ in range(config.FACE_WORKER_BATCH_SIZE):
        job = claim_job()
        if not job:
            break
        try:
            process_job(job)
        except Exception as exc:
            fail_job(job, exc)
        processed += 1
    return processed


def run_forever():
    while True:
        processed = run_once()
        if not processed:
            time.sleep(config.FACE_WORKER_POLL_SECONDS)
