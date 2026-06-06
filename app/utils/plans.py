from bson import ObjectId
from flask_login import current_user

from app import mongo


DEFAULT_PLAN_ID = "free"
DEFAULT_PLAN = {
    "plan_id": DEFAULT_PLAN_ID,
    "name": "Free",
    "description": "Free Wedflix trial plan",
    "limits": {
        "wedding_limit": 1,
        "program_limit": 3,
        "episode_limit": 3,
        "photo_limit": 100,
    },
    "features": {
        "allow_public_access": True,
        "allow_drive_import": True,
    },
    "is_default": True,
    "active": True,
}


def ensure_default_plan():
    existing = mongo.db.plans.find_one({"plan_id": DEFAULT_PLAN_ID})
    if not existing:
        mongo.db.plans.insert_one(DEFAULT_PLAN.copy())
        return
    if existing.get("is_default") and not (existing.get("features") or {}).get("allow_public_access"):
        mongo.db.plans.update_one(
            {"plan_id": DEFAULT_PLAN_ID},
            {"$set": {"features.allow_public_access": True}},
        )


def is_developer(user=None):
    user = user or current_user
    return bool(getattr(user, "is_developer", False))


def normalize_plan(plan):
    plan = plan or DEFAULT_PLAN
    limits = {**DEFAULT_PLAN["limits"], **(plan.get("limits") or {})}
    features = {**DEFAULT_PLAN["features"], **(plan.get("features") or {})}
    return {**DEFAULT_PLAN, **plan, "limits": limits, "features": features}


def get_plan(plan_id):
    plan = mongo.db.plans.find_one({"plan_id": plan_id or DEFAULT_PLAN_ID, "active": {"$ne": False}})
    return normalize_plan(plan)


def get_current_plan():
    return get_plan(getattr(current_user, "plan_id", DEFAULT_PLAN_ID))


def user_id(user=None):
    user = user or current_user
    return str(getattr(user, "id", "") or "")


def can_manage_wedding(wedding, user=None):
    user = user or current_user
    if not wedding or not getattr(user, "is_authenticated", False):
        return False
    if is_developer(user):
        return True
    uid = user_id(user)
    owner_id = str(wedding.get("owner_user_id") or "")
    return owner_id == uid or str(wedding.get("_id")) in [str(x) for x in getattr(user, "wedding_ids", [])]


def can_edit_wedding(wedding, user=None):
    user = user or current_user
    if not wedding or not getattr(user, "is_authenticated", False):
        return False
    if is_developer(user):
        return True
    return str(wedding.get("owner_user_id") or "") == user_id(user)


def can_view_wedding(wedding, user=None):
    user = user or current_user
    if not wedding:
        return False
    if (wedding.get("access_level") or "private") == "public":
        return True
    return can_manage_wedding(wedding, user)


def owned_wedding_ids(user=None):
    user = user or current_user
    if is_developer(user):
        return [doc["_id"] for doc in mongo.db.weddings.find({}, {"_id": 1})]
    uid = user_id(user)
    ids = [doc["_id"] for doc in mongo.db.weddings.find({"owner_user_id": uid}, {"_id": 1})]
    for wid in getattr(user, "wedding_ids", []):
        try:
            oid = ObjectId(wid)
        except Exception:
            continue
        if oid not in ids:
            ids.append(oid)
    return ids


def count_weddings(user=None):
    return len(owned_wedding_ids(user))


def count_programs(user=None):
    wedding_ids = owned_wedding_ids(user)
    if not wedding_ids:
        return 0
    return mongo.db.programs.count_documents({"wedding_id": {"$in": wedding_ids}})


def count_episodes_for_program(program_id):
    return mongo.db.episodes.count_documents({"program_id": ObjectId(program_id)})


def count_photos(user=None):
    wedding_ids = owned_wedding_ids(user)
    if not wedding_ids:
        return 0
    program_ids = [doc["_id"] for doc in mongo.db.programs.find({"wedding_id": {"$in": wedding_ids}}, {"_id": 1})]
    if not program_ids:
        return 0
    episode_ids = [doc["_id"] for doc in mongo.db.episodes.find({"program_id": {"$in": program_ids}}, {"_id": 1})]
    filters = [{"program_id": {"$in": program_ids}}]
    if episode_ids:
        filters.append({"episode_id": {"$in": episode_ids}})
    return mongo.db.photos.count_documents({"$or": filters})


def usage_for_user(user_doc):
    class UserShim:
        is_authenticated = True

        def __init__(self, doc):
            self.id = str(doc["_id"])
            self.role = doc.get("role") or "admin"
            self.wedding_ids = [str(item) for item in doc.get("wedding_ids", [])]

        @property
        def is_developer(self):
            return (self.role or "").strip().lower() == "developer"

    shim = UserShim(user_doc)
    wedding_ids = owned_wedding_ids(shim)
    program_ids = [doc["_id"] for doc in mongo.db.programs.find({"wedding_id": {"$in": wedding_ids}}, {"_id": 1})] if wedding_ids else []
    episode_ids = [doc["_id"] for doc in mongo.db.episodes.find({"program_id": {"$in": program_ids}}, {"_id": 1})] if program_ids else []
    return {
        "weddings": len(wedding_ids),
        "programs": len(program_ids),
        "episodes": len(episode_ids),
        "photos": mongo.db.photos.count_documents({"$or": [{"program_id": {"$in": program_ids}}, {"episode_id": {"$in": episode_ids}}]}) if program_ids else 0,
    }


def limit_error(kind, add=1, program_id=None):
    if is_developer():
        return ""
    plan = get_current_plan()
    limits = plan["limits"]
    if kind == "wedding" and count_weddings() + add > int(limits.get("wedding_limit") or 0):
        return f"Your plan allows {limits['wedding_limit']} wedding profile."
    if kind == "program" and count_programs() + add > int(limits.get("program_limit") or 0):
        return f"Your plan allows {limits['program_limit']} functions."
    if kind == "episode" and count_episodes_for_program(program_id) + add > int(limits.get("episode_limit") or 0):
        return f"Your plan allows {limits['episode_limit']} events per function."
    if kind == "photo" and count_photos() + add > int(limits.get("photo_limit") or 0):
        return f"Your plan allows {limits['photo_limit']} photos."
    return ""


def public_access_allowed():
    return bool(is_developer() or get_current_plan()["features"].get("allow_public_access"))


def drive_import_allowed():
    return bool(is_developer() or get_current_plan()["features"].get("allow_drive_import"))
