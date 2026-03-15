// ============================================================
// #OscarsSoWhite 2026 Ballot — Vercel Serverless API
// Uses Vercel Blob (same BLOB_READ_WRITE_TOKEN as time-tracker)
// ============================================================

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'OscarsSoWhite2026';
const BLOB_PREFIX = 'oscars2026/';

// ─── CORS headers ───────────────────────────────────────────
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ─── Helpers ────────────────────────────────────────────────
function randomId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function blobPut(key, data) {
  const { put } = require('@vercel/blob');
  const blob = await put(BLOB_PREFIX + key, JSON.stringify(data), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });
  return blob.url;
}

async function blobGet(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function blobList(prefix) {
  const { list } = require('@vercel/blob');
  const { blobs } = await list({ prefix: BLOB_PREFIX + prefix });
  return blobs;
}

// ─── Main handler ───────────────────────────────────────────
module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.url.replace(/^\/api/, '').replace(/\?.*$/, '');

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    // No blob configured — return empty data gracefully
    if (url === '/leaderboard') return res.json({ ballots: [], winners: [] });
    if (url === '/ballot') return res.json({ id: 'local-' + randomId() });
    if (url === '/winner') return res.json({ success: true, note: 'no blob configured' });
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    if (url === '/ballot' && req.method === 'POST') {
      return await handleSubmitBallot(req, res);
    }
    if (url === '/leaderboard' && req.method === 'GET') {
      return await handleLeaderboard(req, res);
    }
    if (url === '/winner' && req.method === 'POST') {
      return await handleSaveWinner(req, res);
    }
    return res.status(404).json({ error: 'Not found' });
  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: err.message });
  }
};

// ─── POST /api/ballot ────────────────────────────────────────
// Each ballot is stored as its own blob: oscars2026/ballot-{id}.json
// This avoids concurrent-write race conditions.
async function handleSubmitBallot(req, res) {
  const { name, handle, platform, picks } = req.body || {};
  if (!name || !handle || !picks) {
    return res.status(400).json({ error: 'name, handle, and picks are required' });
  }

  const id = randomId();
  const ballot = {
    id,
    name: String(name).slice(0, 100),
    handle: String(handle).slice(0, 50),
    platform: String(platform || 'other').slice(0, 20),
    picks,
    submittedAt: new Date().toISOString(),
  };

  await blobPut(`ballot-${id}.json`, ballot);
  return res.json({ id });
}

// ─── GET /api/leaderboard ────────────────────────────────────
async function handleLeaderboard(req, res) {
  // List all ballot blobs in parallel with winners fetch
  const [ballotBlobs, winnersBlob] = await Promise.all([
    blobList('ballot-'),
    blobList('winners.json').then(blobs => blobs[0] || null),
  ]);

  // Fetch all ballots in parallel (cap at 500 for sanity)
  const ballotFetches = ballotBlobs.slice(0, 500).map(b => blobGet(b.url));
  const [ballotsRaw, winnersRaw] = await Promise.all([
    Promise.all(ballotFetches),
    winnersBlob ? blobGet(winnersBlob.url) : Promise.resolve([]),
  ]);

  const ballots = ballotsRaw
    .filter(Boolean)
    .map(b => ({
      id: b.id,
      name: b.name,
      handle: b.handle,
      platform: b.platform || 'other',
      picks: b.picks || {},
      submittedAt: b.submittedAt || '',
    }))
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));

  const winners = Array.isArray(winnersRaw) ? winnersRaw : [];

  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=20');
  return res.json({ ballots, winners });
}

// ─── POST /api/winner ────────────────────────────────────────
// Appends/updates one winner in the winners array blob
async function handleSaveWinner(req, res) {
  const { categoryId, nomineeId, winnerName, password } = req.body || {};

  if (password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Incorrect password' });
  }
  if (!categoryId || !nomineeId) {
    return res.status(400).json({ error: 'categoryId and nomineeId required' });
  }

  // Read existing winners
  const blobs = await blobList('winners.json');
  let winners = [];
  if (blobs.length > 0) {
    const existing = await blobGet(blobs[0].url);
    if (Array.isArray(existing)) winners = existing;
  }

  // Upsert this winner
  const idx = winners.findIndex(w => w.categoryId === categoryId);
  const entry = {
    categoryId,
    nomineeId,
    winnerName: winnerName || nomineeId,
    announcedAt: new Date().toISOString(),
  };
  if (idx >= 0) winners[idx] = entry;
  else winners.push(entry);

  await blobPut('winners.json', winners);
  return res.json({ success: true });
}
