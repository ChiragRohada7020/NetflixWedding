from flask import Flask
from flask_login import LoginManager
from flask_pymongo import PyMongo
from flask_jwt_extended import JWTManager

from app.config import config_map

mongo = PyMongo()
login_manager = LoginManager()
jwt = JWTManager()


def create_app(env_name="development"):
    app = Flask(__name__)
    app.config.from_object(config_map.get(env_name, config_map["development"]))

    mongo.init_app(app)
    login_manager.init_app(app)
    jwt.init_app(app)

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

    return app
