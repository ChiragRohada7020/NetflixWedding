from datetime import datetime

from app.models.base import BaseModel


class Program(BaseModel):
    collection_name = "programs"
    invitation_section_keys = {"invitation", "invite", "prewedding", "pre-wedding"}

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
    def by_wedding(cls, wedding_id, include_invitation=False):
        query = {"wedding_id": cls.to_object_id(wedding_id)}
        if not include_invitation:
            query["section_key"] = {"$nin": sorted(cls.invitation_section_keys)}
        docs = [cls.serialize(x) for x in cls.collection().find(query)]
        docs.sort(key=lambda p: (p.get("order", 0), cls._date_key(p.get("event_date")), p.get("title", "")))
        return docs

    @classmethod
    def get(cls, program_id):
        return cls.serialize(cls.collection().find_one({"_id": cls.to_object_id(program_id)}))

    @classmethod
    def create(cls, payload):
        inserted = cls.collection().insert_one(payload)
        return str(inserted.inserted_id)
