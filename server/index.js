import express from 'express';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePrice } from '../shared/purchases.js';

const app = express();
const port = Number(process.env.PORT || 3000);
const here = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(process.env.DB_PATH || path.join(here, 'fioul.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS tanks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    position INTEGER NOT NULL,
    capacity REAL NOT NULL CHECK(capacity > 0),
    initial_level REAL NOT NULL DEFAULT 0 CHECK(initial_level >= 0)
  );
  CREATE TABLE IF NOT EXISTS actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('transfer', 'delivery')),
    date TEXT NOT NULL,
    volume REAL NOT NULL CHECK(volume > 0),
    from_tank_id INTEGER REFERENCES tanks(id) ON DELETE RESTRICT,
    to_tank_id INTEGER REFERENCES tanks(id) ON DELETE RESTRICT,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
// Idempotent upgrade: retain the existing tanks and complete action history.
if (!db.prepare('PRAGMA table_info(actions)').all().some(c => c.name === 'purchase_price_cents')) {
  db.exec('ALTER TABLE actions ADD COLUMN purchase_price_cents INTEGER CHECK(purchase_price_cents IS NULL OR purchase_price_cents >= 0)');
}
if (db.prepare('SELECT COUNT(*) AS n FROM tanks').get().n === 0) {
  const insert = db.prepare('INSERT INTO tanks (label, position, capacity, initial_level) VALUES (?, ?, ?, ?)');
  const seed = db.transaction(() => {
    insert.run('A', 0, 1000, 0);
    insert.run('B', 1, 1000, 0);
    insert.run('C', 2, 1000, 1000);
  });
  seed();
}

app.use(express.json());
function getState() {
  const tanks = db.prepare('SELECT * FROM tanks ORDER BY position, id').all();
  const actions = db.prepare(`SELECT a.*, f.label AS from_label, t.label AS to_label
    FROM actions a LEFT JOIN tanks f ON a.from_tank_id=f.id LEFT JOIN tanks t ON a.to_tank_id=t.id
    ORDER BY a.date DESC, a.id DESC`).all();
  const levels = new Map(tanks.map(t => [t.id, Number(t.initial_level)]));
  for (const action of [...actions].reverse()) {
    if (action.type === 'delivery') levels.set(action.to_tank_id, (levels.get(action.to_tank_id) || 0) + action.volume);
    else {
      levels.set(action.from_tank_id, (levels.get(action.from_tank_id) || 0) - action.volume);
      levels.set(action.to_tank_id, (levels.get(action.to_tank_id) || 0) + action.volume);
    }
  }
  return {
    tanks: tanks.map(t => ({ ...t, capacity: Number(t.capacity), level: Math.max(0, Number((levels.get(t.id) || 0).toFixed(1))) })),
    actions: actions.map(a => ({ ...a, volume: Number(a.volume) }))
  };
}
app.get('/api/state', (_req, res) => res.json(getState()));
app.post('/api/actions', (req, res) => {
  const { type, date, volume, fromTankId, toTankId, note = '', purchasePrice } = req.body || {};
  const amount = Number(volume);
  if (!['transfer', 'delivery'].includes(type) || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Vérifiez le type, la date et le volume.' });
  const state = getState();
  const to = state.tanks.find(t => t.id === Number(toTankId));
  if (!to) return res.status(400).json({ error: 'Choisissez une cuve de destination.' });
  if (type === 'delivery') {
    let price;
    try { price = parsePrice(purchasePrice); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    if (to.level + amount > to.capacity + 0.001) return res.status(400).json({ error: `La cuve ${to.label} ne peut recevoir que ${Math.max(0, to.capacity - to.level).toFixed(0)} L.` });
    db.prepare('INSERT INTO actions (type,date,volume,to_tank_id,note,purchase_price_cents) VALUES (?,?,?,?,?,?)').run(type,date,amount,to.id,String(note).slice(0,250),price);
  } else {
    const from = state.tanks.find(t => t.id === Number(fromTankId));
    if (!from || from.id === to.id) return res.status(400).json({ error: 'Choisissez deux cuves différentes.' });
    if (from.level + 0.001 < amount) return res.status(400).json({ error: `La cuve ${from.label} ne contient que ${from.level.toFixed(0)} L.` });
    if (to.level + amount > to.capacity + 0.001) return res.status(400).json({ error: `La cuve ${to.label} ne peut recevoir que ${Math.max(0, to.capacity - to.level).toFixed(0)} L.` });
    db.prepare('INSERT INTO actions (type,date,volume,from_tank_id,to_tank_id,note) VALUES (?,?,?,?,?,?)').run(type,date,amount,from.id,to.id,String(note).slice(0,250));
  }
  res.status(201).json(getState());
});
app.patch('/api/actions/:id/price', (req, res) => {
  const action = db.prepare('SELECT * FROM actions WHERE id=?').get(Number(req.params.id));
  if (!action) return res.status(404).json({ error: 'Livraison introuvable.' });
  if (action.type !== 'delivery') return res.status(400).json({ error: 'Un prix d’achat concerne uniquement une livraison.' });
  if (!Object.hasOwn(req.body || {}, 'purchasePrice')) return res.status(400).json({ error: 'Indiquez le prix à enregistrer.' });
  let price;
  try { price = parsePrice(req.body.purchasePrice); }
  catch (error) { return res.status(400).json({ error: error.message }); }
  db.prepare('UPDATE actions SET purchase_price_cents=? WHERE id=?').run(price, action.id);
  res.json(getState());
});
app.post('/api/tanks', (req, res) => {
  const label = String(req.body?.label || '').trim().slice(0, 24);
  const capacity = Number(req.body?.capacity);
  const initial = Number(req.body?.initialLevel ?? 0);
  if (!label || !Number.isFinite(capacity) || capacity <= 0 || !Number.isFinite(initial) || initial < 0 || initial > capacity) return res.status(400).json({ error: 'Vérifiez le nom, la capacité et le niveau de départ.' });
  const pos = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM tanks').get().p;
  db.prepare('INSERT INTO tanks (label,position,capacity,initial_level) VALUES (?,?,?,?)').run(label,pos,capacity,initial);
  res.status(201).json(getState());
});
app.patch('/api/tanks/:id', (req, res) => {
  const tank = db.prepare('SELECT * FROM tanks WHERE id=?').get(Number(req.params.id));
  if (!tank) return res.status(404).json({ error: 'Cuve introuvable.' });
  const label = String(req.body?.label ?? tank.label).trim().slice(0, 24);
  const capacity = Number(req.body?.capacity ?? tank.capacity);
  const hasActions = db.prepare('SELECT COUNT(*) AS n FROM actions WHERE from_tank_id=? OR to_tank_id=?').get(tank.id,tank.id).n > 0;
  if (hasActions && req.body?.initialLevel !== undefined && Number(req.body.initialLevel) !== tank.initial_level) return res.status(400).json({ error: 'Le niveau de départ est verrouillé car cette cuve possède un historique.' });
  const initial = hasActions ? tank.initial_level : Number(req.body?.initialLevel ?? tank.initial_level);
  const current = getState().tanks.find(t => t.id === tank.id).level;
  if (!label || !Number.isFinite(capacity) || capacity <= 0 || !Number.isFinite(initial) || initial < 0 || initial > capacity || (hasActions && capacity < current)) return res.status(400).json({ error: `La capacité doit être supérieure au niveau actuel (${current.toFixed(0)} L).` });
  db.prepare('UPDATE tanks SET label=?,capacity=?,initial_level=? WHERE id=?').run(label,capacity,initial,tank.id);
  res.json(getState());
});
app.delete('/api/tanks/:id', (req, res) => {
  const id = Number(req.params.id);
  if (db.prepare('SELECT COUNT(*) AS n FROM tanks').get().n <= 1) return res.status(400).json({ error: 'Il faut conserver au moins une cuve.' });
  if (db.prepare('SELECT COUNT(*) AS n FROM actions WHERE from_tank_id=? OR to_tank_id=?').get(id,id).n) return res.status(400).json({ error: 'Cette cuve figure dans l’historique et ne peut pas être supprimée.' });
  const position = db.prepare('SELECT position FROM tanks WHERE id=?').get(id)?.position;
  if (position === undefined) return res.status(404).json({ error: 'Cuve introuvable.' });
  db.prepare('DELETE FROM tanks WHERE id=?').run(id);
  db.prepare('UPDATE tanks SET position=position-1 WHERE position > ?').run(position);
  res.json(getState());
});

if (process.env.NODE_ENV === 'production') {
  const dist = path.resolve(here, '../dist');
  app.use(express.static(dist));
  app.get(/.*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}
const server = app.listen(port, '0.0.0.0', () => console.log(`Mon fioul API disponible sur :${server.address().port}`));
