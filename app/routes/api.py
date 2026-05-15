from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from app.models.comment import Comment
from app.models.episode import Episode
from app.models.program import Program
from app.models.wedding import Wedding

api_bp = Blueprint("api", __name__)


@api_bp.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@api_bp.route("/weddings", methods=["GET"])
def weddings():
    docs = Wedding.all()
    if not current_user.is_authenticated:
        docs = [w for w in docs if (w.get("access_level") or "private") == "public"]
    return jsonify(docs)


@api_bp.route("/weddings/<wedding_id>", methods=["GET"])
def wedding_detail(wedding_id):
    wedding = Wedding.get(wedding_id)
    if not wedding:
        return jsonify({"error": "Wedding not found"}), 404
    if (wedding.get("access_level") or "private") != "public" and not current_user.is_authenticated:
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify(wedding)


@api_bp.route("/weddings/<wedding_id>/programs", methods=["GET"])
def wedding_programs(wedding_id):
    wedding = Wedding.get(wedding_id)
    if not wedding:
        return jsonify({"error": "Wedding not found"}), 404
    if (wedding.get("access_level") or "private") != "public" and not current_user.is_authenticated:
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify(Program.by_wedding(wedding_id))


@api_bp.route("/programs/<program_id>/episodes", methods=["GET"])
def program_episodes(program_id):
    program = Program.get(program_id)
    if not program:
        return jsonify({"error": "Program not found"}), 404
    wedding = Wedding.get(str(program.get("wedding_id")))
    if not wedding:
        return jsonify({"error": "Wedding not found"}), 404
    if (wedding.get("access_level") or "private") != "public" and not current_user.is_authenticated:
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify(Episode.by_program(program_id))


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
