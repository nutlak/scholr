import { useEffect, useState } from "react";
import { api } from "../../api.js";
import { MessageCircle, Plus, Smile, X } from "lucide-react";
import { Avatar } from "../../ui/Avatar.jsx";
import { FONT, MONO, REACTION_EMOJIS } from "../../lib/theme.js";
import { timeAgo } from "../../lib/format.js";

export function UnitNoteRow({ note, currentUserId, tint, onDelete, onChange }) {
  const author = note.first_name || note.full_name || note.email?.split("@")[0] || "Member";
  const mine = note.user_id === currentUserId;
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [reactionUsers, setReactionUsers] = useState(null); // hover tooltip cache

  // Build aggregated reaction counts from note.reactions = [{ emoji, user_id }]
  const reactionMap = {};
  for (const r of note.reactions ?? []) {
    if (!reactionMap[r.emoji]) reactionMap[r.emoji] = { emoji: r.emoji, count: 0, mine: false, userIds: [] };
    reactionMap[r.emoji].count++;
    reactionMap[r.emoji].userIds.push(r.user_id);
    if (r.user_id === currentUserId) reactionMap[r.emoji].mine = true;
  }
  const reactionList = Object.values(reactionMap);
  const [pickerOpen, setPickerOpen] = useState(false);

  async function toggleReaction(emoji) {
    const existing = (note.reactions ?? []).find(r => r.user_id === currentUserId && r.emoji === emoji);
    const next = existing
      ? (note.reactions ?? []).filter(r => !(r.user_id === currentUserId && r.emoji === emoji))
      : [...(note.reactions ?? []), { emoji, user_id: currentUserId }];
    onChange({ reactions: next });
    try {
      if (existing) await api.removeReaction(note.id, emoji);
      else await api.addReaction(note.id, emoji);
    } catch (err) {
      console.error("reaction toggle failed:", err);
      onChange({ reactions: note.reactions ?? [] });
    }
  }

  async function loadComments() {
    setCommentsOpen(true);
    if (commentsLoaded) return;
    try {
      const rows = await api.getNoteComments(note.id);
      setComments(rows);
      setCommentsLoaded(true);
    } catch (err) {
      console.error(err);
      setCommentsLoaded(true);
    }
  }

  async function addComment(e) {
    e.preventDefault();
    const text = commentDraft.trim();
    if (!text || postingComment) return;
    setPostingComment(true);
    try {
      const c = await api.addNoteComment(note.id, text);
      setComments(cs => [...cs, c]);
      setCommentDraft("");
      onChange({ comment_count: (note.comment_count ?? 0) + 1 });
    } catch (err) {
      console.error(err);
    }
    setPostingComment(false);
  }

  async function deleteComment(id) {
    const prev = comments;
    setComments(cs => cs.filter(c => c.id !== id));
    onChange({ comment_count: Math.max(0, (note.comment_count ?? 0) - 1) });
    try { await api.deleteNoteComment(id); }
    catch (err) {
      console.error(err);
      setComments(prev);
      onChange({ comment_count: note.comment_count });
    }
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 8, padding: "10px 12px",
      background: "var(--s1)",
      border: "1px solid var(--border-default)",
      borderRadius: 10,
      animation: "fadeIn 0.18s ease",
    }}>
      <div style={{ display: "flex", gap: 10 }}>
        <Avatar name={note.email ?? author} size={26} seed={note.email ?? author} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: FONT }}>
              {mine ? "You" : author}
            </span>
            <span style={{ fontSize: 10.5, color: "var(--t4, rgba(245,245,250,0.35))", fontFamily: MONO }}>
              {timeAgo(note.created_at)}
            </span>
          </div>
          <div style={{
            fontSize: 13, color: "var(--text-secondary)",
            fontFamily: FONT, lineHeight: 1.6, whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}>{note.content}</div>
        </div>
        {mine && (
          <button
            onClick={onDelete}
            title="Delete note"
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "2px 6px", fontSize: 12,
              color: "var(--t4, rgba(245,245,250,0.3))",
              transition: "color 0.15s, background 0.15s",
              borderRadius: 6, height: 24, flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--danger)"; e.currentTarget.style.background = "rgba(248,113,113,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--t4, rgba(245,245,250,0.3))"; e.currentTarget.style.background = "transparent"; }}
          ><X size={12} strokeWidth={1.75} /></button>
        )}
      </div>

      {/* Reactions row */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", paddingLeft: 36 }}>
        {reactionList.map(r => (
          <button
            key={r.emoji}
            onClick={() => toggleReaction(r.emoji)}
            onMouseEnter={async () => {
              if (reactionUsers && reactionUsers[r.emoji]) return;
              try {
                const rows = await api.getNoteReactions(note.id);
                const byEmoji = {};
                for (const row of rows) {
                  const name = row.user_id === currentUserId ? "You" : (row.first_name || row.email?.split("@")[0] || "Member");
                  (byEmoji[row.emoji] ??= []).push(name);
                }
                setReactionUsers(byEmoji);
              } catch { /* ignore */ }
            }}
            title={(reactionUsers?.[r.emoji] ?? []).join(", ")}
            style={{
              background: r.mine ? "rgba(167,139,250,0.18)" : "var(--bg-surface-2)",
              border: `1px solid ${r.mine ? "color-mix(in srgb, var(--acc) 45%, transparent)" : "var(--border-default)"}`,
              borderRadius: 999, padding: "1px 8px", height: 22,
              fontSize: 12, fontFamily: FONT,
              color: r.mine ? "var(--acc-h)" : "var(--text-secondary)",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
            }}
          >
            <span>{r.emoji}</span>
            <span style={{ fontWeight: 600 }}>{r.count}</span>
          </button>
        ))}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setPickerOpen(o => !o)}
            title="Add reaction"
            style={{
              background: "transparent",
              border: "1px dashed var(--border-default)",
              borderRadius: 999, padding: "1px 8px", height: 22,
              fontSize: 12, fontFamily: FONT,
              color: "var(--text-tertiary)", cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 4,
            }}
          ><Plus size={12} strokeWidth={2} /><Smile size={12} strokeWidth={1.75} /></button>
          {pickerOpen && (
            <>
              <div onClick={() => setPickerOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 100 }} />
              <div onClick={e => e.stopPropagation()} style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0,
                background: "var(--bg-surface-2)",
                border: "1px solid var(--border-default)",
                borderRadius: 10, padding: 6, zIndex: 110,
                display: "flex", gap: 4,
                boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
              }}>
                {REACTION_EMOJIS.map(e => (
                  <button
                    key={e}
                    onClick={() => { toggleReaction(e); setPickerOpen(false); }}
                    style={{
                      background: "transparent", border: "none", cursor: "pointer",
                      fontSize: 16, padding: "4px 6px", borderRadius: 6,
                    }}
                    onMouseEnter={ev => { ev.currentTarget.style.background = "var(--border)"; }}
                    onMouseLeave={ev => { ev.currentTarget.style.background = "transparent"; }}
                  >{e}</button>
                ))}
              </div>
            </>
          )}
        </div>
        <button
          onClick={() => commentsOpen ? setCommentsOpen(false) : loadComments()}
          style={{
            background: "transparent", border: "none", cursor: "pointer",
            fontSize: 11.5, color: "var(--text-tertiary)",
            fontFamily: FONT, padding: "1px 4px", fontWeight: 600,
            marginLeft: 4,
            display: "inline-flex", alignItems: "center", gap: 4,
          }}
        >
          <MessageCircle size={12} strokeWidth={1.75} /> {(note.comment_count ?? 0) > 0 ? `${note.comment_count} comment${note.comment_count === 1 ? "" : "s"}` : "Comment"}
        </button>
      </div>

      {commentsOpen && (
        <div style={{
          marginLeft: 36, padding: "8px 10px",
          background: "var(--bg, rgba(0,0,0,0.15))",
          border: "1px solid var(--border-default)",
          borderRadius: 8,
        }}>
          {!commentsLoaded ? (
            <div style={{ fontSize: 11.5, color: "var(--t3)", fontFamily: FONT }}>Loading…</div>
          ) : (
            <>
              {comments.map(c => {
                const cAuthor = c.first_name || c.full_name || c.email?.split("@")[0] || "Member";
                const cMine = c.user_id === currentUserId;
                return (
                  <div key={c.id} style={{
                    display: "flex", gap: 8, padding: "6px 0",
                    borderBottom: "1px solid var(--border-default)",
                  }}>
                    <Avatar name={c.email ?? cAuthor} size={20} seed={c.email ?? cAuthor} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--t1)", fontFamily: FONT }}>
                          {cMine ? "You" : cAuthor}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--t4)", fontFamily: MONO }}>
                          {timeAgo(c.created_at)}
                        </span>
                      </div>
                      <div style={{
                        fontSize: 12.5, color: "var(--t2)", fontFamily: FONT,
                        lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
                      }}>{c.content}</div>
                    </div>
                    {cMine && (
                      <button
                        onClick={() => deleteComment(c.id)}
                        title="Delete comment"
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          fontSize: 11, color: "var(--t4)", padding: "0 4px", borderRadius: 4,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = "var(--danger)"; }}
                        onMouseLeave={e => { e.currentTarget.style.color = "var(--t4)"; }}
                      ><X size={11} strokeWidth={2} /></button>
                    )}
                  </div>
                );
              })}
              <form onSubmit={addComment} style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <input
                  value={commentDraft}
                  onChange={e => setCommentDraft(e.target.value)}
                  placeholder="Add a comment…"
                  maxLength={2000}
                  style={{
                    flex: 1, background: "var(--bg-surface-1)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 7, padding: "0 10px", height: 30,
                    color: "var(--text-primary)", fontSize: 12, fontFamily: FONT,
                    outline: "none",
                  }}
                />
                <button
                  type="submit"
                  disabled={!commentDraft.trim() || postingComment}
                  style={{
                    background: commentDraft.trim() && !postingComment
                      ? `linear-gradient(135deg, ${tint.hue} 0%, ${tint.deep} 100%)`
                      : "var(--bg-surface-2)",
                    border: "none", borderRadius: 7, padding: "0 10px", height: 30,
                    color: "#fff", fontSize: 11.5, fontWeight: 600,
                    cursor: commentDraft.trim() && !postingComment ? "pointer" : "not-allowed",
                    fontFamily: FONT,
                    opacity: commentDraft.trim() && !postingComment ? 1 : 0.55,
                  }}
                >{postingComment ? "…" : "Post"}</button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
export function UnitNotes({ notebookId, currentUserId, tint }) {
  const [notes, setNotes]     = useState([]);
  const [draft, setDraft]     = useState("");
  const [posting, setPosting] = useState(false);
  const [loaded, setLoaded]   = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.getUnitNotes(notebookId)
      .then(rows => { if (!cancelled) { setNotes(rows); setLoaded(true); } })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [notebookId]);

  async function add(e) {
    e?.preventDefault?.();
    const text = draft.trim();
    if (!text || posting) return;
    setPosting(true);
    try {
      const note = await api.addUnitNote(notebookId, text);
      setNotes(n => [note, ...n]);
      setDraft("");
    } catch (err) {
      console.error("addUnitNote failed:", err);
    }
    setPosting(false);
  }

  async function remove(id) {
    const prev = notes;
    setNotes(n => n.filter(x => x.id !== id));
    try { await api.deleteUnitNote(id); }
    catch (err) { console.error(err); setNotes(prev); }
  }

  return (
    <div className="tool-content" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      {notes.length > 0 && (
        <div style={{
          fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)",
          letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10,
        }}>{notes.length} note{notes.length === 1 ? "" : "s"}</div>
      )}

      <form onSubmit={add} style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Add a note for your study group…"
          maxLength={2000}
          style={{
            flex: 1, background: "#0F0F18",
            border: "1px solid var(--border)",
            borderRadius: 10, padding: "0 12px", height: 38,
            color: "var(--t1)", fontSize: 13, fontFamily: FONT,
            outline: "none", transition: "all 0.18s", letterSpacing: 0,
          }}
          onFocus={e => { e.target.style.borderColor = tint.hue; e.target.style.boxShadow = `0 0 0 3px ${tint.hue}22`; }}
          onBlur={e => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
        />
        <button
          type="submit"
          disabled={!draft.trim() || posting}
          className="btn-press"
          style={{
            background: draft.trim() && !posting
              ? `linear-gradient(135deg, ${tint.hue} 0%, ${tint.deep} 100%)`
              : "var(--s2)",
            border: draft.trim() && !posting ? "none" : "1px solid var(--border)",
            borderRadius: 10, padding: "0 14px", height: 38,
            color: "#fff", fontWeight: 600, fontSize: 13,
            cursor: draft.trim() && !posting ? "pointer" : "not-allowed",
            fontFamily: FONT, letterSpacing: "-0.01em",
            opacity: draft.trim() && !posting ? 1 : 0.55,
            boxShadow: draft.trim() && !posting ? `0 4px 12px ${tint.hue}40` : "none",
          }}
        >{posting ? "…" : "Add"}</button>
      </form>

      <div style={{
        flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8,
        minHeight: 0,
      }}>
        {!loaded ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            color: "var(--t3)", fontSize: 12.5, padding: "12px 4px",
          }}>
            <div className="forge-spinner" style={{ width: 14, height: 14, borderWidth: 1.5, borderTopColor: tint.hue, borderColor: `${tint.hue}26` }} />
            Loading notes…
          </div>
        ) : notes.length === 0 ? (
          <div style={{
            padding: "16px 12px", textAlign: "center",
            color: "var(--t3)", fontSize: 12.5,
            border: "1px dashed var(--border)", borderRadius: 10,
            fontFamily: FONT,
          }}>
            No notes yet — be the first to share a thought with your group.
          </div>
        ) : notes.map(n => (
          <UnitNoteRow
            key={n.id}
            note={n}
            currentUserId={currentUserId}
            tint={tint}
            onDelete={() => remove(n.id)}
            onChange={updated => setNotes(ns => ns.map(x => x.id === n.id ? { ...x, ...updated } : x))}
          />
        ))}
      </div>
    </div>
  );
}
