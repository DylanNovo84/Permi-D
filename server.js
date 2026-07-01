// Serveur "Ligne D" — révision permis bus
// Auth par nom d'utilisateur / mot de passe (bcrypt) + session via cookie JWT httpOnly
// Stockage des données (résultats, mémos, check-lists) dans un fichier JSON, par utilisateur
// Version "tout à la racine" : pas de sous-dossier public/, plus simple à mettre sur GitHub.

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
const DB_FILE = path.join(__dirname, 'storage', 'db.json');

app.use(express.json());
app.use(cookieParser());

// Bloque tout accès direct au dossier de stockage AVANT de servir les fichiers statiques
// (sinon storage/db.json, qui contient les mots de passe hashés, serait téléchargeable publiquement)
app.use('/storage', (req, res) => res.status(404).end());
// Bloque aussi les fichiers de configuration du serveur (pas de secret dedans, mais autant rester propre)
const BLOCKED_FILES = ['/server.js', '/package.json', '/package-lock.json', '/render.yaml', '/.gitignore'];
app.use((req, res, next) => BLOCKED_FILES.includes(req.path) ? res.status(404).end() : next());

app.use(express.static(__dirname, { index: 'index.html' }));

// ---------- Petite "base de données" fichier JSON ----------
function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}
function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
function emptyUserData() {
  return { checklists: { ext: {}, int: {} }, memos: [], results: [] };
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
app.post('/api/register', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || username.trim().length < 3) {
    return res.status(400).json({ error: "Nom d'utilisateur trop court (3 caractères min)." });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Mot de passe trop court (6 caractères min).' });
  }
  const db = loadDB();
  const key = username.trim().toLowerCase();
  if (db.users[key]) return res.status(409).json({ error: 'Ce nom d\'utilisateur existe déjà.' });

  db.users[key] = {
    username: username.trim(),
    passwordHash: bcrypt.hashSync(password, 10),
    data: emptyUserData()
  };
  saveDB(db);
  issueCookie(res, key);
  res.json({ ok: true, username: db.users[key].username });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const db = loadDB();
  const key = (username || '').trim().toLowerCase();
  const user = db.users[key];
  if (!user || !bcrypt.compareSync(password || '', user.passwordHash)) {
    return res.status(401).json({ error: 'Identifiants incorrects.' });
  }
  issueCookie(res, key);
  res.json({ ok: true, username: user.username });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

app.get('/api/me', auth, (req, res) => {
  const db = loadDB();
  const user = db.users[req.userKey];
  if (!user) return res.status(404).json({ error: 'not_found' });
  res.json({ username: user.username });
});

app.get('/api/data', auth, (req, res) => {
  const db = loadDB();
  const user = db.users[req.userKey];
  if (!user) return res.status(404).json({ error: 'not_found' });
  res.json(user.data || emptyUserData());
});

app.post('/api/data', auth, (req, res) => {
  const db = loadDB();
  const user = db.users[req.userKey];
  if (!user) return res.status(404).json({ error: 'not_found' });
  const { checklists, memos, results } = req.body || {};
  user.data = {
    checklists: checklists || { ext: {}, int: {} },
    memos: Array.isArray(memos) ? memos : [],
    results: Array.isArray(results) ? results : []
  };
  saveDB(db);
  res.json({ ok: true });
});

// Fallback : toute autre route sert l'app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Ligne D — serveur lancé sur http://localhost:${PORT}`);
});
