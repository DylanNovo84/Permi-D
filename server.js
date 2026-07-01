// Serveur "Ligne D" — révision permis bus
// Auth par nom d'utilisateur / mot de passe (bcrypt) + session via cookie JWT httpOnly
// Stockage : Upstash Redis (persistant, gratuit) si configuré, sinon fichier JSON local (dev uniquement)

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const USE_REDIS = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

const LOCAL_DB_FILE = path.join(__dirname, 'storage', 'db.json');

app.use(express.json());
app.use(cookieParser());

app.use('/storage', (req, res) => res.status(404).end());
const BLOCKED_FILES = ['/server.js', '/package.json', '/package-lock.json', '/render.yaml', '/.gitignore'];
app.use((req, res, next) => BLOCKED_FILES.includes(req.path) ? res.status(404).end() : next());

app.use(express.static(__dirname, { index: 'index.html' }));

// ---------- Stockage : Upstash Redis (production) ----------
async function redisCmd(cmd) {
  const res = await fetch(UPSTASH_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd)
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.result;
}

// ---------- Stockage : fichier JSON local (fallback dev, non persistant en prod) ----------
function loadLocalDB() {
  if (!fs.existsSync(LOCAL_DB_FILE)) {
    fs.mkdirSync(path.dirname(LOCAL_DB_FILE), { recursive: true });
    fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify({ users: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(LOCAL_DB_FILE, 'utf-8'));
}
function saveLocalDB(db) {
  fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(db, null, 2));
}

function emptyUserData() {
  return { checklists: { ext: {}, int: {} }, memos: [], results: [] };
}

// ---------- Interface unifiée, quel que soit le backend ----------
async function getUser(key) {
  if (USE_REDIS) {
    const raw = await redisCmd(['GET', `user:${key}`]);
    return raw ? JSON.parse(raw) : null;
  }
  const db = loadLocalDB();
  return db.users[key] || null;
}
async function saveUser(key, userObj) {
  if (USE_REDIS) {
    await redisCmd(['SET', `user:${key}`, JSON.stringify(userObj)]);
    return;
  }
  const db = loadLocalDB();
  db.users[key] = userObj;
  saveLocalDB(db);
}

// ---------- Auth middleware ----------
function auth(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'not_authenticated' });
  try {
    req.userKey = jwt.verify(token, JWT_SECRET).userKey;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid_token' });
  }
}
function issueCookie(res, userKey) {
  const token = jwt.sign({ userKey }, JWT_SECRET, { expiresIn: '90d' });
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 90 * 24 * 3600 * 1000
  });
}

// ---------- Routes ----------
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || username.trim().length < 3) {
      return res.status(400).json({ error: "Nom d'utilisateur trop court (3 caractères min)." });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Mot de passe trop court (6 caractères min).' });
    }
    const key = username.trim().toLowerCase();
    if (await getUser(key)) return res.status(409).json({ error: 'Ce nom d\'utilisateur existe déjà.' });

    const userObj = {
      username: username.trim(),
      passwordHash: bcrypt.hashSync(password, 10),
      data: emptyUserData()
    };
    await saveUser(key, userObj);
    issueCookie(res, key);
    res.json({ ok: true, username: userObj.username });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur, réessaie dans un instant.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const key = (username || '').trim().toLowerCase();
    const user = await getUser(key);
    if (!user || !bcrypt.compareSync(password || '', user.passwordHash)) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }
    issueCookie(res, key);
    res.json({ ok: true, username: user.username });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur, réessaie dans un instant.' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

app.get('/api/me', auth, async (req, res) => {
  try {
    const user = await getUser(req.userKey);
    if (!user) return res.status(404).json({ error: 'not_found' });
    res.json({ username: user.username });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/api/data', auth, async (req, res) => {
  try {
    const user = await getUser(req.userKey);
    if (!user) return res.status(404).json({ error: 'not_found' });
    res.json(user.data || emptyUserData());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/data', auth, async (req, res) => {
  try {
    const user = await getUser(req.userKey);
    if (!user) return res.status(404).json({ error: 'not_found' });
    const { checklists, memos, results } = req.body || {};
    user.data = {
      checklists: checklists || { ext: {}, int: {} },
      memos: Array.isArray(memos) ? memos : [],
      results: Array.isArray(results) ? results : []
    };
    await saveUser(req.userKey, user);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Ligne D — serveur lancé sur http://localhost:${PORT}`);
  console.log(`Stockage : ${USE_REDIS ? 'Upstash Redis (persistant)' : 'fichier local (NON persistant en production)'}`);
});