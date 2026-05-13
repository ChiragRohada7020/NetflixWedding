import os
import uuid
from werkzeug.utils import secure_filename


def save_uploaded_audio(file_storage, upload_root, max_bytes=8 * 1024 * 1024):
    if not file_storage or not file_storage.filename:
        return ""

    ext = os.path.splitext(file_storage.filename)[1].lower()
    allowed = {".mp3", ".wav", ".ogg", ".m4a"}
    if ext not in allowed:
        return ""

    folder = os.path.join(upload_root, "audio")
    os.makedirs(folder, exist_ok=True)

    filename = secure_filename(file_storage.filename)
    unique = f"{uuid.uuid4().hex}_{filename}"
    path = os.path.join(folder, unique)

    written = 0
    try:
        with open(path, "wb") as out:
            while True:
                chunk = file_storage.stream.read(1024 * 1024)
                if not chunk:
                    break
                written += len(chunk)
                if written > max_bytes:
                    out.close()
                    os.remove(path)
                    return ""
                out.write(chunk)
    except OSError:
        if os.path.exists(path):
            os.remove(path)
        return ""

    return f"/static/uploads/audio/{unique}"


def save_uploaded_image(file_storage, upload_root):
    if not file_storage or not file_storage.filename:
        return ""

    ext = os.path.splitext(file_storage.filename)[1].lower()
    allowed = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    if ext not in allowed:
        return ""

    folder = os.path.join(upload_root, "thumbnails")
    os.makedirs(folder, exist_ok=True)

    filename = secure_filename(file_storage.filename)
    unique = f"{uuid.uuid4().hex}_{filename}"
    path = os.path.join(folder, unique)
    file_storage.save(path)
    return f"/static/uploads/thumbnails/{unique}"
