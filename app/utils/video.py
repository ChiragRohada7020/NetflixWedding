import re


def youtube_video_id(url):
    patterns = [
        r"v=([a-zA-Z0-9_-]{11})",
        r"youtu\.be/([a-zA-Z0-9_-]{11})",
        r"embed/([a-zA-Z0-9_-]{11})",
    ]
    for p in patterns:
        m = re.search(p, url or "")
        if m:
            return m.group(1)
    return ""


def youtube_embed_url(url):
    video_id = youtube_video_id(url)
    if video_id:
        return f"https://www.youtube-nocookie.com/embed/{video_id}"
    return url
