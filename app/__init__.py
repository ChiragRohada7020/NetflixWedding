import os

from flask import Flask, flash, redirect, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_login import LoginManager
from flask_pymongo import PyMongo

from app.config import config_map

mongo = PyMongo()
login_manager = LoginManager()
jwt = JWTManager()


def create_app(env_name="development"):
    app = Flask(__name__)

    app.config.from_object(
        config_map.get(env_name, config_map["development"])
    )

    app.config["SESSION_COOKIE_SAMESITE"] = "None"
    app.config["SESSION_COOKIE_SECURE"] = True

    mongo.init_app(app)
    login_manager.init_app(app)
    jwt.init_app(app)

    frontend_origin = os.getenv(
        "FRONTEND_ORIGIN",
        "http://localhost:5173"
    )

    CORS(
        app,
        resources={
            r"/api/*": {"origins": [frontend_origin]},
            r"/auth/*": {"origins": [frontend_origin]},
            r"/admin/*": {"origins": [frontend_origin]},
        },
        supports_credentials=True,
    )

    login_manager.login_view = "auth.login"

    from app.routes.public import public_bp
    from app.routes.auth import auth_bp
    from app.routes.dashboard import dashboard_bp
    from app.routes.api import api_bp
    from app.admin.routes import admin_bp

    app.register_blueprint(public_bp)
    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(dashboard_bp, url_prefix="/weddings")
    app.register_blueprint(api_bp, url_prefix="/api")
    app.register_blueprint(admin_bp, url_prefix="/admin")

    from app.models.user import User

    @login_manager.user_loader
    def load_user(user_id):
        return User.get_by_id(user_id)

    def ensure_default_users():
        admin_email = os.getenv(
            "DEFAULT_ADMIN_EMAIL",
            "admin@weddingflix.com"
        )

        admin_password = os.getenv(
            "DEFAULT_ADMIN_PASSWORD",
            "admin123"
        )

        guest_email = os.getenv(
            "DEFAULT_GUEST_EMAIL",
            "guest@weddingflix.com"
        )

        guest_password = os.getenv(
            "DEFAULT_GUEST_PASSWORD",
            "guest123"
        )

        if not User.get_by_email(admin_email):
            User.create(
                name="Admin",
                email=admin_email,
                password=admin_password,
                role="admin",
                wedding_ids=[],
            )

        if not User.get_by_email(guest_email):
            User.create(
                name="Guest",
                email=guest_email,
                password=guest_password,
                role="guest",
                wedding_ids=[],
            )

    with app.app_context():
        ensure_default_users()

    @app.errorhandler(413)
    def request_entity_too_large(_error):
        flash(
            "Upload is too large. Please use a smaller file.",
            "error",
        )
        return redirect(request.referrer or "/")

    return app