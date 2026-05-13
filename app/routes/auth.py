from flask import Blueprint, flash, redirect, render_template, request, url_for
from flask_login import login_required, login_user, logout_user

from app.models.user import User

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email", "")
        password = request.form.get("password", "")
        user_doc = User.get_by_email(email)
        if not user_doc:
            flash("Invalid credentials", "error")
            return render_template("auth/login.html")
        user = User.get_by_id(str(user_doc["_id"]))
        if not user or not user.check_password(password):
            flash("Invalid credentials", "error")
            return render_template("auth/login.html")

        login_user(user)
        return redirect(url_for("public.landing"))

    return render_template("auth/login.html")


@auth_bp.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("public.landing"))
