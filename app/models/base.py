from bson import ObjectId


class BaseModel:
    collection_name = None

    @classmethod
    def collection(cls):
        from app import mongo

        return mongo.db[cls.collection_name]

    @staticmethod
    def to_object_id(value):
        if isinstance(value, ObjectId):
            return value
        return ObjectId(value)

    @classmethod
    def serialize(cls, doc):
        if not doc:
            return None
        doc["_id"] = str(doc["_id"])
        return doc
