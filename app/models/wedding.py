import re

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
    def get_by_public_slug(cls, public_slug):
        return cls.serialize(cls.collection().find_one({"public_slug": public_slug}))

    @staticmethod
    def slugify(value, fallback="wedding"):
        slug = re.sub(r"[^a-z0-9]+", "-", (value or "").strip().lower()).strip("-")
        return slug or fallback

    @classmethod
    def unique_public_slug(cls, value, exclude_id=None):
        base = cls.slugify(value)
        slug = base
        suffix = 2
        query = {"public_slug": slug}
        if exclude_id:
            query["_id"] = {"$ne": cls.to_object_id(exclude_id)}
        while cls.collection().find_one(query):
            slug = f"{base}-{suffix}"
            suffix += 1
            query = {"public_slug": slug}
            if exclude_id:
                query["_id"] = {"$ne": cls.to_object_id(exclude_id)}
        return slug

    @classmethod
    def create(cls, payload):
        if not payload.get("public_slug"):
            payload["public_slug"] = cls.unique_public_slug(payload.get("couple_names") or "wedding")
        inserted = cls.collection().insert_one(payload)
        return str(inserted.inserted_id)
