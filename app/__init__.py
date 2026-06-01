import os

from flask import Flask, flash, jsonify, redirect, request
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

    @app.after_request
    def add_cors_headers(response):
        origin = request.headers.get("Origin")
        if origin in cors_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Headers"] = request.headers.get(
                "Access-Control-Request-Headers",
                "Content-Type, X-Wedflix-Fetch",
            )
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, DELETE, OPTIONS"
            response.headers["Access-Control-Max-Age"] = "0"
            response.headers.add("Vary", "Origin")
        elif response.headers.get("Access-Control-Allow-Origin") == "*":
            response.headers.pop("Access-Control-Allow-Origin", None)
            response.headers.pop("Access-Control-Allow-Credentials", None)
        if request.path.startswith("/static/uploads/"):
            response.headers["Cache-Control"] = "public, max-age=604800, stale-while-revalidate=86400"
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
        from app.utils.plans import ensure_default_plan
        ensure_default_plan()

        developer_email = os.getenv(
            "DEFAULT_DEVELOPER_EMAIL",
            "developer@wedflix.com"
        )

        developer_password = os.getenv(
            "DEFAULT_DEVELOPER_PASSWORD",
            "developer123"
        )

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

        existing_developer = User.get_by_email(developer_email)
        if not existing_developer:
            User.create(
                name="Developer Admin",
                email=developer_email,
                password=developer_password,
                role="developer",
                wedding_ids=[],
            )
        elif (existing_developer.get("role") or "") != "developer":
            mongo.db.users.update_one(
                {"_id": existing_developer["_id"]},
                {"$set": {"role": "developer", "status": "active", "plan_id": "free"}},
            )

        existing_admin = User.get_by_email(admin_email)
        if not existing_admin:
            User.create(
                name="Demo Admin",
                email=admin_email,
                password=admin_password,
                role="admin",
                wedding_ids=[],
                status="active",
                plan_id="free",
            )
        elif admin_email != developer_email:
            mongo.db.users.update_one(
                {"_id": existing_admin["_id"]},
                {"$set": {"role": "admin", "status": "active", "plan_id": existing_admin.get("plan_id") or "free"}},
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
