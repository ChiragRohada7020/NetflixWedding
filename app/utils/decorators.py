from functools import wraps

from flask import abort, current_app
from flask_login import current_user


def admin_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if current_app.config.get("LOGIN_DISABLED"):
            return view(*args, **kwargs)
        if (
            not current_user.is_authenticated
            or not getattr(current_user, "is_admin", False)
            or not getattr(current_user, "is_active", True)
        ):
            abort(403)
        return view(*args, **kwargs)

    return wrapped
