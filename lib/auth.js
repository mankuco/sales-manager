import crypto from "node:crypto";

const COOKIE = "rt_session";
const MAX_AGE = 30 * 24 * 3600; // 30 days

// APP_USERS="manu:contraseña,socio:otra" (set in Vercel → Settings → Environment Variables)
export function users() {
  const out = new Map();
  for (const pair of (process.env.APP_USERS || "").split(",")) {
    const i = pair.indexOf(":");
    if (i > 0) out.set(pair.slice(0, i).trim().toLowerCase(), pair.slice(i + 1).trim());
  }
  return out;
}

function secret() {
  return process.env.SESSION_SECRET || crypto.createHash("sha256").update("radar-taquilla:" + (process.env.APP_USERS || "")).digest("hex");
}
const sign = (v) => crypto.createHmac("sha256", secret()).update(v).digest("base64url");
function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function checkPassword(user, password) {
  const expected = users().get(String(user || "").trim().toLowerCase());
  // compare against a dummy when the user does not exist so timing does not reveal valid names
  const ok = safeEqual(expected ?? crypto.randomBytes(16).toString("hex"), password || "");
  return Boolean(expected) && ok;
}

export function setSession(res, user) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const v = Buffer.from(JSON.stringify({ u: user, exp })).toString("base64url");
  res.setHeader("Set-Cookie", `${COOKIE}=${v}.${sign(v)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`);
}
export function clearSession(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

export function sessionUser(req) {
  const raw = (req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  if (!raw) return null;
  const [v, sig] = raw.slice(COOKIE.length + 1).split(".");
  if (!v || !sig || !safeEqual(sign(v), sig)) return null;
  try {
    const { u, exp } = JSON.parse(Buffer.from(v, "base64url").toString());
    if (!u || exp < Date.now() / 1000 || !users().has(u)) return null; // removing a user from APP_USERS logs them out
    return u;
  } catch { return null; }
}

export function requireUser(req, res) {
  const u = sessionUser(req);
  if (!u) res.status(401).json({ error: "Tu sesión ha caducado. Vuelve a entrar." });
  return u;
}

// Same-origin check for state-changing requests (cookie auth).
export function sameOrigin(req) {
  const origin = req.headers.origin;
  return !origin || origin === `https://${req.headers.host}` || origin === `http://${req.headers.host}`;
}
