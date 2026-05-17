from flask import Blueprint, flash, make_response, redirect, render_template_string, request, url_for
from flask_login import login_required, login_user, logout_user

from app.models.user import User

auth_bp = Blueprint("auth", __name__)

LOGIN_PAGE_HTML = """
<!doctype html>
<html lang=\"en\" style=\"height:100%;overflow:hidden;\">
<head>
  <meta charset=\"UTF-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
  <title>Login | Wedflix</title>
  <script src=\"https://cdn.tailwindcss.com\"></script>
  <style>
    html, body { height: 100%; margin: 0; overflow: hidden; background: #000; }
  </style>
</head>
<body class=\"text-white\">
  <div class=\"fixed inset-0 bg-black z-[99999]\">
    <div class=\"absolute inset-0 overflow-y-auto\">
      <div class=\"min-h-full w-full flex items-center justify-center p-4\">
        <div class=\"w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-2xl p-6 md:p-8\">
          <h1 class=\"text-3xl font-bold mb-2\">Welcome Back</h1>
          <p class=\"text-zinc-300 mb-6\">Login with admin email and password.</p>
          {% if message %}
            <div class=\"mb-4 bg-red-500/20 border border-red-400/50 rounded p-2 text-sm\">{{ message }}</div>
          {% endif %}
          <form method=\"post\" class=\"space-y-4\">
            <input type=\"hidden\" name=\"next\" value=\"{{ next_url }}\">
            <input name=\"email\" type=\"email\" required placeholder=\"Enter email\" class=\"w-full p-3 rounded bg-zinc-800 border border-zinc-600\" />
            <input name=\"password\" type=\"password\" required placeholder=\"Enter password\" class=\"w-full p-3 rounded bg-zinc-800 border border-zinc-600\" />
            <button type=\"submit\" class=\"w-full bg-red-600 hover:bg-red-500 rounded p-3 font-semibold\">Login</button>
          </form>
          <a href=\"{{ home_url }}\" class=\"inline-block mt-5 text-sm text-zinc-300 hover:text-white\">Back to Home</a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
"""


def _next_url(default_endpoint="public.landing"):
    nxt = (request.values.get("next") or "").strip()
    if nxt.startswith("http://localhost:") or nxt.startswith("http://127.0.0.1:"):
        return nxt
    return url_for(default_endpoint)


def _render_login(message=""):
    html = render_template_string(
        LOGIN_PAGE_HTML,
        next_url=_next_url("public.landing"),
        home_url=url_for("public.landing"),
        message=message,
    )
    resp = make_response(html)
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email", "")
        password = request.form.get("password", "")
        user_doc = User.get_by_email(email)
        if not user_doc:
            return _render_login("Invalid credentials")
        user = User.get_by_id(str(user_doc["_id"]))
        if not user or not user.check_password(password):
            return _render_login("Invalid credentials")

        login_user(user)
        return redirect(_next_url("public.landing"))

    return _render_login()


@auth_bp.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(_next_url("public.landing"))
