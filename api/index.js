// ============================================================
// #OscarsSoWhite 2026 Ballot — Vercel Serverless API
// Uses Firebase Firestore (same credentials as time-tracker)
// ============================================================

const admin = require('firebase-admin');

// ─── Firebase init (lazy, singleton) ────────────────────────
let db = null;
function getDb() {
  if (db) return db;
  if (!process.env.FIREBASE_PROJECT_ID) return null;
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });
  }
  db = admin.firestore();
  return db;
}

const BALLOTS = 'oscars2026_ballots';
const WINNERS = 'oscars2026_winners';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'OscarsSoWhite2026';

// ─── CORS headers ───────────────────────────────────────────
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ─── Main handler ───────────────────────────────────────────
module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.url.replace(/^\/api/, '').replace(/\?.*$/, '');

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
// Body: { name, handle, email, picks }
// Returns: { id }
async function handleSubmitBallot(req, res) {
  const { name, handle, email, picks } = req.body || {};
  if (!name || !handle || !picks) {
    return res.status(400).json({ error: 'name, handle, and picks are required' });
  }

  const firestore = getDb();
  if (!firestore) {
    // No Firebase configured — return a local ID
    return res.json({ id: 'local-' + Date.now() });
  }

  const doc = await firestore.collection(BALLOTS).add({
    name: String(name).slice(0, 100),
    handle: String(handle).slice(0, 50),
    email: String(email || '').slice(0, 200),
    picks: picks,
    submittedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return res.json({ id: doc.id });
}

// ─── GET /api/leaderboard ────────────────────────────────────
// Returns: { ballots: [...], winners: [...] }
async function handleLeaderboard(req, res) {
  const firestore = getDb();
  if (!firestore) {
    return res.json({ ballots: [], winners: [] });
  }

  const [ballotsSnap, winnersSnap] = await Promise.all([
    firestore.collection(BALLOTS).orderBy('submittedAt', 'asc').get(),
    firestore.collection(WINNERS).get(),
  ]);

  const ballots = ballotsSnap.docs.map(doc => {
    const d = doc.data();
    return {
      id: doc.id,
      name: d.name,
      handle: d.handle,
      picks: d.picks || {},
      submittedAt: d.submittedAt?.toDate?.()?.toISOString() || '',
    };
  });

  const winners = winnersSnap.docs.map(doc => {
    const d = doc.data();
    return {
      categoryId: doc.id,
      nomineeId: d.nomineeId,
      winnerName: d.winnerName,
      announcedAt: d.announcedAt?.toDate?.()?.toISOString() || '',
    };
  });

  // Cache-control: short TTL since ceremony is live
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=20');
  return res.json({ ballots, winners });
}

// ─── POST /api/winner ────────────────────────────────────────
// Body: { categoryId, nomineeId, winnerName, password }
// Returns: { success: true }
async function handleSaveWinner(req, res) {
  const { categoryId, nomineeId, winnerName, password } = req.body || {};

  if (password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Incorrect password' });
  }
  if (!categoryId || !nomineeId) {
    return res.status(400).json({ error: 'categoryId and nomineeId are required' });
  }

  const firestore = getDb();
  if (!firestore) {
    return res.json({ success: true, note: 'No Firebase configured — not persisted' });
  }

  await firestore.collection(WINNERS).doc(categoryId).set({
    nomineeId,
    winnerName: winnerName || nomineeId,
    announcedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return res.json({ success: true });
}
