from datetime import datetime

from app.models.base import BaseModel


class Comment(BaseModel):
    collection_name = "comments"

    @classmethod
    def by_episode(cls, episode_id):
        docs = cls.collection().find({"episode_id": cls.to_object_id(episode_id)}).sort("created_at", -1)
        return [cls.serialize(x) for x in docs]

    @classmethod
    def add(cls, episode_id, user_name, text):
        payload = {
            "episode_id": cls.to_object_id(episode_id),
            "user_name": user_name,
            "text": text,
            "created_at": datetime.utcnow(),
        }
        inserted = cls.collection().insert_one(payload)
        return str(inserted.inserted_id)
