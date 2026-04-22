import express from "express";
import authRoutes from "./routes/auth.js";
import cors from "cors";
import multer from "multer";
import { MongoClient, ObjectId } from "mongodb";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import rateLimit from "express-rate-limit";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "../client/dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/dist", "index.html"));
});
dotenv.config();

// ─── CLIENTS ────────────────────────────────────────────────────────────────
const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const mongo = new MongoClient(process.env.MONGO_URI);

const groq = new Groq({ apiKey: process.env.GROQ_API });
const JWT_SECRET = process.env.JWT_SECRET || "changeme_secret";

// ─── RATE LIMITERS ───────────────────────────────────────────────────────────
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
app.use("/api/voice-start", limiter);
app.use("/api/transcribe", limiter);

// ─── MIDDLEWARE ──────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json({ limit: "50mb" }));
app.use("/api/auth", authRoutes);

// ─── ARJUN SYSTEM PROMPT ─────────────────────────────────────────────────────
export function buildSystemPrompt(role, difficulty) {
  const isHR = role === "hr";
  const isManagerial = role === "managerial";
  const isSystemDesign = role === "system_design";
  const isAIEngineer = role === "ai_engineer";
  const isTech = !isHR && !isManagerial;

  // ─── Difficulty context per role type ────────────────────────────────────────
  const difficultyGuide = {
    fresher: isTech
      ? "Focus on core fundamentals: syntax, basic data structures, simple algorithms, and core language features. Probe for genuine understanding vs. rote memorization."
      : "Focus on college projects, internships, adaptability, teamwork, coachability, and genuine enthusiasm to learn.",
    mid: isTech
      ? "Focus on real-world problem-solving, design patterns, trade-offs, debugging instincts, and practical hands-on experience in production systems."
      : "Focus on daily team dynamics, taking ownership of tasks, handling competing deadlines, and navigating minor interpersonal conflicts.",
    senior: isTech
      ? "Focus on system design, distributed architecture, scalability trade-offs, deep performance considerations, and engineering leadership mindset."
      : "Focus on strategic leadership, cross-functional influence, mentoring junior engineers, navigating organizational ambiguity, and driving cultural change.",
  };

  // ─── Example questions per role × difficulty ─────────────────────────────────
  const exampleQuestions = {
    tech: {
      fresher: `"What is the difference between == and === in JavaScript and when does it actually matter?", "How does a hash map handle collisions internally?"`,
      mid: `"How would you design a rate limiter for a public API handling 10k RPS?", "What are the real-world trade-offs between Redux and React Context — and when have you chosen one over the other?"`,
      senior: `"Walk me through how you'd architect a distributed job queue that guarantees at-least-once delivery without a message broker.", "How do you handle consistency trade-offs when running a service across multiple regions with eventual consistency?"`,
    },
    system_design: {
      fresher: `"Design a URL shortener — walk me through every component you'd need.", "How would you design a basic key-value store? What happens when it needs to scale?"`,
      mid: `"Design a real-time notification system that needs to handle 1M concurrent users. Where do bottlenecks appear and how do you solve them?", "How would you design an API gateway that handles auth, rate limiting, and request routing?"`,
      senior: `"Architect a globally distributed database that guarantees low-latency reads with strong consistency — walk me through the trade-offs.", "Design a real-time collaborative editing system like Google Docs. How do you handle conflict resolution at scale?"`,
    },
    ai_engineer: {
      fresher: `"What is RAG and when would you use it instead of fine-tuning a model?", "Explain what vector embeddings are and how a vector database works in plain English."`,
      mid: `"You've built a RAG pipeline but it keeps retrieving irrelevant chunks. Walk me through how you'd systematically debug it.", "What are the real trade-offs between using a hosted LLM API versus self-hosting an open-source model in production?"`,
      senior: `"Design an LLM-powered feature that needs to be reliable, cost-efficient, and fully observable at scale — how do you architect it?", "How do you evaluate and monitor LLM output quality in production without requiring human review on every single request?"`,
    },
    hr: {
      fresher: `"Tell me about a time you had to pick up a new skill quickly under pressure — what was your process?", "Walk me through the last time you received critical feedback. What did you do with it?"`,
      mid: `"Tell me about a time you pushed back on a deadline you thought was unrealistic. How did you handle the conversation?", "What's the hardest professional decision you've made in the last year, and would you make it again?"`,
      senior: `"Describe a situation where you realized your own blind spot was slowing down your team. What did you do?", "How do you personally ensure your goals stay aligned with the company's direction as priorities shift?"`,
    },
    managerial: {
      fresher: `"Tell me about a time you stepped up to lead a group project when no one else would — what made you do it?", "How do you decide what to work on first when you have three urgent things hitting at once?"`,
      mid: `"Describe a situation where you noticed a process was quietly draining your team. How did you identify it and what did you actually change?", "How do you handle a team member who is technically strong but consistently misses deadlines?"`,
      senior: `"Tell me about a time you had to kill a project your team was emotionally invested in. How did you make the call and communicate it?", "How do you manage senior stakeholders when a critical project is delayed and the root cause is unclear?"`,
    },
  };

  const roleKey = isHR ? "hr"
    : isManagerial ? "managerial"
    : isSystemDesign ? "system_design"
    : isAIEngineer ? "ai_engineer"
    : "tech";

  const currentExamples = exampleQuestions[roleKey]?.[difficulty] ?? exampleQuestions.tech.mid;

  // ─── Role-specific evaluation blocks ─────────────────────────────────────────
  const roleBlock = isHR
    ? `
## Interview Type: HR / Culture Fit Round

## Your Behavior & Goal
- Evaluate personality, communication clarity, emotional intelligence, self-awareness, and cultural alignment.
- Ask modern, highly relevant behavioral and situational questions — nothing clichéd.
- When a candidate gives a vague or generic answer, immediately probe for a specific example: "Can you give me a concrete situation where that actually played out?"
- Listen for red flags: blame-shifting, lack of ownership, inability to reflect critically on their own decisions.

## Evaluation Signals to Watch
- Communication clarity and confidence without arrogance
- Honest self-awareness — can they discuss their own failures without deflecting?
- Structured thinking — do they naturally apply STAR (Situation, Task, Action, Result) or ramble?
- Growth mindset — do their answers show genuine learning, not just performance?
`
    : isManagerial
    ? `
## Interview Type: Managerial / Leadership Round

## Your Behavior & Goal
- You are an Engineering Manager evaluating leadership judgment, ownership, and decision-making ability.
- Put the candidate in genuinely difficult, ambiguous situations — not textbook scenarios.
- When they describe what they "would" do, redirect: "Tell me about a real time this happened."
- Look for accountability without victimhood: do they own failures or assign blame?

## Evaluation Signals to Watch
- Leadership instinct: do they lead from the front or manage from behind?
- Accountability: do they own failure as readily as success?
- Decision-making under pressure or incomplete information
- Conflict resolution: can they hold firm and stay fair simultaneously?
- Mentorship quality: how do they talk about growing others?
`
    : isSystemDesign
    ? `
## Interview Type: System Design Round

## Your Behavior & Goal
- You are evaluating architectural thinking, scalability instincts, and the ability to reason through complex trade-offs.
- Always push the candidate to clarify requirements before jumping to solutions. Penalize candidates who design without scoping first.
- Ask them to walk through components step by step. Challenge every assumption: "What happens when this component fails?", "How does this behave at 100x the load?"
- Push on: single points of failure, data modeling decisions, consistency vs. availability trade-offs, cost, and observability.

## Evaluation Signals to Watch
- Do they ask clarifying questions or jump straight to solutions?
- Can they identify bottlenecks and articulate trade-offs clearly?
- Do they understand the difference between what's theoretically correct and what's practically buildable?
- For ${difficulty === "fresher" ? "fresher level: focus on component identification, basic scaling concepts, and whether they understand why each piece exists." : difficulty === "mid" ? "mid level: focus on caching strategies, load balancing, database design, and handling failure scenarios." : "senior level: focus on distributed systems theory, CAP theorem application, global-scale architecture, and the business cost of technical decisions."}
`
    : isAIEngineer
    ? `
## Interview Type: AI / ML Engineer Round

## Your Behavior & Goal
- You are evaluating practical AI engineering ability — not academic theory, but real production-level thinking.
- Cover modern AI engineering topics: LLMs, RAG pipelines, vector databases, embeddings, fine-tuning, prompt engineering, model evaluation, and MLOps.
- Push beyond surface-level answers. Ask about real failure modes: hallucinations, latency issues, cost at scale, data quality, and model drift.
- If they mention a tool or technique, dig in: "Why that over the alternatives?", "What breaks when your data volume doubles?"

## Evaluation Signals to Watch
- Do they understand the difference between using AI tools and engineering AI systems?
- Can they debug a broken AI pipeline systematically, not just intuitively?
- Do they reason about cost, latency, and reliability — not just accuracy?
- For ${difficulty === "fresher" ? "fresher level: focus on core concepts — what LLMs are, how RAG works, what embeddings represent, and basic pipeline understanding." : difficulty === "mid" ? "mid level: focus on practical debugging of AI systems, trade-offs in model/tooling choices, and building reliable AI features." : "senior level: focus on production AI architecture, evaluation frameworks at scale, cost efficiency, and the organizational challenges of shipping AI reliably."}
`
    : `
## Interview Type: Technical Round

## Question Strategy
- Ask modern, production-relevant technical questions grounded in real engineering trade-offs.
- Avoid questions that reward rote memorization. Reward reasoning and adaptability.
- For ${difficulty === "fresher" ? "entry-level" : difficulty}-level candidates, calibrate depth accordingly — but always probe whether they truly understand or have just memorized.
- In 2026, AI coding tools are ubiquitous. Go beyond syntax: ask WHY, not just HOW. Push them to explain trade-offs, edge cases, and failure modes.
- If they answer quickly and cleanly, follow up with: "Why did you name it that way?", "What breaks under high load?", or "What would you do differently if you had a week more?"
`;

  // ─── Final assembled prompt ───────────────────────────────────────────────────
  return `
You are Ammy, a senior interviewer at a top-tier tech company. You are sharp, professional, and direct — respected for asking questions that separate truly strong candidates from coached ones.

You are NOT the candidate. You are conducting the interview.

Role being interviewed for: ${role}
Candidate Level: ${difficulty}
Focus Area: ${difficultyGuide[difficulty] || difficultyGuide.mid}

${roleBlock}

## Your Persona
- You have interviewed hundreds of engineers. You've heard every rehearsed answer.
- You are not unkind, but you do not sugarcoat. Your feedback is brief and candid.
- You believe strong candidates can explain their thinking clearly, under pressure, in plain English.
- You are especially attuned to candidates who clearly understand the "why" behind their answers vs. those who have memorized surface-level responses.

## Interview Structure — Exactly 7 Rounds
Track the round number internally. Do not announce it out loud.

- Round 1: A warm-up question to get the candidate talking naturally. Relevant to the role, not intimidating.
- Rounds 2–5: Progressively deeper questions. Build on their answers where possible. Introduce new dimensions if their answer opens a gap.
- Round 6: A scenario-based or situational curveball — something uncomfortable or genuinely ambiguous.
- Round 7: A final introspective question that tests self-awareness or long-term thinking. Then close the interview formally and professionally.

## Post-Answer Behavior
After every answer the candidate gives:
1. Deliver a candid, 1–2 line reaction. Be direct. Call out strong points or gaps honestly. Don't pad it.
2. Immediately ask the next question. No filler phrases like "Great!" or "That's interesting!"

## Strict Question Rules
- Ask ONE question per response. Never stack questions.
- No clichéd or outdated questions. Modernize them. Instead of "What is your weakness?", ask "Tell me about recent feedback that genuinely surprised you and how you acted on it."
- For behavioral prompts, if the candidate replies with what they "would" do hypothetically, push back: "I'm looking for a real example — can you think of a specific time this happened?"
- Calibrate question difficulty to the level: ${difficulty}.

## Question Caliber Reference
Examples of the kind of questions appropriate for this session: ${currentExamples}

## Hard Rules — Never Break These
- Never break character under any circumstances.
- Never reveal you are an AI, an LLM, or a simulated interviewer.
- Never ask "Do you have any questions for me?"
- No bullet points in your spoken responses. You are a human interviewer speaking naturally.
- Never exceed one question per turn.
- Never give the candidate the answer or hint at what a "correct" response looks like.
`.trim();
}

// ─── GROQ CHAT HELPER ────────────────────────────────────────────────────────
async function groqChat(history, role, difficulty) {
  // Build a dynamic "topics already covered" reminder to avoid repetition
  const arjunTurns = history.filter((m) => m.role === "arjun");
  const topicsSoFar = arjunTurns
    .map((m, i) => `Round ${i + 1}: ${m.text.slice(0, 100)}`)
    .join("\n");

  const dynamicReminder = topicsSoFar
    ? `\n\n## Topics Already Covered (DO NOT repeat these)\n${topicsSoFar}`
    : "";

  const systemPrompt = buildSystemPrompt(role, difficulty) + dynamicReminder;

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({
      role: m.role === "arjun" ? "assistant" : "user",
      content: m.text,
    })),
  ];

  // Groq requires the last message to be from "user"
  const last = messages[messages.length - 1];
  if (messages.length === 1 || last.role !== "user") {
    messages.push({
      role: "user",
      content:
        history.length === 0
          ? "Start the interview. Greet me briefly and ask your first question."
          : "continue",
    });
  }

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages,
    temperature: 0.65,       // focused, less rambling
    max_tokens: 280,         // keep responses tight
    presence_penalty: 0.6,  // discourages revisiting covered topics
    frequency_penalty: 0.4,
  });

  return completion.choices[0]?.message?.content?.trim() ?? "";
}

// ─── TTS HELPER ──────────────────────────────────────────────────────────────
async function synthesizeSpeech(_text) {
  return null; // client uses browser TTS when null
}

// ─── AUTH MIDDLEWARE ─────────────────────────────────────────────────────────
function authHR(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    req.hr = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  CANDIDATE ROUTES
// ════════════════════════════════════════════════════════════════════════════

// POST /api/voice-start
app.post("/api/voice-start", async (req, res) => {
  try {
    const {
      role = "Software Engineer",
      difficulty = "medium",
      candidateName = "Candidate",
    } = req.body;

    const db = req.app.locals.db;

    const session = {
      candidateName,
      role,
      difficulty,
      status: "active",
      history: [],
      roundScores: [],
      createdAt: new Date(),
    };

    const result = await db.collection("sessions").insertOne(session);
    const sessionId = result.insertedId.toString();

    const question = await groqChat([], role, difficulty);

    await db.collection("sessions").updateOne(
      { _id: result.insertedId },
      { $push: { history: { role: "arjun", text: question, round: 1 } } }
    );

    const audio = await synthesizeSpeech(question);
    res.json({ sessionId, question, audio, round: 1 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transcribe
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No audio file" });

    // ── Deepgram (PRIMARY) ───────────────────────────────────────────────────
    if (process.env.DEEPGRAM_API) {
      const dgRes = await fetch(
        "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=en",
        {
          method: "POST",
          headers: {
            Authorization: `Token ${process.env.DEEPGRAM_API}`,
            "Content-Type": req.file.mimetype || "audio/webm",
          },
          body: req.file.buffer,
        }
      );

      const dgData = await dgRes.json();
      const transcript =
        dgData?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim();
      if (transcript) return res.json({ transcript });
    }

    // ── Groq Whisper (FALLBACK) ──────────────────────────────────────────────
    const { Blob } = await import("buffer");
    const audioBlob = new Blob([req.file.buffer], {
      type: req.file.mimetype || "audio/webm",
    });
    audioBlob.name = "speech.webm";

    const transcription = await groq.audio.transcriptions.create({
      file: audioBlob,
      model: "whisper-large-v3-turbo",
      language: "en",
    });

    const transcript = transcription.text?.trim();
    if (transcript) return res.json({ transcript });

    return res
      .status(500)
      .json({ error: "Transcription failed — empty result" });
  } catch (err) {
    console.error("[transcribe]", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/voice-respond
app.post("/api/voice-respond", async (req, res) => {
  try {
    const { sessionId, transcript } = req.body;
    const db = req.app.locals.db;

    const session = await db.collection("sessions").findOne(
      { _id: new ObjectId(sessionId) },
      { projection: { history: 1, role: 1, difficulty: 1 } }
    );
    if (!session) return res.status(404).json({ error: "Session not found" });

    const currentRound = Math.floor(session.history.length / 2) + 1;
    const done = currentRound >= 7;

    // Keep a sliding window of recent history to stay within token limits
    // but always include the full context for the AI's "topics covered" summary
    const updatedHistory = [
      ...session.history.slice(-6),
      { role: "candidate", text: transcript, round: currentRound },
    ];

    const [response] = await Promise.all([
      done
        ? Promise.resolve(
            "That was great — thanks for your time today. Best of luck with the rest of your process!"
          )
        : groqChat(updatedHistory, session.role, session.difficulty),

      db.collection("sessions").updateOne(
        { _id: new ObjectId(sessionId) },
        {
          $push: {
            history: { role: "candidate", text: transcript, round: currentRound },
          },
        }
      ),
    ]);

    const [audio] = await Promise.all([
      synthesizeSpeech(response),
      db.collection("sessions").updateOne(
        { _id: new ObjectId(sessionId) },
        {
          $push: {
            history: {
              role: "arjun",
              text: response,
              round: currentRound + 1,
            },
          },
          ...(done ? { $set: { status: "completed" } } : {}),
        }
      ),
    ]);

    res.json({ response, audio, round: currentRound + 1, done });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/report
app.post("/api/report", async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    const db = req.app.locals.db;

    const session = await db
      .collection("sessions")
      .findOne({ _id: new ObjectId(sessionId) });

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

 // In the /api/report route, change historyText to this:
const historyText = session.history
  .map((h, i) => {
    const roundNum = Math.floor(i / 2) + 1;
    const label = h.role === "arjun" ? `Interviewer (Round ${roundNum})` : `Candidate answer (Round ${roundNum})`;
    return `${label}: ${h.text}`;
  })
  .join("\n");

    const prompt = `
You are a senior engineering hiring manager.

IMPORTANT:
- Return ONLY valid JSON
- DO NOT add explanation
- DO NOT use markdown
- DO NOT wrap in \`\`\`

Evaluate this interview:

Role: ${session.role}
Difficulty: ${session.difficulty}

Transcript:
${historyText}

Return JSON in this exact format:
{
  "overallScore": number,
  "roundScores": number[],
  "strengths": string[],
  "weaknesses": string[],
  "studyList": string[],
  "verdict": "Hire | Borderline | Reject",
  "summary": string,
  "answerImprovements": [
  {
    "round": number,
    "original": string,   // copy the candidate's EXACT words from the transcript above
    "improved": string,   // what a strong answer would look like
    "tip": string         // one-line tip on what was missing
  }
]

IMPORTANT: For "original", copy the candidate's actual answer verbatim from the transcript. Do not paraphrase or summarize it.
}

For answerImprovements: for each candidate answer, provide what a strong answer would have looked like, and a one-line tip on what was missing or could be sharper.
`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    let raw = completion.choices[0]?.message?.content?.trim();

    if (!raw) {
      return res.status(500).json({ error: "Empty AI response" });
    }

    raw = raw.replace(/```json|```/g, "").trim();

    let report;
    try {
      report = JSON.parse(raw);
    } catch {
      console.error("Invalid JSON from AI:", raw);
      return res.status(500).json({ error: "Invalid JSON from AI" });
    }

    await db.collection("sessions").updateOne(
      { _id: new ObjectId(sessionId) },
      {
        $set: {
          overallScore: report.overallScore,
          roundScores: report.roundScores,
          aiVerdict: report.verdict,
          report,
          completedAt: new Date(),
        },
      }
    );

    res.json(report);
  } catch (err) {
    console.error("Report API Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/upload-recording
app.post("/api/upload-recording", upload.single("video"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No video" });
    const { sessionId } = req.body;
    const db = req.app.locals.db;

    // STUB — swap in S3/R2 upload here when ready
    const url = `https://storage.example.com/recordings/${sessionId}.webm`;

    await db.collection("sessions").updateOne(
      { _id: new ObjectId(sessionId) },
      { $set: { recordingUrl: url } }
    );

    res.json({ url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  HR ROUTES
// ════════════════════════════════════════════════════════════════════════════

// POST /api/hr/login
app.post("/api/hr/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = req.app.locals.db;

    const company = await db
      .collection("companies")
      .findOne({ hrEmail: email });

    if (!company || !(await bcrypt.compare(password, company.hrPasswordHash))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { companyId: company._id.toString(), email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({ token, companyName: company.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/hr/candidates
app.get("/api/hr/candidates", authHR, async (req, res) => {
  try {
    const { role, minScore, page = 1 } = req.query;
    const db = req.app.locals.db;

    const filter = { status: "completed" };
    if (role) filter.role = role;
    if (minScore) filter.overallScore = { $gte: parseInt(minScore) };

    const candidates = await db
      .collection("sessions")
      .find(filter)
      .sort({ overallScore: -1 })
      .skip((page - 1) * 20)
      .limit(20)
      .project({ history: 0 })
      .toArray();

    res.json(candidates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/hr/candidate/:id
app.get("/api/hr/candidate/:id", authHR, async (req, res) => {
  try {
    const db = req.app.locals.db;

    const session = await db
      .collection("sessions")
      .findOne({ _id: new ObjectId(req.params.id) });
    if (!session) return res.status(404).json({ error: "Not found" });

    const note = await db
      .collection("hrNotes")
      .findOne({ sessionId: req.params.id });
    res.json({ ...session, hrNote: note || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hr/candidate/:id/note
app.post("/api/hr/candidate/:id/note", authHR, async (req, res) => {
  try {
    const { note, shortlisted } = req.body;
    const db = req.app.locals.db;

    await db.collection("hrNotes").updateOne(
      { sessionId: req.params.id },
      {
        $set: {
          note,
          shortlisted,
          reviewedAt: new Date(),
          reviewedBy: req.hr.email,
        },
      },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hr/seed
app.post("/api/hr/seed", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const db = req.app.locals.db;

    const hash = await bcrypt.hash(password, 10);
    await db
      .collection("companies")
      .insertOne({ name, hrEmail: email, hrPasswordHash: hash });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── HEALTH ──────────────────────────────────────────────────────────────────
app.get("/health", (_, res) => res.json({ status: "ok" }));

// ─── START ───────────────────────────────────────────────────────────────────
async function start() {
  await mongo.connect();
  const db = mongo.db("voiceinterview");
  app.locals.db = db;

  console.log("✅ MongoDB connected");

  await db.collection("sessions").createIndex({ overallScore: -1 });
  await db.collection("sessions").createIndex({ role: 1 });
  await db.collection("sessions").createIndex({ status: 1 });

  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`🚀 Server running on :${PORT}`));
}

start().catch(console.error);