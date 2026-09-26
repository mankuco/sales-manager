import { Redis } from "@upstash/redis";
import { createClient } from "redis";

// Finds whatever Redis the Vercel project has connected and exposes the few commands the app uses.
// Supports Upstash / Vercel KV REST variables (any prefix) and plain redis:// URLs (Vercel "Redis").

function findRest() {
  const env = process.env;
  for (const [name, url] of Object.entries(env)) {
    const m = name.match(/^(.*?)(KV_REST_API_URL|REDIS_REST_URL|REDIS_REST_API_URL)$/);
    if (!m || !/^https:\/\//.test(url || "")) continue;
    const token = env[m[1] + m[2].replace(/URL$/, "TOKEN")];
    if (token) return { url, token, source: name };
  }
  return null;
}

function findTcp() {
  for (const [name, url] of Object.entries(process.env)) {
    if (/(REDIS_URL|KV_URL)$/.test(name) && /^rediss?:\/\//.test(url || "")) return { url, source: name };
  }
  return null;
}

function restStore({ url, token, source }) {
  const r = new Redis({ url, token, automaticDeserialization: false });
  return {
    source,
    get: (k) => r.get(k),
    incr: (k) => r.incr(k),
    expire: (k, s) => r.expire(k, s),
    del: (k) => r.del(k),
    hgetall: async (k) => {
      const v = await r.hgetall(k);
      if (!Array.isArray(v)) return v || {};
      const o = {}; // without deserialization the client returns [field, value, ...]
      for (let i = 0; i < v.length; i += 2) o[v[i]] = v[i + 1];
      return o;
    },
    hset: (k, obj) => r.hset(k, obj),
    hdel: (k, f) => r.hdel(k, f),
  };
}

let tcpClient = null;
function tcpStore({ url, source }) {
  if (!tcpClient) {
    tcpClient = createClient({ url });
    tcpClient.on("error", (e) => console.error("redis", e.message));
  }
  const c = async () => { if (!tcpClient.isOpen) await tcpClient.connect(); return tcpClient; };
  return {
    source,
    get: async (k) => (await c()).get(k),
    incr: async (k) => (await c()).incr(k),
    expire: async (k, s) => (await c()).expire(k, s),
    del: async (k) => (await c()).del(k),
    hgetall: async (k) => (await c()).hGetAll(k),
    hset: async (k, obj) => (await c()).hSet(k, obj),
    hdel: async (k, f) => (await c()).hDel(k, f),
  };
}

let store;
export function db() {
  if (store !== undefined) return store;
  const rest = findRest();
  const tcp = rest ? null : findTcp();
  store = rest ? restStore(rest) : tcp ? tcpStore(tcp) : null;
  return store;
}

// Names (never values) of variables that look database-related, to help diagnose setup.
export function dbEnvNames() {
  return Object.keys(process.env).filter((n) => /REDIS|KV_|UPSTASH/.test(n)).sort();
}
