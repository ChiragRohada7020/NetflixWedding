def normalize_image_url(url):
    cleaned = (url or "").strip()
    if not cleaned:
        return "https://picsum.photos/seed/weddingflix-thumb/800/450"
    if cleaned.startswith("//"):
        return f"https:{cleaned}"
    if cleaned.startswith("www."):
        return f"https://{cleaned}"
    return cleaned
