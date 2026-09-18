import { supabase, supabaseAuth } from "./supabase.js";

export async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (process.env.DEBUG === "true") {
    console.log("requireAuth: checking token for", req.method, req.path);
    console.log("requireAuth: token present:", !!token);
  }
  if (!token) {
    console.warn(`requireAuth: no token on ${req.method} ${req.path}`);
    return res.status(401).json({ error: "Missing auth token" });
  }

  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data.user) {
    console.log("requireAuth: verification failed:", error?.message ?? "no user returned");
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  req.user = data.user;
  next();
}

// Verify the caller is a member of the given notebook.
export async function requireMember(req, res, next) {
  const { data, error } = await supabase
    .from("notebook_members")
    .select("role")
    .eq("notebook_id", req.params.id)
    .eq("user_id", req.user.id)
    .maybeSingle();

  if (error) {
    console.error(`requireMember: DB error for notebook=${req.params.id} user=${req.user.id}:`, error);
    return res.status(500).json({ error: "Membership check failed" });
  }
  if (!data) {
    console.warn(`requireMember: DENIED — user=${req.user.id} is not a member of notebook=${req.params.id}`);
    return res.status(403).json({ error: "Not a member of this notebook" });
  }
  req.membership = data; // { role: 'owner' | 'member' }
  next();
}
