# Job Digest Portal

A full-stack personal job portal. Sign up, upload your resume, and every morning you get a curated email of matching jobs — scored by AI against your profile, with a personalised cover letter for each one.

---

## Features

- **Resume-powered matching** — Upload your resume (PDF or TXT). GPT-4o-mini extracts your candidate profile and suggests job roles automatically.
- **Role selection** — Pick the job roles you're interested in. The portal fetches jobs specifically for those roles.
- **Daily morning digest** — A cron job runs at 7am IST, fetches fresh jobs, scores each one (0–100) against your profile, and emails you the top matches.
- **AI-generated cover letters** — Each matched job includes a personalised 150–200 word cover letter.
- **Application tracker** — Mark jobs as applied, track your history by week/month/all time.
- **System design topic of the day** — 40 rotating topics (HLD + LLD) shown on your dashboard and in the morning email.
- **Multi-user** — Anyone can sign up with their own resume and get their own personalised feed.

---

## How job fetching works

Jobs are fetched from **two free public APIs**:

| Source | Type | Free tier |
|--------|------|-----------|
| [Adzuna](https://developer.adzuna.com/) | Job board aggregator — India + worldwide | 250 calls/month free |
| [Remotive](https://remotive.com/api) | Remote software jobs only | Unlimited, no key needed |

### What about LinkedIn, Naukri, Wellfound, Indeed?

These platforms **do not offer public job APIs**:
- **LinkedIn** — Deprecated their public Jobs API in 2015. No free access.
- **Naukri** — No public API. Their ToS prohibits scraping.
- **Wellfound (AngelList)** — Requires partnership approval.
- **Indeed** — Deprecated public job feed access. Publisher API requires approval.
- **Glassdoor** — API access requires a partnership.

**Adzuna itself aggregates from many platforms**, so you'll often see jobs that originally came from multiple sources.

**Future improvements** (if you want more sources):
- [JSearch via RapidAPI](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch) — Paid, aggregates LinkedIn, Indeed, Glassdoor + 20 more (from ~$10/month)
- [The Muse API](https://www.themuse.com/developers) — Free, US-focused
- [Arbeitnow API](https://arbeitnow.com/api) — Free, Europe-focused

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express |
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| Database | SQLite (`better-sqlite3`) locally / PostgreSQL on Railway |
| AI | OpenAI `gpt-4o-mini` |
| Job APIs | Adzuna + Remotive |
| Email | Resend |
| Auth | JWT (bcryptjs + jsonwebtoken) |
| Resume parsing | pdf-parse + OpenAI |
| Scheduler | node-cron (7am IST daily) |

---

## Local setup

### Prerequisites
- Node.js 18+
- npm

### 1. Clone and install

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Set up environment variables

Copy and fill in `backend/.env`:

```env
OPENAI_API_KEY=sk-...
ADZUNA_APP_ID=your_id
ADZUNA_APP_KEY=your_key
RESEND_API_KEY=re_...
PORTAL_URL=http://localhost:3000
DATABASE_URL=                        # leave blank for SQLite
DB_PATH=./data/jobs.db               # SQLite file path (auto-created)
JWT_SECRET=a_long_random_secret      # generate: openssl rand -hex 32
CRON_SCHEDULE=30 1 * * *             # 7am IST = 1:30am UTC
PORT=4000
```

Edit `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 3. Run

```bash
# Terminal 1 — backend (starts on :4000)
cd backend && npm run dev

# Terminal 2 — frontend (starts on :3000)
cd frontend && npm run dev
```

Open http://localhost:3000 → sign up → upload resume → select roles → dashboard.

### 4. Test the digest manually

After signing up and completing setup:
```bash
curl -X POST http://localhost:4000/api/cron/trigger \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Or click **"Run digest now"** on the empty dashboard.

---

## Environment variables explained

### How to get each key

**`OPENAI_API_KEY`**
1. Go to https://platform.openai.com/api-keys
2. Create a new secret key
3. You need credits — add a minimum (~$5) at https://platform.openai.com/settings/billing
4. Cost estimate: ~$0.003 per job scored (gpt-4o-mini). Scoring 40 jobs/day = ~$0.12/day = ~$3.60/month.

**`ADZUNA_APP_ID` + `ADZUNA_APP_KEY`**
1. Go to https://developer.adzuna.com/
2. Register for a free account
3. Create an application — you'll get an `app_id` and `app_key`
4. Free tier: 250 API calls/month (plenty for daily use)

**`RESEND_API_KEY`**
1. Go to https://resend.com/ and create a free account
2. Go to API Keys → Create API Key
3. Free tier: 3,000 emails/month, 100/day (more than enough)
4. Note: In free tier you can only send to your own verified email address. To send to others, verify a domain in Resend settings.

**`JWT_SECRET`**
- Generate a secure random string:
  ```bash
  openssl rand -hex 32
  # or
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- Any long random string works. Keep it secret — it signs all auth tokens.

**`DATABASE_URL`** (optional — for PostgreSQL)
- Leave blank to use SQLite (recommended for local development)
- For production on Railway: add a PostgreSQL service and Railway auto-sets this

---

## API reference

All endpoints except `/api/auth/*` require `Authorization: Bearer <token>` header.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | `{ name, email, password }` → `{ token, user }` |
| POST | `/api/auth/login` | `{ email, password }` → `{ token, user }` |
| GET | `/api/auth/me` | Returns current user (no sensitive fields) |
| GET | `/api/profile` | User profile with parsed roles |
| POST | `/api/profile/resume` | Upload resume file (multipart/form-data, field: `resume`) |
| PUT | `/api/profile/preferences` | `{ preferredRoles: string[] }` — saves roles + marks setup complete |
| GET | `/api/jobs?date=YYYY-MM-DD` | Today's matched jobs (ordered by score) |
| GET | `/api/jobs/:id` | Single job with full description + cover letter |
| PATCH | `/api/jobs/:id/apply` | `{ applied: true\|false }` — mark/unmark as applied |
| GET | `/api/stats` | Counts: applied today/week/month, total matched/applied |
| GET | `/api/stats/applied?filter=week\|month\|all` | Applied job list for tracker |
| GET | `/api/topic/today` | Today's system design topic |
| POST | `/api/cron/trigger` | Manually run digest for your account (auth required) |
| GET | `/api/health` | Server health check |

---

## User flow

```
Sign up → Upload resume → AI extracts profile + suggests roles
       → Select preferred roles → Setup complete
       → Dashboard (empty on day 1)
       → Click "Run digest now" OR wait for 7am IST cron
       → Jobs appear, scored against your resume
       → Click any job → read description + cover letter
       → Click Apply Now → go to original job listing
       → Mark as Applied
       → View history in Tracker
```

---

## Project structure

```
job-digest-portal/
├── backend/
│   ├── index.js                   # Express entry + cron
│   ├── middleware/
│   │   └── auth.js                # JWT verification middleware
│   ├── cron/
│   │   └── dailyDigest.js         # Runs for all setup-complete users
│   ├── services/
│   │   ├── jobFetcher.js          # Adzuna + Remotive, user role-aware search
│   │   ├── jobScorer.js           # OpenAI scoring against user's profile
│   │   ├── resumeParser.js        # PDF/TXT parsing + OpenAI profile extraction
│   │   ├── emailSender.js         # HTML email via Resend
│   │   └── topicPicker.js         # 40 system design topics, daily rotation
│   ├── db/
│   │   ├── init.js                # Table creation (SQLite / PostgreSQL)
│   │   └── queries.js             # All DB operations, user-scoped
│   └── routes/
│       ├── auth.js                # signup, login, me
│       ├── profile.js             # resume upload, preferences
│       ├── jobs.js                # CRUD for job matches
│       ├── stats.js               # stats + applied history
│       └── topic.js               # daily system design topic
│
├── frontend/
│   ├── context/
│   │   └── AuthContext.jsx        # JWT auth state (localStorage)
│   ├── app/
│   │   ├── page.jsx               # Dashboard (protected)
│   │   ├── login/page.jsx         # Login
│   │   ├── signup/page.jsx        # Signup
│   │   ├── setup/page.jsx         # Resume upload + role selection
│   │   ├── jobs/[id]/page.jsx     # Job detail + cover letter (protected)
│   │   └── tracker/page.jsx       # Application history (protected)
│   └── components/
│       ├── JobCard.jsx
│       ├── StatsBar.jsx
│       ├── TopicCard.jsx
│       └── TrackerTable.jsx
│
├── railway.toml
└── README.md
```

---

## Railway deployment

### Backend service

1. Create a Railway project → **New Service** → **GitHub Repo** → select backend folder (or set root directory to `backend/`)
2. Add environment variables (all from `backend/.env`)
3. For SQLite persistence: add a **Volume** mounted at `/app/data`, set `DB_PATH=/app/data/jobs.db`
4. For PostgreSQL: add a **PostgreSQL** plugin → Railway auto-injects `DATABASE_URL`

### Frontend service

1. **New Service** → select frontend folder
2. Set `NEXT_PUBLIC_API_URL` to your backend Railway URL (e.g. `https://your-backend.railway.app`)
3. Deploy

### After deployment

Update `PORTAL_URL` in backend env to your frontend Railway URL so email links are correct.
