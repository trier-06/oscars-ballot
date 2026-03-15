# #OscarsSoWhite 2026 Ballot
### Created for April Reign · 98th Academy Awards · March 15, 2026

---

## Deploy in 5 Minutes

### Step 1 — Push to GitHub

```bash
cd /Users/trier/Claudine/oscars-ballot
git init
git add .
git commit -m "OscarsSoWhite 2026 Ballot — initial deploy"
gh repo create oscars-ballot --public --push
```

### Step 2 — Deploy to Vercel

```bash
vercel --prod
```

When prompted:
- **Project name:** `oscars-ballot` (or any name)
- **Root directory:** `.` (current)
- **Build command:** leave blank (auto-detected from vercel.json)

### Step 3 — Add Environment Variables

In Vercel dashboard → Project → Settings → Environment Variables, add:

| Variable | Value |
|---|---|
| `FIREBASE_PROJECT_ID` | Same as your time-tracker project |
| `FIREBASE_PRIVATE_KEY` | Same as your time-tracker project |
| `FIREBASE_CLIENT_EMAIL` | Same as your time-tracker project |
| `ADMIN_PASSWORD` | `OscarsSoWhite2026` (or change it) |

> **Tip:** These are the exact same Firebase credentials already in your time-tracker Vercel project. Go to time-tracker → Settings → Environment Variables to copy them.

### Step 4 — Redeploy with env vars

```bash
vercel --prod
```

---

## Custom Domain (oscars.reignofapril.com)

1. In Vercel dashboard → Project → Settings → Domains
2. Add `oscars.reignofapril.com`
3. Vercel will give you a CNAME to add to DNS

**For April's DNS setup:**
- Log into wherever `reignofapril.com` DNS is managed (GoDaddy, Namecheap, Squarespace, etc.)
- Add a **CNAME record**:
  - **Name/Host:** `oscars`
  - **Value:** the URL Vercel provides (e.g. `oscars-ballot.vercel.app`)
  - **TTL:** 3600
- SSL certificate auto-provisions within minutes

---

## Admin Panel — Entering Winners

During the ceremony, open `https://oscars.reignofapril.com/#admin` (or tap the hidden `·` dot in the footer).

Password: `OscarsSoWhite2026`

As each category is announced, select the winner from the dropdown and click **Save**. Scores update in real-time for all users.

---

## Data

Stored in Firebase Firestore, same project as the time-tracker:

- `oscars2026_ballots` — all submitted ballots
- `oscars2026_winners` — announced winners

---

## If Firebase isn't set up yet

The ballot still works! Picks are saved to `localStorage`. The leaderboard will show empty until Firebase env vars are configured.

---

## Footer Credit

> *#OscarsSoWhite was created by April Reign in 2015. Ten years later, the work continues.*
