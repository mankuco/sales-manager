import { requireUser, sameOrigin } from "../lib/auth.js";
import { db, dbEnvNames } from "../lib/store.js";

const KEY = "events"; // Redis hash: party id -> party JSON
const ID = /^[A-Za-z0-9_-]{1,80}$/;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const user = requireUser(req, res);
  if (!user) return;
  const r = db();
  if (!r) {
    const found = dbEnvNames();
    return res.status(503).json({ error: found.length
      ? `No reconozco la base de datos. Variables encontradas: ${found.join(", ")}.`
      : "No hay ninguna base de datos conectada a este proyecto en Vercel (Storage). Si ya la conectaste, haz Redeploy." });
  }

  if (req.method === "GET") {
    const all = (await r.hgetall(KEY)) || {};
    const events = Object.entries(all).map(([id, v]) => ({ ...(typeof v === "string" ? JSON.parse(v) : v), id }));
    return res.status(200).json({ events });
  }
  if (!sameOrigin(req)) return res.status(403).json({ error: "Origen no permitido." });

  if (req.method === "PUT") {
    const ev = req.body && req.body.event;
    if (!ev || !ID.test(ev.id || "")) return res.status(400).json({ error: "Fiesta no válida." });
    const json = JSON.stringify({ ...ev, updatedBy: user });
    if (json.length > 900_000) return res.status(413).json({ error: "La fiesta tiene demasiados datos." });
    await r.hset(KEY, { [ev.id]: json });
    return res.status(200).json({ ok: true });
  }
  if (req.method === "DELETE") {
    const id = String(req.query.id || "");
    if (!ID.test(id)) return res.status(400).json({ error: "Fiesta no válida." });
    await r.hdel(KEY, id);
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: "Método no permitido." });
}
