import "dotenv/config";
// server/routes/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { JWT_SECRET } from "../config.js";

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ── Helper: sign JWT ─────────────────────────────────────────
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

// ── Middleware: verify JWT ───────────────────────────────────
export function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ════════════════════════════════════════════════════════════
//  CANDIDATE AUTH
// ════════════════════════════════════════════════════════════

// POST /api/auth/candidate/signup
router.post("/candidate/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: "All fields required" });

    const db = req.app.locals.db;
    const existing = await db.collection("candidates").findOne({ email });
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const hash = await bcrypt.hash(password, 10);
    const result = await db.collection("candidates").insertOne({
      name, email,
      passwordHash: hash,
      provider: "email",
      createdAt: new Date(),
    });

    const token = signToken({ id: result.insertedId.toString(), email, name, role: "candidate" });
    res.json({ token, user: { id: result.insertedId, name, email, role: "candidate" } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/candidate/login
router.post("/candidate/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = req.app.locals.db;
    const candidate = await db.collection("candidates").findOne({ email });

    if (!candidate || !(await bcrypt.compare(password, candidate.passwordHash)))
      return res.status(401).json({ error: "Invalid email or password" });

    const token = signToken({ id: candidate._id.toString(), email, name: candidate.name, role: "candidate" });
    res.json({ token, user: { id: candidate._id, name: candidate.name, email, role: "candidate" } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/candidate/google
router.post("/candidate/google", async (req, res) => {
  try {
    const { credential } = req.body;
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const { sub, email, name, picture } = ticket.getPayload();
    const db = req.app.locals.db;

    let candidate = await db.collection("candidates").findOne({ email });
    if (!candidate) {
      const result = await db.collection("candidates").insertOne({
        name, email,
        googleId: sub,
        picture,
        provider: "google",
        createdAt: new Date(),
      });
      candidate = { _id: result.insertedId, name, email };
    }

    const token = signToken({ id: candidate._id.toString(), email, name: candidate.name, role: "candidate" });
    res.json({ token, user: { id: candidate._id, name: candidate.name, email, role: "candidate" } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  HR AUTH
// ════════════════════════════════════════════════════════════

// POST /api/auth/hr/signup
router.post("/hr/signup", async (req, res) => {
  try {
    const { name, email, password, company } = req.body;
    if (!name || !email || !password || !company)
      return res.status(400).json({ error: "All fields required" });

    const db = req.app.locals.db;
    const existing = await db.collection("companies").findOne({ hrEmail: email });
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const hash = await bcrypt.hash(password, 10);
    const result = await db.collection("companies").insertOne({
      name: company,
      hrName: name,
      hrEmail: email,
      hrPasswordHash: hash,
      provider: "email",
      createdAt: new Date(),
    });

    const token = signToken({ id: result.insertedId.toString(), email, name, company, role: "hr" });
    res.json({ token, user: { id: result.insertedId, name, email, company, role: "hr" } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/hr/login
router.post("/hr/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = req.app.locals.db;
    const company = await db.collection("companies").findOne({ hrEmail: email });

    if (!company || !(await bcrypt.compare(password, company.hrPasswordHash)))
      return res.status(401).json({ error: "Invalid email or password" });

    const token = signToken({ id: company._id.toString(), email, name: company.hrName, company: company.name, role: "hr" });
    res.json({ token, user: { id: company._id, name: company.hrName, email, company: company.name, role: "hr" } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/hr/google
router.post("/hr/google", async (req, res) => {
  try {
    const { credential, company } = req.body;
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const { sub, email, name, picture } = ticket.getPayload();
    const db = req.app.locals.db;

    let hr = await db.collection("companies").findOne({ hrEmail: email });
    if (!hr) {
      if (!company) return res.status(400).json({ error: "company_required" });
      const result = await db.collection("companies").insertOne({
        name: company,
        hrName: name,
        hrEmail: email,
        googleId: sub,
        picture,
        provider: "google",
        createdAt: new Date(),
      });
      hr = { _id: result.insertedId, hrName: name, name: company };
    }

    const token = signToken({ id: hr._id.toString(), email, name: hr.hrName, company: hr.name, role: "hr" });
    res.json({ token, user: { id: hr._id, name: hr.hrName, email, company: hr.name, role: "hr" } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me — verify token + return user
router.get("/me", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

export default router;
