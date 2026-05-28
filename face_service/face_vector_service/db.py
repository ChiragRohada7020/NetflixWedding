from pymongo import MongoClient

from .config import config


if not config.MONGO_URI:
    raise RuntimeError("MONGO_URI is required for the face vector service.")

client = MongoClient(config.MONGO_URI)
db = client.get_default_database()
