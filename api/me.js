import { sessionUser } from "../lib/auth.js";
import { db, dbEnvNames } from "../lib/store.js";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const user = sessionUser(req);
  const store = db();
  res.status(200).json({
    user,
    ai: Boolean(process.env.ANTHROPIC_API_KEY),
    storage: Boolean(store),
    // setup diagnostics, only for signed-in users and only variable names
    ...(user ? { storageSource: store?.source || null, dbEnv: dbEnvNames() } : {}),
  });
}
