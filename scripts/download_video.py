#!/usr/bin/env python3
"""
Video downloader using yt-dlp.

Use only for videos you own, have permission to download, or that are otherwise
available for lawful download.
"""

import argparse
import os
import subprocess
import sys


def install_ytdlp():
    try:
        import yt_dlp  # noqa: F401
    except ImportError:
        print("Installing yt-dlp...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "yt-dlp"])
        print("yt-dlp installed successfully.\n")


def build_format(quality, audio_only):
    if audio_only:
        return "bestaudio/best"
    if quality == "best":
        return "bestvideo+bestaudio/best"
    if quality == "worst":
        return "worstvideo+worstaudio/worst"
    return f"bestvideo[height<={quality}]+bestaudio/best[height<={quality}]/best"


def download_video(url, output_dir="downloads", quality="720", audio_only=False):
    import yt_dlp

    os.makedirs(output_dir, exist_ok=True)
    ydl_opts = {
        "format": build_format(quality, audio_only),
        "outtmpl": os.path.join(output_dir, "%(title)s.%(ext)s"),
        "merge_output_format": "mp4",
        "quiet": False,
        "no_warnings": False,
        "progress": True,
    }

    if audio_only:
        ydl_opts["postprocessors"] = [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }
        ]

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        print(f"\nDownloading: {url}")
        print(f"Saving to  : {os.path.abspath(output_dir)}")
        print(f"Quality    : {'audio only (MP3)' if audio_only else quality}\n")
        info = ydl.extract_info(url, download=True)
        title = info.get("title", "Unknown")
        print(f"\nDone. Downloaded: {title}")
        return title


def get_video_info(url):
    import yt_dlp

    ydl_opts = {"quiet": True, "no_warnings": True}
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        print("\nVideo Info")
        print(f"   Title    : {info.get('title')}")
        print(f"   Uploader : {info.get('uploader')}")
        print(f"   Duration : {info.get('duration_string', 'N/A')}")
        views = info.get("view_count")
        print(f"   Views    : {views:,}" if views else "   Views    : N/A")

        formats = info.get("formats", [])
        heights = sorted({f.get("height") for f in formats if f.get("height")}, reverse=True)
        qualities = ", ".join(f"{height}p" for height in heights[:6]) or "N/A"
        print(f"   Qualities: {qualities}\n")


def parse_args():
    parser = argparse.ArgumentParser(description="Download videos with yt-dlp.")
    parser.add_argument("url", nargs="?", help="Video URL to download.")
    parser.add_argument("-o", "--output-dir", default="downloads", help="Folder to save the video.")
    parser.add_argument(
        "-q",
        "--quality",
        default="720",
        choices=["best", "worst", "1080", "720", "480", "360"],
        help="Download quality.",
    )
    parser.add_argument("--audio-only", action="store_true", help="Download MP3 audio only.")
    parser.add_argument("--info", action="store_true", help="Show video info before downloading.")
    return parser.parse_args()


def main():
    args = parse_args()
    if not args.url:
        print("Please provide a video URL.")
        print("Example: python scripts/download_video.py \"https://example.com/video\" --quality 720")
        return 2

    install_ytdlp()
    if args.info:
        get_video_info(args.url)
    download_video(args.url, args.output_dir, args.quality, args.audio_only)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
