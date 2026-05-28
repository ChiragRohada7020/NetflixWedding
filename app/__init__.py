import os

from flask import Flask, flash, jsonify, redirect, request
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

    is_production = env_name == "production" or os.getenv("RENDER") == "true"
    app.config["SESSION_COOKIE_SAMESITE"] = "None" if is_production else "Lax"
    app.config["SESSION_COOKIE_SECURE"] = is_production
    app.config["REMEMBER_COOKIE_SAMESITE"] = "None" if is_production else "Lax"
    app.config["REMEMBER_COOKIE_SECURE"] = is_production

    mongo.init_app(app)
    login_manager.init_app(app)
    jwt.init_app(app)

    configured_origins = os.getenv("FRONTEND_ORIGINS") or os.getenv("FRONTEND_ORIGIN") or ""
    cors_origins = {
        "https://netflix-wedding-eta.vercel.app",
        "https://wedflix.space",
        "https://www.wedflix.space",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    }
    cors_origins.update(
        origin.strip().rstrip("/")
        for origin in configured_origins.split(",")
        if origin.strip() and origin.strip() != "*"
    )

    CORS(
        app,
        origins=sorted(cors_origins),
        supports_credentials=True,
        vary_header=True,
    )

    @app.after_request
    def add_local_cors_headers(response):
        origin = request.headers.get("Origin")
        if origin in cors_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Wedflix-Fetch"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, DELETE, OPTIONS"
            response.headers.add("Vary", "Origin")
        return response

    login_manager.login_view = "auth.login"

    @login_manager.unauthorized_handler
    def unauthorized():
        if request.headers.get("X-Wedflix-Fetch") == "1":
            return jsonify({"error": "Login required"}), 401
        return redirect(f"{app.config.get('APPLICATION_ROOT', '')}/auth/login?next={request.path}")

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
        if request.headers.get("X-Wedflix-Fetch") == "1":
            return jsonify({"error": "Upload is too large. Please use a smaller file."}), 413
        flash(
            "Upload is too large. Please use a smaller file.",
            "error",
        )
        return redirect(request.referrer or "/")

    @app.errorhandler(403)
    def forbidden(_error):
        if request.headers.get("X-Wedflix-Fetch") == "1":
            return jsonify({"error": "Admin access required"}), 403
        return "Forbidden", 403

    return app
