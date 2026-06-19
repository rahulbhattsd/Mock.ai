# Free-Tier Deployment Notes

This repo is configured for one Render free web service:

- Build command: `npm run render-build`
- Start command: `npm start`
- Health check path: `/health`
- Frontend API base: same origin by default, so `VITE_API_URL` can be omitted on Render.

## Required Free Services

- MongoDB Atlas free cluster for `MONGO_URI`
- Groq free tier for `GROQ_API`
- Deepgram free tier for `DEEPGRAM_API`
- Render free web service
- Optional UptimeRobot monitor pointing at `/health` during active hours

## Optional Free Upstash Rate Limiting

Without these env vars, the app uses an in-memory limiter for local/dev safety. Add both to use Upstash Redis REST in production:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Useful optional knobs:

- `INTERVIEW_RATE_LIMIT_MAX=30`
- `TRANSCRIBE_RATE_LIMIT_MAX=40`

## Storage Controls

- `ACTIVE_SESSION_TTL_SECONDS=21600` deletes abandoned `status: "active"` sessions after 6 hours.
- `ENABLE_RECORDING_UPLOAD=false` keeps video upload disabled. Leave it disabled for the Rs. 0 stack.

Reports intentionally store `answerImprovements` without duplicated original answers. The UI/API hydrates original answers from `history` only when rendering.
