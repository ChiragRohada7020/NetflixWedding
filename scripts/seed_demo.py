from bson import ObjectId
from pymongo import MongoClient
from werkzeug.security import generate_password_hash

MONGO_URI = "mongodb://localhost:27017/weddingflix"


def run_seed():
    client = MongoClient(MONGO_URI)
    db = client.get_default_database()

    db.users.delete_many({})
    db.weddings.delete_many({})
    db.programs.delete_many({})
    db.episodes.delete_many({})
    db.photos.delete_many({})
    db.comments.delete_many({})
    db.guest_wishes.delete_many({})

    wedding_id = db.weddings.insert_one(
        {
            "couple_names": "Aarav & Meera",
            "wedding_date": "2026-12-10",
            "hero_video_url": "https://www.youtube.com/watch?v=1Rc_XnSk-Ew",
            "description": "A cinematic journey of love.",
        }
    ).inserted_id

    programs = ["Haldi", "Sangeet", "Bharat", "Wedding", "Reception", "Pre-Wedding Shoot"]
    thumbnails = [
        "https://images.unsplash.com/photo-1519741497674-611481863552?w=1200",
        "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=1200",
        "https://images.unsplash.com/photo-1529636798458-92182e662485?w=1200",
        "https://images.unsplash.com/photo-1469371670807-013ccf25f16a?w=1200",
        "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=1200",
        "https://images.unsplash.com/photo-1518568814500-bf0f8d125f46?w=1200",
    ]

    sangeet_id = None
    for i, title in enumerate(programs):
        pid = db.programs.insert_one(
            {
                "wedding_id": ObjectId(wedding_id),
                "title": title,
                "thumbnail": thumbnails[i],
                "order": i + 1,
            }
        ).inserted_id
        if title == "Sangeet":
            sangeet_id = pid

    episode_titles = ["Couple Dance", "Family Dance", "Funny Moments", "Full Event Video"]
    youtube_links = [
        "https://www.youtube.com/watch?v=JNKZN8uq1H8&list=RDJNKZN8uq1H8&start_radio=1",
        "https://www.youtube.com/watch?v=-bYAMk91Lzc",
        "https://www.youtube.com/watch?v=JNKZN8uq1H8",
        "https://www.youtube.com/watch?v=-bYAMk91Lzc",
    ]
    embed_links = [
        "https://www.youtube.com/embed/JNKZN8uq1H8",
        "https://www.youtube.com/embed/-bYAMk91Lzc",
        "https://www.youtube.com/embed/JNKZN8uq1H8",
        "https://www.youtube.com/embed/-bYAMk91Lzc",
    ]
    episode_ids = []
    for i, t in enumerate(episode_titles):
        eid = db.episodes.insert_one(
            {
                "program_id": ObjectId(sangeet_id),
                "title": t,
                "description": f"Highlights from {t.lower()}.",
                "youtube_url": youtube_links[i],
                "embed_url": embed_links[i],
                "thumbnail": thumbnails[1],
                "order": i + 1,
            }
        ).inserted_id
        episode_ids.append(eid)

    for i in range(8):
        db.photos.insert_one(
            {
                "episode_id": ObjectId(episode_ids[0]),
                "event": "Sangeet",
                "image_url": f"https://picsum.photos/seed/weddingflix{i}/800/1000",
                "order": i + 1,
            }
        )

    db.users.insert_many(
        [
            {
                "name": "Admin",
                "email": "admin@weddingflix.com",
                "password_hash": generate_password_hash("admin123"),
                "role": "admin",
                "wedding_ids": [ObjectId(wedding_id)],
            },
            {
                "name": "Guest",
                "email": "guest@weddingflix.com",
                "password_hash": generate_password_hash("guest123"),
                "role": "guest",
                "wedding_ids": [ObjectId(wedding_id)],
            },
        ]
    )

    print("Seed complete")


if __name__ == "__main__":
    run_seed()
