import { sessionUser } from "../lib/auth.js";
import { db } from "../lib/store.js";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ user: sessionUser(req), ai: Boolean(process.env.ANTHROPIC_API_KEY), storage: Boolean(db()) });
}
