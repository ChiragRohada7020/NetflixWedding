from app.models.base import BaseModel


class Wedding(BaseModel):
    collection_name = "weddings"

    @classmethod
    def all(cls):
        return [cls.serialize(x) for x in cls.collection().find().sort("wedding_date", 1)]

    @classmethod
    def get(cls, wedding_id):
        return cls.serialize(cls.collection().find_one({"_id": cls.to_object_id(wedding_id)}))

    @classmethod
    def create(cls, payload):
        inserted = cls.collection().insert_one(payload)
        return str(inserted.inserted_id)
