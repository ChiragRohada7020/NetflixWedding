# Wedflix Face Vector Service

This service runs outside the main Wedflix app. It reads queued photo jobs from MongoDB, converts faces into embeddings, and writes results back to MongoDB.

The main Flask app only creates lightweight `face_jobs` records when `FACE_INDEX_ENABLED=1`. It does not load face models.

## Collections

- `face_jobs`: queued background work.
- `photo_faces`: one document per detected face/vector.
- `photos.face_index_status`: `queued`, `processing`, `ready`, `no_face`, or `failed`.

## Setup

1. Create `face_service/.env` from `face_service/.env.example`.
2. Install dependencies on the separate server:
   ```bash
   pip install -r face_service/requirements.txt
   ```
3. Start the combined API + worker service:
   ```bash
   gunicorn run:app
   ```

For local testing, you can also run `python face_service/run.py`.

## Main App Setup

Set this in the main Wedflix backend environment:

```text
FACE_INDEX_ENABLED=1
FACE_SERVICE_URL=https://your-face-service.example.com
FACE_SERVICE_TOKEN=same-token-as-face-service
```

When a photo is uploaded, Wedflix inserts a `face_jobs` record. The separate worker picks it up and stores vectors.

On Render you can deploy this as one Web Service:

```text
Root Directory: face_service
Build Command: pip install -r requirements.txt && python preload_model.py
Start Command: gunicorn run:app
```

Render environment variables for this service:

```text
MONGO_URI=<same MongoDB URI as Wedflix>
FACE_SERVICE_TOKEN=<strong shared secret>
FACE_MODEL_NAME=buffalo_sc
FACE_MODEL_PROVIDER=insightface
FACE_MODEL_ROOT=.insightface
FACE_DET_SIZE=320
FACE_PRELOAD_MODEL=1
FACE_WORKER_ENABLED=1
FACE_WORKER_POLL_SECONDS=5
FACE_WORKER_BATCH_SIZE=1
FACE_DOWNLOAD_TIMEOUT_SECONDS=60
FACE_MAX_IMAGE_BYTES=15728640
FACE_MATCH_THRESHOLD=0.55
```

Do not set `PORT` manually on Render. Render injects its own `PORT` value for the web service.

Use the build command above so Render downloads the InsightFace model during build. That avoids repeated runtime downloads on every boot.

Guest selfie search should call the main backend endpoint:

```text
POST /api/photos/face-search
form-data:
  wedding_id=<wedding id>
  photo=<selfie file>
```

The main backend forwards the selfie to this service privately, then returns matched photos.

## Licensing Note

InsightFace code is MIT licensed, but its pretrained model packs such as `buffalo_l`/`buffalo_s`/`buffalo_sc` are restricted to non-commercial research use unless you obtain commercial model rights. Use only with licensing that matches your deployment.
