from app.models.base import BaseModel


class Episode(BaseModel):
    collection_name = "episodes"

    @classmethod
    def by_program(cls, program_id):
        docs = cls.collection().find({"program_id": cls.to_object_id(program_id)}).sort("order", 1)
        return [cls.serialize(x) for x in docs]

    @classmethod
    def get(cls, episode_id):
        return cls.serialize(cls.collection().find_one({"_id": cls.to_object_id(episode_id)}))

    @classmethod
    def create(cls, payload):
        inserted = cls.collection().insert_one(payload)
        return str(inserted.inserted_id)
