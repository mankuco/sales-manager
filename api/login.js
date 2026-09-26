import { checkPassword, setSession, sameOrigin, users } from "../lib/auth.js";
import { db } from "../lib/store.js";

const WINDOW = 15 * 60, MAX_TRIES = 10;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido." });
  if (!sameOrigin(req)) return res.status(403).json({ error: "Origen no permitido." });
  if (!users().size) return res.status(503).json({ error: "No hay usuarios configurados (falta APP_USERS en Vercel)." });

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  const r = db();
  const key = `login-fails:${ip}`;
  if (r) {
    const fails = Number(await r.get(key)) || 0;
    if (fails >= MAX_TRIES) return res.status(429).json({ error: "Demasiados intentos. Espera 15 minutos." });
  }

  const { user, password } = req.body || {};
  if (!checkPassword(user, password)) {
    if (r) { await r.incr(key); await r.expire(key, WINDOW); }
    return res.status(401).json({ error: "Usuario o contraseña incorrectos." });
  }
  if (r) await r.del(key);
  const name = String(user).trim().toLowerCase();
  setSession(res, name);
  return res.status(200).json({ user: name });
}
