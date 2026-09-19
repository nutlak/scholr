// Notebook helpers shared by the notebook and user routes.
import { supabase } from "./supabase.js";

// Delete the actual stored files in the "notebook-images" bucket for the given
// notebook ids. DB rows cascade on notebook/account delete; this clears the
// orphaned storage objects. Defensive — logs and continues, never throws.
export async function removeNotebookImageFiles(notebookIds) {
  try {
    const ids = (notebookIds ?? []).filter(Boolean);
    if (!ids.length) return;
    const { data, error } = await supabase
      .from("notebook_images").select("storage_path").in("notebook_id", ids);
    if (error) { console.error("[storage cleanup] notebook_images query failed:", error.message); return; }
    const paths = [...new Set((data ?? []).map(r => r.storage_path).filter(Boolean))];
    for (let i = 0; i < paths.length; i += 100) {
      const { error: rmErr } = await supabase.storage.from("notebook-images").remove(paths.slice(i, i + 100));
      if (rmErr) console.error("[storage cleanup] notebook-images remove failed:", rmErr.message);
    }
  } catch (e) {
    console.error("[storage cleanup] notebook-images unexpected error:", e?.message ?? e);
  }
}

// First-run sample notebook — an instant AI "aha" for a brand-new user instead
// of an empty dashboard. Idempotent: only seeds when the user owns 0 notebooks;
// also marks onboarding done so the setup wizard doesn't double up.
export const WELCOME_NOTE = `Welcome to Scholr! This is a sample note so you can see how it works.

Scholr turns your class notes into a study buddy named Derek:

1) Upload your notes — PDFs, slides, photos, or pasted text. Derek reads them.
2) Ask Derek anything — "explain this like I'm 12", "quiz me", "what's the main idea?" — and he answers using YOUR notes.
3) Study smarter — make flashcards and study guides with Forge, test yourself with Feynman Mode, and share notebooks with your study group.

Try it now: tap "Ask AI about this" below and Derek will summarize this note and quiz you. That's your first question — go.

Sample fact to quiz on: the mitochondria is the powerhouse of the cell — it produces ATP through cellular respiration.`;
