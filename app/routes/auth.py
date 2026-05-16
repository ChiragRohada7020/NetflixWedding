from flask import Blueprint, flash, redirect, render_template, request, url_for
from flask_login import login_required, login_user, logout_user

from app.models.user import User

auth_bp = Blueprint("auth", __name__)

def _next_url(default_endpoint="public.landing"):
    nxt = (request.values.get("next") or "").strip()
    if nxt.startswith("http://localhost:") or nxt.startswith("http://127.0.0.1:"):
        return nxt
    return url_for(default_endpoint)


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
        return redirect(_next_url("public.landing"))

    return render_template("auth/login.html", next_url=_next_url("public.landing"))


@auth_bp.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(_next_url("public.landing"))
