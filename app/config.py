import os


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "change-me")
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/weddingflix")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-jwt-secret")
    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "app/static/uploads")


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False


config_map = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
}
