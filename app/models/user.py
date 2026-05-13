from flask_login import UserMixin
from werkzeug.security import check_password_hash, generate_password_hash

from app.models.base import BaseModel


class User(BaseModel, UserMixin):
    collection_name = "users"

    @classmethod
    def create(cls, name, email, password, role="guest", wedding_ids=None):
        payload = {
            "name": name,
            "email": email.lower(),
            "password_hash": generate_password_hash(password),
            "role": role,
            "wedding_ids": wedding_ids or [],
        }
        inserted = cls.collection().insert_one(payload)
        return str(inserted.inserted_id)

    @classmethod
    def get_by_email(cls, email):
        return cls.collection().find_one({"email": email.lower()})

    @classmethod
    def get_by_id(cls, user_id):
        doc = cls.collection().find_one({"_id": cls.to_object_id(user_id)})
        if not doc:
            return None
        return UserRecord(doc)


class UserRecord(UserMixin):
    def __init__(self, doc):
        self.doc = doc
        self.id = str(doc["_id"])
        self.name = doc.get("name")
        self.email = doc.get("email")
        self.role = doc.get("role", "guest")
        self.wedding_ids = [str(w) for w in doc.get("wedding_ids", [])]

    def check_password(self, password):
        return check_password_hash(self.doc.get("password_hash", ""), password)

    @property
    def is_admin(self):
        return self.role == "admin"
