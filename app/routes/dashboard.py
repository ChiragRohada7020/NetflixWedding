from collections import defaultdict

from bson import ObjectId
from flask import Blueprint, abort, redirect, render_template, request, url_for
from flask_login import current_user

from app import mongo
from app.models.comment import Comment
from app.models.episode import Episode
from app.models.photo import Photo
from app.models.program import Program
from app.models.wedding import Wedding
from app.utils.video import youtube_embed_url


dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.route("/<wedding_id>")
def wedding_dashboard(wedding_id):
    wedding = Wedding.get(wedding_id)
    if not wedding:
        abort(404)
    if (wedding.get("access_level") or "private") != "public" and not current_user.is_authenticated:
        return redirect(url_for("auth.login"))

    wedding["hero_embed_url"] = youtube_embed_url(wedding.get("hero_video_url"))
    programs = Program.by_wedding(wedding_id)

    q = (request.args.get("q") or "").strip()
    event_results = []
    if q and programs:
        program_ids = [ObjectId(p["_id"]) for p in programs if p.get("_id")]
        episodes = list(
            mongo.db.episodes.find(
                {
                    "program_id": {"$in": program_ids},
                    "$or": [
                        {"title": {"$regex": q, "$options": "i"}},
                        {"description": {"$regex": q, "$options": "i"}},
                    ],
                }
            ).sort("order", 1).limit(30)
        )
        program_map = {p["_id"]: p for p in programs}
        for e in episodes:
            program = program_map.get(str(e.get("program_id")))
            if not program:
                continue
            event_results.append(
                {
                    "program_id": str(e.get("program_id")),
                    "episode_id": str(e.get("_id")),
                    "title": e.get("title") or "Untitled Event",
                    "program_title": program.get("title") or "Program",
                    "thumbnail": e.get("thumbnail") or "https://picsum.photos/seed/search-event/800/450",
                }
            )

    return render_template(
        "dashboard/home.html",
        wedding=wedding,
        programs=programs,
        q=q,
        event_results=event_results,
        page_music_url=wedding.get("music_url", ""),
    )


@dashboard_bp.route("/<wedding_id>/programs/<program_id>")
def program_detail(wedding_id, program_id):
    wedding = Wedding.get(wedding_id)
    program = Program.get(program_id)
    if not wedding or not program:
        abort(404)
    if (wedding.get("access_level") or "private") != "public" and not current_user.is_authenticated:
        return redirect(url_for("auth.login"))

    episodes = Episode.by_program(program_id)
    program_hero_embed_url = program.get("hero_embed_url") or youtube_embed_url(program.get("hero_video_url"))
    if not program_hero_embed_url and episodes:
        program_hero_embed_url = episodes[0].get("embed_url") or ""

    seasons_map = defaultdict(list)
    for ep in episodes:
        season = ep.get("season_number") or 1
        seasons_map[int(season)].append(ep)

    seasons = sorted(seasons_map.items(), key=lambda x: x[0])
    return render_template(
        "program/detail.html",
        wedding=wedding,
        program=program,
        episodes=episodes,
        seasons=seasons,
        program_hero_embed_url=program_hero_embed_url,
        page_music_url=program.get("music_url") or wedding.get("music_url", ""),
    )


@dashboard_bp.route("/<wedding_id>/programs/<program_id>/episodes/<episode_id>")
def episode_detail(wedding_id, program_id, episode_id):
    wedding = Wedding.get(wedding_id)
    program = Program.get(program_id)
    episode = Episode.get(episode_id)
    if not wedding or not program or not episode:
        abort(404)
    if (wedding.get("access_level") or "private") != "public" and not current_user.is_authenticated:
        return redirect(url_for("auth.login"))
    photos = Photo.by_episode(episode_id)
    comments = Comment.by_episode(episode_id)
    episode_video_url = (episode.get("embed_url") or "").strip()
    if episode_video_url:
        joiner = "&" if "?" in episode_video_url else "?"
        episode_video_url = (
            f"{episode_video_url}{joiner}"
            "autoplay=1&mute=0&controls=1&rel=0&playsinline=1&"
            "iv_load_policy=3&modestbranding=1&enablejsapi=1"
        )
    return render_template(
        "episode/detail.html",
        wedding=wedding,
        program=program,
        episode=episode,
        episode_video_url=episode_video_url,
        photos=photos,
        comments=comments,
        page_music_url="",
    )
