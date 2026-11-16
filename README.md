# Takwira24

A sports community for finding players, creating matches and sharing the game.

## Stack
- React + Vite
- Supabase (Auth, Postgres, Storage, Realtime)
- Capacitor-ready web app structure

## Run locally
```bash
npm install
cp .env.example .env
npm run dev
```

Add your Supabase project URL and anon/publishable key to `.env`. The UI runs in demo mode without credentials.

## Supabase setup
1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env`.
4. Enable email auth. Configure Storage buckets `avatars` and `media` (the schema includes setup notes).

## Current MVP
- Responsive Arabic RTL sports dashboard.
- Sport selection (football, handball, basketball).
- Match creation with venue, date, time and player slots.
- Player search/selection and pending invitation states.
- Match feed and profile preview.
- Demo mode for UI review before Supabase credentials are configured.

## Next implementation milestones
- Connect auth/profile onboarding and image uploads.
- Persist matches and invitations using Supabase.
- Realtime invitation updates and push notifications.
- Match completion, score and per-player goal/stat recording.
- Stories and video publishing with moderation/reporting tools.
- Capacitor Android packaging and Play Console release.
