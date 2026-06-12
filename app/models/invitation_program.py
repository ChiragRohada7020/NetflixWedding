from datetime import datetime

from bson import ObjectId

from app.models.base import BaseModel


class InvitationProgram(BaseModel):
    collection_name = "invitation_programs"
    legacy_section_keys = {"invitation", "invite", "prewedding", "pre-wedding"}

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
        cls.migrate_legacy_for_wedding(wedding_id)
        docs = [cls.serialize(x) for x in cls.collection().find({"wedding_id": cls.to_object_id(wedding_id)})]
        docs.sort(key=lambda p: (p.get("order", 0), cls._date_key(p.get("event_date")), p.get("title", "")))
        return docs

    @classmethod
    def migrate_legacy_for_wedding(cls, wedding_id):
        from app import mongo

        wid = cls.to_object_id(wedding_id)
        legacy_docs = list(
            mongo.db.programs.find(
                {
                    "wedding_id": wid,
                    "section_key": {"$in": sorted(cls.legacy_section_keys)},
                }
            )
        )
        if not legacy_docs:
            return

        legacy_ids = []
        for doc in legacy_docs:
            legacy_id = doc.get("_id")
            if not isinstance(legacy_id, ObjectId):
                continue
            exists = cls.collection().find_one({"legacy_program_id": legacy_id})
            legacy_ids.append(legacy_id)
            if exists:
                continue
            next_doc = {k: v for k, v in doc.items() if k != "_id"}
            next_doc["legacy_program_id"] = legacy_id
            cls.collection().insert_one(next_doc)

        if legacy_ids:
            mongo.db.programs.delete_many({"_id": {"$in": legacy_ids}})

    @classmethod
    def get(cls, program_id):
        return cls.serialize(cls.collection().find_one({"_id": cls.to_object_id(program_id)}))

    @classmethod
    def create(cls, payload):
        inserted = cls.collection().insert_one(payload)
        return str(inserted.inserted_id)
