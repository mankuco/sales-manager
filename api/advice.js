import Anthropic from "@anthropic-ai/sdk";
import { requireUser, sameOrigin } from "../lib/auth.js";

const INSTRUCTIONS = `Eres un experto en marketing de fiestas y ocio nocturno en España. Un organizador vende entradas en Entradium. Con estos datos, dile en español, de tú y directo:
1. Diagnóstico en 2 frases: ¿va bien o tiene que apretar en redes? Justifícalo con los números.
2. Plan día a día hasta la fiesta (máximo 7 días; si faltan más, por semanas): qué publicar en feed, stories y TikTok cada día, con ideas concretas de contenido y textos de ejemplo.
3. Tres acciones extra de alto impacto (relaciones públicas, sorteos, anuncios pagados con presupuesto orientativo, precios/tandas).
Sin relleno. Usa listas cortas. Texto plano, sin tablas. No inventes datos que no estén aquí.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido." });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: "Falta la clave de Anthropic en Vercel." });
  if (!sameOrigin(req)) return res.status(403).json({ error: "Origen no permitido." });
  if (!requireUser(req, res)) return;

  const data = req.body && req.body.data;
  const payload = JSON.stringify(data ?? {}, null, 1);
  if (!data || payload.length > 30000) return res.status(400).json({ error: "Datos de la fiesta no válidos." });

  try {
    const client = new Anthropic();
    const msg = await client.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      messages: [{ role: "user", content: `${INSTRUCTIONS}\n\nDATOS:\n${payload}` }],
    });
    if (msg.stop_reason === "refusal") return res.status(422).json({ error: "Claude no ha podido generar este plan. Prueba otra vez." });
    const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    return res.status(200).json({ text });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return res.status(429).json({ error: "Demasiadas peticiones. Prueba en un rato." });
    if (e instanceof Anthropic.AuthenticationError) return res.status(500).json({ error: "La clave de Anthropic no es válida." });
    console.error(e);
    return res.status(502).json({ error: "No se pudo generar el plan. Prueba otra vez." });
  }
}
