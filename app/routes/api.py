from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from app.models.comment import Comment

api_bp = Blueprint("api", __name__)


@api_bp.route("/episodes/<episode_id>/comments", methods=["GET", "POST"])
@login_required
def episode_comments(episode_id):
    if request.method == "GET":
        return jsonify(Comment.by_episode(episode_id))

    payload = request.get_json(force=True)
    text = (payload.get("text") or "").strip()
    if not text:
        return jsonify({"error": "Comment text is required"}), 400

    Comment.add(episode_id=episode_id, user_name=current_user.name, text=text)
    return jsonify({"status": "ok"}), 201


@api_bp.route("/episodes/<episode_id>/like", methods=["POST"])
@login_required
def like_episode(episode_id):
    return jsonify({"status": "ok", "episode_id": episode_id})
