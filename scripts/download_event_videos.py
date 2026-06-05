#!/usr/bin/env python3
"""
Download event videos stored in MongoDB.

Use only for videos you own, have permission to download, or that are otherwise
available for lawful download.
"""

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

from download_video import download_video, install_ytdlp


def ensure_dependencies():
    try:
        import bson  # noqa: F401
        import dotenv  # noqa: F401
        import pymongo  # noqa: F401
    except ImportError:
        print("Installing MongoDB script dependencies...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pymongo", "python-dotenv"])
        print("Dependencies installed.\n")


def clean_name(value, fallback="untitled"):
    text = re.sub(r"[<>:\"/\\|?*\x00-\x1f]+", "-", str(value or "").strip())
    text = re.sub(r"\s+", " ", text).strip(" .-")
    return text[:90] or fallback


def normalize_video_url(url):
    url = str(url or "").strip()
    if not url:
        return ""
    match = re.search(r"youtube\.com/embed/([a-zA-Z0-9_-]{11})", url)
    if match:
        return f"https://www.youtube.com/watch?v={match.group(1)}"
    return url


def first_video_url(event):
    for key in ("youtube_url", "video_url", "embed_url"):
        url = normalize_video_url(event.get(key))
        if url:
            return url
    return ""


def object_id(value):
    from bson import ObjectId

    if not value:
        return None
    return ObjectId(str(value))


def connect_db():
    from dotenv import load_dotenv
    from pymongo import MongoClient

    load_dotenv(".env")
    mongo_uri = os.getenv("MONGO_URI", "").strip().strip('"')
    if not mongo_uri:
        raise SystemExit("MONGO_URI is missing in .env")
    client = MongoClient(mongo_uri)
    return client.get_default_database()


def build_context(db):
    weddings = {doc["_id"]: doc for doc in db.weddings.find({})}
    programs = {doc["_id"]: doc for doc in db.programs.find({})}
    return weddings, programs


def event_matches(event, program, args):
    if args.episode_id and event.get("_id") != object_id(args.episode_id):
        return False
    if args.program_id and event.get("program_id") != object_id(args.program_id):
        return False
    if args.wedding_id:
        if not program or program.get("wedding_id") != object_id(args.wedding_id):
            return False
    if args.search:
        haystack = " ".join(
            str(part or "")
            for part in (
                event.get("title"),
                event.get("description"),
                event.get("youtube_url"),
                event.get("video_url"),
                event.get("embed_url"),
            )
        ).lower()
        if args.search.lower() not in haystack:
            return False
    return True


def find_events(db, args):
    weddings, programs = build_context(db)
    events = []
    for event in db.episodes.find({}).sort([("program_id", 1), ("order", 1), ("title", 1)]):
        program = programs.get(event.get("program_id"))
        wedding = weddings.get(program.get("wedding_id")) if program else None
        url = first_video_url(event)
        if not url or not event_matches(event, program, args):
            continue
        events.append({"event": event, "program": program, "wedding": wedding, "url": url})
        if args.limit and len(events) >= args.limit:
            break
    return events


def print_events(items):
    if not items:
        print("No event video links found.")
        return
    for index, item in enumerate(items, start=1):
        event = item["event"]
        program = item["program"] or {}
        wedding = item["wedding"] or {}
        print(f"{index}. {wedding.get('couple_names') or 'Wedding'} / {program.get('title') or 'Program'} / {event.get('title') or 'Event'}")
        print(f"   event_id  : {event['_id']}")
        print(f"   program_id: {event.get('program_id')}")
        print(f"   url       : {item['url']}")


def download_events(items, args):
    install_ytdlp()
    for item in items:
        event = item["event"]
        program = item["program"] or {}
        wedding = item["wedding"] or {}
        output_dir = Path(args.output_dir)
        output_dir = output_dir / clean_name(wedding.get("couple_names"), "wedding")
        output_dir = output_dir / clean_name(program.get("title"), "program")
        output_dir = output_dir / clean_name(event.get("title"), "event")
        download_video(
            item["url"],
            output_dir=str(output_dir),
            quality=args.quality,
            audio_only=args.audio_only,
        )


def parse_args():
    parser = argparse.ArgumentParser(description="Download video links saved in Wedflix event records.")
    parser.add_argument("--list", action="store_true", help="List matching event video links without downloading.")
    parser.add_argument("--wedding-id", help="Only include events under this wedding id.")
    parser.add_argument("--program-id", help="Only include events under this program id.")
    parser.add_argument("--episode-id", help="Only download/list this event id.")
    parser.add_argument("--search", help="Only include events whose title/description/url contains this text.")
    parser.add_argument("--limit", type=int, default=0, help="Maximum number of events to process.")
    parser.add_argument("-o", "--output-dir", default="downloads/events", help="Folder to save event videos.")
    parser.add_argument(
        "-q",
        "--quality",
        default="720",
        choices=["best", "worst", "1080", "720", "480", "360"],
        help="Download quality.",
    )
    parser.add_argument("--audio-only", action="store_true", help="Download MP3 audio only.")
    return parser.parse_args()


def main():
    ensure_dependencies()
    args = parse_args()
    db = connect_db()
    items = find_events(db, args)
    print_events(items)
    if args.list:
        return 0
    if not items:
        return 1
    download_events(items, args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
