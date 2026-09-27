import Anthropic from "@anthropic-ai/sdk";
import { requireUser, sameOrigin } from "../lib/auth.js";

const INSTRUCTIONS = `Eres un experto en marketing de fiestas y ocio nocturno en España. Un organizador vende entradas en Entradium. Con estos datos, dile en español, de tú y directo, qué hacer para vender más entradas. Nada genérico: cada consejo tiene que salir de un dato de abajo (line-up, tramo actual y cuántas quedan, siguiente tramo y su precio, franja y días en que compra su público, presupuesto, relaciones públicas, lo que ya ha hecho). Si falta un dato clave, dilo en una línea y sigue.
1. Diagnóstico en 2 frases con números: ¿llega al aforo? ¿qué es lo que más está frenando o empujando la venta?
2. Las 3 prioridades de hoy, en orden, cada una con el porqué en números.
3. Palancas: cuándo y cómo desvelar (o aprovechar) el line-up, cómo usar el cierre del tramo actual y la subida de precio del siguiente (fecha y mensaje de urgencia), y a qué hora y qué días publicar según cuándo compra su público.
4. Plan día a día hasta la fiesta (máximo 7 días; si faltan más, por semanas): feed, stories y TikTok, con hora de publicación y un texto de ejemplo listo para copiar.
5. Si hay presupuesto, cómo repartirlo (plataforma, días, público, importe). Si hay relaciones públicas, qué pedirles esta semana.
No repitas lo que ya ha hecho salvo para mejorarlo. Sin relleno. Usa listas cortas. Texto plano, sin tablas. No inventes datos que no estén aquí.`;

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
