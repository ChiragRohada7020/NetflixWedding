from datetime import datetime

from app.models.base import BaseModel


class Program(BaseModel):
    collection_name = "programs"

    @staticmethod
    def _date_key(value):
        if not value:
            return datetime.max
        for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
            try:
                return datetime.strptime(str(value), fmt)
            except ValueError:
                continue
        return datetime.max

    @classmethod
    def by_wedding(cls, wedding_id):
        docs = [cls.serialize(x) for x in cls.collection().find({"wedding_id": cls.to_object_id(wedding_id)})]
        docs.sort(key=lambda p: (cls._date_key(p.get("event_date")), p.get("order", 0), p.get("title", "")))
        return docs

    @classmethod
    def get(cls, program_id):
        return cls.serialize(cls.collection().find_one({"_id": cls.to_object_id(program_id)}))

    @classmethod
    def create(cls, payload):
        inserted = cls.collection().insert_one(payload)
        return str(inserted.inserted_id)
