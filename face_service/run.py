import os
import threading

from face_vector_service.api import create_app
from face_vector_service.worker import run_forever

app = create_app()

if os.getenv("FACE_WORKER_ENABLED", "1") == "1":
    thread = threading.Thread(target=run_forever, name="face-vector-worker", daemon=True)
    thread.start()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=app.config["PORT"])
