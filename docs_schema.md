# Database Schema

## users
- _id: ObjectId
- name: string
- email: string (unique)
- password_hash: string
- role: enum(admin, guest)
- wedding_ids: ObjectId[]

## weddings
- _id: ObjectId
- couple_names: string
- wedding_date: string/date
- hero_video_url: string
- description: string

## programs
- _id: ObjectId
- wedding_id: ObjectId
- title: string
- thumbnail: string
- order: int

## episodes
- _id: ObjectId
- program_id: ObjectId
- title: string
- description: string
- youtube_url: string
- embed_url: string
- thumbnail: string
- order: int

## photos
- _id: ObjectId
- episode_id: ObjectId
- event: string
- image_url: string
- order: int

## comments
- _id: ObjectId
- episode_id: ObjectId
- user_name: string
- text: string
- created_at: datetime

## guest_wishes
- _id: ObjectId
- wedding_id: ObjectId
- guest_name: string
- message: string
- created_at: datetime
