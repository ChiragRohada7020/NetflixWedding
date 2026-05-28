import os
from datetime import datetime, timezone

from bson import ObjectId

from app import mongo


def face_index_enabled():
    return os.getenv("FACE_INDEX_ENABLED") == "1"


def enqueue_face_index_job(photo_id, image_url, episode_id=None, wedding_id=None):
    if not face_index_enabled() or not image_url:
        return None

    now = datetime.now(timezone.utc)
    photo_object_id = ObjectId(photo_id)
    job = {
        "photo_id": photo_object_id,
        "episode_id": ObjectId(episode_id) if episode_id else None,
        "wedding_id": ObjectId(wedding_id) if wedding_id else None,
        "image_url": image_url,
        "status": "queued",
        "attempts": 0,
        "created_at": now,
        "updated_at": now,
    }
    result = mongo.db.face_jobs.insert_one(job)
    mongo.db.photos.update_one(
        {"_id": photo_object_id},
        {"$set": {"face_index_status": "queued", "face_job_id": result.inserted_id}},
    )
    return result.inserted_id
