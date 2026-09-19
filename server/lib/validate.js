// Shared input validation.

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/me/username — set/update the current user's username.
export const RESERVED_USERNAMES = new Set([
  "admin", "root", "support", "help", "staff", "moderator", "mod",
  "official", "system", "security", "billing", "abuse",
  "webmaster", "postmaster", "scholr", "derek",
]);
