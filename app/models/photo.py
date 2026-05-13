from app.models.base import BaseModel


class Photo(BaseModel):
    collection_name = "photos"

    @classmethod
    def by_episode(cls, episode_id):
        docs = cls.collection().find({"episode_id": cls.to_object_id(episode_id)}).sort("order", 1)
        return [cls.serialize(x) for x in docs]
