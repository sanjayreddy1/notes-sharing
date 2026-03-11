import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import Database from 'better-sqlite3';

// Database Setup
const db = new Database('study_sync.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    mobile TEXT UNIQUE,
    password TEXT,
    college TEXT,
    academic_details TEXT
  );

  CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT,
    subject TEXT,
    description TEXT,
    file_path TEXT,
    file_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS study_groups (
    id TEXT PRIMARY KEY,
    name TEXT,
    subject TEXT,
    description TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS group_members (
    group_id TEXT,
    user_id TEXT,
    PRIMARY KEY(group_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    group_id TEXT,
    user_id TEXT,
    user_name TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.json());

// File Upload Setup
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({ storage });

// API Routes
app.post('/api/auth/signup', (req, res) => {
  const { name, email, mobile, password, college, academic_details } = req.body;
  try {
    const userId = uuidv4();
    db.prepare('INSERT INTO users (id, name, email, mobile, password, college, academic_details) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(userId, name, email, mobile, password, college, academic_details);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    res.json({ success: true, user });
  } catch (e) {
    res.status(400).json({ success: false, message: 'User already exists or invalid data' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND password = ?').get(email, password);
  if (user) {
    res.json({ success: true, user });
  } else {
    res.status(401).json({ success: false, message: 'Invalid email or password' });
  }
});

app.get('/api/materials', (req, res) => {
  const materials = db.prepare('SELECT materials.*, users.name as user_name FROM materials JOIN users ON materials.user_id = users.id ORDER BY created_at DESC').all();
  res.json(materials);
});

app.post('/api/materials', upload.single('file'), (req, res) => {
  const { userId, title, subject, description } = req.body;
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'File is required' });

  const id = uuidv4();
  db.prepare('INSERT INTO materials (id, user_id, title, subject, description, file_path, file_name) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, userId, title, subject, description, file.filename, file.originalname);
  
  res.json({ success: true, id });
});

app.delete('/api/materials/:id', (req, res) => {
  const { id } = req.params;
  const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(id);
  if (material) {
    const filePath = path.join(uploadDir, material.file_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    db.prepare('DELETE FROM materials WHERE id = ?').run(id);
  }
  res.json({ success: true });
});

app.get('/api/materials/download/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(uploadDir, filename);
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).send('File not found');
  }
});

app.get('/api/groups', (req, res) => {
  const groups = db.prepare('SELECT * FROM study_groups ORDER BY created_at DESC').all();
  res.json(groups);
});

app.post('/api/groups', (req, res) => {
  const { name, subject, description, userId } = req.body;
  const id = uuidv4();
  db.prepare('INSERT INTO study_groups (id, name, subject, description, created_by) VALUES (?, ?, ?, ?, ?)')
    .run(id, name, subject, description, userId);
  db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(id, userId);
  res.json({ success: true, id });
});

app.post('/api/groups/join', (req, res) => {
  const { groupId, userId } = req.body;
  try {
    db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(groupId, userId);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: 'Already a member' });
  }
});

app.get('/api/groups/:id/messages', (req, res) => {
  const messages = db.prepare('SELECT * FROM messages WHERE group_id = ? ORDER BY created_at ASC').all(req.params.id);
  res.json(messages);
});

app.post('/api/feedback', (req, res) => {
  const { userId, content } = req.body;
  db.prepare('INSERT INTO feedback (id, user_id, content) VALUES (?, ?, ?)').run(uuidv4(), userId, content);
  res.json({ success: true });
});

// Socket.io for Real-time Chat
io.on('connection', (socket) => {
  socket.on('join-group', (groupId) => {
    socket.join(groupId);
  });

  socket.on('send-message', (data) => {
    const { groupId, userId, userName, content } = data;
    const id = uuidv4();
    db.prepare('INSERT INTO messages (id, group_id, user_id, user_name, content) VALUES (?, ?, ?, ?, ?)')
      .run(id, groupId, userId, userName, content);
    
    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
    io.to(groupId).emit('new-message', message);
  });
});

// Vite Integration
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => res.sendFile(path.resolve('dist/index.html')));
  }

  const PORT = 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
