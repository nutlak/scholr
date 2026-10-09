// Signup, OTP, password reset, sign-out and account deletion.
import { Router } from "express";
import { otpIpLimiter, otpSendEmailLimiter, otpVerifyLimiter, resetLimiter } from "../lib/limiters.js";
import { removeNotebookImageFiles } from "../lib/notebooks.js";
import { OTP_MAX_VERIFY_FAILS, generateOtp, generateToken, invalidateOldCodes, otpFailures } from "../lib/otp.js";
import { checkPassword } from "../lib/password.js";
import { supabase } from "../lib/supabase.js";
import { sendOtpEmail } from "../email.js";
import { MIN_AGE, ageFromDob, needsSignupCompletion, welcomeNewAccount } from "../lib/signup.js";
import { requireAuth } from "../lib/auth.js";
import { requireTurnstile } from "../lib/turnstile.js";

export const router = Router();

// POST /api/auth/send-otp — generate & email a 6-digit code
// type: "signup" | "password_reset"
router.post("/api/auth/send-otp", otpIpLimiter, otpSendEmailLimiter, requireTurnstile, async (req, res) => {
  const { email, type } = req.body;
  if (!email || !type) return res.status(400).json({ error: "email and type are required" });
  if (!["signup", "password_reset"].includes(type))
    return res.status(400).json({ error: "Invalid type" });

  // A lookup error used to read as "no such account": signup let duplicates
  // through and reset quietly sent nothing. Fail loudly instead.
  const { data: uid, error: lookupErr } = await supabase.rpc("get_user_id_by_email", { target_email: email });
  if (lookupErr) {
    console.error("[send-otp] get_user_id_by_email failed:", lookupErr.message);
    return res.status(500).json({ error: "Something went wrong on our side. Try again in a minute." });
  }
  let userId = null;
  if (type === "signup") {
    if (uid) return res.status(400).json({ error: "An account with this email already exists. Please log in instead." });
  } else {
    if (!uid) return res.json({ ok: true }); // don't reveal whether email is registered
    userId = uid;
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await invalidateOldCodes(email, type);

  const { error: insertErr } = await supabase.from("verification_codes").insert({
    email, code, type, user_id: userId, expires_at: expiresAt,
  });
  if (insertErr) {
    console.error("[send-otp] verification_codes insert failed:", insertErr.message);
    return res.status(500).json({ error: "Something went wrong on our side. Try again in a minute." });
  }

  try {
    await sendOtpEmail(email, code, type);
  } catch (err) {
    console.error("Email send error:", err.message);
    return res.status(500).json({ error: "Couldn't send the verification email. Try again in a minute." });
  }

  res.json({ ok: true });
});

// POST /api/auth/verify-otp — validate code; create user (signup) or return reset token (password_reset)
router.post("/api/auth/verify-otp", otpIpLimiter, otpVerifyLimiter, async (req, res) => {
  const { email, code, type, password, fullName } = req.body;
  if (!email || !code || !type) return res.status(400).json({ error: "email, code, and type are required" });

  const { data: row } = await supabase
    .from("verification_codes")
    .select("id, user_id")
    .eq("email", email)
    .eq("code", code)
    .eq("type", type)
    .eq("used", false)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const failKey = String(email).trim().toLowerCase();
  if (!row) {
    const fails = (otpFailures.get(failKey) ?? 0) + 1;
    otpFailures.set(failKey, fails);
    if (fails >= OTP_MAX_VERIFY_FAILS) {
      await invalidateOldCodes(email, type); // burn outstanding codes after repeated wrong guesses
      otpFailures.delete(failKey);
      return res.status(429).json({ error: "Too many incorrect attempts. Please request a new code." });
    }
    return res.status(400).json({ error: "Invalid or expired verification code." });
  }
  otpFailures.delete(failKey); // correct code — clear the brute-force counter

  if (type === "signup") {
    if (!password) return res.status(400).json({ error: "password is required" });
    // Same policy as reset — length, common-password and breach screening. The
    // client checks this too, for the feedback, but the client's check is a
    // convenience: this endpoint takes a password field straight from the
    // request body, so the rule that counts is the one enforced here.
    const pwError = await checkPassword(password, { email });
    if (pwError) return res.status(400).json({ error: pwError });
    if (req.body?.termsAccepted !== true) {
      return res.status(400).json({ error: "You must be at least 13 and accept the Terms of Service and Privacy Policy to create an account." });
    }

    // ── Age gate (COPPA): authoritative server-side check. The account is NOT
    // created if this fails.
    const dateOfBirth = typeof req.body?.dateOfBirth === "string" ? req.body.dateOfBirth.trim() : "";
    const ageNow = ageFromDob(dateOfBirth);
    if (Number.isNaN(ageNow)) return res.status(400).json({ error: "A valid date of birth is required." });
    if (ageNow < MIN_AGE) return res.status(403).json({ error: "You must be at least 13 to use Scholr." });

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName?.trim() ?? "" },
    });

    if (createErr) {
      if (createErr.message.toLowerCase().includes("already")) {
        return res.status(400).json({ error: "An account with this email already exists. Please log in." });
      }
      return res.status(500).json({ error: createErr.message });
    }

    if (created?.user?.id) {
      await welcomeNewAccount({ uid: created.user.id, email, name: fullName, dateOfBirth });
    }

    await supabase.from("verification_codes").update({ used: true }).eq("id", row.id);
    return res.json({ ok: true });
  }

  // password_reset: issue a single-use, short-lived reset token. The row's
  // expires_at is re-stamped here so the token carries its own 15-minute
  // window rather than inheriting the code's remaining seconds — and so
  // reset-password has something to check it against.
  const resetToken = generateToken();
  await supabase
    .from("verification_codes")
    .update({
      used: true,
      reset_token: resetToken,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    })
    .eq("id", row.id);

  res.json({ ok: true, resetToken });
});

// POST /api/auth/complete-signup — the age gate and terms for accounts made by
// Google sign-in, which Supabase creates without ever reaching verify-otp.
// requireAuth lets a not-yet-completed account reach only this and sign-out.
router.post("/api/auth/complete-signup", requireAuth, async (req, res) => {
  const user = req.user;
  if (!needsSignupCompletion(user)) return res.json({ ok: true });
  if (req.body?.termsAccepted !== true) {
    return res.status(400).json({ error: "Please confirm you're at least 13 and accept the Terms and Privacy Policy." });
  }
  const dateOfBirth = typeof req.body?.dateOfBirth === "string" ? req.body.dateOfBirth.trim() : "";
  const age = ageFromDob(dateOfBirth);
  if (Number.isNaN(age)) return res.status(400).json({ error: "Please enter a valid date of birth." });
  if (age < MIN_AGE) {
    // COPPA: an under-13 account can't be kept at all, not just blocked.
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) console.error("[complete-signup] under-13 delete failed:", error.message);
    return res.status(403).json({ error: "You must be at least 13 to use Scholr.", deleted: true });
  }

  const { error: metaErr } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, age_verified: true },
  });
  if (metaErr) {
    console.error("[complete-signup] app_metadata update failed:", metaErr.message);
    return res.status(500).json({ error: "Something went wrong on our side. Try again in a minute." });
  }
  const meta = user.user_metadata ?? {};
  await welcomeNewAccount({
    uid: user.id, email: user.email, name: meta.full_name ?? meta.name, dateOfBirth,
  });
  res.json({ ok: true });
});

// POST /api/auth/reset-password — set a new password using a verified reset token
router.post("/api/auth/reset-password", resetLimiter, async (req, res) => {
  const { resetToken, newPassword } = req.body;
  if (!resetToken || !newPassword) return res.status(400).json({ error: "resetToken and newPassword are required" });

  const { data: row } = await supabase
    .from("verification_codes")
    .select("user_id")
    .eq("reset_token", resetToken)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!row?.user_id) return res.status(400).json({ error: "Invalid or expired reset token" });

  // Checked after the token, deliberately: this runs a network call and reveals
  // which passwords are breached, so it stays behind proof that the caller
  // actually holds a valid reset token rather than being a free oracle.
  const pwError = await checkPassword(newPassword);
  if (pwError) return res.status(400).json({ error: pwError });

  const { error: updateErr } = await supabase.auth.admin.updateUserById(row.user_id, { password: newPassword });
  if (updateErr) return res.status(500).json({ error: updateErr.message });

  // Consume the token so it can't be reused
  await supabase.from("verification_codes").update({ reset_token: null }).eq("reset_token", resetToken);

  res.json({ ok: true });
});

// POST /api/auth/change-password — set a new password for the signed-in user
//
// Exists so that EVERY path that sets a password goes through one policy. The
// in-app reset screen used to call supabase.auth.updateUser() straight from the
// browser, which works but answers to Supabase's own minimum and nothing else —
// so the breach and common-password screening applied at signup and at
// token-based reset simply didn't exist on that path. Three ways to set a
// password, two of them checked, is the same as none of them being checked.
router.post("/api/auth/change-password", requireAuth, resetLimiter, async (req, res) => {
  const { newPassword } = req.body ?? {};
  if (!newPassword) return res.status(400).json({ error: "newPassword is required" });

  const pwError = await checkPassword(newPassword, { email: req.user.email });
  if (pwError) return res.status(400).json({ error: pwError });

  const { error } = await supabase.auth.admin.updateUserById(req.user.id, { password: newPassword });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// POST /api/auth/sign-out — server-side session invalidation
// The real work (clearing local session) happens via supabase.auth.signOut() on the client.
// This endpoint exists so the frontend has a consistent API surface and lets us
// invalidate the session server-side if needed in the future.
router.post("/api/auth/sign-out", requireAuth, async (req, res) => {
  res.status(200).json({ success: true });
});

// DELETE /api/auth/delete-account — permanently delete the calling user's account
router.delete("/api/auth/delete-account", requireAuth, async (req, res) => {
  const userId = req.user.id;
  console.log(`[delete-account] starting for user=${userId}`);

  // Resilient step runner: one failing cleanup step must never abort the whole
  // deletion. Logs BOTH thrown errors and Supabase-returned { error } objects
  // (supabase-js resolves with { error } instead of throwing), then proceeds.
  const step = async (label, fn) => {
    try {
      const result = await fn();
      if (result?.error) console.error(`[delete-account] ${label} error:`, result.error.message ?? result.error);
    } catch (e) {
      console.error(`[delete-account] ${label} threw:`, e?.message ?? e);
    }
  };

  // Extract a bucket-relative path from a full Supabase public URL.
  // URL shape: https://*.supabase.co/storage/v1/object/public/scholr/{path}[?download=…]
  const extractPath = (url) => {
    if (!url) return null;
    const marker = "/object/public/scholr/";
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(url.slice(idx + marker.length).split("?")[0]);
  };

  // Remove a list of Storage paths from the "scholr" bucket in batches of 100.
  const removeStoragePaths = async (paths) => {
    const clean = (paths ?? []).filter(Boolean);
    for (let i = 0; i < clean.length; i += 100) {
      await step(`storage remove batch ${i}`, () =>
        supabase.storage.from("scholr").remove(clean.slice(i, i + 100)));
    }
  };

  try {
    // 0. Delete notebooks OWNED by this user + their Storage files. Postgres
    //    CASCADE on notebook_id removes notes/messages/members/forge_outputs/
    //    unit_notes/reactions/comments/podcasts that live in those notebooks.
    //    (Collaborator-only notebooks owned by others are left intact.)
    let ownedNotebookIds = [];
    await step("query owned notebooks", async () => {
      const { data, error } = await supabase
        .from("notebook_members").select("notebook_id")
        .eq("user_id", userId).eq("role", "owner");
      if (!error) ownedNotebookIds = (data ?? []).map(m => m.notebook_id);
      return { error };
    });

    if (ownedNotebookIds.length > 0) {
      const [{ data: noteFiles }, { data: podcastFiles }] = await Promise.all([
        supabase.from("notes").select("file_url").in("notebook_id", ownedNotebookIds).not("file_url", "is", null),
        supabase.from("podcasts").select("audio_url").in("notebook_id", ownedNotebookIds).not("audio_url", "is", null),
      ]);
      await removeStoragePaths([
        ...(noteFiles ?? []).map(f => extractPath(f.file_url)),
        ...(podcastFiles ?? []).map(f => extractPath(f.audio_url)),
      ]);
      // Purge generated-image files for owned notebooks before the cascade
      // removes their notebook_images rows.
      await step("remove owned-notebook image files", () => removeNotebookImageFiles(ownedNotebookIds));
      await step("delete owned notebooks", () =>
        supabase.from("notebooks").delete().in("id", ownedNotebookIds));
    }
    console.log(`[delete-account] owned notebooks processed: ${ownedNotebookIds.length}`);

    // 0a. Images this user saved into notebooks owned by OTHERS: the rows cascade
    //     on auth-user delete, but the storage files would orphan. Remove them.
    await step("remove user image files", async () => {
      const { data, error } = await supabase
        .from("notebook_images").select("storage_path").eq("user_id", userId);
      if (error) return { error };
      const paths = [...new Set((data ?? []).map(r => r.storage_path).filter(Boolean))];
      for (let i = 0; i < paths.length; i += 100) {
        await supabase.storage.from("notebook-images").remove(paths.slice(i, i + 100));
      }
      return {};
    });

    // 0b. ROOT-CAUSE FIX. podcasts.created_by REFERENCES auth.users(id) WITHOUT
    //     ON DELETE CASCADE (migration 019). Podcasts the user created in a
    //     notebook they DON'T own are not covered by the owned-notebook cascade
    //     above, so they linger and make admin.deleteUser fail with a foreign-key
    //     violation. Remove every podcast authored by this user (+ its audio file)
    //     before deleting the auth user.
    await step("collect + remove user podcast audio", async () => {
      const { data, error } = await supabase
        .from("podcasts").select("id, audio_url").eq("created_by", userId);
      if (!error) {
        await removeStoragePaths((data ?? []).map(p =>
          extractPath(p.audio_url) ?? `podcasts/${p.id}.mp3`));
      }
      return { error };
    });
    await step("delete user podcasts", () =>
      supabase.from("podcasts").delete().eq("created_by", userId));

    // 0c. Remove this user's authored content that may live in notebooks owned by
    //     OTHERS (their author columns can be non-cascade FKs to auth.users too).
    //     Also fulfils the "deleting your account removes your content" disclosure.
    await step("delete user note_reactions", () => supabase.from("note_reactions").delete().eq("user_id", userId));
    await step("delete user note_comments",  () => supabase.from("note_comments").delete().eq("user_id", userId));
    await step("delete user unit_notes",      () => supabase.from("unit_notes").delete().eq("user_id", userId));
    await step("delete user forge_outputs",   () => supabase.from("forge_outputs").delete().eq("user_id", userId));
    await step("delete user-uploaded notes",  () => supabase.from("notes").delete().eq("uploader_id", userId));

    // 1–11. Clear the remaining direct references to auth.users. Each is
    //     independent — a failure (e.g. a table that doesn't exist yet because a
    //     migration is pending) is logged and skipped, never aborting the delete.
    await step("delete subscriptions",     () => supabase.from("subscriptions").delete().eq("user_id", userId));
    await step("delete profiles",          () => supabase.from("profiles").delete().eq("user_id", userId));
    await step("delete terms_acceptances", () => supabase.from("terms_acceptances").delete().eq("user_id", userId));
    await step("delete usage",             () => supabase.from("usage").delete().eq("user_id", userId));
    await step("delete notifications",      () => supabase.from("notifications").delete().eq("user_id", userId));
    await step("delete activities",         () => supabase.from("activities").delete().eq("user_id", userId));
    await step("delete messages",           () => supabase.from("messages").delete().eq("created_by", userId));
    await step("delete invites",            () => supabase.from("invites").delete().eq("created_by", userId));
    await step("delete starred_notebooks",  () => supabase.from("starred_notebooks").delete().eq("user_id", userId));
    await step("delete notebook_members",   () => supabase.from("notebook_members").delete().eq("user_id", userId));
    await step("delete daily_activity",      () => supabase.from("daily_activity").delete().eq("user_id", userId));

    // 12. Finally delete the auth user. This ALWAYS runs as long as the caller is
    //     authenticated, even if some cleanup steps above logged failures.
    console.log("[delete-account] calling admin.deleteUser");
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      // Full cause is logged server-side only — never returned to the client.
      console.error("[delete-account] admin.deleteUser failed:", error.message, JSON.stringify(error));
      return res.status(500).json({ error: "Failed to delete account. Please try again." });
    }

    console.log(`[delete-account] success for user=${userId}`);
    res.status(204).end();
  } catch (err) {
    // Full cause is logged server-side only — never returned to the client.
    console.error("[delete-account] Unexpected error:", err);
    res.status(500).json({ error: "Failed to delete account. Please try again." });
  }
});
