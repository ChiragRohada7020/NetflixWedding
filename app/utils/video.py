import re


def youtube_embed_url(url):
    patterns = [
        r"v=([a-zA-Z0-9_-]{11})",
        r"youtu\.be/([a-zA-Z0-9_-]{11})",
        r"embed/([a-zA-Z0-9_-]{11})",
    ]
    for p in patterns:
        m = re.search(p, url or "")
        if m:
            return f"https://www.youtube-nocookie.com/embed/{m.group(1)}"
    return url
