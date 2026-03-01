import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

const db = new Database("madrasah.db");

// Initialize Database Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    guardian_name TEXT,
    phone TEXT,
    address TEXT,
    enrollment_date TEXT,
    class_id INTEGER,
    status TEXT DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    subject TEXT,
    phone TEXT,
    email TEXT,
    join_date TEXT
  );

  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    teacher_id INTEGER,
    room TEXT
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    date TEXT,
    status TEXT, -- 'present', 'absent', 'late'
    UNIQUE(student_id, date)
  );

  CREATE TABLE IF NOT EXISTS fees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    amount REAL,
    month TEXT,
    year INTEGER,
    status TEXT, -- 'paid', 'pending'
    payment_date TEXT
  );
`);

// Seed initial data if empty
const studentCount = db.prepare("SELECT COUNT(*) as count FROM students").get() as { count: number };
if (studentCount.count === 0) {
  db.prepare("INSERT INTO classes (name, room) VALUES (?, ?)").run("Class 1A", "Room 101");
  db.prepare("INSERT INTO students (name, guardian_name, phone, class_id, enrollment_date) VALUES (?, ?, ?, ?, ?)").run(
    "Ahmad Abdullah", "Abdullah Omar", "0123456789", 1, new Date().toISOString()
  );
  db.prepare("INSERT INTO teachers (name, subject, email) VALUES (?, ?, ?)").run(
    "Ustaz Ibrahim", "Quranic Studies", "ibrahim@example.com"
  );
}

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // API Routes
  app.get("/api/stats", (req, res) => {
    const students = db.prepare("SELECT COUNT(*) as count FROM students").get() as any;
    const teachers = db.prepare("SELECT COUNT(*) as count FROM teachers").get() as any;
    const classes = db.prepare("SELECT COUNT(*) as count FROM classes").get() as any;
    const pendingFees = db.prepare("SELECT COUNT(*) as count FROM fees WHERE status = 'pending'").get() as any;
    
    res.json({
      students: students.count,
      teachers: teachers.count,
      classes: classes.count,
      pendingFees: pendingFees.count
    });
  });

  app.get("/api/students", (req, res) => {
    const students = db.prepare(`
      SELECT s.*, c.name as class_name 
      FROM students s 
      LEFT JOIN classes c ON s.class_id = c.id
    `).all();
    res.json(students);
  });

  app.post("/api/students", (req, res) => {
    const { name, guardian_name, phone, class_id } = req.body;
    const info = db.prepare("INSERT INTO students (name, guardian_name, phone, class_id, enrollment_date) VALUES (?, ?, ?, ?, ?)")
      .run(name, guardian_name, phone, class_id, new Date().toISOString());
    res.json({ id: info.lastInsertRowid });
  });

  app.get("/api/teachers", (req, res) => {
    const teachers = db.prepare("SELECT * FROM teachers").all();
    res.json(teachers);
  });

  app.get("/api/classes", (req, res) => {
    const classes = db.prepare("SELECT * FROM classes").all();
    res.json(classes);
  });

  app.get("/api/attendance/:date", (req, res) => {
    const { date } = req.params;
    const attendance = db.prepare(`
      SELECT s.id as student_id, s.name, a.status 
      FROM students s 
      LEFT JOIN attendance a ON s.id = a.student_id AND a.date = ?
    `).all(date);
    res.json(attendance);
  });

  app.post("/api/attendance", (req, res) => {
    const { student_id, date, status } = req.body;
    db.prepare(`
      INSERT INTO attendance (student_id, date, status) 
      VALUES (?, ?, ?) 
      ON CONFLICT(student_id, date) DO UPDATE SET status = excluded.status
    `).run(student_id, date, status);
    res.json({ success: true });
  });

  app.get("/api/fees", (req, res) => {
    const fees = db.prepare(`
      SELECT f.*, s.name as student_name 
      FROM fees f 
      JOIN students s ON f.student_id = s.id
    `).all();
    res.json(fees);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
