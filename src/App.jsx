import { useState, useEffect, useRef } from "react";
import { api } from "./api.js";
import { supabase } from "./supabase.js";
import AuthModal from "./AuthModal.jsx";
import LandingPage from "./LandingPage.jsx";
import LegalPage, { LegalFooter } from "./LegalPages.jsx";
import NewNotebookModal from "./NewNotebookModal.jsx";
import UploadNotesModal from "./UploadNotesModal.jsx";
import OnboardingWizard from "./components/OnboardingWizard.jsx";
import SharedNotebook from "./components/SharedNotebook.jsx";
import ImageGeneratorModal from "./ImageGeneratorModal.jsx";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Flame, Star, Bell, CheckCircle, Plus, Search, FileText, Paperclip,
  Hammer, MessageCircle, Users, Settings, LayoutDashboard, Trash2, ArrowLeft,
  ChevronRight, Sparkles, BarChart2, Target, Lightbulb, BookOpen, HelpCircle,
  Layers, ClipboardList, Sun, Moon, LogOut, Palette, AlertTriangle, Link as LinkIcon,
  Upload, Save, Pencil, Check, X, Menu, Notebook, Zap, Rocket, Smile, RefreshCw,
  Coffee, Folder, File, ArrowUp, Headphones, Play, Pause, Download, Share2,
  Brain, XCircle, ArrowRight, RotateCcw,
  Maximize2, Minimize2, ChevronLeft,
  Image as ImageIcon,
} from "lucide-react";
import "./App.css";

// Module-scoped guard: only ever call /track-visit once per page load,
// even if the auth effect re-runs (e.g. on sign-in after landing-page view).
let _visitTrackedThisSession = false;

function timeAgo(iso) {
  const secs = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const REACTION_EMOJIS = ["👍", "✅", "🔥", "❤️", "😂", "🚀"];

function formatDueDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dueDateTone(iso) {
  if (!iso) return null;
  const now = Date.now();
  const due = new Date(iso).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  if (due < now) return { color: "#F87171", label: "Overdue", tone: "red" };
  if (due - now <= 3 * dayMs) return { color: "#FBBF24", label: "Due soon", tone: "amber" };
  return { color: "#34D399", label: "Upcoming", tone: "green" };
}

const ACCENT_PRESETS = [
  { color: "#A78BFA", hover: "#C4B5FD", deep: "#7C3AED", name: "Purple" },
  { color: "#60A5FA", hover: "#93C5FD", deep: "#3B82F6", name: "Blue" },
  { color: "#34D399", hover: "#6EE7B7", deep: "#10B981", name: "Emerald" },
  { color: "#FBBF24", hover: "#FCD34D", deep: "#F59E0B", name: "Amber" },
  { color: "#F472B6", hover: "#F9A8D4", deep: "#EC4899", name: "Pink" },
  { color: "#FB7185", hover: "#FDA4AF", deep: "#F43F5E", name: "Rose" },
];

const STATUS_META = {
  in_progress: { label: "In Progress", color: "#60A5FA", bg: "rgba(96,165,250,0.12)", border: "rgba(96,165,250,0.32)" },
  done:        { label: "Done",        color: "#34D399", bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.32)" },
  need_help:   { label: "Need Help",   color: "#F87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.32)" },
};

// Two-domain split: getscholr.com is the marketing site, scholr.dev is the app.
// Auth + the Supabase session live on the app origin (sessions are per-origin and
// cannot cross to a different domain), so marketing CTAs bounce users to APP_ORIGIN
// to sign in rather than authenticating on getscholr.com.
const APP_ORIGIN = "https://scholr.dev";
const IS_MARKETING_HOST =
  typeof window !== "undefined" && /(^|\.)getscholr\.com$/i.test(window.location.hostname);

// Reads ?auth=signup|signin from the URL → normalized tab ("signup"/"login"), or
// null. Used to derive the AuthModal's INITIAL open state so it paints open on the
// first render (visitors arriving from getscholr.com), with no effect/double-render.
function readAuthIntentFromUrl() {
  if (typeof window === "undefined" || IS_MARKETING_HOST) return null;
  const p = new URLSearchParams(window.location.search).get("auth");
  if (!p) return null;
  return p === "login" || p === "signin" ? "login" : "signup";
}

const FONT = `"Mulish", -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;
const FONT_SERIF = `"Instrument Serif", "Times New Roman", Georgia, serif`;
const FONT_HEADING = `"Playfair Display", Georgia, "Times New Roman", serif`;
const MONO = `ui-monospace, "SF Mono", Consolas, monospace`;

// Warm tint palette for class/member color accents (deterministic by id/name)
const TINTS = [
  { hue: "#A78BFA", deep: "#8B5CF6" }, // violet
  { hue: "#60A5FA", deep: "#3B82F6" }, // sky
  { hue: "#34D399", deep: "#10B981" }, // emerald
  { hue: "#FBBF24", deep: "#F59E0B" }, // amber
  { hue: "#F472B6", deep: "#EC4899" }, // pink
  { hue: "#FB7185", deep: "#F43F5E" }, // rose
  { hue: "#22D3EE", deep: "#06B6D4" }, // cyan
];
function tintFor(seed) {
  if (!seed) return TINTS[0];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return TINTS[Math.abs(h) % TINTS.length];
}

// Named class-color palette (the .color column stores the hex `hue`)
const CLASS_COLORS = [
  { id: "purple",  hue: "#A78BFA", deep: "#8B5CF6", label: "Purple"  },
  { id: "blue",    hue: "#60A5FA", deep: "#3B82F6", label: "Blue"    },
  { id: "emerald", hue: "#34D399", deep: "#10B981", label: "Emerald" },
  { id: "amber",   hue: "#FBBF24", deep: "#F59E0B", label: "Amber"   },
  { id: "pink",    hue: "#F472B6", deep: "#EC4899", label: "Pink"    },
  { id: "rose",    hue: "#FB7185", deep: "#F43F5E", label: "Rose"    },
];
function classTint(color) {
  if (!color) return CLASS_COLORS[0];
  const lower = color.toLowerCase();
  return CLASS_COLORS.find(c => c.hue.toLowerCase() === lower) ?? CLASS_COLORS[0];
}

function Avatar({ name, size = 28, seed }) {
  const t = tintFor(seed ?? name);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `linear-gradient(135deg, ${t.hue} 0%, ${t.deep} 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.4, fontWeight: 700, color: "#fff",
      fontFamily: FONT, flexShrink: 0,
      border: "2px solid #0B0B12",
      boxShadow: `0 2px 6px ${t.hue}40`,
      letterSpacing: "-0.02em",
    }}>
      {(name?.[0] ?? "?").toUpperCase()}
    </div>
  );
}

function AvatarStack({ names }) {
  return (
    <div style={{ display: "flex" }}>
      {names.slice(0, 3).map((n, i) => (
        <div key={`${n}-${i}`} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: names.length - i }}>
          <Avatar name={n} size={24} seed={n} />
        </div>
      ))}
      {names.length > 3 && (
        <div style={{
          marginLeft: -8, width: 24, height: 24, borderRadius: "50%",
          background: "var(--s2)", border: "2px solid #0B0B12",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 600, color: "var(--t2)", fontFamily: FONT,
        }}>+{names.length - 3}</div>
      )}
    </div>
  );
}

function NotebookCard({ nb, onClick, starred = false, onToggleStar, onStatusChange }) {
  const [hovered, setHovered] = useState(false);
  const t = nb.color ? classTint(nb.color) : tintFor(nb.id ?? nb.title);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="lift-card"
      style={{
        position: "relative",
        background: hovered ? "var(--bg-surface-2)" : "var(--bg-surface-1)",
        border: `1px solid ${hovered ? "var(--accent)" : "var(--border-default)"}`,
        borderRadius: 8,
        padding: "16px 16px 14px",
        cursor: "pointer",
        overflow: "hidden",
        transition: "background 0.18s ease, border-color 0.18s ease",
      }}
    >

      {onToggleStar && (
        <button
          onClick={e => { e.stopPropagation(); onToggleStar(); }}
          title={starred ? "Remove star" : "Star this notebook"}
          style={{
            position: "absolute", top: 12, right: 12, zIndex: 10,
            background: "none", border: "none", cursor: "pointer",
            padding: "4px 6px", fontSize: 16,
            color: starred ? "var(--c-quest)" : "var(--t4)",
            opacity: starred ? 1 : hovered ? 1 : 0,
            transition: "color 0.18s, opacity 0.18s, transform 0.18s", lineHeight: 1,
          }}
          onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.color = "var(--c-quest)"; e.currentTarget.style.transform = "scale(1.15)"; }}
          onMouseLeave={e => { e.stopPropagation(); e.currentTarget.style.color = starred ? "var(--c-quest)" : "var(--t4)"; e.currentTarget.style.transform = "scale(1)"; }}
        >
          <Star size={15} strokeWidth={1.75} fill={starred ? "currentColor" : "none"} />
        </button>
      )}

      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div style={{
            fontSize: 10.5, fontWeight: 600, letterSpacing: "0.08em",
            color: t.hue, textTransform: "uppercase",
            fontFamily: FONT,
          }}>
            {nb.notes} {nb.notes === 1 ? "note" : "notes"}
          </div>
          {onStatusChange && (
            <span onClick={e => e.stopPropagation()}>
              <StatusPill status={nb.status ?? "in_progress"} onChange={s => onStatusChange(s)} />
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: FONT, paddingRight: 22 }}>{nb.updated}</div>
      </div>
      <div style={{
        position: "relative",
        fontSize: 16, fontWeight: 600, color: "var(--text-primary)",
        fontFamily: FONT, marginBottom: 4, lineHeight: 1.3, letterSpacing: "-0.018em",
      }}>
        {nb.title}
      </div>
      {nb.topic && (
        <div style={{
          position: "relative",
          fontSize: 12.5, color: "var(--text-secondary)", fontFamily: FONT,
          marginBottom: 14, lineHeight: 1.45,
        }}>
          {nb.topic}
        </div>
      )}
      {!nb.topic && <div style={{ height: 14 }} />}
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AvatarStack names={nb.contributors} />
          <span style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontFamily: FONT }}>
            {nb.contributors.length} {nb.contributors.length === 1 ? "member" : "members"}
          </span>
        </div>
        <div style={{
          fontSize: 12, color: t.hue, fontFamily: FONT, fontWeight: 600,
          opacity: hovered ? 1 : 0,
          transform: hovered ? "translateX(0)" : "translateX(-4px)",
          transition: "opacity 0.2s, transform 0.2s",
        }}>Open →</div>
      </div>
      {nb.due_date && (
        <div style={{
          position: "absolute", top: 12, right: starred || hovered ? 36 : 12,
          fontSize: 10.5, fontWeight: 600,
          color: dueDateTone(nb.due_date).color,
          background: `${dueDateTone(nb.due_date).color}1A`,
          border: `1px solid ${dueDateTone(nb.due_date).color}55`,
          padding: "2px 8px", borderRadius: 999, fontFamily: FONT,
          transition: "right 0.18s",
        }}>
          Due {formatDueDate(nb.due_date)}
        </div>
      )}
    </div>
  );
}

function memberLabel(m) {
  const first = m.first_name?.trim();
  if (first) return first;
  const local = m.email?.split("@")[0] ?? "Member";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function MemberAvatarStack({ members }) {
  const [open, setOpen] = useState(false);
  const visible = members.slice(0, 3);
  const overflow = members.length - 3;

  // Owners first, then alphabetical by display label
  const sorted = [...members].sort((a, b) => {
    if (a.role !== b.role) return a.role === "owner" ? -1 : 1;
    return memberLabel(a).localeCompare(memberLabel(b));
  });

  return (
    <div
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{ display: "flex", alignItems: "center", position: "relative", cursor: "default" }}
    >
      {visible.map((m, i) => (
        <div key={m.user_id} style={{ marginLeft: i === 0 ? 0 : -10, zIndex: visible.length - i }}>
          <Avatar name={m.email} size={28} seed={m.email} />
        </div>
      ))}
      {overflow > 0 && (
        <div style={{
          marginLeft: -10, width: 28, height: 28, borderRadius: "50%",
          background: "var(--s2)", border: "2px solid #0B0B12",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10.5, fontWeight: 600, color: "var(--t2)", fontFamily: FONT, zIndex: 0,
        }}>+{overflow}</div>
      )}

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 10px)", right: 0,
          minWidth: 240, maxWidth: 320, maxHeight: 300, overflowY: "auto",
          background: "rgba(20,20,31,0.92)",
          backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
          border: "1px solid var(--border-h)",
          borderRadius: 10, padding: 12,
          fontFamily: FONT, zIndex: 100,
          boxShadow: "0 16px 40px rgba(0,0,0,0.55), 0 0 0 1px var(--acc-bg), 0 0 32px var(--acc-bg)",
          animation: "fadeIn 0.15s ease",
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 600, color: "var(--t3)",
            letterSpacing: "0.08em", textTransform: "uppercase",
            padding: "2px 4px 8px",
          }}>
            {members.length} {members.length === 1 ? "Member" : "Members"}
          </div>
          {sorted.map(m => {
            const label = memberLabel(m);
            const isOwner = m.role === "owner";
            return (
              <div key={m.user_id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "6px 4px", borderRadius: 8,
              }}>
                <Avatar name={m.email} size={26} seed={m.email} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 500, color: "var(--t1)",
                    letterSpacing: "-0.01em",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
                    <span style={{ color: "var(--t4)", flexShrink: 0 }}>•</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: isOwner ? "var(--acc)" : "var(--t3)",
                      letterSpacing: "-0.005em", flexShrink: 0,
                    }}>
                      {isOwner ? "Owner" : "Member"}
                    </span>
                  </div>
                  {m.email && m.email !== label && (
                    <div style={{
                      fontSize: 11, color: "var(--t3)", marginTop: 1,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{m.email}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const FORGE_ACTIONS = [
  { id: "study_guide", label: "Study Guide", Icon: BookOpen,       color: "#34D399", desc: "Comprehensive review" },
  { id: "questions",   label: "Questions",   Icon: HelpCircle,     color: "#FBBF24", desc: "Practice questions"  },
  { id: "flashcards",  label: "Flashcards",  Icon: Layers,         color: "#F472B6", desc: "Quick recall cards"  },
  { id: "summary",     label: "Summary",     Icon: ClipboardList,  color: "#60A5FA", desc: "Concise overview"    },
];
const FORGE_BY_ID = Object.fromEntries(FORGE_ACTIONS.map(a => [a.id, a]));

// ── Scholr 2.0 study-tool registry ────────────────────────────────────────────
// One source of truth for the notebook study tools. The header bar maps over
// this to render its buttons, and ToolModal looks up title/subtitle/icon by id.
// Adding a future tool (e.g. standalone flashcards) is a single entry here.
const NB_TOOLS = [
  { id: "notes",   text: "Notes",   label: "Unit notes",   title: "Unit Notes",    Icon: FileText,   subtitle: "Shared notes for everyone in this notebook" },
  { id: "forge",   text: "Forge",   label: "The Forge",    title: "The Forge",     Icon: Hammer,     subtitle: "Generate study guides, quizzes & flashcards from your notes" },
  { id: "podcast", text: "Podcast", label: "Podcast Mode", title: "Podcast",       Icon: Headphones, subtitle: "A two-host AI audio overview of your notes" },
  { id: "feynman", text: "Feynman", label: "Feynman Mode", title: "Feynman Mode",  Icon: Brain,      subtitle: "Explain a concept in your words — Claude grades your understanding" },
];
const NB_TOOL_META = Object.fromEntries(NB_TOOLS.map(x => [x.id, x]));

// ── ToolModal — Scholr 2.0 universal study-tool shell ─────────────────────────
// EVERY study tool (Notes, Forge, Podcast, Feynman, future flashcards) renders
// inside this one spacious, dismissible shell so they all feel identical.
// Desktop: a centered modal with an Expand toggle. Mobile / split-screen: a
// full-screen sheet with safe-area padding (pure CSS, correct at any width).
// Dismiss with ✕, click-outside, or Esc; background scroll locks while open.
// Remembered per session (no localStorage): which mode the user last left a tool in.
let _toolModeMemory = "dock"; // "dock" | "modal"

function ToolModal({ open, onClose, title, subtitle, Icon, children }) {
  const [mode, setMode] = useState(_toolModeMemory); // "dock" (right rail) | "modal" (centered)
  const [wide, setWide] = useState(false);
  const [entered, setEntered] = useState(false);

  // Entrance: settle on the next frame so the open — and every dock<->modal
  // toggle — runs through the same CSS transitions (slide + fade, no snap).
  // ToolModal only mounts while open, so this runs once per open.
  useEffect(() => {
    const r = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(r);
  }, []);

  // Esc closes (both modes). Scroll-lock + chat-yield only when desktop-docked is
  // OFF (i.e. modal mode, or any mobile width — where dock is ignored entirely).
  useEffect(() => {
    if (!open) return undefined;
    const mq = window.matchMedia("(max-width: 768px)");
    const apply = () => {
      const docked = mode === "dock" && !mq.matches;
      document.body.classList.toggle("tool-docked", docked);
      document.body.style.overflow = docked ? "" : "hidden";
    };
    apply();
    mq.addEventListener("change", apply);
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => {
      mq.removeEventListener("change", apply);
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("tool-docked");
      document.body.style.overflow = "";
    };
  }, [open, mode, onClose]);

  function toggleMode() {
    setMode((m) => {
      const next = m === "dock" ? "modal" : "dock";
      _toolModeMemory = next;
      if (next === "dock") setWide(false);
      return next;
    });
  }

  if (!open) return null;
  const isModal = mode === "modal";
  return (
    <div className={`tool-modal-root tool-mode-${mode}${entered ? " is-entered" : ""}`}>
      <div
        className="tool-modal-backdrop"
        onMouseDown={isModal ? onClose : undefined}
      />
      <div
        className={`tool-modal-card${wide ? " is-wide" : ""}`}
        role="dialog"
        aria-modal={isModal}
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="tool-modal-header">
          <div className="tool-modal-titlewrap">
            {Icon && <span className="tool-modal-icon"><Icon size={16} strokeWidth={2} /></span>}
            <div style={{ minWidth: 0 }}>
              <div className="tool-modal-title">{title}</div>
              {subtitle && <div className="tool-modal-subtitle">{subtitle}</div>}
            </div>
          </div>
          <div className="tool-modal-controls">
            <button
              type="button"
              className="tool-modal-iconbtn tool-modal-toggle has-tip"
              onClick={toggleMode}
              aria-label={isModal ? "Dock to right" : "Open in center"}
              data-tooltip={isModal ? "Dock right" : "Center"}
            >{isModal ? <ChevronRight size={16} strokeWidth={1.9} /> : <ChevronLeft size={16} strokeWidth={1.9} />}</button>
            {isModal && (
              <button
                type="button"
                className="tool-modal-iconbtn tool-modal-expand has-tip"
                onClick={() => setWide((w) => !w)}
                aria-label={wide ? "Collapse panel" : "Expand panel"}
                data-tooltip={wide ? "Collapse" : "Expand"}
              >{wide ? <Minimize2 size={16} strokeWidth={1.9} /> : <Maximize2 size={16} strokeWidth={1.9} />}</button>
            )}
            <button
              type="button"
              className="tool-modal-iconbtn has-tip"
              onClick={onClose}
              aria-label="Close"
              data-tooltip="Close (Esc)"
            ><X size={17} strokeWidth={1.9} /></button>
          </div>
        </header>
        <div className="tool-modal-body">{children}</div>
      </div>
    </div>
  );
}

// ── FeynmanPanel ──────────────────────────────────────────────────────────────
// Active-recall tool: the user explains a concept in plain words and Claude
// grades genuine understanding. Mirrors TheForge/PodcastPanel layout so it
// slots into the same desktop side-panel + mobile overlay containers. Grading
// runs server-side via /api/feynman (key + model stay on the server).
const FEYNMAN_SAMPLES = ["Recursion", "Supply & demand", "Photosynthesis", "Entropy"];

const fmLabel = {
  display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.08em", color: "var(--text-tertiary)", marginBottom: 7, fontFamily: FONT,
};
const fmField = {
  width: "100%", background: "var(--bg-surface-1)", border: "1px solid var(--border-default)",
  borderRadius: 10, padding: "10px 12px", fontSize: 14, color: "var(--text-primary)",
  fontFamily: FONT, outline: "none", boxSizing: "border-box",
};

function feynmanScoreColor(score) {
  if (score >= 80) return "var(--success)";
  if (score >= 55) return "var(--acc)";
  return "var(--danger)";
}

function FeynmanScoreRing({ score }) {
  const r = 34, c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score | 0));
  const offset = c - (pct / 100) * c;
  const color = feynmanScoreColor(pct);
  return (
    <div style={{ position: "relative", width: 88, height: 88, flexShrink: 0 }}>
      <svg width="88" height="88" viewBox="0 0 80 80" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--bg-surface-3)" strokeWidth="7" />
        <circle
          cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(.2,.7,.3,1)" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 23, fontWeight: 700, color, fontFamily: FONT, lineHeight: 1 }}>{pct}</span>
        <span style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 1 }}>/ 100</span>
      </div>
    </div>
  );
}

function FeynmanSection({ title, items, Icon, color, delay = 0 }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{
      background: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)",
      borderRadius: 14, padding: "14px 16px", animation: `slideInUp 0.4s ease ${delay}s both`,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
        fontSize: 11, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: "0.06em", color: "var(--text-tertiary)",
      }}>
        <Icon size={14} strokeWidth={2} style={{ color, flexShrink: 0 }} /> {title}
      </div>
      <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8, margin: 0, padding: 0 }}>
        {items.map((item, i) => (
          <li key={i} style={{ display: "flex", gap: 10, fontSize: 13.5, lineHeight: 1.5, color: "var(--text-secondary)" }}>
            <span style={{ marginTop: 7, width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0, opacity: 0.85 }} />
            <span style={{ minWidth: 0 }}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FeynmanPanel({ nb, onToast, onUpgradeNeeded }) {
  const [concept, setConcept] = useState(nb?.topic || nb?.title || "");
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const trimmed = explanation.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const canGrade = concept.trim().length > 1 && trimmed.length >= 20 && !loading;

  const sampleChips = [nb?.topic, ...FEYNMAN_SAMPLES]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 4);

  async function grade() {
    if (!canGrade) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const r = await api.feynman({ concept: concept.trim(), explanation: trimmed });
      setResult(r);
      onToast?.(`Scored ${r.score}/100`);
    } catch (e) {
      if (e.code === "message_limit") { onUpgradeNeeded?.("message_limit"); return; }
      setError(e.message || "Couldn't grade that one — try again in a sec.");
    } finally {
      setLoading(false);
    }
  }

  function reset() { setResult(null); setError(""); setExplanation(""); }

  return (
    <div className="tool-content feynman-content">
      {/* Input card */}
      <div style={{
        background: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)",
        borderRadius: 14, padding: 18,
      }}>
        <label style={fmLabel}>Concept</label>
        <input
          className="fm-field"
          value={concept}
          onChange={e => setConcept(e.target.value)}
          placeholder="What are you trying to understand?"
          style={fmField}
        />
        {!result && sampleChips.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {sampleChips.map(c => (
              <button key={c} onClick={() => setConcept(c)} className="btn-press" style={{
                fontSize: 12, padding: "5px 10px", borderRadius: 999,
                border: "1px solid var(--border-default)", background: "transparent",
                color: "var(--text-secondary)", cursor: "pointer", fontFamily: FONT, whiteSpace: "nowrap",
              }}>{c}</button>
            ))}
          </div>
        )}

        <label style={{ ...fmLabel, marginTop: 16 }}>Your explanation</label>
        <textarea
          className="fm-field"
          value={explanation}
          onChange={e => setExplanation(e.target.value)}
          rows={6}
          placeholder="Explain it in plain words, as if teaching a curious 12-year-old. No jargon you can't unpack."
          style={{ ...fmField, resize: "none", lineHeight: 1.55, minHeight: 124 }}
        />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>
            {trimmed.length < 20 ? "A little more detail unlocks grading" : `${words} word${words === 1 ? "" : "s"}`}
          </span>
          <button onClick={grade} disabled={!canGrade} className="btn-press" style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            borderRadius: 10, padding: "0 16px", height: 38, border: "none",
            background: canGrade ? "var(--acc)" : "var(--bg-surface-3)",
            color: canGrade ? "#fff" : "var(--text-tertiary)",
            fontFamily: FONT, fontSize: 13, fontWeight: 600,
            cursor: canGrade ? "pointer" : "not-allowed",
            boxShadow: canGrade ? "0 4px 14px var(--acc-bg-h)" : "none",
            transition: "background 150ms ease, box-shadow 150ms ease",
            flexShrink: 0,
          }}>
            {loading
              ? <><span className="forge-spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} /> Grading…</>
              : <><Sparkles size={14} strokeWidth={2} /> Grade my understanding</>}
          </button>
        </div>

        {error && (
          <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--danger)", display: "flex", alignItems: "flex-start", gap: 6 }}>
            <XCircle size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{error}</span>
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
          {/* Score + verdict */}
          <div style={{
            background: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)",
            borderRadius: 16, padding: 16, display: "flex", alignItems: "center", gap: 16,
            animation: "slideInUp 0.4s ease both",
          }}>
            <FeynmanScoreRing score={result.score} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={fmLabel}>Verdict</div>
              <p style={{ fontSize: 14.5, color: "var(--text-primary)", marginTop: 2, lineHeight: 1.4 }}>{result.verdict}</p>
            </div>
          </div>

          {/* AI disclaimer on results — Feynman grades understanding, not academic fact */}
          <div style={{
            fontSize: 11, color: "var(--text-tertiary)", fontFamily: FONT,
            textAlign: "center", lineHeight: 1.4, padding: "0 4px",
          }}>
            AI feedback — not a final grade. Review independently for accuracy.
          </div>

          <FeynmanSection title="What you nailed" items={result.nailed} Icon={CheckCircle} color="var(--success)" delay={0.05} />
          <FeynmanSection title="Gaps to close" items={result.gaps} Icon={AlertTriangle} color="var(--warning)" delay={0.1} />
          <FeynmanSection title="Watch out — misconceptions" items={result.misconceptions} Icon={XCircle} color="var(--danger)" delay={0.15} />

          {result.followup && (
            <div style={{
              background: "var(--accent-soft)", border: "1px solid color-mix(in srgb, var(--accent) 22%, transparent)",
              borderRadius: 14, padding: 16, animation: "slideInUp 0.4s ease 0.2s both",
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--acc-h)",
              }}>
                <ArrowRight size={13} strokeWidth={2.4} /> Push further
              </div>
              <p style={{ fontSize: 14, color: "var(--text-primary)", marginTop: 8, lineHeight: 1.45 }}>{result.followup}</p>
            </div>
          )}

          <button onClick={reset} className="btn-press" style={{
            alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 7,
            background: "transparent", border: "none", color: "var(--text-secondary)",
            cursor: "pointer", fontFamily: FONT, fontSize: 13, padding: "6px 2px",
          }}><RotateCcw size={14} strokeWidth={2} /> Try another explanation</button>
        </div>
      )}
    </div>
  );
}

// ── PodcastPanel ────────────────────────────────────────────────────────────
// Two-host AI audio overview of a notebook. Pro-gated. Mirrors TheForge's
// width/layout so it slots into the same desktop side-panel + mobile overlay
// containers. Audio segments come from /podcast/generate (async) and are
// played by a custom <audio> player (no native controls) so we can offer
// playback-speed and downloads consistently across browsers.
const PODCAST_LENGTHS = [
  { id: "quick",    label: "Quick",    sub: "~3 min" },
  { id: "standard", label: "Standard", sub: "~8 min" },
  { id: "deep",     label: "Deep",     sub: "~15 min" },
];
const PODCAST_FORMATS = [
  { id: "casual",   label: "Casual",    sub: "Friendly chat" },
  { id: "examcram", label: "Exam Cram", sub: "Testable facts" },
  { id: "eli5",     label: "ELI5",      sub: "Simple analogies" },
  { id: "debate",   label: "Debate",    sub: "Opposing angles" },
];
const PODCAST_SPEEDS = [1, 1.25, 1.5, 2];

function formatPodcastTime(secs) {
  if (!Number.isFinite(secs) || secs < 0) return "0:00";
  const s = Math.floor(secs);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function PodcastPlayer({ podcast, onShare }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(podcast.duration_seconds || 0);
  const [speed, setSpeed] = useState(1);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCur(a.currentTime);
    const onMeta = () => { if (Number.isFinite(a.duration) && a.duration > 0) setDur(a.duration); };
    const onEnd  = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, [podcast.audio_url]);

  useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = speed; }, [speed]);

  function toggle() {
    const a = audioRef.current; if (!a) return;
    if (a.paused) { a.play(); setPlaying(true); }
    else          { a.pause(); setPlaying(false); }
  }
  function scrubTo(pct) {
    const a = audioRef.current; if (!a || !dur) return;
    a.currentTime = Math.max(0, Math.min(dur, pct * dur));
    setCur(a.currentTime);
  }
  function bumpSpeed() {
    const i = PODCAST_SPEEDS.indexOf(speed);
    setSpeed(PODCAST_SPEEDS[(i + 1) % PODCAST_SPEEDS.length]);
  }
  async function downloadMp3() {
    if (!podcast.audio_url) return;
    // Same-origin <a download> would be ideal but Supabase storage is
    // cross-origin so fetch→blob→object-url is the only reliable path.
    try {
      const r = await fetch(podcast.audio_url);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(podcast.title || "podcast").replace(/[^\w.-]+/g, "_")}.mp3`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { console.warn("download failed", e); }
  }

  const pct = dur ? Math.min(100, (cur / dur) * 100) : 0;

  return (
    <div style={{
      background: "var(--bg-surface-1)", border: "1px solid var(--border-subtle)",
      borderRadius: 12, padding: "16px 16px 14px", marginBottom: 12,
    }}>
      <audio ref={audioRef} src={podcast.audio_url} preload="metadata" />
      <div style={{
        fontSize: 15, fontWeight: 600, color: "var(--text-primary)",
        fontFamily: FONT, letterSpacing: "-0.015em", marginBottom: 12,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{podcast.title}</div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          className="btn-press"
          style={{
            width: 44, height: 44, minWidth: 44, borderRadius: "50%",
            background: "var(--accent)", border: "none", color: "#fff",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {playing
            ? <Pause size={18} strokeWidth={2} fill="currentColor" />
            : <Play size={18} strokeWidth={2} fill="currentColor" style={{ marginLeft: 2 }} />}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            onClick={e => {
              const r = e.currentTarget.getBoundingClientRect();
              scrubTo((e.clientX - r.left) / r.width);
            }}
            style={{
              height: 6, borderRadius: 3, background: "var(--bg-surface-2)",
              cursor: "pointer", overflow: "hidden", position: "relative",
            }}
          >
            <div style={{
              position: "absolute", inset: 0, width: `${pct}%`,
              background: "var(--accent)", borderRadius: 3,
              transition: "width 0.1s linear",
            }} />
          </div>
          <div style={{
            display: "flex", justifyContent: "space-between", marginTop: 6,
            fontSize: 11.5, color: "var(--text-tertiary)", fontFamily: FONT, fontVariantNumeric: "tabular-nums",
          }}>
            <span>{formatPodcastTime(cur)}</span>
            <span>{formatPodcastTime(dur)}</span>
          </div>
        </div>
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap",
      }}>
        <button
          onClick={bumpSpeed}
          title="Playback speed"
          className="btn-press"
          style={{
            minHeight: 36, padding: "0 12px", borderRadius: 8, cursor: "pointer",
            background: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)",
            color: "var(--text-primary)", fontSize: 12, fontWeight: 600, fontFamily: FONT,
            fontVariantNumeric: "tabular-nums",
          }}
        >{speed}×</button>
        <button
          onClick={downloadMp3}
          title="Download MP3"
          className="btn-press"
          style={{
            minHeight: 36, padding: "0 12px", borderRadius: 8, cursor: "pointer",
            background: "transparent", border: "1px solid var(--border-subtle)",
            color: "var(--text-secondary)", fontSize: 12, fontWeight: 500, fontFamily: FONT,
            display: "inline-flex", alignItems: "center", gap: 6,
          }}
        ><Download size={13} strokeWidth={1.75} /> Download</button>
        {onShare && (
          <button
            onClick={onShare}
            title="Share to study group"
            className="btn-press"
            style={{
              minHeight: 36, padding: "0 12px", borderRadius: 8, cursor: "pointer",
              background: "transparent", border: "1px solid var(--border-subtle)",
              color: "var(--text-secondary)", fontSize: 12, fontWeight: 500, fontFamily: FONT,
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
          ><Share2 size={13} strokeWidth={1.75} /> Share</button>
        )}
        <button
          onClick={() => setShowTranscript(v => !v)}
          className="btn-press"
          style={{
            minHeight: 36, padding: "0 12px", borderRadius: 8, cursor: "pointer",
            background: "transparent", border: "1px solid var(--border-subtle)",
            color: "var(--text-secondary)", fontSize: 12, fontWeight: 500, fontFamily: FONT,
            marginLeft: "auto",
          }}
        >{showTranscript ? "Hide transcript" : "Show transcript"}</button>
      </div>

      {showTranscript && Array.isArray(podcast.transcript) && (
        <div style={{
          marginTop: 14, paddingTop: 12,
          borderTop: "1px solid var(--border-subtle)",
          display: "flex", flexDirection: "column", gap: 8,
          maxHeight: 320, overflowY: "auto",
        }}>
          {podcast.transcript.map((l, i) => {
            const isAlex = l.speaker === "alex";
            return (
              <div key={i} style={{ display: "flex", gap: 10 }}>
                <div style={{
                  fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                  color: isAlex ? "var(--accent)" : "var(--c-flash, #F472B6)",
                  fontFamily: FONT, minWidth: 38, flexShrink: 0, paddingTop: 2,
                }}>{isAlex ? "Alex" : "Sam"}</div>
                <div style={{
                  fontSize: 13.5, color: "var(--text-primary)", fontFamily: FONT,
                  lineHeight: 1.55, letterSpacing: "-0.005em",
                }}>{l.text}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PodcastPanel({ nb, onToast, onUpgradeNeeded }) {
  const [tier, setTier] = useState("free");
  const [tierLoaded, setTierLoaded] = useState(false);
  const [lengthPreset, setLengthPreset] = useState("standard");
  const [formatPreset, setFormatPreset] = useState("casual");
  const [focusTopic, setFocusTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [pollId, setPollId] = useState(null);
  const [activePodcast, setActivePodcast] = useState(null); // currently-rendered ready episode
  const [episodes, setEpisodes] = useState([]);             // past episodes
  const [error, setError] = useState("");
  const pollTimer = useRef(null);

  // Initial load: tier + episodes list.
  useEffect(() => {
    let alive = true;
    api.getSubscription().then(s => {
      if (alive) { setTier(s?.tier ?? "free"); setTierLoaded(true); }
    }).catch(() => { if (alive) setTierLoaded(true); });
    api.getPodcasts(nb.id).then(rows => {
      if (!alive) return;
      setEpisodes(rows);
      const firstReady = rows.find(r => r.status === "ready");
      if (firstReady) setActivePodcast(firstReady);
    }).catch(console.error);
    return () => { alive = false; if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [nb.id]);

  // Poll a generating episode until ready/failed.
  useEffect(() => {
    if (!pollId) return;
    if (pollTimer.current) clearInterval(pollTimer.current);
    const tick = async () => {
      try {
        const pod = await api.getPodcast(pollId);
        if (pod.status === "ready") {
          clearInterval(pollTimer.current); pollTimer.current = null;
          setGenerating(false);
          setActivePodcast(pod);
          setPollId(null);
          // Refresh list so the new one shows under Past episodes.
          api.getPodcasts(nb.id).then(setEpisodes).catch(() => {});
          onToast?.("Podcast ready");
        } else if (pod.status === "failed") {
          clearInterval(pollTimer.current); pollTimer.current = null;
          setGenerating(false);
          setError(pod.error_message || "Generation failed. Try again.");
          setPollId(null);
        }
      } catch (e) { console.warn("poll error", e); }
    };
    tick();
    pollTimer.current = setInterval(tick, 3000);
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [pollId, nb.id, onToast]);

  async function handleGenerate() {
    setError("");
    if (tier !== "pro") { onUpgradeNeeded?.("forge_limit_reached"); return; }
    setGenerating(true);
    try {
      const { podcastId } = await api.generatePodcast(nb.id, {
        lengthPreset, formatPreset,
        focusTopic: focusTopic.trim() || null,
      });
      setPollId(podcastId);
    } catch (e) {
      setGenerating(false);
      if (e.code === "pro_required") { onUpgradeNeeded?.("forge_limit_reached"); return; }
      setError(e.message || "Failed to start generation.");
    }
  }

  function loadEpisode(p) {
    if (p.status === "ready") setActivePodcast(p);
    else if (p.status === "generating") { setPollId(p.id); setGenerating(true); }
  }

  const isLocked = tierLoaded && tier !== "pro";

  return (
    <div className="tool-content">
      {/* Upgrade gate for free users */}
      {isLocked && (
        <div style={{
          background: "var(--accent-soft)",
          border: "1px solid color-mix(in srgb, var(--accent) 24%, transparent)",
          borderRadius: 12, padding: "16px 16px 14px", marginBottom: 16,
        }}>
          <div style={{
            fontSize: 14, fontWeight: 600, color: "var(--text-primary)",
            fontFamily: FONT, letterSpacing: "-0.015em", marginBottom: 4,
          }}>Podcast Mode is a Pro feature</div>
          <div style={{
            fontSize: 12.5, color: "var(--text-secondary)", fontFamily: FONT, lineHeight: 1.5, marginBottom: 12,
          }}>Generate AI audio discussions of your notes — two hosts, four formats, downloadable MP3.</div>
          <button
            onClick={() => onUpgradeNeeded?.("forge_limit_reached")}
            className="btn-press"
            style={{
              width: "100%", minHeight: 40, borderRadius: 10,
              background: "linear-gradient(135deg, #A78BFA, #8B5CF6)",
              border: "none", color: "#fff", fontWeight: 700, fontSize: 13.5,
              cursor: "pointer", fontFamily: FONT,
            }}
          >Upgrade to Pro</button>
        </div>
      )}

      {/* Active player (most recent ready or just-finished episode) */}
      {activePodcast && activePodcast.status === "ready" && (
        <PodcastPlayer podcast={activePodcast} />
      )}

      {/* Generating state */}
      {generating && (
        <div style={{
          background: "var(--bg-surface-1)", border: "1px solid var(--border-subtle)",
          borderRadius: 12, padding: "16px", marginBottom: 12,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div className="forge-spinner" />
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", fontFamily: FONT, letterSpacing: "-0.01em" }}>
              Creating your episode…
            </div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: FONT, marginTop: 2 }}>
              Alex and Sam are prepping. This takes about a minute.
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          background: "color-mix(in srgb, var(--danger) 8%, transparent)",
          border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
          borderRadius: 10, padding: "10px 12px", marginBottom: 12,
          color: "var(--danger)", fontSize: 12.5, fontFamily: FONT,
        }}>{error}</div>
      )}

      {/* Generation controls — hidden while a job is in flight */}
      {!generating && (
        <>
          <div style={{
            fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", fontFamily: FONT,
            letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8,
          }}>Length</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
            {PODCAST_LENGTHS.map(opt => {
              const active = lengthPreset === opt.id;
              return (
                <button key={opt.id}
                  disabled={isLocked}
                  onClick={() => setLengthPreset(opt.id)}
                  className="btn-press"
                  style={{
                    flex: "1 1 90px", minHeight: 44, padding: "6px 10px",
                    borderRadius: 10, cursor: isLocked ? "not-allowed" : "pointer",
                    fontFamily: FONT, fontSize: 13, fontWeight: 600, textAlign: "center",
                    background: active ? "var(--accent-soft)" : "transparent",
                    border: `1px solid ${active ? "var(--accent)" : "var(--border-subtle)"}`,
                    color: active ? "var(--accent)" : "var(--text-secondary)",
                    opacity: isLocked ? 0.5 : 1,
                  }}
                >
                  <div>{opt.label}</div>
                  <div style={{ fontSize: 10.5, fontWeight: 500, marginTop: 2, color: active ? "var(--accent)" : "var(--text-tertiary)" }}>{opt.sub}</div>
                </button>
              );
            })}
          </div>

          <div style={{
            fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", fontFamily: FONT,
            letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8,
          }}>Format</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 16 }}>
            {PODCAST_FORMATS.map(opt => {
              const active = formatPreset === opt.id;
              return (
                <button key={opt.id}
                  disabled={isLocked}
                  onClick={() => setFormatPreset(opt.id)}
                  className="btn-press"
                  style={{
                    minHeight: 48, padding: "6px 10px",
                    borderRadius: 10, cursor: isLocked ? "not-allowed" : "pointer",
                    fontFamily: FONT, fontSize: 13, fontWeight: 600, textAlign: "left",
                    background: active ? "var(--accent-soft)" : "transparent",
                    border: `1px solid ${active ? "var(--accent)" : "var(--border-subtle)"}`,
                    color: active ? "var(--accent)" : "var(--text-secondary)",
                    opacity: isLocked ? 0.5 : 1,
                  }}
                >
                  <div>{opt.label}</div>
                  <div style={{ fontSize: 10.5, fontWeight: 500, marginTop: 2, color: active ? "var(--accent)" : "var(--text-tertiary)" }}>{opt.sub}</div>
                </button>
              );
            })}
          </div>

          <div style={{
            fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", fontFamily: FONT,
            letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8,
          }}>Focus topic (optional)</div>
          <input
            value={focusTopic}
            onChange={e => setFocusTopic(e.target.value)}
            disabled={isLocked}
            placeholder="e.g. mitochondrial respiration"
            className="forge-topic-input"
            style={{
              width: "100%", height: 44, borderRadius: 10,
              padding: "0 12px", marginBottom: 16,
              background: "var(--bg-surface-2)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)", fontSize: 16, fontFamily: FONT, outline: "none",
              opacity: isLocked ? 0.5 : 1,
            }}
          />

          <button
            onClick={handleGenerate}
            disabled={isLocked}
            className="btn-press"
            style={{
              width: "100%", minHeight: 48, borderRadius: 10,
              background: isLocked
                ? "var(--bg-surface-2)"
                : "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)",
              border: "none", color: "#fff", fontWeight: 700, fontSize: 14,
              fontFamily: FONT, cursor: isLocked ? "not-allowed" : "pointer",
              boxShadow: isLocked ? "none" : "0 6px 18px rgba(167,139,250,0.36)",
              letterSpacing: "-0.01em",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
              opacity: isLocked ? 0.6 : 1,
            }}
          >
            <Headphones size={16} strokeWidth={2} /> Generate Podcast
          </button>
        </>
      )}

      {/* Past episodes */}
      {episodes.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", fontFamily: FONT,
            letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8,
          }}>Past episodes</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {episodes.map(ep => {
              const isActive = activePodcast?.id === ep.id;
              const isReady = ep.status === "ready";
              const isFailed = ep.status === "failed";
              return (
                <button
                  key={ep.id}
                  onClick={() => loadEpisode(ep)}
                  disabled={!isReady && !isFailed && ep.status !== "generating"}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 4px",
                    borderBottom: "1px solid var(--border-subtle)",
                    background: isActive ? "var(--bg-surface-2)" : "transparent",
                    border: "none", cursor: "pointer",
                    textAlign: "left", fontFamily: FONT, width: "100%",
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                    background: isReady ? "var(--accent)" : "var(--bg-surface-2)",
                    color: isReady ? "#fff" : "var(--text-tertiary)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {isReady ? <Play size={12} strokeWidth={2} fill="currentColor" style={{ marginLeft: 1 }} />
                     : isFailed ? <X size={12} strokeWidth={2} />
                     : <div className="forge-spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 500, color: "var(--text-primary)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      letterSpacing: "-0.005em",
                    }}>{ep.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1 }}>
                      {isReady && ep.duration_seconds ? `${formatPodcastTime(ep.duration_seconds)} · ` : ""}
                      {isFailed ? "Failed · " : ""}
                      {timeAgo(ep.created_at)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function TheForge({ nb, onToast, onUpgradeNeeded }) {
  const [action, setAction]         = useState(null);
  const [topic, setTopic]           = useState("");
  const [content, setContent]       = useState("");
  const [generating, setGenerating] = useState(false);

  // Flashcard state
  const [flashcards, setFlashcards]       = useState(null);
  const [cardIdx, setCardIdx]             = useState(0);
  const [isFlipped, setIsFlipped]         = useState(false);
  const [shuffledOrder, setShuffledOrder] = useState(null);
  const [learned, setLearned]             = useState(new Set());

  // UI
  const [copied, setCopied]             = useState(false);
  const [savedOutputs, setSavedOutputs] = useState([]);
  const [showSaved, setShowSaved]       = useState(false);
  const contentRef = useRef(null);

  useEffect(() => {
    api.listForgeOutputs(nb.id).then(setSavedOutputs).catch(() => {});
  }, [nb.id]);

  useEffect(() => {
    if (contentRef.current && !flashcards)
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
  }, [content, flashcards]);

  async function autoSave(fullContent, selectedAction) {
    try {
      const out = await api.saveForgeOutput(nb.id, selectedAction, fullContent, topic);
      setSavedOutputs(prev => [out, ...prev]);
      onToast?.(`Saved to ${nb.title}`);
    } catch (err) {
      console.error("autoSave failed:", err);
    }
  }

  async function generate(selectedAction) {
    setAction(selectedAction);
    setContent(""); setFlashcards(null);
    setCardIdx(0); setIsFlipped(false); setShuffledOrder(null); setLearned(new Set());
    setGenerating(true);

    let full = "";
    try {
      await api.forge(
        nb.id, selectedAction, topic,
        (chunk) => { full += chunk; },
        () => {
          if (selectedAction === "flashcards") {
            try {
              const m = full.match(/\[[\s\S]*\]/);
              if (m) {
                const cards = JSON.parse(m[0]);
                setFlashcards(cards);
                setShuffledOrder(cards.map((_, i) => i));
              } else { setContent(full); }
            } catch { setContent(full); }
          } else {
            setContent(full);
          }
          setGenerating(false);
          autoSave(full, selectedAction);
        },
        (err) => { setContent(`Error: ${err}`); setGenerating(false); }
      );
    } catch (err) {
      if (err.code === "forge_limit_reached") {
        setGenerating(false);
        setAction(null);
        onUpgradeNeeded?.("forge_limit_reached");
        return;
      }
      setContent(`Error: ${err.message}`);
      setGenerating(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownload() {
    const label = FORGE_ACTIONS.find(a => a.id === action)?.label ?? action;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${nb.title} - ${label}.txt`; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDeleteSaved(id) {
    try { await api.deleteForgeOutput(id); setSavedOutputs(p => p.filter(o => o.id !== id)); } catch {}
  }

  function loadSaved(o) {
    setAction(o.type); setContent(o.content); setGenerating(false); setShowSaved(false);
    if (o.type === "flashcards") {
      try {
        const m = o.content.match(/\[[\s\S]*\]/);
        if (m) { const cards = JSON.parse(m[0]); setFlashcards(cards); setShuffledOrder(cards.map((_, i) => i)); setCardIdx(0); setIsFlipped(false); setLearned(new Set()); return; }
      } catch {}
    }
    setFlashcards(null);
  }

  const currentOrder = shuffledOrder ?? (flashcards?.map((_, i) => i) ?? []);
  const currentCard  = flashcards?.[currentOrder[cardIdx]];
  const totalCards   = flashcards?.length ?? 0;
  const realIdx      = currentOrder[cardIdx];

  function goNext() { if (cardIdx >= totalCards - 1) return; setIsFlipped(false); setTimeout(() => setCardIdx(i => i + 1), 140); }
  function goPrev() { if (cardIdx <= 0) return; setIsFlipped(false); setTimeout(() => setCardIdx(i => i - 1), 140); }
  function handleShuffle() {
    setCardIdx(0); setIsFlipped(false);
    const arr = [...currentOrder];
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    setShuffledOrder(arr);
  }
  function toggleLearned() { setLearned(p => { const n = new Set(p); n.has(realIdx) ? n.delete(realIdx) : n.add(realIdx); return n; }); }

  const showCards = action === "flashcards" && flashcards && !generating;
  const activeColor = action ? FORGE_BY_ID[action]?.color ?? "var(--acc)" : "var(--acc)";

  return (
    <div className="tool-content">
      {/* Saved-library toggle (relocated from the old panel header) */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button
          onClick={() => setShowSaved(v => !v)}
          className="btn-press"
          style={{
            background: showSaved ? "var(--acc-bg)" : "transparent",
            border: `1px solid ${showSaved ? "color-mix(in srgb, var(--acc) 35%, transparent)" : "var(--border)"}`,
            borderRadius: 9, padding: "0 12px", height: 32, cursor: "pointer",
            fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
            color: showSaved ? "var(--acc-h)" : "var(--t2)",
            fontFamily: FONT,
            display: "flex", alignItems: "center", gap: 5,
          }}
          onMouseEnter={e => { if (!showSaved) { e.currentTarget.style.color = "var(--t1)"; e.currentTarget.style.borderColor = "var(--border-h)"; }}}
          onMouseLeave={e => { if (!showSaved) { e.currentTarget.style.color = "var(--t2)"; e.currentTarget.style.borderColor = "var(--border)"; }}}
        >
          SAVED
          {savedOutputs.length > 0 && (
            <span style={{
              background: showSaved ? "color-mix(in srgb, var(--acc) 25%, transparent)" : "var(--t4)",
              color: showSaved ? "var(--acc-h)" : "var(--t2)",
              borderRadius: 999, padding: "1px 6px", fontSize: 10, fontWeight: 700,
              letterSpacing: "0",
            }}>{savedOutputs.length}</span>
          )}
        </button>
      </div>

      {/* Saved outputs panel */}
      {showSaved && (
        <div style={{
          background: "var(--s1)", border: "1px solid var(--border)",
          borderRadius: 12, padding: 6, marginBottom: 14,
          maxHeight: 200, overflowY: "auto",
          animation: "fadeIn 0.18s ease",
          boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
        }}>
          {savedOutputs.length === 0 ? (
            <div style={{
              fontSize: 12.5, color: "var(--t3)",
              fontFamily: FONT, padding: "20px 12px", textAlign: "center",
            }}>
              No saved outputs yet. Generate something to start your library.
            </div>
          ) : savedOutputs.map(o => {
            const meta = FORGE_BY_ID[o.type];
            const Icon = meta?.Icon ?? File;
            const color = meta?.color ?? "var(--acc)";
            return (
              <div key={o.id} className="forge-saved-item">
                <div style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: `${color}18`, border: `1px solid ${color}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color, flexShrink: 0,
                }}><Icon size={15} strokeWidth={1.75} /></div>
                <div onClick={() => loadSaved(o)} style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12.5, color: "var(--t1)", fontFamily: FONT, fontWeight: 500,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    letterSpacing: "-0.01em",
                  }}>{o.title}</div>
                  <div style={{
                    fontSize: 10.5, color: "var(--t3)",
                    fontFamily: FONT, marginTop: 2,
                  }}>
                    {new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                </div>
                <button className="forge-del" onClick={e => { e.stopPropagation(); handleDeleteSaved(o.id); }} aria-label="Delete"><X size={12} strokeWidth={2} /></button>
              </div>
            );
          })}
        </div>
      )}

      {/* Action buttons — color-coded grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        {FORGE_ACTIONS.map(a => (
          <button
            key={a.id}
            onClick={() => generate(a.id)}
            disabled={generating}
            className={`forge-action-btn${action === a.id ? " forge-active" : ""}`}
            style={{ "--btn-color": a.color }}
          >
            <div className="forge-action-icon">{a.icon}</div>
            <div style={{
              fontSize: 12, fontWeight: 600, fontFamily: FONT,
              letterSpacing: "-0.01em",
            }}>{a.label}</div>
          </button>
        ))}
      </div>

      {/* Topic input */}
      <input
        value={topic}
        onChange={e => setTopic(e.target.value)}
        onKeyDown={e => e.key === "Enter" && action && !generating && generate(action)}
        placeholder="Focus on a specific topic (optional)"
        disabled={generating}
        className="forge-topic-input"
        style={{
          width: "100%", background: "var(--s1)",
          border: "1px solid var(--border)",
          borderRadius: 10, padding: "0 14px",
          height: 40,
          color: "var(--t1)", fontSize: 13,
          fontFamily: FONT,
          outline: "none", marginBottom: 12,
          boxSizing: "border-box",
          transition: "all 0.18s",
          letterSpacing: "-0.01em",
        }}
      />

      {/* Flashcard view */}
      {showCards && currentCard ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 10,
          }}>
            <div style={{
              fontSize: 11, color: "var(--t3)", fontFamily: MONO,
              padding: "3px 8px", background: "var(--s2)",
              borderRadius: 6, fontWeight: 600,
            }}>{cardIdx + 1} / {totalCards}</div>
            <div style={{
              fontSize: 11, color: "var(--t3)", fontFamily: FONT,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              flex: 1, textAlign: "center", margin: "0 12px",
            }}>{nb.title}</div>
            <div style={{
              fontSize: 11, color: learned.size > 0 ? "#34D399" : "var(--t4)",
              fontFamily: MONO, flexShrink: 0,
              padding: "3px 8px",
              background: learned.size > 0 ? "rgba(52,211,153,0.1)" : "var(--s2)",
              borderRadius: 6, fontWeight: 600,
            }}>{learned.size}/{totalCards}</div>
          </div>

          <div style={{ perspective: "1400px", cursor: "pointer", flex: 1, minHeight: 0 }} onClick={() => setIsFlipped(f => !f)}>
            <div className={`forge-card${isFlipped ? " flipped" : ""}`} style={{ width: "100%", height: "100%", position: "relative", minHeight: 200 }}>
              <div className="forge-face" style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(180deg, #1C1C2A 0%, #14141F 100%)",
                border: "1px solid var(--border-h)",
                borderRadius: 14,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                padding: "28px 22px",
                boxShadow: "0 12px 32px rgba(0,0,0,0.3)",
              }}>
                <div style={{
                  fontSize: 15, color: "var(--t1)", textAlign: "center", lineHeight: 1.6,
                  fontFamily: FONT, fontWeight: 500, letterSpacing: "-0.01em",
                }}>{currentCard.question}</div>
                <div style={{
                  position: "absolute", bottom: 12, fontSize: 10,
                  color: "var(--t4)", fontFamily: FONT,
                  letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600,
                }}>Click to flip</div>
              </div>
              <div className="forge-face forge-back" style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(180deg, var(--acc-bg) 0%, rgba(167,139,250,0.04) 100%)",
                border: "1px solid color-mix(in srgb, var(--acc) 30%, transparent)",
                borderRadius: 14,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                padding: "28px 22px",
                boxShadow: "0 12px 32px rgba(0,0,0,0.3), 0 0 24px rgba(167,139,250,0.15)",
              }}>
                <div style={{
                  fontSize: 14, color: "var(--acc-h)", textAlign: "center", lineHeight: 1.65,
                  fontFamily: FONT, letterSpacing: "-0.005em",
                }}>{currentCard.answer}</div>
                <div style={{
                  position: "absolute", bottom: 12, fontSize: 10,
                  color: "var(--acc-bg-h)", fontFamily: FONT,
                  letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600,
                }}>Click to flip back</div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14 }}>
            <button onClick={goPrev} disabled={cardIdx === 0} className="btn-press" style={{
              background: "var(--s1)", border: "1px solid var(--border)",
              borderRadius: 10, height: 36, width: 44,
              color: cardIdx === 0 ? "var(--t4)" : "var(--t2)",
              cursor: cardIdx === 0 ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}><ArrowLeft size={15} strokeWidth={1.75} /></button>
            <button onClick={handleShuffle} title="Shuffle" className="btn-press" style={{
              background: "var(--s1)", border: "1px solid var(--border)",
              borderRadius: 10, height: 36, width: 40,
              color: "var(--t3)", cursor: "pointer", fontSize: 13,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--acc)"; e.currentTarget.style.borderColor = "color-mix(in srgb, var(--acc) 30%, transparent)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--t3)"; e.currentTarget.style.borderColor = "var(--border)"; }}
            ><RefreshCw size={14} strokeWidth={1.75} /></button>
            <button onClick={toggleLearned} className="btn-press" style={{
              background: learned.has(realIdx) ? "rgba(52,211,153,0.12)" : "var(--s1)",
              border: `1px solid ${learned.has(realIdx) ? "rgba(52,211,153,0.32)" : "var(--border)"}`,
              borderRadius: 10, padding: "0 14px", height: 36,
              color: learned.has(realIdx) ? "#34D399" : "var(--t2)",
              cursor: "pointer", fontSize: 12, fontFamily: FONT, fontWeight: 600,
              whiteSpace: "nowrap", letterSpacing: "-0.005em",
            }}>
              {learned.has(realIdx) ? <><Check size={13} strokeWidth={2} /> Learned</> : "Mark learned"}
            </button>
            <button onClick={goNext} disabled={cardIdx === totalCards - 1} className="btn-press" style={{
              background: "var(--s1)", border: "1px solid var(--border)",
              borderRadius: 10, height: 36, width: 44,
              color: cardIdx === totalCards - 1 ? "var(--t4)" : "var(--t2)",
              cursor: cardIdx === totalCards - 1 ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}><ChevronRight size={16} strokeWidth={1.75} /></button>
          </div>
        </div>
      ) : (
        <>
          <div ref={contentRef} style={{
            flex: 1, overflowY: "auto", minHeight: 240,
            background: "#0F0F18",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "18px",
            fontSize: 13.5, color: "var(--t1)", lineHeight: 1.7,
            fontFamily: FONT, whiteSpace: "pre-wrap",
            letterSpacing: "-0.005em",
          }}>
            {!action && !content && (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", height: "100%", minHeight: 200, gap: 12,
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 14,
                  background: "linear-gradient(135deg, var(--acc-bg) 0%, rgba(167,139,250,0.04) 100%)",
                  border: "1px solid rgba(167,139,250,0.18)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--accent)",
                }}><Sparkles size={24} strokeWidth={1.5} /></div>
                <div style={{
                  fontSize: 14, fontWeight: 600, color: "var(--t1)", fontFamily: FONT,
                  letterSpacing: "-0.015em",
                }}>Ready to forge</div>
                <div style={{
                  fontSize: 12.5, color: "var(--t3)", lineHeight: 1.55,
                  textAlign: "center", maxWidth: 260,
                }}>
                  Pick a type above to generate study content from your notes.
                </div>
              </div>
            )}
            {generating && (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", height: "100%", gap: 14, minHeight: 200,
              }}>
                <div className="forge-spinner" style={{ borderTopColor: activeColor, borderColor: `${activeColor}26` }} />
                <span style={{
                  fontSize: 12.5, color: "var(--t2)", fontFamily: FONT,
                  fontWeight: 500, letterSpacing: "-0.005em",
                }}>
                  Forging your {FORGE_BY_ID[action]?.label.toLowerCase() ?? "output"}…
                </span>
              </div>
            )}
            {!generating && content && <span>{content}</span>}
          </div>

          {content && !generating && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={handleCopy} className="btn-press" style={{
                flex: 1, background: copied ? "rgba(52,211,153,0.1)" : "var(--s1)",
                border: `1px solid ${copied ? "rgba(52,211,153,0.3)" : "var(--border)"}`,
                borderRadius: 10, height: 36,
                color: copied ? "#34D399" : "var(--t2)",
                fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                letterSpacing: "-0.005em",
              }}
                onMouseEnter={e => { if (!copied) { e.currentTarget.style.color = "var(--t1)"; e.currentTarget.style.borderColor = "var(--border-h)"; }}}
                onMouseLeave={e => { if (!copied) { e.currentTarget.style.color = "var(--t2)"; e.currentTarget.style.borderColor = "var(--border)"; }}}
              >{copied ? <><Check size={13} strokeWidth={2} /> Copied</> : "Copy"}</button>
              <button onClick={handleDownload} className="btn-press" style={{
                flex: 1, background: "var(--s1)",
                border: "1px solid var(--border)",
                borderRadius: 10, height: 36,
                color: "var(--t2)", fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: FONT,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                letterSpacing: "-0.005em",
              }}
                onMouseEnter={e => { e.currentTarget.style.color = "var(--t1)"; e.currentTarget.style.borderColor = "var(--border-h)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--t2)"; e.currentTarget.style.borderColor = "var(--border)"; }}
              >Download</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function renderMessageText(text, isOwn) {
  // Highlight @mentions inline (e.g. "@Alice ...")
  const parts = String(text ?? "").split(/(@[A-Za-z][A-Za-z0-9_]*)/g);
  return parts.map((p, i) => {
    if (/^@[A-Za-z][A-Za-z0-9_]*$/.test(p)) {
      return (
        <span key={i} style={{
          color: isOwn ? "var(--t1)" : "var(--acc-h)",
          fontWeight: 600,
          background: isOwn ? "var(--border-h)" : "color-mix(in srgb, var(--acc) 16%, transparent)",
          padding: "0 4px", borderRadius: 4,
        }}>{p}</span>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

function SourcesPanel({ sources }) {
  const [open, setOpen] = useState(false);
  if (!sources || sources.length === 0) return null;
  return (
    <div style={{ marginTop: 6, marginLeft: 2 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: "transparent",
          border: "1px solid var(--border-default)",
          borderRadius: 8, padding: "0 10px", height: 24,
          fontSize: 11, fontWeight: 600, fontFamily: FONT,
          color: "var(--text-tertiary)",
          cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 4,
        }}
      ><Paperclip size={11} strokeWidth={1.75} /> {sources.length} source{sources.length === 1 ? "" : "s"} <ChevronRight size={11} strokeWidth={2} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} /></button>
      {open && (
        <div style={{
          marginTop: 6, padding: "8px 10px",
          background: "var(--bg-surface-2)",
          border: "1px solid var(--border-default)",
          borderRadius: 8, maxWidth: 360,
        }}>
          {sources.map((s, i) => (
            <div key={i} style={{
              fontSize: 11.5, color: "var(--text-secondary)",
              fontFamily: FONT, padding: "2px 0",
            }}>• {s}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Public-share modal ───────────────────────────────────────────────────────
function ShareModal({ notebookId, onClose, onStateChange }) {
  const [loading, setLoading] = useState(true);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.shareNotebook(notebookId)
      .then(r => { setShareUrl(r.shareUrl); setLoading(false); onStateChange?.(true); })
      .catch(e => { setError(e.message || "Couldn't create a share link."); setLoading(false); });
  }, [notebookId, onStateChange]);

  async function copy() {
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable */ }
  }
  async function stopSharing() {
    setStopping(true);
    try { await api.unshareNotebook(notebookId); onStateChange?.(false); onClose(); }
    catch (e) { setError(e.message || "Couldn't stop sharing."); setStopping(false); }
  }

  return (
    <div className="mobile-sheet-overlay" onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, zIndex: 3000, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16, animation: "fadeIn 0.18s ease",
    }}>
      <div className="mobile-sheet" style={{
        background: "var(--bg-surface-1)", border: "1px solid rgba(167,139,250,0.28)",
        borderRadius: 18, padding: "28px 26px", maxWidth: 440, width: "100%",
        boxShadow: "var(--sh-modal)", fontFamily: FONT, animation: "slideInUp 0.22s cubic-bezier(0.34,1.56,0.64,1)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <Share2 size={18} strokeWidth={2} style={{ color: "var(--acc)" }} />
          <div style={{ fontSize: 18, fontWeight: 600, fontFamily: FONT_HEADING, color: "var(--text-primary)" }}>Your notebook is now public!</div>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 18 }}>Anyone with this link can view your notes.</div>

        {error ? (
          <div style={{ fontSize: 13, color: "#F87171", marginBottom: 14 }}>{error}</div>
        ) : (
          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            <input readOnly value={loading ? "Generating link…" : shareUrl} onFocus={e => e.target.select()} style={{
              flex: 1, height: 42, borderRadius: 10, background: "var(--s1)", border: "1px solid var(--border)",
              color: "var(--text-primary)", fontFamily: FONT, fontSize: 13.5, padding: "0 12px", outline: "none",
            }} />
            <button onClick={copy} disabled={loading} className="btn-press" style={{
              height: 42, borderRadius: 10, border: "none", padding: "0 16px", cursor: loading ? "wait" : "pointer",
              background: "linear-gradient(135deg, #A78BFA, #8B5CF6)", color: "#fff", fontWeight: 700, fontSize: 13.5, fontFamily: FONT, whiteSpace: "nowrap",
            }}>{copied ? "Copied! ✓" : "Copy"}</button>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
          <button onClick={stopSharing} disabled={stopping} className="btn-press" style={{
            height: 40, borderRadius: 10, padding: "0 16px", cursor: "pointer",
            background: "transparent", border: "1px solid rgba(248,113,113,0.4)", color: "var(--danger)",
            fontFamily: FONT, fontSize: 13, fontWeight: 600,
          }}>{stopping ? "Stopping…" : "Stop sharing"}</button>
          <button onClick={onClose} className="btn-press" style={{
            height: 40, borderRadius: 10, padding: "0 18px", cursor: "pointer",
            background: "transparent", border: "1px solid var(--border-h)", color: "var(--text-secondary)", fontFamily: FONT, fontSize: 13,
          }}>Done</button>
        </div>
      </div>
    </div>
  );
}

function NotebookView({ nb, onBack, onDeleted, currentUserId, onToast, onSetStatus, onUpgradeNeeded }) {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [isShared, setIsShared] = useState(!!nb.is_public);
  const [deleting, setDeleting]     = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [members, setMembers]       = useState([]);
  // Scholr 2.0 — one source of truth for which study tool is open (it renders
  // in the shared ToolModal). Replaces the old show*/mobilePanelView/isMobile
  // tangle; responsive behavior is now handled purely in CSS.
  const [activeTool, setActiveTool] = useState(null); // null | 'notes' | 'forge' | 'podcast' | 'feynman' | 'image-gen'
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [explainLevel, setExplainLevel] = useState(null); // { messageId } showing submenu
  const [explainingId, setExplainingId] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  // Prefer the class-assigned color when available, otherwise fall back to
  // the deterministic per-notebook tint so other views still render nicely.
  const t = nb.color ? classTint(nb.color) : tintFor(nb.id ?? nb.title);

  useEffect(() => {
    api.listMembers(nb.id).then(setMembers).catch(() => {});
  }, [nb.id]);

  useEffect(() => {
    api.getMessages(nb.id)
      .then(async (rows) => {
        if (rows.length > 0) {
          // For prior assistant messages, derive sources by matching known note titles against the content
          let notesByTitle = [];
          try { notesByTitle = await api.listNotes(nb.id); } catch { /* ignore */ }
          setMessages(rows.map(r => ({
            id: r.id, role: r.role, text: r.content, createdBy: r.created_by,
            sources: r.role === "assistant"
              ? notesByTitle
                  .filter(n => n.title && r.content.toLowerCase().includes(n.title.toLowerCase()))
                  .map(n => n.title)
              : undefined,
          })));
        } else {
          setMessages([{ role: "assistant", text: `Hey! I've read all the notes in this notebook. Ask me anything about ${nb.title}.` }]);
        }
        setHistoryLoaded(true);
      })
      .catch(() => {
        setMessages([{ role: "assistant", text: `Hey! I've read all the notes in this notebook. Ask me anything about ${nb.title}.` }]);
        setHistoryLoaded(true);
      });
  }, [nb.id]);

  function handleNoteUploaded(note) {
    setMessages(m => [...m, {
      role: "assistant",
      text: `"${note.title}" was added to this notebook. I'll include it in future answers.`,
    }]);
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError("");
    try {
      await api.deleteNotebook(nb.id);
      onDeleted(nb.id);
    } catch (err) {
      setDeleteError(err.message);
      setDeleting(false);
    }
  }

  useEffect(() => {
    if (!historyLoaded) return;
    const hasHistory = messages.some(m => m.id);
    if (hasHistory) return;
    api.listNotes(nb.id).then(notes => {
      if (notes.length === 0) return;
      const list = notes.map(n => `• ${n.title}`).join("\n");
      setMessages(m => [...m, {
        role: "assistant",
        text: `${notes.length} note${notes.length !== 1 ? "s" : ""} in this notebook:\n${list}\n\nAsk me anything about them!`,
      }]);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyLoaded]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function ask(presetText) {
    const text = (typeof presetText === "string" ? presetText : query).trim();
    if (!text || loading) return;

    setQuery("");
    setMentionOpen(false);
    setLoading(true);
    setMessages(m => [...m, { role: "user", text, createdBy: currentUserId }]);
    api.addMessage(nb.id, "user", text).catch(err => console.error("addMessage failed (user):", err));

    try {
      const data = await api.query(nb.id, text);
      if (data.error) throw new Error(data.error);
      const saved = await api.addMessage(nb.id, "assistant", data.answer).catch(err => { console.error("addMessage failed (assistant):", err); return null; });
      setMessages(m => [...m, { id: saved?.id, role: "assistant", text: data.answer, createdBy: null, sources: data.sources ?? [] }]);
      if (data.usageWarning) onToast?.(`⚡ ${data.usageWarning.message}`);
    } catch (err) {
      if (err.code === "message_limit_reached") {
        // Remove the optimistic user message bubble and show upgrade modal
        setMessages(m => m.slice(0, -1));
        onUpgradeNeeded?.("message_limit_reached");
      } else {
        setMessages(m => [...m, {
          role: "assistant",
          text: `Sorry, something went wrong: ${err.message}`,
          isError: true,
        }]);
      }
    } finally {
      setLoading(false);
    }
  }

  function onQueryChange(e) {
    const value = e.target.value;
    setQuery(value);
    // Detect @mention pattern: word starting with @ at cursor
    const caret = e.target.selectionStart ?? value.length;
    const upToCaret = value.slice(0, caret);
    const m = upToCaret.match(/(?:^|\s)@([A-Za-z0-9_]*)$/);
    if (m) {
      setMentionQuery(m[1].toLowerCase());
      setMentionOpen(true);
    } else {
      setMentionOpen(false);
    }
  }

  function pickMention(name) {
    if (!inputRef.current) return;
    const el = inputRef.current;
    const caret = el.selectionStart ?? query.length;
    const before = query.slice(0, caret).replace(/@([A-Za-z0-9_]*)$/, `@${name} `);
    const after = query.slice(caret);
    const next = before + after;
    setQuery(next);
    setMentionOpen(false);
    setTimeout(() => { el.focus(); el.selectionStart = el.selectionEnd = before.length; }, 0);
  }

  async function doExplainDifferently(messageId, level) {
    setExplainLevel(null);
    setExplainingId(messageId);
    try {
      const data = await api.explainDifferently(nb.id, messageId, level);
      const saved = await api.addMessage(nb.id, "assistant", data.answer).catch(() => null);
      setMessages(m => [...m, { id: saved?.id, role: "assistant", text: data.answer, createdBy: null }]);
    } catch (err) {
      setMessages(m => [...m, { role: "assistant", text: `Couldn't re-explain: ${err.message}`, isError: true }]);
    } finally {
      setExplainingId(null);
    }
  }

  const mentionCandidates = mentionOpen
    ? members
        .filter(m => {
          const name = (m.first_name || m.email?.split("@")[0] || "").toLowerCase();
          return name && name !== (members.find(x => x.user_id === currentUserId)?.first_name || "").toLowerCase() && name.startsWith(mentionQuery);
        })
        .slice(0, 6)
    : [];

  return (
    <div className="print-area" data-print-title={nb.title || "Notes"} style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0, overflow: "hidden", position: "relative" }}>
      {showShare && (
        <ShareModal notebookId={nb.id} onClose={() => setShowShare(false)} onStateChange={setIsShared} />
      )}
      {showUpload && (
        <UploadNotesModal
          notebookId={nb.id} accentColor={t.hue}
          onClose={() => setShowUpload(false)}
          onUploaded={handleNoteUploaded}
        />
      )}

      {showInvite && (
        <InviteModal notebookId={nb.id} onClose={() => setShowInvite(false)} />
      )}

      {confirmDelete && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(8,8,14,0.78)",
          backdropFilter: "blur(10px)", display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 1000, padding: 16,
        }}>
          <div style={{
            background: "linear-gradient(180deg, #14141F 0%, #1C1C2A 100%)",
            border: "1px solid var(--border)",
            borderRadius: 18, width: "100%", maxWidth: 400,
            padding: "24px",
            boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(248,113,113,0.12)",
            animation: "fadeIn 0.2s ease",
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.28)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--danger)", marginBottom: 14,
            }}><Trash2 size={20} strokeWidth={1.75} /></div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--t1)", fontFamily: FONT, marginBottom: 6, letterSpacing: "-0.015em" }}>
              Delete this notebook?
            </div>
            <div style={{ fontSize: 13, color: "var(--t2)", fontFamily: FONT, marginBottom: 20, lineHeight: 1.55 }}>
              <span style={{ color: "var(--t1)", fontWeight: 500 }}>{nb.title}</span> and all its notes will be permanently deleted.
            </div>
            {deleteError && (
              <div style={{
                background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.22)",
                borderRadius: 10, padding: "10px 12px", marginBottom: 16,
                fontSize: 12.5, color: "#F87171", fontFamily: FONT,
              }}>{deleteError}</div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setConfirmDelete(false); setDeleteError(""); }}
                disabled={deleting}
                className="btn-press"
                style={{
                  background: "transparent", border: "1px solid var(--border-h)",
                  borderRadius: 10, padding: "0 16px", height: 36,
                  color: "var(--t2)", fontSize: 13, fontWeight: 500,
                  cursor: "pointer", fontFamily: FONT,
                  opacity: deleting ? 0.5 : 1, letterSpacing: "-0.01em",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-h)"; e.currentTarget.style.color = "var(--t1)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-h)"; e.currentTarget.style.color = "var(--t2)"; }}
              >Cancel</button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="btn-press"
                style={{
                  background: "linear-gradient(135deg, #F87171 0%, #EF4444 100%)",
                  border: "none", borderRadius: 10, padding: "0 18px", height: 36,
                  color: "#fff", fontWeight: 600, fontSize: 13,
                  cursor: deleting ? "not-allowed" : "pointer",
                  fontFamily: FONT, opacity: deleting ? 0.65 : 1,
                  boxShadow: "0 4px 14px rgba(248,113,113,0.35)",
                  letterSpacing: "-0.01em",
                }}
              >{deleting ? "Deleting…" : "Delete"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="nb-header no-print" style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 18,
        paddingBottom: 14, borderBottom: "1px solid var(--border-default)",
      }}>
        {/* Back — always Row 1 */}
        <button onClick={onBack} className="btn-press" style={{
          background: "transparent", border: "1px solid var(--border-strong)",
          color: "var(--text-secondary)",
          borderRadius: 10, padding: "0 14px", height: 36, cursor: "pointer",
          fontFamily: FONT, fontSize: 13, fontWeight: 500,
          letterSpacing: "-0.01em", flexShrink: 0,
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "var(--border-default)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.background = "transparent"; }}
        >← Back</button>

        {/* Title + (desktop) status + due date */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
          <div style={{
            width: 8, height: 8, borderRadius: 2,
            background: `linear-gradient(135deg, ${t.hue}, ${t.deep})`,
            boxShadow: `0 0 12px ${t.hue}66`, flexShrink: 0,
          }} />
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 15, fontWeight: 600, color: "var(--text-primary)",
              fontFamily: FONT, letterSpacing: "-0.018em",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{nb.title}</div>
            {nb.topic && (
              <div style={{
                fontSize: 11.5, color: "var(--text-tertiary)",
                fontFamily: FONT, marginTop: 1,
              }}>{nb.topic}</div>
            )}
          </div>
          {onSetStatus && (
            <span className="nb-desktop-only" style={{ marginLeft: 4 }}>
              <StatusPill status={nb.status ?? "in_progress"} onChange={s => onSetStatus(s)} size="md" />
            </span>
          )}
        </div>

        {/* Avatar — mobile: in Row 1 right; desktop: in actions */}
        {members.length > 0 && (
          <span className="nb-mobile-only" style={{ flexShrink: 0 }}>
            <MemberAvatarStack members={members} />
          </span>
        )}

        {/* Action buttons — desktop: inline; mobile: full-width scrollable Row 2 */}
        <div className="nb-header-actions">
          <button
            onClick={() => {
              const prev = document.title;
              document.title = nb.title || "Scholr notes";
              window.print();
              setTimeout(() => { document.title = prev; }, 1000);
            }}
            aria-label="Export PDF"
            data-tooltip="Export as PDF"
            className="btn-press has-tip"
            style={{
              background: "transparent", border: "1px solid var(--border-strong)",
              color: "var(--text-secondary)",
              borderRadius: 10, padding: "0 12px", height: 36, cursor: "pointer",
              fontFamily: FONT, fontSize: 14, flexShrink: 0,
            }}
          >📄</button>
          <button
            onClick={() => setShowShare(true)}
            aria-label="Share notebook"
            data-tooltip="Share notebook"
            className="btn-press has-tip"
            style={{
              background: isShared ? "var(--acc-bg)" : "transparent",
              border: `1px solid ${isShared ? "var(--acc)" : "var(--border-strong)"}`,
              color: isShared ? "var(--acc-h)" : "var(--text-secondary)",
              borderRadius: 10, padding: "0 12px", height: 36, cursor: "pointer",
              fontFamily: FONT, fontSize: 14, flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6,
            }}
          ><Share2 size={14} strokeWidth={1.85} /></button>
          <button
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete notebook"
            data-tooltip="Delete notebook"
            className="btn-press has-tip"
            style={{
              background: "transparent", border: "1px solid rgba(248,113,113,0.18)",
              color: "rgba(248,113,113,0.55)",
              borderRadius: 10, padding: "0 12px", height: 36, cursor: "pointer",
              fontFamily: FONT, fontSize: 14, flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(248,113,113,0.5)"; e.currentTarget.style.color = "var(--danger)"; e.currentTarget.style.background = "rgba(248,113,113,0.06)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(248,113,113,0.18)"; e.currentTarget.style.color = "rgba(248,113,113,0.55)"; e.currentTarget.style.background = "transparent"; }}
          ><Trash2 size={14} strokeWidth={1.75} /></button>

          {/* Status + DueDate mobile-only compact variants */}
          {onSetStatus && (
            <span className="nb-mobile-only">
              <StatusPill status={nb.status ?? "in_progress"} onChange={s => onSetStatus(s)} size="sm" compact />
            </span>
          )}
          <span className="nb-actions-divider nb-desktop-only" />

          {/* Primary study tools — all open in the shared spacious ToolModal */}
          {NB_TOOLS.map(({ id, text, label, Icon }) => {
            const active = activeTool === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTool(active ? null : id)}
                aria-label={label}
                data-tooltip={label}
                className="btn-press has-tip nb-tool-btn"
                style={{
                  background: active ? "linear-gradient(135deg, color-mix(in srgb, var(--acc) 18%, transparent) 0%, var(--acc-bg) 100%)" : "transparent",
                  border: `1px solid ${active ? "var(--acc-bg-h)" : "var(--border-strong)"}`,
                  color: active ? "var(--acc-h)" : "var(--text-secondary)",
                  boxShadow: active ? "0 0 0 1px rgba(167,139,250,0.18), 0 4px 14px var(--acc-bg-h)" : "none",
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.borderColor = "var(--border-strong)"; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.borderColor = "var(--border-strong)"; } }}
              ><Icon size={15} strokeWidth={1.85} /> <span className="nb-action-text">{text}</span></button>
            );
          })}

          <span className="nb-actions-divider nb-desktop-only" />

          <button
            onClick={() => setShowUpload(true)}
            aria-label="Upload files"
            data-tooltip="Upload files"
            className="btn-press has-tip"
            style={{
              background: "transparent", border: "1px solid var(--border-strong)",
              borderRadius: 10, padding: "0 14px", height: 36, cursor: "pointer",
              fontFamily: FONT, fontSize: 13, fontWeight: 500,
              color: "var(--text-secondary)", letterSpacing: "-0.01em", flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "var(--border-default)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.background = "transparent"; }}
          ><Paperclip size={14} strokeWidth={1.75} /> <span className="nb-action-text">Upload</span></button>

          <button
            onClick={() => setShowInvite(true)}
            aria-label="Invite collaborators"
            data-tooltip="Invite collaborators"
            className="btn-press has-tip"
            style={{
              background: "transparent", border: "1px solid var(--border-strong)",
              borderRadius: 10, padding: "0 14px", height: 36, cursor: "pointer",
              fontFamily: FONT, fontSize: 13, fontWeight: 500,
              color: "var(--text-secondary)", letterSpacing: "-0.01em", flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "var(--border-default)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.background = "transparent"; }}
          >+ <span className="nb-action-text">Invite</span></button>

          {/* Avatar — desktop: in actions (right-most); mobile: shown in Row 1 via nb-mobile-only above */}
          {members.length > 0 && (
            <span className="nb-desktop-only">
              <MemberAvatarStack members={members} />
            </span>
          )}
        </div>
      </div>

      {/* Chat + Forge split */}
      <div className="notebook-split" style={{ display: "flex", flex: 1, minHeight: 0, gap: 0 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* Message list */}
          <div style={{
            flex: 1, overflowY: "auto", display: "flex", flexDirection: "column",
            gap: 12, marginBottom: 14, paddingRight: 4,
          }}>
            {messages.map((m, i) => {
              const isOwn = m.role === "user" && (m.createdBy === currentUserId || (!m.createdBy && m.role === "user"));
              const isOtherMember = m.role === "user" && m.createdBy && m.createdBy !== currentUserId;
              const isAssistant = m.role === "assistant";

              const senderInfo = isOtherMember ? members.find(mem => mem.user_id === m.createdBy) : null;
              const senderLabel = isAssistant
                ? "Derek"
                : isOtherMember
                  ? (senderInfo?.first_name?.trim() || senderInfo?.email?.split("@")[0] || "Member")
                  : null;
              const senderTint = isOtherMember ? tintFor(senderInfo?.email ?? "") : null;

              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: isOwn ? "flex-end" : "flex-start" }}>
                  {senderLabel && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6, marginBottom: 5,
                      paddingLeft: 4,
                    }}>
                      {isAssistant ? (
                        <div style={{
                          width: 16, height: 16, borderRadius: "50%",
                          background: "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 9, fontWeight: 700, color: "#fff",
                          boxShadow: "0 2px 6px var(--acc-bg-h)",
                        }}>D</div>
                      ) : senderTint && (
                        <div style={{
                          width: 16, height: 16, borderRadius: "50%",
                          background: `linear-gradient(135deg, ${senderTint.hue}, ${senderTint.deep})`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 9, fontWeight: 700, color: "#fff",
                        }}>{(senderLabel[0] || "?").toUpperCase()}</div>
                      )}
                      <div style={{
                        fontSize: 10.5, fontWeight: 600, letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: isAssistant ? "var(--acc-h)" : senderTint?.hue ?? "var(--t3)",
                        fontFamily: FONT,
                      }}>
                        {senderLabel}
                      </div>
                    </div>
                  )}
                  <div style={{
                    maxWidth: "78%",
                    background: m.isError
                      ? "rgba(248,113,113,0.08)"
                      : isOwn
                        ? "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)"
                        : "linear-gradient(180deg, var(--bg-surface-1) 0%, var(--bg-surface-2) 100%)",
                    color: m.isError ? "#F87171" : isOwn ? "#fff" : "var(--text-primary)",
                    borderRadius: 14,
                    padding: "11px 14px",
                    fontSize: 14, lineHeight: 1.6,
                    fontFamily: FONT,
                    border: !isOwn
                      ? `1px solid ${m.isError ? "rgba(248,113,113,0.22)" : "var(--border-default)"}`
                      : "none",
                    boxShadow: isOwn
                      ? "0 4px 14px rgba(167,139,250,0.28)"
                      : "0 2px 6px rgba(0,0,0,0.2)",
                    whiteSpace: "pre-wrap",
                    letterSpacing: "-0.005em",
                    animation: isOwn
                      ? "slideInUp 200ms cubic-bezier(0.34, 1.56, 0.64, 1) both"
                      : "slideInLeft 220ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
                  }}>
                    {renderMessageText(m.text, isOwn)}
                  </div>
                  {/* Sources display under Derek's message */}
                  {isAssistant && !m.isError && m.sources && m.sources.length > 0 && (
                    <SourcesPanel sources={m.sources} />
                  )}
                  {/* Explain Differently controls */}
                  {isAssistant && !m.isError && m.id && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, marginLeft: 2 }}>
                      <button
                        onClick={() => setExplainLevel(explainLevel === m.id ? null : m.id)}
                        disabled={explainingId !== null}
                        title="Explain differently"
                        style={{
                          background: explainLevel === m.id ? "var(--acc-bg-h)" : "transparent",
                          border: "1px solid var(--border-default)",
                          borderRadius: 8, padding: "0 10px", height: 26,
                          fontSize: 11, fontWeight: 600, fontFamily: FONT,
                          color: "var(--text-secondary)",
                          cursor: explainingId !== null ? "not-allowed" : "pointer",
                          opacity: explainingId !== null ? 0.5 : 1,
                          display: "flex", alignItems: "center", gap: 4,
                        }}
                      ><RefreshCw size={11} strokeWidth={1.75} /> {explainingId === m.id ? "Re-explaining…" : "Explain differently"}</button>
                      {explainLevel === m.id && (
                        <>
                          {[
                            { id: "simpler", label: "Simpler" },
                            { id: "more_advanced", label: "More advanced" },
                            { id: "different_angle", label: "Different angle" },
                          ].map(l => (
                            <button
                              key={l.id}
                              onClick={() => doExplainDifferently(m.id, l.id)}
                              style={{
                                background: "var(--bg-surface-2)",
                                border: "1px solid rgba(167,139,250,0.32)",
                                borderRadius: 8, padding: "0 10px", height: 26,
                                fontSize: 11, fontWeight: 600, fontFamily: FONT,
                                color: "var(--acc-h)", cursor: "pointer",
                              }}
                            >{l.label}</button>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 6, marginBottom: 5, paddingLeft: 4,
                }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: "50%",
                    background: "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 700, color: "#fff",
                    boxShadow: "0 2px 6px var(--acc-bg-h)",
                  }}>D</div>
                  <div style={{
                    fontSize: 10.5, fontWeight: 600, letterSpacing: "0.05em",
                    textTransform: "uppercase", color: "var(--acc-h)", fontFamily: FONT,
                  }}>Derek</div>
                </div>
                <div style={{
                  background: "linear-gradient(180deg, #14141F 0%, #1C1C2A 100%)",
                  border: "1px solid var(--border)",
                  borderRadius: 14, padding: "11px 14px",
                  display: "flex", gap: 6, alignItems: "center",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                  animation: "slideInLeft 220ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
                }}>
                  <span style={{
                    fontSize: 13, color: "var(--t2)", fontStyle: "italic",
                    fontFamily: FONT, marginRight: 4,
                  }}>Derek is thinking</span>
                  <span className="dot-thinking" />
                  <span className="dot-thinking" />
                  <span className="dot-thinking" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* AI disclaimer — Derek is a study aid, not an authoritative source */}
          <div style={{
            fontSize: 11, color: "var(--text-tertiary)", fontFamily: FONT,
            marginBottom: 8, textAlign: "center", lineHeight: 1.4,
          }}>
            Derek is AI — responses may be inaccurate. Verify important information independently.
          </div>

          {/* First-run aha: suggested prompt when the chat is empty */}
          {messages.length === 0 && (
            <button
              onClick={() => ask("Summarize this note and quiz me on the key points.")}
              disabled={loading}
              className="btn-press"
              style={{
                alignSelf: "flex-start", marginBottom: 10,
                background: "linear-gradient(135deg, #A78BFA, #8B5CF6)", border: "none",
                borderRadius: 999, padding: "10px 18px", color: "#fff",
                fontFamily: FONT, fontSize: 13.5, fontWeight: 700,
                cursor: loading ? "wait" : "pointer", boxShadow: "0 4px 14px rgba(167,139,250,0.35)",
              }}
            >✨ Ask AI about this →</button>
          )}

          {/* Input row */}
          <div style={{ display: "flex", gap: 10, position: "relative" }}>
            {mentionOpen && mentionCandidates.length > 0 && (
              <div style={{
                position: "absolute", bottom: "calc(100% + 6px)", left: 0,
                background: "var(--bg-surface-2)",
                border: "1px solid var(--border-default)",
                borderRadius: 10, padding: 4, zIndex: 50,
                boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
                minWidth: 200,
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--t3)", padding: "6px 8px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  Mention a member
                </div>
                {mentionCandidates.map(m => {
                  const name = m.first_name || m.email?.split("@")[0] || "Member";
                  const tnt = tintFor(m.email ?? name);
                  return (
                    <div
                      key={m.user_id}
                      onMouseDown={e => { e.preventDefault(); pickMention(name); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "6px 8px", borderRadius: 7, cursor: "pointer",
                        fontSize: 13, color: "var(--text-primary)", fontFamily: FONT,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "var(--border)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <div style={{
                        width: 20, height: 20, borderRadius: "50%",
                        background: `linear-gradient(135deg, ${tnt.hue}, ${tnt.deep})`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 700, color: "#fff",
                      }}>{name[0]?.toUpperCase()}</div>
                      {name}
                    </div>
                  );
                })}
              </div>
            )}
            <input
              ref={inputRef}
              value={query}
              onChange={onQueryChange}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && ask()}
              placeholder={`Ask anything about ${nb.title}… (use @ to mention)`}
              disabled={loading}
              style={{
                flex: 1, background: "var(--bg-surface-1)",
                border: "1px solid var(--border-default)",
                borderRadius: 12, padding: "0 16px", height: 48,
                color: "var(--text-primary)", fontSize: 14, fontFamily: FONT,
                outline: "none", transition: "all 0.18s",
                letterSpacing: "-0.01em",
              }}
              onFocus={e => { e.target.style.borderColor = "var(--acc)"; e.target.style.boxShadow = "0 0 0 3px var(--acc-bg-h)"; }}
              onBlur={e => { e.target.style.borderColor = "var(--border-default)"; e.target.style.boxShadow = "none"; }}
            />
            <button
              onClick={() => setActiveTool("image-gen")}
              className="btn-press"
              title="Generate image"
              aria-label="Generate image"
              style={{
                background: "var(--s2)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                width: 48, height: 48,
                color: "var(--text-primary)",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s",
              }}
            >
              <ImageIcon size={20} strokeWidth={1.85} />
            </button>
            <button
              onClick={ask}
              disabled={loading || !query.trim()}
              className="btn-press"
              style={{
                background: query.trim() && !loading
                  ? "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)"
                  : "var(--s2)",
                border: query.trim() && !loading ? "none" : "1px solid var(--border)",
                borderRadius: 12,
                width: 48, height: 48, fontSize: 18, fontWeight: 600,
                color: "#fff",
                cursor: loading || !query.trim() ? "not-allowed" : "pointer",
                opacity: loading || !query.trim() ? 0.5 : 1,
                boxShadow: query.trim() && !loading ? "0 4px 14px color-mix(in srgb, var(--acc) 35%, transparent)" : "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s",
              }}
            >
              {loading ? "…" : "↑"}
            </button>
          </div>

        </div>
      </div>

      {/* Scholr 2.0 — every study tool opens in one spacious, dismissible shell */}
      {activeTool && NB_TOOL_META[activeTool] && (
        <ToolModal
          open
          onClose={() => setActiveTool(null)}
          title={NB_TOOL_META[activeTool].title}
          subtitle={NB_TOOL_META[activeTool].subtitle}
          Icon={NB_TOOL_META[activeTool].Icon}
        >
          {activeTool === "notes" && (
            <UnitNotes notebookId={nb.id} currentUserId={currentUserId} tint={t} />
          )}
          {activeTool === "forge" && (
            <TheForge nb={nb} onToast={onToast} onUpgradeNeeded={onUpgradeNeeded} />
          )}
          {activeTool === "podcast" && (
            <PodcastPanel nb={nb} onToast={onToast} onUpgradeNeeded={onUpgradeNeeded} />
          )}
          {activeTool === "feynman" && (
            <FeynmanPanel nb={nb} onToast={onToast} onUpgradeNeeded={onUpgradeNeeded} />
          )}
        </ToolModal>
      )}

      {/* Image generator brings its own modal chrome, so it's gated on activeTool but rendered outside ToolModal */}
      {activeTool === "image-gen" && (
        <ImageGeneratorModal notebookId={nb.id} onClose={() => setActiveTool(null)} />
      )}
    </div>
  );
}

function UnitNoteRow({ note, currentUserId, tint, onDelete, onChange }) {
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

function UnitNotes({ notebookId, currentUserId, tint }) {
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

function PasswordResetModal({ onDone }) {
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 6)  { setError("Password must be at least 6 characters."); return; }
    setError("");
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      onDone();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  const inputBase = {
    width: "100%", background: "var(--s1)", border: "1px solid var(--border)",
    borderRadius: 10, padding: "0 14px", height: 42, color: "var(--t1)", fontSize: 14,
    fontFamily: FONT, outline: "none", transition: "all 0.18s", letterSpacing: "-0.01em",
  };
  const label = {
    fontSize: 11, color: "var(--t2)", fontFamily: FONT,
    letterSpacing: "0.04em", textTransform: "uppercase", display: "block",
    marginBottom: 7, fontWeight: 600,
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(8,8,14,0.78)",
      backdropFilter: "blur(10px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: "linear-gradient(180deg, #14141F 0%, #1C1C2A 100%)",
        border: "1px solid var(--border)",
        borderRadius: 18, width: "100%", maxWidth: 440,
        padding: "28px 26px",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px var(--acc-bg)",
        animation: "fadeIn 0.2s ease",
      }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: "var(--t1)", fontFamily: FONT_HEADING, marginBottom: 5, letterSpacing: "-0.02em" }}>
          Set a new password
        </div>
        <div style={{ fontSize: 13, color: "var(--t2)", marginBottom: 22, fontFamily: FONT, lineHeight: 1.55 }}>
          Choose a strong password for your account.
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={label}>New password</label>
            <input
              type="password" required autoFocus
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Min 6 characters" style={inputBase}
              onFocus={e => { e.target.style.borderColor = "var(--acc)"; e.target.style.boxShadow = "0 0 0 3px var(--acc-bg-h)"; }}
              onBlur={e => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
            />
          </div>
          <div>
            <label style={label}>Confirm password</label>
            <input
              type="password" required
              value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="Same password again" style={inputBase}
              onFocus={e => { e.target.style.borderColor = "var(--acc)"; e.target.style.boxShadow = "0 0 0 3px var(--acc-bg-h)"; }}
              onBlur={e => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
            />
          </div>
          {error && (
            <div style={{
              background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.22)",
              borderRadius: 10, padding: "10px 12px", fontSize: 12.5, color: "#F87171", fontFamily: FONT,
            }}>{error}</div>
          )}
          <button type="submit" disabled={loading} style={{
            width: "100%", background: "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)",
            border: "none", borderRadius: 10, height: 42, color: "#fff",
            fontWeight: 600, fontSize: 14, cursor: loading ? "not-allowed" : "pointer",
            fontFamily: FONT, opacity: loading ? 0.65 : 1, marginTop: 4,
            transition: "transform 0.15s, box-shadow 0.2s, opacity 0.18s",
            boxShadow: "0 4px 14px rgba(167,139,250,0.34), 0 0 0 1px var(--acc-bg-h)",
            letterSpacing: "-0.01em",
          }}>
            {loading ? "Saving…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}

function DeleteAccountModal({ onClose, onConfirm }) {
  const [typed, setTyped]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const confirmed = typed === "DELETE";

  async function handleConfirm(e) {
    e.preventDefault();
    if (!confirmed) return;
    setLoading(true);
    setError("");
    try {
      await onConfirm();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(8,8,14,0.78)",
      backdropFilter: "blur(10px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: "linear-gradient(180deg, #14141F 0%, #1C1C2A 100%)",
        border: "1px solid rgba(248,113,113,0.18)",
        borderRadius: 18, width: "100%", maxWidth: 420,
        padding: "26px",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(248,113,113,0.12)",
        animation: "fadeIn 0.2s ease",
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.28)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 14, color: "var(--danger)",
        }}><AlertTriangle size={20} strokeWidth={1.75} /></div>
        <div style={{ fontSize: 17, fontWeight: 600, color: "var(--t1)", fontFamily: FONT, marginBottom: 6, letterSpacing: "-0.015em" }}>
          Delete your account?
        </div>
        <div style={{ fontSize: 13, color: "var(--t2)", fontFamily: FONT, marginBottom: 20, lineHeight: 1.6 }}>
          All notebooks, notes, and data will be <span style={{ color: "#F87171", fontWeight: 500 }}>permanently deleted</span>. This cannot be undone.
        </div>

        <form onSubmit={handleConfirm} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{
              fontSize: 11, color: "var(--t2)", fontFamily: FONT,
              letterSpacing: "0.04em", textTransform: "uppercase",
              display: "block", marginBottom: 7, fontWeight: 600,
            }}>
              Type <span style={{ color: "#F87171", letterSpacing: "0.08em" }}>DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder="DELETE"
              autoFocus
              spellCheck={false}
              style={{
                width: "100%", background: "var(--s1)",
                border: `1px solid ${confirmed ? "rgba(248,113,113,0.45)" : "var(--border)"}`,
                borderRadius: 10, padding: "0 14px", height: 42,
                color: confirmed ? "#F87171" : "var(--t1)",
                fontSize: 14, fontFamily: MONO,
                outline: "none", transition: "all 0.18s",
                letterSpacing: "0.08em",
                boxShadow: confirmed ? "0 0 0 3px rgba(248,113,113,0.12)" : "none",
              }}
            />
          </div>

          {error && (
            <div style={{
              background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.22)",
              borderRadius: 10, padding: "10px 12px",
              fontSize: 12.5, color: "#F87171", fontFamily: FONT,
            }}>{error}</div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-press"
              style={{
                background: "transparent", border: "1px solid var(--border-h)",
                borderRadius: 10, padding: "0 16px", height: 36,
                color: "var(--t2)", fontSize: 13, fontWeight: 500,
                cursor: "pointer", fontFamily: FONT, opacity: loading ? 0.5 : 1,
                letterSpacing: "-0.01em",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-h)"; e.currentTarget.style.color = "var(--t1)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-h)"; e.currentTarget.style.color = "var(--t2)"; }}
            >Cancel</button>
            <button
              type="submit"
              disabled={!confirmed || loading}
              className="btn-press"
              style={{
                background: confirmed ? "linear-gradient(135deg, #F87171 0%, #EF4444 100%)" : "var(--s2)",
                border: confirmed ? "none" : "1px solid var(--border)",
                borderRadius: 10, padding: "0 18px", height: 36,
                color: confirmed ? "#fff" : "var(--t4)",
                fontWeight: 600, fontSize: 13,
                cursor: confirmed && !loading ? "pointer" : "not-allowed",
                fontFamily: FONT,
                boxShadow: confirmed ? "0 4px 14px rgba(248,113,113,0.35)" : "none",
                letterSpacing: "-0.01em",
              }}
            >{loading ? "Deleting…" : "Delete account"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UnitRow({ unit, color, onClick, onStatusChange }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "0 14px", height: 48,
        background: hovered ? "var(--bg-surface-1)" : "transparent",
        borderBottom: "1px solid var(--border-subtle)",
        cursor: "pointer", transition: "background 0.15s",
        position: "relative",
      }}
    >
      <div style={{
        width: 4, height: 24, borderRadius: 2,
        background: hovered ? color : "var(--border-default)",
        transition: "background 0.18s",
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)", fontFamily: FONT,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          letterSpacing: "-0.01em",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span>{unit.title}</span>
          {unit.due_date && (
            <span style={{
              fontSize: 10.5, fontWeight: 600,
              color: dueDateTone(unit.due_date).color,
              background: `${dueDateTone(unit.due_date).color}1A`,
              border: `1px solid ${dueDateTone(unit.due_date).color}55`,
              padding: "1px 7px", borderRadius: 999,
            }}>Due {formatDueDate(unit.due_date)}</span>
          )}
        </div>
        {unit.topic && (
          <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontFamily: FONT, marginTop: 1 }}>{unit.topic}</div>
        )}
      </div>
      {onStatusChange && (
        <span onClick={e => e.stopPropagation()} style={{ flexShrink: 0 }}>
          <StatusPill status={unit.status ?? "in_progress"} onChange={s => onStatusChange(s)} />
        </span>
      )}
      <div style={{
        fontSize: 11, color: "var(--text-tertiary)", fontFamily: FONT,
        flexShrink: 0, padding: "2px 8px", background: "var(--bg-surface-2)",
        borderRadius: 6, fontWeight: 500,
      }}>
        {unit.notes} {unit.notes === 1 ? "note" : "notes"}
      </div>
      <div style={{
        fontSize: 13, color, flexShrink: 0,
        opacity: hovered ? 1 : 0, transform: hovered ? "translateX(0)" : "translateX(-4px)",
        transition: "opacity 0.18s, transform 0.18s", fontWeight: 600,
      }}>→</div>
    </div>
  );
}

function ConfirmDeleteClassModal({ cls, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    setLoading(true);
    setError("");
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="mobile-sheet-overlay" onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, background: "rgba(8,8,14,0.78)",
      backdropFilter: "blur(10px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, padding: 16,
    }}>
      <div className="mobile-sheet" style={{
        background: "linear-gradient(180deg, var(--bg-surface-1) 0%, var(--bg-surface-2) 100%)",
        border: "1px solid rgba(248,113,113,0.18)",
        borderRadius: 18, width: "100%", maxWidth: 400,
        padding: "24px",
        boxShadow: "var(--sh-modal)",
        animation: "fadeIn 0.2s ease",
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.28)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 14, color: "var(--danger)",
        }}><Trash2 size={20} strokeWidth={1.75} /></div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--t1)", fontFamily: FONT, marginBottom: 6, letterSpacing: "-0.015em" }}>
          Delete "{cls.title}"?
        </div>
        <div style={{ fontSize: 13, color: "var(--t2)", fontFamily: FONT, lineHeight: 1.55, marginBottom: 20 }}>
          All units and notes inside will be permanently deleted.
        </div>
        {error && (
          <div style={{
            background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.22)",
            borderRadius: 10, padding: "10px 12px", fontSize: 12.5,
            color: "#F87171", fontFamily: FONT, marginBottom: 16,
          }}>{error}</div>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button" onClick={onClose}
            className="btn-press"
            style={{
              background: "transparent", border: "1px solid var(--border-h)",
              borderRadius: 10, padding: "0 16px", height: 36,
              color: "var(--t2)", fontSize: 13, fontWeight: 500,
              cursor: "pointer", fontFamily: FONT, letterSpacing: "-0.01em",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-h)"; e.currentTarget.style.color = "var(--t1)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-h)"; e.currentTarget.style.color = "var(--t2)"; }}
          >Cancel</button>
          <button
            type="button" onClick={handleConfirm} disabled={loading}
            className="btn-press"
            style={{
              background: "linear-gradient(135deg, #F87171 0%, #EF4444 100%)",
              border: "none", borderRadius: 10, padding: "0 18px", height: 36,
              color: "#fff", fontWeight: 600, fontSize: 13,
              cursor: loading ? "not-allowed" : "pointer", fontFamily: FONT,
              opacity: loading ? 0.65 : 1, boxShadow: "0 4px 14px rgba(248,113,113,0.35)",
              letterSpacing: "-0.01em",
            }}
          >{loading ? "Deleting…" : "Delete class"}</button>
        </div>
      </div>
    </div>
  );
}

function ClassCard({ cls, expanded, units, onToggle, onOpenUnit, onNewUnit, onDeleteClass, onChangeColor, onUnitStatusChange }) {
  const [hovered, setHovered] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPos, setPickerPos] = useState({ top: 0, right: 0 });
  const pickerBtnRef = useRef(null);
  const t = classTint(cls.color);

  function openPicker(e) {
    e.stopPropagation();
    if (!pickerOpen && pickerBtnRef.current) {
      const r = pickerBtnRef.current.getBoundingClientRect();
      setPickerPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    }
    setPickerOpen(v => !v);
  }

  return (
    <div style={{ position: "relative" }}>
      {/* Card header */}
      <div
        onClick={onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "16px 20px",
          background: "var(--bg-surface-1)",
          border: `1px solid ${hovered ? "var(--accent)" : "var(--border-subtle)"}`,
          borderRadius: 10,
          cursor: "pointer",
          transition: "border-color 200ms ease, transform 200ms ease",
          transform: hovered ? "translateY(-1px)" : "translateY(0)",
        }}
      >
        {/* Color dot */}
        <div style={{
          width: 12, height: 12, borderRadius: "50%", flexShrink: 0,
          background: t.hue,
        }} />

        {/* Class name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 15, fontWeight: 600, color: "var(--text-primary)",
            fontFamily: FONT, letterSpacing: "-0.01em",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {cls.title}
          </div>
        </div>

        {/* Unit count */}
        <div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: FONT, flexShrink: 0 }}>
          {units === null ? "" : `${units.length} ${units.length === 1 ? "unit" : "units"}`}
        </div>

        {/* Color picker swatch */}
        {onChangeColor && (
          <div style={{ flexShrink: 0 }}>
            <button
              ref={pickerBtnRef}
              onClick={openPicker}
              title="Change color"
              style={{
                width: 16, height: 16, borderRadius: 4, padding: 0,
                border: "1.5px solid var(--border-h)",
                background: `linear-gradient(135deg, ${t.hue} 0%, ${t.deep} 100%)`,
                cursor: "pointer",
                opacity: hovered || pickerOpen ? 1 : 0,
                transition: "opacity 0.18s, transform 0.15s",
              }}
              onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.transform = "scale(1.15)"; }}
              onMouseLeave={e => { e.stopPropagation(); e.currentTarget.style.transform = "scale(1)"; }}
            />
            {pickerOpen && (
              <>
                <div onClick={e => { e.stopPropagation(); setPickerOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 50 }} />
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: "fixed", top: pickerPos.top, right: pickerPos.right,
                    background: "var(--bg-surface-1)",
                    backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 12, padding: 12, zIndex: 60,
                    boxShadow: "var(--sh-modal)",
                    animation: "fadeIn 0.15s ease",
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 10, padding: "0 2px" }}>
                    Class Color
                  </div>
                  <ColorSwatchPicker value={cls.color} onChange={hue => { onChangeColor(hue); setPickerOpen(false); }} />
                </div>
              </>
            )}
          </div>
        )}

        {/* Delete */}
        {onDeleteClass && (
          <button
            onClick={e => { e.stopPropagation(); onDeleteClass(); }}
            title="Delete class"
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "4px 6px", fontSize: 13, lineHeight: 1, color: "var(--text-tertiary)",
              opacity: hovered ? 1 : 0,
              transition: "opacity 0.18s, color 0.18s", flexShrink: 0, borderRadius: 6,
            }}
            onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.color = "var(--danger)"; e.currentTarget.style.background = "rgba(248,113,113,0.08)"; }}
            onMouseLeave={e => { e.stopPropagation(); e.currentTarget.style.color = "var(--text-tertiary)"; e.currentTarget.style.background = "transparent"; }}
          ><X size={13} strokeWidth={2} /></button>
        )}

        {/* Chevron */}
        <div style={{
          color: expanded ? t.hue : "var(--text-tertiary)",
          transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), color 0.18s",
          transform: expanded ? "rotate(90deg)" : "none", flexShrink: 0,
          display: "inline-flex",
        }}><ChevronRight size={16} strokeWidth={1.75} /></div>
      </div>

      {/* Expanded units */}
      {expanded && (
        <div style={{ animation: "fadeIn 0.2s ease", paddingLeft: 22, paddingTop: 4 }}>
          {units === null ? (
            <div style={{ padding: "12px 0", fontSize: 12.5, color: "var(--text-tertiary)", fontFamily: FONT, display: "flex", alignItems: "center", gap: 8 }}>
              <div className="forge-spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} />
              Loading units…
            </div>
          ) : units.length === 0 ? (
            <div style={{ padding: "16px 0", fontSize: 12.5, color: "var(--text-tertiary)", fontFamily: FONT }}>
              <div>No units yet</div>
              <div style={{ fontSize: 11.5, color: "var(--t4)", marginTop: 2 }}>Create your first unit below to start studying</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {units.map(unit => (
                <UnitRow
                  key={unit.id}
                  unit={unit}
                  color={t.hue}
                  onClick={() => onOpenUnit(unit)}
                  onStatusChange={onUnitStatusChange ? (status) => onUnitStatusChange(unit, status) : undefined}
                />
              ))}
            </div>
          )}
          <div style={{ padding: "10px 0" }}>
            <button
              onClick={onNewUnit}
              className="btn-press"
              style={{
                background: "transparent",
                border: `1px dashed ${t.hue}55`,
                borderRadius: 8, padding: "7px 14px",
                color: t.hue, fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: FONT, transition: "all 0.18s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = t.hue; e.currentTarget.style.background = `${t.hue}10`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = `${t.hue}55`; e.currentTarget.style.background = "transparent"; }}
            >+ New Unit</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Wraps ClassCard with dnd-kit sortable behavior. The drag listeners are
// bound to the handle (not the wrapper) so clicking the card body still
// opens it. While dragging: slight scale, drop shadow, lifted z-index.
function SortableClassCard({ cls, dragDisabled, ...rest }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: cls.id, disabled: dragDisabled });

  // Compose the transform with a small scale while dragging.
  const scaled = isDragging && transform
    ? { ...transform, scaleX: 1.02, scaleY: 1.02 }
    : transform;

  const style = {
    position: "relative",
    transform: CSS.Transform.toString(scaled),
    transition,
    opacity: isDragging ? 0.85 : 1,
    zIndex: isDragging ? 10 : "auto",
    boxShadow: isDragging ? "0 8px 24px rgba(0,0,0,0.35)" : "none",
    borderRadius: isDragging ? 6 : 0,
    background: isDragging ? "var(--bg-surface-1)" : "transparent",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortable-class-row${isDragging ? " is-dragging" : ""}`}
    >
      {!dragDisabled && (
        <button
          type="button"
          className="class-drag-handle"
          aria-label="Drag to reorder class"
          title="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
      )}
      <ClassCard cls={cls} {...rest} />
    </div>
  );
}

function ColorSwatchPicker({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {CLASS_COLORS.map(c => {
        const selected = c.hue.toLowerCase() === (value ?? "").toLowerCase();
        return (
          <button
            key={c.id}
            type="button"
            title={c.label}
            onClick={() => onChange(c.hue)}
            className="btn-press"
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${c.hue} 0%, ${c.deep} 100%)`,
              border: selected
                ? `2px solid #F5F5FA`
                : "2px solid transparent",
              cursor: "pointer", padding: 0,
              boxShadow: selected
                ? `0 0 0 3px ${c.hue}44, 0 6px 16px ${c.hue}55`
                : `0 2px 6px ${c.hue}30`,
              transition: "all 0.18s",
              outline: "none",
            }}
          />
        );
      })}
    </div>
  );
}

// Pre-built course templates (starter notebooks + note structures).
const CLASS_TEMPLATES = [
  { id: "ap-bio", name: "AP Biology", emoji: "🧬", color: "#34D399", notebooks: [
    { name: "Unit 1 — Chemistry of Life", notes: ["Key Concepts", "Vocabulary", "Practice Questions"] },
    { name: "Unit 2 — Cell Structure", notes: ["Key Concepts", "Vocabulary", "Practice Questions"] },
    { name: "Unit 3 — Cellular Energetics", notes: ["Key Concepts", "Vocabulary", "Practice Questions"] },
    { name: "Unit 4 — Cell Communication", notes: ["Key Concepts", "Vocabulary", "Practice Questions"] },
    { name: "Exam Prep", notes: ["FRQ Practice", "MCQ Review", "Formula Sheet"] },
  ] },
  { id: "ap-calc-ab", name: "AP Calculus AB", emoji: "📐", color: "#60A5FA", notebooks: [
    { name: "Unit 1 — Limits", notes: ["Key Concepts", "Practice Problems", "Common Mistakes"] },
    { name: "Unit 2 — Derivatives", notes: ["Key Concepts", "Practice Problems", "Common Mistakes"] },
    { name: "Unit 3 — Integrals", notes: ["Key Concepts", "Practice Problems", "Common Mistakes"] },
    { name: "Unit 4 — Differential Equations", notes: ["Key Concepts", "Practice Problems"] },
    { name: "Exam Prep", notes: ["FRQ Practice", "Formula Sheet", "Calculator Tips"] },
  ] },
  { id: "ap-us-history", name: "AP US History", emoji: "🇺🇸", color: "#F87171", notebooks: [
    { name: "Period 1-2 (1491–1754)", notes: ["Key Events", "Key Figures", "Essay Outlines"] },
    { name: "Period 3-4 (1754–1848)", notes: ["Key Events", "Key Figures", "Essay Outlines"] },
    { name: "Period 5-6 (1844–1898)", notes: ["Key Events", "Key Figures", "Essay Outlines"] },
    { name: "Period 7-8 (1898–1980)", notes: ["Key Events", "Key Figures", "Essay Outlines"] },
    { name: "Period 9 (1980–Present)", notes: ["Key Events", "Key Figures", "Essay Outlines"] },
    { name: "Exam Prep", notes: ["SAQ Practice", "LEQ Practice", "DBQ Practice", "Key Themes"] },
  ] },
  { id: "ap-chem", name: "AP Chemistry", emoji: "⚗️", color: "#A78BFA", notebooks: [
    { name: "Unit 1 — Atomic Structure", notes: ["Key Concepts", "Practice Problems"] },
    { name: "Unit 2 — Molecular Structure", notes: ["Key Concepts", "Practice Problems"] },
    { name: "Unit 3 — Intermolecular Forces", notes: ["Key Concepts", "Practice Problems"] },
    { name: "Unit 4 — Chemical Reactions", notes: ["Key Concepts", "Practice Problems"] },
    { name: "Unit 5 — Kinetics", notes: ["Key Concepts", "Practice Problems"] },
    { name: "Exam Prep", notes: ["FRQ Practice", "Formula Sheet", "Lab Review"] },
  ] },
  { id: "ap-english", name: "AP English Literature", emoji: "📚", color: "#FBBF24", notebooks: [
    { name: "Poetry Analysis", notes: ["Poems List", "Analysis Notes", "Essay Practice"] },
    { name: "Prose Fiction", notes: ["Reading Notes", "Literary Devices", "Essay Practice"] },
    { name: "Drama", notes: ["Play Notes", "Themes", "Essay Practice"] },
    { name: "Exam Prep", notes: ["Free Response Practice", "Essay Outlines", "Key Terms"] },
  ] },
  { id: "ap-physics", name: "AP Physics 1", emoji: "⚡", color: "#F472B6", notebooks: [
    { name: "Unit 1 — Kinematics", notes: ["Key Concepts", "Practice Problems", "Formulas"] },
    { name: "Unit 2 — Forces", notes: ["Key Concepts", "Practice Problems", "Formulas"] },
    { name: "Unit 3 — Energy", notes: ["Key Concepts", "Practice Problems", "Formulas"] },
    { name: "Unit 4 — Waves", notes: ["Key Concepts", "Practice Problems", "Formulas"] },
    { name: "Exam Prep", notes: ["FRQ Practice", "Formula Sheet", "Lab Skills"] },
  ] },
  { id: "blank", name: "Start blank", emoji: "✨", color: "#6B7280", notebooks: [] },
];

function NewClassModal({ onClose, onCreate }) {
  const [step, setStep] = useState(1); // 1 = template picker, 2 = name + color
  const [template, setTemplate] = useState(null);
  const [title, setTitle] = useState("");
  const [color, setColor] = useState(CLASS_COLORS[0].hue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const tint = classTint(color);
  const hasTemplate = template && template.id !== "blank" && template.notebooks.length > 0;

  function advance(t) {
    setTemplate(t);
    if (t.id !== "blank") { setTitle(t.name); if (t.color) setColor(t.color); }
    setStep(2);
    setTimeout(() => inputRef.current?.focus(), 60);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) { setError("Class name is required."); return; }
    setError(""); setLoading(true);
    try { await onCreate(title.trim(), color, template); onClose(); }
    catch (err) { setError(err.message); setLoading(false); }
  }

  const inp = {
    width: "100%", background: "var(--s1)", border: "1px solid var(--border)",
    borderRadius: 10, padding: "0 14px", height: 42, color: "var(--t1)", fontSize: 14,
    fontFamily: FONT, outline: "none", transition: "all 0.18s", letterSpacing: "-0.01em",
  };
  const lbl = {
    fontSize: 11, color: "var(--t2)", fontFamily: FONT,
    letterSpacing: "0.5px", textTransform: "uppercase",
    display: "block", marginBottom: 9, fontWeight: 600,
  };

  return (
    <div className="mobile-sheet-overlay" onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, background: "rgba(8,8,14,0.78)",
      backdropFilter: "blur(10px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, padding: 16,
    }}>
      <div className="mobile-sheet" style={{
        position: "relative",
        background: "linear-gradient(180deg, var(--bg-surface-1) 0%, var(--bg-surface-2) 100%)",
        border: "1px solid var(--border-default)",
        borderRadius: 18, width: "100%", maxWidth: 440,
        padding: "28px 26px",
        boxShadow: `var(--sh-modal), 0 0 0 1px ${tint.hue}22`,
        animation: "fadeIn 0.2s ease", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -100, right: -60,
          width: 200, height: 200, borderRadius: "50%",
          background: `radial-gradient(circle, ${tint.hue}28 0%, transparent 70%)`,
          pointerEvents: "none", transition: "background 0.25s",
        }} />
        <div style={{ position: "relative" }}>
          {step === 1 ? (
            <>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 19, fontWeight: 600, color: "var(--t1)", fontFamily: FONT_HEADING, marginBottom: 5, letterSpacing: "-0.01em" }}>Start with a template</div>
                <div style={{ fontSize: 13, color: "var(--t2)", fontFamily: FONT, lineHeight: 1.6 }}>Pre-built notebooks &amp; notes for common courses — or start blank.</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxHeight: 340, overflowY: "auto", marginBottom: 18 }}>
                {CLASS_TEMPLATES.map(t => {
                  const sel = template?.id === t.id;
                  return (
                    <button key={t.id} type="button" onClick={() => setTemplate(t)} className="btn-press" style={{
                      textAlign: "left", background: sel ? `${t.color}1f` : "var(--s1)",
                      border: `1.5px solid ${sel ? t.color : "var(--border)"}`,
                      borderRadius: 12, padding: "13px 14px", cursor: "pointer", fontFamily: FONT,
                      display: "flex", flexDirection: "column", gap: 3,
                    }}>
                      <span style={{ fontSize: 22 }}>{t.emoji}</span>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--t1)", letterSpacing: "-0.01em" }}>{t.name}</span>
                      <span style={{ fontSize: 11.5, color: "var(--t3)", fontFamily: FONT }}>{t.notebooks.length ? `${t.notebooks.length} notebooks` : "Empty"}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" onClick={onClose} className="btn-press" style={{
                  background: "transparent", border: "1px solid var(--border-h)", borderRadius: 10,
                  padding: "0 16px", height: 38, color: "var(--t2)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: FONT,
                }}>Cancel</button>
                <button type="button" disabled={!template} onClick={() => advance(template)} className="btn-press" style={{
                  background: template ? `linear-gradient(135deg, ${tint.hue} 0%, ${tint.deep} 100%)` : "var(--s2)",
                  border: "none", borderRadius: 10, padding: "0 22px", height: 38, color: "#fff", fontWeight: 600, fontSize: 13,
                  cursor: template ? "pointer" : "not-allowed", opacity: template ? 1 : 0.5, fontFamily: FONT, letterSpacing: "-0.01em",
                }}>Next →</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 19, fontWeight: 600, color: "var(--t1)", fontFamily: FONT_HEADING, marginBottom: 5, letterSpacing: "-0.01em" }}>New Class</div>
                <div style={{ fontSize: 13, color: "var(--t2)", fontFamily: FONT, lineHeight: 1.6 }}>
                  {hasTemplate ? `${template.notebooks.length} starter notebooks will be added automatically` : "A class holds your units and notes for one course"}
                </div>
              </div>
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={lbl}>Class Name</label>
                  <input
                    ref={inputRef} value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. AP World History" maxLength={80}
                    style={inp}
                    onFocus={e => { e.target.style.borderColor = tint.hue; e.target.style.boxShadow = `0 0 0 3px ${tint.hue}22`; }}
                    onBlur={e => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                  />
                </div>
                <div>
                  <label style={lbl}>Color</label>
                  <ColorSwatchPicker value={color} onChange={setColor} />
                </div>
                {error && <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.22)", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, color: "#F87171", fontFamily: FONT }}>{error}</div>}
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                  <button type="button" onClick={() => setStep(1)} className="btn-press" style={{
                    background: "transparent", border: "1px solid var(--border-h)",
                    borderRadius: 10, padding: "0 16px", height: 38,
                    color: "var(--t2)", fontSize: 13, fontWeight: 500,
                    cursor: "pointer", fontFamily: FONT, letterSpacing: "-0.01em",
                  }}>← Back</button>
                  <button type="submit" disabled={loading || !title.trim()} className="btn-press" style={{
                    background: `linear-gradient(135deg, ${tint.hue} 0%, ${tint.deep} 100%)`,
                    border: "none", borderRadius: 10, padding: "0 20px", height: 38,
                    color: "#fff", fontWeight: 600, fontSize: 13,
                    cursor: loading || !title.trim() ? "not-allowed" : "pointer",
                    fontFamily: FONT, opacity: loading || !title.trim() ? 0.55 : 1,
                    boxShadow: `0 4px 14px ${tint.hue}55, 0 0 0 1px ${tint.hue}66`,
                    letterSpacing: "-0.01em", transition: "all 0.18s",
                  }}>{loading ? (hasTemplate ? "Setting up your class…" : "Creating…") : "Create Class"}</button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function NewUnitModal({ classTitle, onClose, onCreate }) {
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) { setError("Unit name is required."); return; }
    setError(""); setLoading(true);
    try { await onCreate(title.trim(), topic.trim()); onClose(); }
    catch (err) { setError(err.message); }
    setLoading(false);
  }

  const inp = {
    width: "100%", background: "var(--s1)", border: "1px solid var(--border)",
    borderRadius: 10, padding: "0 14px", height: 42, color: "var(--t1)", fontSize: 14,
    fontFamily: FONT, outline: "none", transition: "all 0.18s", letterSpacing: "-0.01em",
  };
  const lbl = {
    fontSize: 11, color: "var(--t2)", fontFamily: FONT,
    letterSpacing: "0.04em", textTransform: "uppercase", display: "block",
    marginBottom: 7, fontWeight: 600,
  };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, background: "rgba(8,8,14,0.78)",
      backdropFilter: "blur(10px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, padding: 16,
    }}>
      <div style={{
        position: "relative",
        background: "linear-gradient(180deg, #14141F 0%, #1C1C2A 100%)",
        border: "1px solid var(--border)",
        borderRadius: 18, width: "100%", maxWidth: 440,
        padding: "28px 26px",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px var(--acc-bg)",
        animation: "fadeIn 0.2s ease", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -100, right: -60,
          width: 200, height: 200, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(167,139,250,0.18) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{ position: "relative" }}>
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: "var(--t1)", fontFamily: FONT_HEADING, marginBottom: 5, letterSpacing: "-0.02em" }}>New Unit</div>
            <div style={{ fontSize: 13, color: "var(--t2)", fontFamily: FONT, lineHeight: 1.55 }}>
              Adding to <span style={{ color: "var(--acc)", fontWeight: 500 }}>{classTitle}</span>
            </div>
          </div>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={lbl}>Unit name *</label>
              <input ref={inputRef} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Unit 5 — Revolutions" maxLength={80} style={inp}
                onFocus={e => { e.target.style.borderColor = "var(--acc)"; e.target.style.boxShadow = "0 0 0 3px var(--acc-bg-h)"; }}
                onBlur={e => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
              />
            </div>
            <div>
              <label style={lbl}>Topic / description</label>
              <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Industrial Revolution, causes and effects" maxLength={120} style={inp}
                onFocus={e => { e.target.style.borderColor = "var(--acc)"; e.target.style.boxShadow = "0 0 0 3px var(--acc-bg-h)"; }}
                onBlur={e => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
              />
            </div>
            {error && <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.22)", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, color: "#F87171", fontFamily: FONT }}>{error}</div>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
              <button type="button" onClick={onClose} className="btn-press" style={{
                background: "transparent", border: "1px solid var(--border-h)",
                borderRadius: 10, padding: "0 16px", height: 38,
                color: "var(--t2)", fontSize: 13, fontWeight: 500,
                cursor: "pointer", fontFamily: FONT, letterSpacing: "-0.01em",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-h)"; e.currentTarget.style.color = "var(--t1)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-h)"; e.currentTarget.style.color = "var(--t2)"; }}
              >Cancel</button>
              <button type="submit" disabled={loading || !title.trim()} className="btn-press" style={{
                background: "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)",
                border: "none", borderRadius: 10, padding: "0 20px", height: 38,
                color: "#fff", fontWeight: 600, fontSize: 13,
                cursor: loading || !title.trim() ? "not-allowed" : "pointer",
                fontFamily: FONT, opacity: loading || !title.trim() ? 0.55 : 1,
                boxShadow: "0 4px 14px rgba(167,139,250,0.34), 0 0 0 1px var(--acc-bg-h)",
                letterSpacing: "-0.01em",
              }}>{loading ? "Creating…" : "Create Unit"}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function InviteModal({ notebookId, onClose }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");

  async function handleSend() {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Please enter a valid email address."); return;
    }
    setStatus("sending"); setError("");
    try {
      await api.createInvite(notebookId, trimmed);
      setSentTo(trimmed);
      setStatus("success");
      setTimeout(onClose, 2000);
    } catch (err) {
      setError(err.message || "Failed to send invite.");
      setStatus("error");
    }
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, background: "rgba(8,8,14,0.78)",
      backdropFilter: "blur(10px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, padding: 16,
    }}>
      <div style={{
        position: "relative",
        background: "linear-gradient(180deg, #14141F 0%, #1C1C2A 100%)",
        border: "1px solid var(--border)",
        borderRadius: 18, width: "100%", maxWidth: 440,
        padding: "28px 26px",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px var(--acc-bg)",
        animation: "fadeIn 0.2s ease", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -100, right: -60,
          width: 200, height: 200, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(167,139,250,0.18) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{ position: "relative" }}>
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: "var(--t1)", fontFamily: FONT_HEADING, marginBottom: 5, letterSpacing: "-0.02em" }}>Invite a collaborator</div>
            <div style={{ fontSize: 13, color: "var(--t2)", fontFamily: FONT, lineHeight: 1.55 }}>They'll get an email with a link to join this unit</div>
          </div>

          {status === "success" ? (
            <div style={{ textAlign: "center", padding: "24px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: "linear-gradient(135deg, rgba(52,211,153,0.18) 0%, rgba(52,211,153,0.06) 100%)",
                border: "1.5px solid rgba(52,211,153,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--success)",
                boxShadow: "0 0 24px rgba(52,211,153,0.2)",
              }}><CheckCircle size={28} strokeWidth={1.75} /></div>
              <div style={{ fontSize: 15, color: "#34D399", fontFamily: FONT, fontWeight: 600, letterSpacing: "-0.015em" }}>
                Invite sent to {sentTo}!
              </div>
            </div>
          ) : (
            <>
              <input
                type="email"
                placeholder="friend@school.edu"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(""); setStatus("idle"); }}
                onKeyDown={e => e.key === "Enter" && handleSend()}
                autoFocus
                style={{
                  width: "100%", background: "var(--s1)",
                  border: `1px solid ${error ? "rgba(248,113,113,0.45)" : "var(--border)"}`,
                  borderRadius: 10, padding: "0 14px", height: 42, color: "var(--t1)",
                  fontSize: 14, fontFamily: FONT,
                  outline: "none", marginBottom: 10,
                  transition: "all 0.18s", letterSpacing: "-0.01em",
                }}
                onFocus={e => { if (!error) { e.target.style.borderColor = "var(--acc)"; e.target.style.boxShadow = "0 0 0 3px var(--acc-bg-h)"; }}}
                onBlur={e => { if (!error) { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}}
              />
              {error && (
                <div style={{ fontSize: 12.5, color: "#F87171", fontFamily: FONT, marginBottom: 10 }}>{error}</div>
              )}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={onClose} className="btn-press" style={{
                  background: "transparent", border: "1px solid var(--border-h)",
                  borderRadius: 10, padding: "0 16px", height: 38,
                  color: "var(--t2)", fontSize: 13, fontWeight: 500,
                  cursor: "pointer", fontFamily: FONT, letterSpacing: "-0.01em",
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-h)"; e.currentTarget.style.color = "var(--t1)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-h)"; e.currentTarget.style.color = "var(--t2)"; }}
                >Cancel</button>
                <button
                  onClick={handleSend}
                  disabled={status === "sending"}
                  className="btn-press"
                  style={{
                    background: "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)",
                    border: "none", borderRadius: 10,
                    padding: "0 20px", height: 38, color: "#fff", fontWeight: 600, fontSize: 13,
                    cursor: status === "sending" ? "not-allowed" : "pointer",
                    fontFamily: FONT, opacity: status === "sending" ? 0.65 : 1,
                    boxShadow: "0 4px 14px rgba(167,139,250,0.34), 0 0 0 1px var(--acc-bg-h)",
                    letterSpacing: "-0.01em",
                  }}
                >{status === "sending" ? "Sending…" : "Send Invite"}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InviteLanding({ inviteInfo, onSignIn }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      backgroundImage: `
        radial-gradient(circle at 20% 0%, var(--acc-bg) 0%, transparent 50%),
        radial-gradient(circle at 80% 100%, rgba(96,165,250,0.08) 0%, transparent 50%)
      `,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 18, padding: 32, fontFamily: FONT,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <img src="/scholr-logo-final.png" alt="scholr" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover" }} />
        <div style={{
          fontSize: 26, fontWeight: 600, color: "var(--t1)", letterSpacing: "-0.03em",
        }}>
          <span>schol<span style={{ color: "var(--acc)" }}>r</span></span>
        </div>
      </div>
      <div style={{ fontSize: 15, color: "var(--t2)", textAlign: "center" }}>
        You've been invited to join a unit
      </div>
      {inviteInfo ? (
        <div style={{
          background: "linear-gradient(180deg, #14141F 0%, #1C1C2A 100%)",
          border: "1px solid var(--border)",
          borderRadius: 14, padding: "18px 24px", textAlign: "center", maxWidth: 380,
          boxShadow: "0 12px 32px rgba(0,0,0,0.4), 0 0 0 1px var(--acc-bg)",
        }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--t1)", fontFamily: FONT, marginBottom: 4, letterSpacing: "-0.015em" }}>{inviteInfo.notebook_title}</div>
          {inviteInfo.class_title && <div style={{ fontSize: 12.5, color: "var(--t3)" }}>in {inviteInfo.class_title}</div>}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: "var(--t3)" }}>Loading invite info…</div>
      )}
      <div style={{ fontSize: 13, color: "var(--t3)", textAlign: "center" }}>Sign in or create an account to join</div>
      <button
        onClick={onSignIn}
        style={{
          background: "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)",
          border: "none", borderRadius: 12,
          padding: "0 24px", height: 44, color: "#fff", fontWeight: 600,
          fontSize: 14, cursor: "pointer", fontFamily: FONT,
          transition: "transform 0.15s, box-shadow 0.2s",
          boxShadow: "0 8px 24px var(--acc-bg-h), 0 0 0 1px color-mix(in srgb, var(--acc) 45%, transparent)",
          letterSpacing: "-0.01em",
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
      >Sign in or create account</button>
    </div>
  );
}

function ActivityHeatmap({ data, longestStreak = 0 }) {
  const [viewMode, setViewMode] = useState("week"); // 'week' | 'month' | 'year'
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());

  // Build lookup map from API data: 'YYYY-MM-DD' → count
  const activityMap = new Map(data.map(d => [d.date, d.count]));
  const fmtKey = dt => dt.toISOString().slice(0, 10);
  const isActive = key => (activityMap.get(key) ?? 0) > 0;

  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
  const todayKey = fmtKey(todayDate);

  // Streak: consecutive days ending today with activity
  let streak = 0;
  for (let i = 0; ; i++) {
    const d = new Date(todayDate); d.setDate(d.getDate() - i);
    if ((activityMap.get(fmtKey(d)) ?? 0) > 0) streak++; else break;
  }
  const activeDays = data.filter(d => (d.count ?? 0) > 0).length;

  // Week days (Sun–Sat of current week). getDay() returns 0 for Sunday.
  const weekStart = new Date(todayDate);
  weekStart.setDate(todayDate.getDate() - todayDate.getDay());
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d;
  });
  const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

  // Build calendar grid for a month (Sunday-start). first.getDay() gives
  // 0…6 where 0 is Sunday — exactly the offset we need for empty leading cells.
  function buildMonthGrid(monthDt) {
    const y = monthDt.getFullYear(), m = monthDt.getMonth();
    const first = new Date(y, m, 1);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const offset = first.getDay(); // Sun=0 … Sat=6
    const cells = Array(offset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));
    while (cells.length % 7) cells.push(null);
    return cells;
  }

  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const MONTHS_FULL  = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  // Shared day-circle renderer (plain function, not a component, to avoid remount on every render)
  function renderCircle(dt, size, label) {
    if (!dt) return <div style={{ width: size, height: size }} />;
    const key = fmtKey(dt);
    const active = isActive(key);
    const isT = key === todayKey;
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
        {label !== undefined && (
          <div style={{
            fontSize: 9, fontWeight: 700, fontFamily: FONT,
            color: "var(--t3)", textTransform: "uppercase",
            letterSpacing: "0.05em", height: 11, lineHeight: "11px",
          }}>
            {label}
          </div>
        )}
        <div style={{
          width: size, height: size, borderRadius: "50%", boxSizing: "border-box",
          background: active ? "var(--acc-d)" : "var(--s2)",
          border: isT ? "2px solid var(--acc)" : "2px solid transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: Math.max(9, Math.floor(size * 0.36)),
          fontWeight: active ? 700 : 400,
          color: active ? "#fff" : "var(--t3)",
          fontFamily: FONT,
          transition: "background 0.15s",
        }}>
          {dt.getDate()}
        </div>
      </div>
    );
  }

  const navBtnStyle = {
    background: "none", border: "none", color: "var(--t3)",
    cursor: "pointer", fontSize: 18, padding: "2px 8px", lineHeight: 1,
    borderRadius: 6, fontFamily: FONT,
  };

  return (
    <div style={{ marginBottom: 32 }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", fontFamily: FONT,
          letterSpacing: "0.08em", textTransform: "uppercase",
        }}>
          Study Streak
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          {["week", "month", "year"].map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)} style={{
              padding: "3px 10px", borderRadius: 8, cursor: "pointer",
              border: "1px solid",
              borderColor: viewMode === mode ? "color-mix(in srgb, var(--acc) 45%, transparent)" : "var(--border)",
              background: viewMode === mode ? "var(--acc-bg)" : "transparent",
              color: viewMode === mode ? "var(--acc)" : "var(--t3)",
              fontSize: 11, fontWeight: 600, fontFamily: FONT, transition: "all 0.15s",
            }}>
              {mode[0].toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Week view ── */}
      {viewMode === "week" && (
        <div className="heatmap-fade-in">
          <div style={{ display: "flex", justifyContent: "space-around", gap: 2 }}>
            {weekDays.map((d, i) => (
              <div key={i} style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                {renderCircle(d, 36, DAY_LETTERS[i])}
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 10 }}>
            <button onClick={() => setViewMode("month")} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--acc)", fontSize: 11, fontFamily: FONT,
              fontWeight: 600, padding: "4px 8px",
            }}>
              Show month ↓
            </button>
          </div>
        </div>
      )}

      {/* ── Month view ── */}
      {viewMode === "month" && (
        <div className="heatmap-fade-in">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <button style={navBtnStyle} onClick={() => setCurrentMonth(m => { const n = new Date(m); n.setMonth(m.getMonth() - 1); return n; })}>‹</button>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: FONT }}>
              {MONTHS_FULL[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </span>
            <button style={navBtnStyle} onClick={() => setCurrentMonth(m => { const n = new Date(m); n.setMonth(m.getMonth() + 1); return n; })}>›</button>
          </div>
          {/* Day-of-week headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 3 }}>
            {DAY_LETTERS.map((l, i) => (
              <div key={i} style={{
                textAlign: "center", fontSize: 9, fontWeight: 700,
                color: "var(--t4)", fontFamily: FONT,
                paddingBottom: 4, textTransform: "uppercase",
              }}>{l}</div>
            ))}
          </div>
          {/* Calendar grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
            {buildMonthGrid(currentMonth).map((d, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "center" }}>
                {d ? renderCircle(d, 28) : <div style={{ width: 28, height: 28 }} />}
              </div>
            ))}
          </div>
          {/* Sub-nav */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
            <button onClick={() => setViewMode("week")} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--t4)", fontSize: 11, fontFamily: FONT, fontWeight: 600, padding: "4px 0",
            }}>↑ Show less</button>
            <button onClick={() => setViewMode("year")} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--acc)", fontSize: 11, fontFamily: FONT, fontWeight: 600, padding: "4px 0",
            }}>Show year ↓</button>
          </div>
        </div>
      )}

      {/* ── Year view ── */}
      {viewMode === "year" && (
        <div className="heatmap-fade-in">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <button style={navBtnStyle} onClick={() => setCurrentYear(y => y - 1)}>‹</button>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: FONT }}>{currentYear}</span>
            <button style={navBtnStyle} onClick={() => setCurrentYear(y => y + 1)}>›</button>
          </div>
          {/* 12 mini-month grids */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
            {MONTHS_SHORT.map((_, mi) => {
              const monthDt = new Date(currentYear, mi, 1);
              const cells = buildMonthGrid(monthDt);
              return (
                <div key={mi}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, fontFamily: FONT,
                    color: "var(--t3)", textAlign: "center", marginBottom: 4,
                  }}>
                    {MONTHS_SHORT[mi]}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 1.5 }}>
                    {cells.map((d, di) => {
                      if (!d) return <div key={di} style={{ aspectRatio: "1" }} />;
                      const key = fmtKey(d);
                      const active = isActive(key);
                      const isT = key === todayKey;
                      return (
                        <div key={di} style={{
                          aspectRatio: "1", borderRadius: "50%", boxSizing: "border-box",
                          background: active ? "var(--acc-d)" : "var(--s2)",
                          border: isT ? "1.5px solid var(--acc)" : "1.5px solid transparent",
                        }} />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 10 }}>
            <button onClick={() => setViewMode("month")} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--t4)", fontSize: 11, fontFamily: FONT, fontWeight: 600, padding: "4px 0",
            }}>↑ Show less</button>
          </div>
        </div>
      )}

      {/* ── Stats footer ── */}
      <div style={{
        display: "flex", gap: 20, marginTop: 14, paddingTop: 12,
        borderTop: "1px solid var(--border)",
      }}>
        {[
          { val: streak,     label: "day streak", color: "var(--acc)" },
          { val: Math.max(longestStreak, streak), label: "longest", color: "var(--text-secondary)" },
          { val: activeDays, label: activeDays === 1 ? "day visited" : "days visited", color: "var(--text-primary)" },
        ].map(({ val, label, color }) => (
          <div key={label}>
            <div style={{ fontSize: 16, fontWeight: 600, color, fontFamily: FONT, lineHeight: 1 }}>{val}</div>
            <div style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: FONT, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DeadlineRow({ nb, cls, onOpen }) {
  const [hov, setHov] = useState(false);
  const t = classTint(cls?.color ?? nb.color);
  const tone = dueDateTone(nb.due_date);
  return (
    <div
      onClick={() => onOpen(nb, cls?.color)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "11px 6px",
        background: hov ? "var(--bg-surface-1)" : "transparent",
        borderBottom: "1px solid var(--border-subtle)",
        borderRadius: hov ? 6 : 0,
        cursor: "pointer", transition: "background 0.15s",
      }}
    >
      <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: t.hue }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)", fontFamily: FONT,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          letterSpacing: "-0.01em",
        }}>
          {nb.title}
          {cls?.title ? <span style={{ fontWeight: 400, color: "var(--text-tertiary)" }}> · {cls.title}</span> : null}
        </div>
      </div>
      <div style={{
        fontSize: 11, fontWeight: 600, color: tone.color, fontFamily: FONT,
        background: `${tone.color}1A`, border: `1px solid ${tone.color}55`,
        padding: "1px 7px", borderRadius: 999, flexShrink: 0,
      }}>
        Due {formatDueDate(nb.due_date)}
      </div>
    </div>
  );
}

function UpcomingDeadlines({ notebooks, classes, onOpen }) {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const in7 = new Date(now); in7.setDate(in7.getDate() + 7);
  const upcoming = notebooks
    .filter(n => {
      if (!n.due_date) return false;
      const d = new Date(n.due_date);
      return d >= now && d <= in7;
    })
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)",
        fontFamily: FONT, letterSpacing: "0.08em", textTransform: "uppercase",
        marginBottom: 10, display: "flex", alignItems: "center", gap: 8,
      }}>
        Upcoming Deadlines
        {upcoming.length > 0 && (
          <span style={{
            fontSize: 10.5, fontWeight: 700, color: "var(--accent)",
            background: "var(--acc-bg)", border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
            padding: "1px 7px", borderRadius: 999,
          }}>{upcoming.length}</span>
        )}
      </div>
      {upcoming.length === 0 ? (
        <div style={{ padding: "8px 0 12px", color: "var(--text-tertiary)", fontSize: 12.5, fontFamily: FONT }}>
          No deadlines in the next 7 days.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {upcoming.map(nb => {
            const cls = classes.find(c => c.id === nb.class_id);
            return (
              <DeadlineRow key={nb.id} nb={nb} cls={cls} onOpen={onOpen} />
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status, onChange, size = "sm", compact = false }) {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[status] ?? STATUS_META.in_progress;
  const padding = size === "sm" ? "2px 8px" : "4px 10px";
  const fontSize = size === "sm" ? 10.5 : 12;
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        title={compact ? meta.label : undefined}
        style={{
          background: meta.bg,
          border: `1px solid ${meta.border}`,
          borderRadius: compact ? 8 : 999,
          padding: compact ? "0 8px" : padding,
          height: compact ? 30 : "auto",
          fontSize, fontWeight: 600,
          color: meta.color, fontFamily: FONT, cursor: "pointer",
          letterSpacing: "0.02em",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {compact
          ? <span style={{ width: 8, height: 8, borderRadius: "50%", background: meta.color, flexShrink: 0 }} />
          : meta.label}
      </button>
      {open && (
        <>
          <div onClick={e => { e.stopPropagation(); setOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 100 }} />
          <div onClick={e => e.stopPropagation()} style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0,
            background: "var(--bg-surface-2)",
            border: "1px solid var(--border-default)",
            borderRadius: 10, padding: 4, zIndex: 110,
            boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
            minWidth: 140,
          }}>
            {Object.entries(STATUS_META).map(([key, m]) => (
              <div
                key={key}
                onClick={() => { onChange(key); setOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 10px", borderRadius: 7, cursor: "pointer",
                  fontSize: 12.5, color: m.color, fontFamily: FONT, fontWeight: 500,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--s2)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                <span>{m.label}</span>
                {status === key && <Check size={13} strokeWidth={2} />}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function getDisplayName(user) {
  return user?.user_metadata?.full_name
    || user?.email?.split("@")[0]
    || "Student";
}

function getGreeting(name) {
  const h = new Date().getHours();
  const first = name.split(" ")[0];
  if (h >= 6 && h < 12)  return { text: `Good morning, ${first}` };
  if (h >= 12 && h < 17) return { text: `Good afternoon, ${first}` };
  if (h >= 17 && h < 21) return { text: `Good evening, ${first}` };
  return { text: `Burning the midnight oil, ${first}` };
}

const NAV = [
  { id: "dashboard", label: "Dashboard",  Icon: LayoutDashboard },
  { id: "my-notes",  label: "My Notes",   Icon: Notebook },
  { id: "shared",    label: "Shared",     Icon: Users },
  { id: "starred",   label: "Starred",    Icon: Star },
  { id: "settings",  label: "Settings",   Icon: Settings },
];

// ── UpgradeModal ─────────────────────────────────────────────────────────────
// Same 3 testimonials as the landing page (illustrative early-stage social proof).
const UPGRADE_TESTIMONIALS = [
  { quote: "Derek explained cell division better than my AP Bio teacher did.", name: "Maya R.", role: "AP Biology" },
  { quote: "Went from a C to a B+ after one week of Feynman Mode practice.", name: "Jake T.", role: "AP Chemistry" },
  { quote: "My whole study group uses it. We share notebooks before every exam.", name: "Priya S.", role: "AP US History" },
];

function UpgradeSocialProof() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % UPGRADE_TESTIMONIALS.length), 4000);
    return () => clearInterval(t);
  }, []);
  const t = UPGRADE_TESTIMONIALS[idx];
  return (
    <div style={{ marginTop: 18, textAlign: "center" }}>
      <div style={{ fontSize: 15, letterSpacing: 2, marginBottom: 8 }}>⭐⭐⭐⭐⭐</div>
      <div key={idx} style={{ minHeight: 54, animation: "fadeIn 0.6s ease" }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", fontStyle: "italic", lineHeight: 1.5, fontFamily: FONT }}>"{t.quote}"</div>
        <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontFamily: FONT, marginTop: 5 }}>— {t.name}, {t.role}</div>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontFamily: FONT, marginTop: 10 }}>
        Join students improving their grades with Scholr
      </div>
    </div>
  );
}

function UpgradeModal({ limitType, onClose }) {
  const [loading, setLoading] = useState(false);

  // Track which limit triggered this prompt (conversion analytics).
  useEffect(() => { api.recordUpgradeTrigger(limitType || "upgrade"); }, [limitType]);

  const context = {
    message_limit_reached: {
      Icon: MessageCircle,
      headline: "Message limit reached",
      detail: "You've used all 100 messages this month on the free plan.",
    },
    forge_limit_reached: {
      Icon: Zap,
      headline: "Forge limit reached",
      detail: "You've used all 3 Forge outputs this month on the free plan.",
    },
    class_limit_reached: {
      Icon: BookOpen,
      headline: "You're on a roll.",
      detail: "Free plan is limited to 3 classes. Upgrade to Pro for unlimited classes, notebooks, podcast mode, and more.",
    },
    notebook_limit_reached: {
      Icon: Notebook,
      headline: "You're on a roll.",
      detail: "Free plan is limited to 3 notebooks. Upgrade to Pro for unlimited notebooks, notes, podcast mode, and more.",
    },
  }[limitType] ?? {
    Icon: Rocket,
    headline: "Upgrade to Pro",
    detail: "Unlock the full scholr experience.",
  };

  async function handleUpgrade() {
    setLoading(true);
    try {
      await api.createCheckoutSession();
    } catch (err) {
      setLoading(false);
      console.error("Checkout error:", err);
    }
  }

  return (
    <div className="mobile-sheet-overlay" style={{
      position: "fixed", inset: 0, zIndex: 3000,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16, animation: "fadeIn 0.18s ease",
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mobile-sheet" style={{
        background: "var(--bg-surface-1)",
        border: "1px solid rgba(167,139,250,0.28)",
        borderRadius: 20, padding: "32px 28px",
        maxWidth: 400, width: "100%",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px var(--acc-bg)",
        animation: "slideInUp 0.22s cubic-bezier(0.34,1.56,0.64,1)",
        fontFamily: FONT,
      }}>
        {/* Icon + headline */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ marginBottom: 10, color: "var(--acc)", display: "inline-flex" }}>
            <context.Icon size={36} strokeWidth={1.5} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)", fontFamily: FONT_HEADING, letterSpacing: "-0.01em", marginBottom: 6 }}>
            {context.headline}
          </div>
          <div style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {context.detail}
          </div>
        </div>

        {/* Price */}
        <div style={{
          background: "linear-gradient(135deg, var(--acc-bg), rgba(167,139,250,0.04))",
          border: "1px solid rgba(167,139,250,0.22)",
          borderRadius: 12, padding: "14px 18px", marginBottom: 20,
          display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4,
        }}>
          <span style={{ fontSize: 32, fontWeight: 700, color: "var(--acc)", letterSpacing: "-0.03em" }}>$8.49</span>
          <span style={{ fontSize: 13, color: "var(--text-tertiary)", fontWeight: 500 }}>/month</span>
        </div>

        {/* Features */}
        <div style={{ marginBottom: 24 }}>
          {[
            "Unlimited AI messages with Claude Sonnet (smarter AI)",
            "Unlimited Forge outputs (study guides, flashcards, summaries)",
            "Unlimited classes",
            "Unlimited notes & storage",
            "Priority support",
          ].map(f => (
            <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
              <span style={{ color: "var(--success)", flexShrink: 0, marginTop: 1, display: "inline-flex" }}><Check size={14} strokeWidth={2} /></span>
              <span style={{ fontSize: 13.5, color: "var(--text-primary)", lineHeight: 1.4 }}>{f}</span>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <button
          onClick={handleUpgrade}
          disabled={loading}
          style={{
            width: "100%", height: 46, marginBottom: 10,
            background: loading ? "var(--acc-bg-h)" : "linear-gradient(135deg, #A78BFA, #8B5CF6)",
            border: "none", borderRadius: 12,
            color: "#fff", fontWeight: 700, fontSize: 15,
            fontFamily: FONT, cursor: loading ? "wait" : "pointer",
            boxShadow: "0 4px 18px rgba(167,139,250,0.38)",
            transition: "all 0.18s",
          }}
        >
          {loading ? "Redirecting…" : "Upgrade to Pro — $8.49/mo"}
        </button>
        <button
          onClick={onClose}
          style={{
            width: "100%", height: 40, background: "transparent",
            border: "1px solid var(--border-default)",
            borderRadius: 12, color: "var(--text-tertiary)",
            fontSize: 13, fontFamily: FONT, cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          Maybe later
        </button>

        <UpgradeSocialProof />
      </div>
    </div>
  );
}

// ── TermsWall — non-dismissible consent gate for existing users ───────────────
// Shown inside the authed app to users who predate the signup age-gate (no
// accepted-terms record). No ✕, no click-outside, no Esc — they must accept to
// continue. On accept, records consent server-side, then lets them through.
function TermsWall({ onAccepted }) {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAccept() {
    if (!agreed || loading) return;
    setLoading(true); setError("");
    try {
      await api.acceptTerms();
      onAccepted();
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 4000,
      background: "color-mix(in srgb, var(--bg-base) 78%, transparent)",
      backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16, fontFamily: FONT,
    }}>
      <div style={{
        width: "100%", maxWidth: 460,
        background: "var(--bg-surface-1)",
        border: "1px solid var(--border-default)",
        borderRadius: 18, padding: "28px 26px",
        boxShadow: "var(--sh-modal)",
        animation: "fadeIn 0.2s ease",
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9,
          background: "linear-gradient(135deg, var(--acc) 0%, var(--acc-d) 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", marginBottom: 16,
        }}><FileText size={18} strokeWidth={2} /></div>

        <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", fontFamily: FONT_HEADING, letterSpacing: "-0.02em", marginBottom: 8 }}>
          We've updated our Terms &amp; Privacy Policy
        </div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 20 }}>
          Please review and accept to continue using Scholr.
        </div>

        <label style={{ display: "flex", gap: 9, alignItems: "flex-start", cursor: "pointer", marginBottom: 18 }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
            style={{ marginTop: 2, width: 16, height: 16, accentColor: "var(--acc)", cursor: "pointer", flexShrink: 0 }}
          />
          <span style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            I am at least 13 years old (or the minimum age required in my jurisdiction) and agree to Scholr's{" "}
            <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "var(--acc-h)", fontWeight: 600 }}>Terms of Service</a>{" "}
            and{" "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--acc-h)", fontWeight: 600 }}>Privacy Policy</a>
          </span>
        </label>

        {error && (
          <div style={{
            background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.22)",
            borderRadius: 10, padding: "10px 12px", fontSize: 12.5, color: "var(--danger)",
            marginBottom: 14, lineHeight: 1.5,
          }}>{error}</div>
        )}

        <button
          onClick={handleAccept}
          disabled={!agreed || loading}
          className="btn-press"
          style={{
            width: "100%", height: 44, borderRadius: 12, border: "none",
            background: (agreed && !loading) ? "linear-gradient(135deg, var(--acc) 0%, var(--acc-d) 100%)" : "var(--bg-surface-3)",
            color: (agreed && !loading) ? "#fff" : "var(--text-tertiary)",
            fontFamily: FONT, fontSize: 14, fontWeight: 600,
            cursor: (agreed && !loading) ? "pointer" : "not-allowed",
            boxShadow: (agreed && !loading) ? "0 6px 20px var(--acc-bg-h)" : "none",
            transition: "background 150ms ease",
          }}
        >{loading ? "Saving…" : "Continue to Scholr"}</button>
      </div>
    </div>
  );
}

// ── Streak helpers (1F) ────────────────────────────────────────────────────
const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];
function computeStreak(heatmap) {
  const map = new Map((heatmap || []).map(d => [d.date, d.count]));
  const fmtKey = dt => dt.toISOString().slice(0, 10);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let streak = 0;
  for (let i = 0; ; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    if ((map.get(fmtKey(d)) ?? 0) > 0) streak++; else break;
  }
  return streak;
}
// Streak alive but at risk = yesterday had activity, today does not (yet).
function streakAtRiskFromHeatmap(heatmap) {
  if (!heatmap || !heatmap.length) return false;
  const map = new Map(heatmap.map(d => [d.date, d.count]));
  const fmtKey = dt => dt.toISOString().slice(0, 10);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yest = new Date(today); yest.setDate(today.getDate() - 1);
  return (map.get(fmtKey(yest)) ?? 0) > 0 && (map.get(fmtKey(today)) ?? 0) === 0;
}

function StreakMilestoneModal({ day, onClose }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    try {
      await navigator.clipboard.writeText(`I'm on a ${day}-day study streak on Scholr! scholr.dev`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  }
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 16, padding: 32, maxWidth: 380, width: "100%", textAlign: "center", animation: "onbSlide 0.3s ease" }}>
        <div style={{ fontSize: 52, marginBottom: 8 }}>🔥</div>
        <div style={{ fontFamily: FONT_HEADING, fontSize: 26, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>{day}-day streak!</div>
        <div style={{ fontFamily: FONT, fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>You're on fire. Keep it up.</div>
        <button onClick={share} style={{ width: "100%", height: 44, borderRadius: 10, border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-primary)", fontFamily: FONT, fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 10 }}>{copied ? "Copied! ✓" : "Share my streak"}</button>
        <button onClick={onClose} style={{ width: "100%", height: 44, borderRadius: 10, border: "none", background: "linear-gradient(135deg, #A78BFA, #8B5CF6)", color: "#fff", fontFamily: FONT, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Keep going →</button>
      </div>
    </div>
  );
}

// ── Referrals settings section (1D) ─────────────────────────────────────────
function ReferralSection() {
  const [stats, setStats] = useState(null);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { api.getReferralStats().then(setStats).catch(() => {}); }, []);
  const link = stats?.referralLink || "";

  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable */ }
  }
  async function invite() {
    if (!email.includes("@")) return;
    setSending(true); setMsg("");
    try {
      await api.sendReferralInvite(email.trim());
      setMsg(`Invite sent to ${email.trim()} ✓`); setEmail("");
      api.getReferralStats().then(setStats).catch(() => {});
    } catch (e) { setMsg(e.message || "Failed to send invite"); }
    setSending(false);
  }

  const hdr = { fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", fontFamily: FONT, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 };
  const field = { height: 40, borderRadius: 10, background: "var(--bg-subtle, rgba(255,255,255,0.04))", border: "1px solid var(--border)", color: "var(--text-primary)", fontFamily: FONT, fontSize: 14, padding: "0 12px", outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={hdr}>Referrals</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input readOnly value={link} placeholder="loading…" onFocus={e => e.target.select()} style={{ ...field, flex: 1 }} />
        <button onClick={copy} className="btn-press" style={{ ...field, width: "auto", padding: "0 16px", cursor: "pointer", color: "var(--acc)", fontWeight: 600 }}>{copied ? "Copied!" : "Copy"}</button>
      </div>
      <div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: FONT, marginBottom: 14 }}>
        {(stats?.invited ?? 0)} friends invited · {(stats?.signedUp ?? 0)} signed up · {(stats?.monthsEarned ?? 0)} months earned
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === "Enter") invite(); }} placeholder="friend@school.edu" style={{ ...field, flex: 1 }} />
        <button onClick={invite} disabled={sending || !email.includes("@")} className="btn-press" style={{ height: 40, borderRadius: 10, border: "none", padding: "0 16px", background: "linear-gradient(135deg, #A78BFA, #8B5CF6)", color: "#fff", fontFamily: FONT, fontSize: 13.5, fontWeight: 700, cursor: sending || !email.includes("@") ? "not-allowed" : "pointer", opacity: sending || !email.includes("@") ? 0.6 : 1, whiteSpace: "nowrap" }}>{sending ? "Sending…" : "Send invite"}</button>
      </div>
      {msg && <div style={{ fontSize: 12.5, color: "var(--text-secondary)", fontFamily: FONT, marginBottom: 6 }}>{msg}</div>}
      <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: FONT, lineHeight: 1.5 }}>
        Your friend gets Scholr for free. You get 1 month of Pro when they sign up.
      </div>
    </div>
  );
}

export default function Scholr() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [termsGate, setTermsGate] = useState(null); // null = unknown, "ok" = accepted, "needed" = must accept
  const [onboarding, setOnboarding] = useState("ok"); // "ok" | "needed" (first-login wizard)
  const [profile, setProfile] = useState(null);       // profile flags: streak, milestones, referral
  const [streakBannerDismissed, setStreakBannerDismissed] = useState(false);
  const [milestoneModal, setMilestoneModal] = useState(null); // { day } | null
  const [activeView, setActiveView] = useState("dashboard");
  const [activeNb, setActiveNb] = useState(null);
  const [search, setSearch] = useState("");
  const [notebooks, setNotebooks] = useState([]);
  const [ownedNotebooks, setOwnedNotebooks] = useState([]);
  const [sharedNotebooks, setSharedNotebooks] = useState([]);
  const [starredNotebooks, setStarredNotebooks] = useState([]);
  const [starredIds, setStarredIds] = useState(new Set());
  const [notifications, setNotifications] = useState([]);
  const [classes, setClasses] = useState([]);
  const [expandedClassId, setExpandedClassId] = useState(null);
  // Require a 4px drag before activating so taps/clicks on the card body
  // don't accidentally start drags from the handle press.
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );
  const [classUnitsCache, setClassUnitsCache] = useState({});
  const [showNewClassModal, setShowNewClassModal] = useState(false);
  const [newUnitFor, setNewUnitFor] = useState(null);
  const [toast, setToast] = useState("");
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteClassTarget, setDeleteClassTarget] = useState(null);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [showAuth, setShowAuth] = useState(() => readAuthIntentFromUrl() !== null);
  const [authIntent, setAuthIntent] = useState(() => readAuthIntentFromUrl() || "signup"); // tab: "signup" | "login"
  const [pendingInviteToken, setPendingInviteToken] = useState(null);
  const [inviteInfo, setInviteInfo] = useState(null);
  const [showInviteAuth, setShowInviteAuth] = useState(false);
  const [heatmap, setHeatmap] = useState([]);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("scholr-theme") ?? "dark"; }
    catch { return "dark"; }
  });
  const [accentColor, setAccentColor] = useState(() => {
    try { return localStorage.getItem("scholr-accent") ?? "#A78BFA"; }
    catch { return "var(--acc)"; }
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const [subscription, setSubscription] = useState({
    tier: "free",
    messagesUsed: 0, messagesLimit: 30,
    forgeUsed: 0, forgeLimit: 3,
    notebooksUsed: 0, notebooksLimit: 15,
  });
  const [upgradeModal, setUpgradeModal] = useState(null); // null | { limitType: string }

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("scholr-theme", theme); } catch { /* ignore */ }
  }, [theme]);

  useEffect(() => {
    const preset = ACCENT_PRESETS.find(p => p.color === accentColor) ?? ACCENT_PRESETS[0];
    const root = document.documentElement;
    root.style.setProperty("--acc", preset.color);
    root.style.setProperty("--acc-h", preset.hover);
    root.style.setProperty("--acc-d", preset.deep);
    root.style.setProperty("--acc-bg", `${preset.color}14`);
    root.style.setProperty("--acc-bg-h", `${preset.color}24`);
    root.style.setProperty("--acc-glow", `${preset.color}38`);
    try { localStorage.setItem("scholr-accent", accentColor); } catch { /* ignore */ }
  }, [accentColor]);

  useEffect(() => {
    if (!profileOpen) return;
    function handleOutsideClick(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [profileOpen]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") { setShowPasswordReset(true); return; }
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const match = window.location.pathname.match(/^\/invite\/([^/]+)/);
    if (!match) return;
    const token = match[1];
    setPendingInviteToken(token);
    window.history.replaceState({}, "", "/");
    api.getInvite(token).then(setInviteInfo).catch(() => {});
  }, []);

  useEffect(() => {
    if (!pendingInviteToken || !user || !authReady) return;
    const token = pendingInviteToken;
    setPendingInviteToken(null);
    supabase.auth.getSession()
      .then(() => api.acceptInvite(token))
      .then(({ notebook_id }) => {
        return Promise.all([
          api.listNotebooks(getDisplayName(user)),
          api.listSharedNotebooks(getDisplayName(user)),
        ]).then(([nbs, shared]) => {
          setNotebooks(nbs);
          setSharedNotebooks(shared);
          const nb = shared.find(n => n.id === notebook_id) ?? nbs.find(n => n.id === notebook_id);
          if (nb) { setActiveNb(nb); setActiveView("dashboard"); }
        });
      })
      .catch(console.error);
  }, [pendingInviteToken, user, authReady]);

  useEffect(() => {
    if (!user || !authReady) return;
    const name = getDisplayName(user);

    // Terms gate: existing users (pre age-gate) have no accepted-terms record →
    // must accept before using the app. Fail-open on transient error (re-checked
    // next load) so a flaky check never locks anyone out.
    api.getTermsStatus()
      .then(s => setTermsGate(s?.accepted ? "ok" : "needed"))
      .catch(() => setTermsGate("ok"));

    // Notebooks + profile together. First login (no notebooks, not onboarded) →
    // seed a "Welcome to Scholr" notebook with a demo note + AI aha and drop the
    // user straight into it, instead of an empty dashboard or setup wizard.
    Promise.all([api.listNotebooks(name), api.getProfile()])
      .then(async ([nbs, prof]) => {
        if (prof && !prof.onboarding_completed && nbs.length === 0) {
          const r = await api.seedWelcome().catch(() => ({ seeded: false }));
          if (r.seeded && r.notebookId) {
            const fresh = await api.listNotebooks(name).catch(() => nbs);
            setNotebooks(fresh);
            setProfile({ ...(prof || {}), onboarding_completed: true });
            setOnboarding("ok");
            const welcome = fresh.find(n => n.id === r.notebookId);
            if (welcome) { setActiveNb(welcome); setActiveView("dashboard"); }
            return;
          }
        }
        setNotebooks(nbs);
        setProfile(prof);
        setOnboarding(prof && !prof.onboarding_completed && nbs.length === 0 ? "needed" : "ok");
      })
      .catch(console.error);
    api.listOwnedNotebooks(name).then(setOwnedNotebooks).catch(console.error);
    api.listSharedNotebooks(name).then(setSharedNotebooks).catch(console.error);
    api.getStarredNotebooks(name)
      .then(starred => {
        setStarredNotebooks(starred);
        setStarredIds(new Set(starred.map(n => n.id)));
      })
      .catch(console.error);
    api.listClasses().then(setClasses).catch(console.error);
    api.getNotifications().then(setNotifications).catch(console.error);
    api.getSubscription().then(setSubscription).catch(console.error);

    // Mark today as an "active" day for the streak. Fire-and-forget; we still
    // refresh the heatmap *after* this resolves so today shows immediately.
    // Module-scoped flag prevents duplicate calls on auth state churn.
    if (!_visitTrackedThisSession) {
      _visitTrackedThisSession = true;
      const dateLabel = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
      api.trackVisit(dateLabel)
        .catch(err => { console.warn("trackVisit failed:", err.message); })
        .finally(() => {
          api.getActivityHeatmap().then(setHeatmap).catch(console.error);
        });
    } else {
      api.getActivityHeatmap().then(setHeatmap).catch(console.error);
    }

    // Handle ?upgraded=true from Stripe success redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgraded") === "true") {
      window.history.replaceState({}, "", "/app");
      setToast("Welcome to scholr Pro!");
      setTimeout(() => setToast(""), 4000);
    }
  }, [user, authReady]);

  // The AuthModal's initial open state + tab are derived from ?auth=… in the
  // useState initializers above (so it paints open immediately). Here we only
  // strip the param from the URL on mount, so a later refresh won't reopen it.
  // No setState → no cascading re-render.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).get("auth")) return;
    window.history.replaceState({}, "", (window.location.pathname + window.location.hash) || "/");
  }, []);

  // Canonical app URL: the logged-in app lives at /app, the landing/auth at /.
  // Keep the address bar consistent with auth state once it's known. This is a
  // cosmetic replaceState — the app renders by `user`, not by path, and the
  // public routes (/s/:slug, /privacy, /terms, /copyright) return earlier — so
  // matching ONLY the exact root and /app leaves every other route untouched.
  useEffect(() => {
    if (!authReady || IS_MARKETING_HOST) return;
    const path = window.location.pathname;
    const tail = window.location.search + window.location.hash;
    if (user && path === "/") {
      window.history.replaceState({}, "", "/app" + tail);   // logged-in at root → /app
    } else if (!user && path === "/app") {
      window.history.replaceState({}, "", "/" + tail);      // logged-out at /app → /
    }
  }, [authReady, user]);

  // Streak gamification: bump longest streak + fire one-time milestone modals.
  // All setState happens inside async callbacks (never synchronously in the
  // effect) to avoid cascading re-renders; guards keep it idempotent.
  useEffect(() => {
    if (!user || !profile || !heatmap.length) return;
    const streak = computeStreak(heatmap);
    if (streak > (profile.longest_streak ?? 0)) {
      api.updateStreak(streak)
        .then(() => setProfile(p => ({ ...p, longest_streak: streak })))
        .catch(() => {});
    }
    const shown = new Set((profile.streak_milestones_shown ?? []).map(String));
    if (STREAK_MILESTONES.includes(streak) && !shown.has(String(streak))) {
      api.recordStreakMilestone(streak)
        .catch(() => {})
        .finally(() => {
          setMilestoneModal({ day: streak });
          setProfile(p => ({ ...p, streak_milestones_shown: [...(p.streak_milestones_shown ?? []), String(streak)] }));
        });
    }
  }, [user, profile, heatmap]);

  function patchNotebookEverywhere(notebookId, patch) {
    const apply = list => list.map(n => n.id === notebookId ? { ...n, ...patch } : n);
    setNotebooks(apply);
    setOwnedNotebooks(apply);
    setSharedNotebooks(apply);
    setStarredNotebooks(apply);
    setClassUnitsCache(prev => {
      const next = { ...prev };
      for (const cid of Object.keys(next)) {
        if (Array.isArray(next[cid])) next[cid] = apply(next[cid]);
      }
      return next;
    });
    setActiveNb(curr => curr && curr.id === notebookId ? { ...curr, ...patch } : curr);
  }

  // Remove notebook(s) from EVERY place notebooks are stored: all list views,
  // the starred set, the per-class unit cache, and the currently-open notebook.
  function removeNotebooksByIds(idSet) {
    if (!idSet || idSet.size === 0) return;
    const drop = list => list.filter(n => !idSet.has(n.id));
    setNotebooks(drop);
    setOwnedNotebooks(drop);
    setSharedNotebooks(drop);
    setStarredNotebooks(drop);
    setStarredIds(prev => {
      let changed = false;
      const next = new Set(prev);
      for (const id of idSet) if (next.delete(id)) changed = true;
      return changed ? next : prev;
    });
    setClassUnitsCache(prev => {
      const next = { ...prev };
      for (const cid of Object.keys(next)) {
        if (Array.isArray(next[cid])) next[cid] = next[cid].filter(u => !idSet.has(u.id));
      }
      return next;
    });
    setActiveNb(curr => (curr && idSet.has(curr.id) ? null : curr));
  }

  async function handleSetStatus(nb, status) {
    patchNotebookEverywhere(nb.id, { status });
    try { await api.updateNotebookStatus(nb.id, status); }
    catch (err) { console.error(err); setToast("Couldn't update status"); setTimeout(() => setToast(""), 2500); }
  }

  async function handleToggleClass(classId) {
    if (expandedClassId === classId) { setExpandedClassId(null); return; }
    setExpandedClassId(classId);
    if (classUnitsCache[classId]) return;
    setClassUnitsCache(prev => ({ ...prev, [classId]: null }));
    try {
      const units = await api.listClassNotebooks(classId, getDisplayName(user));
      setClassUnitsCache(prev => ({ ...prev, [classId]: units }));
    } catch {
      setClassUnitsCache(prev => ({ ...prev, [classId]: [] }));
    }
  }

  async function handleCreateClass(title, color, template) {
    try {
      const cls = await api.createClass(title, color);
      setClasses(prev => [...prev, cls]);
      // Template selected → batch-create its notebooks + starter notes, open the first.
      if (template && template.id !== "blank" && template.notebooks?.length) {
        try {
          const result = await api.applyTemplate(cls.id, template.notebooks);
          const nm = getDisplayName(user);
          api.listNotebooks(nm).then(setNotebooks).catch(() => {});
          api.listClasses().then(setClasses).catch(() => {});
          if (result.firstNotebookId) {
            const units = await api.listClassNotebooks(cls.id, nm).catch(() => []);
            const first = units.find(u => u.id === result.firstNotebookId) || units[0];
            if (first) { setActiveNb(first); setActiveView("dashboard"); }
          }
          if (result.limitHit) {
            setToast("Some notebooks weren't added — you've hit the free plan limit.");
            setTimeout(() => setToast(""), 4500);
          }
        } catch (e) {
          console.error("applyTemplate failed:", e);
          setToast("Class created, but template setup failed.");
          setTimeout(() => setToast(""), 3500);
        }
      }
    } catch (err) {
      if (err.code === "class_limit_reached") {
        setShowNewClassModal(false);
        setUpgradeModal({ limitType: "class_limit_reached" });
        return;
      }
      throw err;
    }
  }

  const [portalLoading, setPortalLoading] = useState(false);
  async function handleManageSubscription() {
    setPortalLoading(true);
    try {
      // api.createPortalSession() redirects via window.location.href on success
      await api.createPortalSession();
    } catch (err) {
      console.error("Portal session error:", err);
      setToast("Could not open subscription management. Please try again.");
      setTimeout(() => setToast(""), 3500);
      setPortalLoading(false);
    }
  }

  async function handleChangeClassColor(classId, color) {
    // Optimistic update so the UI feels snappy
    const prevClasses = classes;
    setClasses(cs => cs.map(c => c.id === classId ? { ...c, color } : c));
    try {
      await api.updateClassColor(classId, color);
    } catch (err) {
      console.error("updateClassColor failed:", err);
      setClasses(prevClasses);
      setToast("Could not update color");
      setTimeout(() => setToast(""), 2500);
    }
  }

  async function handleReorderClassesDnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = classes.findIndex(c => c.id === active.id);
    const newIndex = classes.findIndex(c => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const prev = classes;
    const next = arrayMove(classes, oldIndex, newIndex);
    setClasses(next);                          // optimistic
    try {
      await api.reorderClasses(next.map(c => c.id));
    } catch (err) {
      console.error("reorderClasses failed:", err);
      setClasses(prev);                        // revert
      setToast("Could not reorder classes");
      setTimeout(() => setToast(""), 2500);
    }
  }

  async function handleCreateUnit(classId, title, topic) {
    try {
      const unit = await api.createClassNotebook(classId, title, topic, getDisplayName(user));
      setClassUnitsCache(prev => ({ ...prev, [classId]: [...(prev[classId] ?? []), unit] }));
      setNotebooks(prev => [unit, ...prev]);
      setSubscription(prev => ({ ...prev, notebooksUsed: (prev.notebooksUsed ?? 0) + 1 }));
    } catch (err) {
      if (err.code === "notebook_limit_reached") {
        setNewUnitFor(null);
        setUpgradeModal({ limitType: "notebook_limit_reached" });
        return;
      }
      throw err;
    }
  }

  // When opening a unit from a class card, attach the class's color so
  // NotebookView/Forge can tint accordingly. For units opened from My Notes /
  // Shared / Starred views we fall back to the deterministic per-notebook tint.
  function openUnitWithClassColor(unit, classColor) {
    setActiveNb(classColor ? { ...unit, color: classColor } : unit);
  }

  async function handleToggleStar(nb) {
    const isStarred = starredIds.has(nb.id);
    setStarredIds(prev => { const next = new Set(prev); isStarred ? next.delete(nb.id) : next.add(nb.id); return next; });
    setStarredNotebooks(prev => isStarred ? prev.filter(n => n.id !== nb.id) : [...prev, nb]);
    try {
      const { starred } = await api.toggleStar(nb.id);
      setStarredIds(prev => { const next = new Set(prev); starred ? next.add(nb.id) : next.delete(nb.id); return next; });
      if (!starred) setStarredNotebooks(prev => prev.filter(n => n.id !== nb.id));
    } catch (err) {
      console.error("star toggle failed:", err);
      setStarredIds(prev => { const next = new Set(prev); isStarred ? next.add(nb.id) : next.delete(nb.id); return next; });
      setStarredNotebooks(prev => isStarred ? [...prev, nb] : prev.filter(n => n.id !== nb.id));
    }
  }

  async function handleDeleteClass(classId) {
    await api.deleteClass(classId);
    // The server cascades the class's notebooks → drop every one of them from
    // all client-side notebook state (lists, starred, open notebook), not just
    // the class + its unit cache.
    const removed = new Set();
    for (const list of [notebooks, ownedNotebooks, sharedNotebooks, starredNotebooks, ...Object.values(classUnitsCache)]) {
      for (const n of (list || [])) if (n && n.class_id === classId) removed.add(n.id);
    }
    setClasses(prev => prev.filter(c => c.id !== classId));
    setClassUnitsCache(prev => { const next = { ...prev }; delete next[classId]; return next; });
    removeNotebooksByIds(removed);
    if (activeNb && removed.has(activeNb.id)) setActiveView("dashboard");
    if (expandedClassId === classId) setExpandedClassId(null);
    setToast("Class deleted");
    setTimeout(() => setToast(""), 3000);
  }

  async function handleDeleteAccount() {
    await api.deleteAccount();    // cleans DB rows + deletes auth user
    localStorage.clear();
    await api.signOut();          // notifies server + clears local Supabase session
    window.location.href = "/";  // hard-navigate to landing; clears all React state
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const displayName = getDisplayName(user);
  const streakAtRisk = streakAtRiskFromHeatmap(heatmap);

  const filteredClasses = classes.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const viewBase = activeView === "my-notes" ? ownedNotebooks
    : activeView === "shared"   ? sharedNotebooks
    : activeView === "starred"  ? starredNotebooks
    : notebooks;

  const filtered = viewBase.filter(n => {
    const q = search.toLowerCase();
    return n.title.toLowerCase().includes(q) || (n.topic || "").toLowerCase().includes(q);
  });

  const viewLabel = NAV.find(n => n.id === activeView)?.label ?? "Dashboard";

  // Public shared-notebook route (/s/:slug) — standalone, no auth required.
  const shareMatch = (typeof window !== "undefined" ? window.location.pathname : "").match(/^\/s\/([A-Za-z0-9]+)/);
  if (shareMatch) return <SharedNotebook slug={shareMatch[1]} />;

  // Public legal routes — render standalone regardless of auth (no router).
  const legalPage = { "/privacy": "privacy", "/terms": "terms", "/copyright": "copyright" }[
    typeof window !== "undefined" ? window.location.pathname : ""
  ];
  if (legalPage) return <LegalPage page={legalPage} />;

  return (
    <>
      {/* Terms wall — authed app only; never on landing/legal (those return earlier) */}
      {user && authReady && termsGate === "needed" && (
        <TermsWall onAccepted={() => setTermsGate("ok")} />
      )}

      {/* First-login onboarding wizard — only after terms are accepted */}
      {user && authReady && termsGate === "ok" && onboarding === "needed" && (
        <OnboardingWizard
          user={user}
          onComplete={() => {
            setOnboarding("ok");
            const nm = getDisplayName(user);
            api.listNotebooks(nm).then(setNotebooks).catch(() => {});
            api.listClasses().then(setClasses).catch(() => {});
          }}
        />
      )}

      {/* Streak milestone celebration */}
      {milestoneModal && (
        <StreakMilestoneModal day={milestoneModal.day} onClose={() => setMilestoneModal(null)} />
      )}

      {pendingInviteToken && authReady && !user && (
        <InviteLanding inviteInfo={inviteInfo} onSignIn={() => setShowInviteAuth(true)} />
      )}

      {authReady && !user && !showPasswordReset && !pendingInviteToken && !showAuth && (
        <LandingPage onSignIn={() => {
          // Marketing domain can't host the session → send users to the app origin to sign in.
          if (IS_MARKETING_HOST) { window.location.href = `${APP_ORIGIN}/?auth=signup`; return; }
          setAuthIntent("signup");
          setShowAuth(true);
        }} />
      )}

      {authReady && !user && !showPasswordReset && (showAuth || showInviteAuth) && (
        <AuthModal initialTab={authIntent} onAuth={(u) => {
          setShowAuth(false); setShowInviteAuth(false); setUser(u);
          // Land the freshly-authed user in the app. On the app origin this is just a
          // URL tidy-up; the marketing-host branch is a defensive fallback (shouldn't fire).
          if (IS_MARKETING_HOST) { window.location.href = `${APP_ORIGIN}/app`; return; }
          window.history.replaceState({}, "", "/app");
        }} />
      )}

      {showPasswordReset && (
        <PasswordResetModal onDone={() => {
          setShowPasswordReset(false);
          setToast("Password updated");
          setTimeout(() => setToast(""), 3000);
        }} />
      )}

      {showDeleteAccount && (
        <DeleteAccountModal
          onClose={() => setShowDeleteAccount(false)}
          onConfirm={handleDeleteAccount}
        />
      )}

      {deleteClassTarget && (
        <ConfirmDeleteClassModal
          cls={deleteClassTarget}
          onClose={() => setDeleteClassTarget(null)}
          onConfirm={() => handleDeleteClass(deleteClassTarget.id)}
        />
      )}

      {upgradeModal && (
        <UpgradeModal
          limitType={upgradeModal.limitType}
          onClose={() => setUpgradeModal(null)}
        />
      )}

      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "linear-gradient(180deg, #14141F 0%, #1C1C2A 100%)",
          border: "1px solid rgba(52,211,153,0.3)",
          borderRadius: 12, padding: "0 18px", height: 42,
          fontSize: 13.5, color: "#34D399", fontWeight: 600,
          fontFamily: FONT,
          boxShadow: "0 12px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(52,211,153,0.15), 0 0 24px rgba(52,211,153,0.2)",
          zIndex: 2000, animation: "slideInUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
          display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
          letterSpacing: "-0.01em",
        }}>
          <span style={{
            width: 18, height: 18, borderRadius: "50%",
            background: "rgba(52,211,153,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--success)",
          }}><Check size={12} strokeWidth={2.5} /></span>
          {toast}
        </div>
      )}

      {showNewClassModal && (
        <NewClassModal
          onClose={() => setShowNewClassModal(false)}
          onCreate={handleCreateClass}
        />
      )}

      {newUnitFor && (
        <NewUnitModal
          classTitle={newUnitFor.classTitle}
          onClose={() => setNewUnitFor(null)}
          onCreate={(title, topic) => handleCreateUnit(newUnitFor.classId, title, topic)}
        />
      )}

      {/* App shell */}
      <div className={sidebarOpen ? "" : "mobile-hide-sidebar"} style={{
        height: "100vh", overflow: "hidden",
        background: "var(--bg-base)",
        display: user ? "flex" : "none", fontFamily: FONT,
      }}>
        {sidebarOpen && (
          <div className="sidebar-backdrop mobile-only" onClick={() => setSidebarOpen(false)} />
        )}
        {/* Sidebar */}
        <div className="sidebar" style={{
          width: 240,
          background: "var(--bg-base)",
          borderRight: "1px solid var(--border-subtle)",
          display: "flex", flexDirection: "column",
          flexShrink: 0, overflow: "hidden",
          position: "fixed", top: 0, bottom: 0, left: 0, zIndex: 200,
        }}>
          {/* Scrollable section: brand + nav */}
          <div style={{
            flex: 1, overflowY: "auto", overflowX: "hidden", minHeight: 0,
            padding: "20px 12px 8px",
            display: "flex", flexDirection: "column", gap: 2,
          }}>
          {/* Brand */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            marginBottom: 22, paddingLeft: 8,
          }}>
            <img
              src={theme === "light" ? "/scholr-logo-white.png" : "/scholr-logo-final.png"}
              alt="scholr"
              style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
            />
            <div style={{
              fontSize: 19, fontWeight: 600,
              color: "var(--text-primary)", letterSpacing: "-0.03em",
              fontFamily: FONT,
            }}>
              {/* outer span = one inline box → letter-spacing holds across the color split */}
              <span>schol<span style={{ color: "var(--accent)" }}>r</span></span>
            </div>
            <button
              className="mobile-only"
              onClick={() => setSidebarOpen(false)}
              title="Close menu"
              style={{
                marginLeft: "auto",
                background: "transparent",
                border: "1px solid var(--border-default)",
                borderRadius: 8, width: 28, height: 28, cursor: "pointer",
                color: "var(--text-secondary)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            ><X size={14} strokeWidth={1.75} /></button>
          </div>

          {/* Nav */}
          {NAV.map(({ id, label, Icon }) => {
            const active = activeView === id;
            return (
              <div
                key={id}
                onClick={() => { setActiveView(id); setActiveNb(null); setSearch(""); setSidebarOpen(false); }}
                style={{
                  position: "relative",
                  padding: "0 12px", height: 36, borderRadius: 8,
                  display: "flex", alignItems: "center", gap: 10,
                  background: active ? "var(--accent-soft)" : "transparent",
                  color: active ? "var(--accent)" : "var(--text-secondary)",
                  fontSize: 13.5, fontWeight: active ? 600 : 500,
                  cursor: "pointer", transition: "background 150ms ease, color 150ms ease",
                  userSelect: "none",
                  letterSpacing: "-0.01em",
                  marginBottom: 1,
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "var(--bg-surface-2)"; e.currentTarget.style.color = "var(--text-primary)"; }}}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}}
              >
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 18, opacity: active ? 1 : 0.85,
                }}>
                  <Icon size={16} strokeWidth={1.75} />
                </span>
                {label}
              </div>
            );
          })}

          </div>{/* end scrollable nav section */}

          <LegalFooter compact />

          {/* Usage indicator — free users only */}
          {subscription.tier === "free" && (
            <div style={{ padding: "0 12px 10px", flexShrink: 0 }}>
              <div style={{
                background: "var(--bg-surface-2)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 10, padding: "10px 12px",
              }}>
                {/* Messages */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: FONT, display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <MessageCircle size={12} strokeWidth={1.75} /> Messages
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: FONT }}>
                      {subscription.messagesUsed}/{subscription.messagesLimit}
                    </span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: "var(--bg-surface-3)", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 2,
                      width: `${Math.min(100, Math.round((subscription.messagesUsed / subscription.messagesLimit) * 100))}%`,
                      background: subscription.messagesUsed >= subscription.messagesLimit
                        ? "#F87171"
                        : "linear-gradient(90deg, #A78BFA, #8B5CF6)",
                      transition: "width 0.4s ease",
                    }} />
                  </div>
                </div>
                {/* Forge */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: FONT, display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <Hammer size={12} strokeWidth={1.75} /> Forge
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: FONT }}>
                      {subscription.forgeUsed}/{subscription.forgeLimit}
                    </span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: "var(--bg-surface-3)", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 2,
                      width: `${Math.min(100, Math.round((subscription.forgeUsed / subscription.forgeLimit) * 100))}%`,
                      background: subscription.forgeUsed >= subscription.forgeLimit
                        ? "#F87171"
                        : "linear-gradient(90deg, #FBBF24, #F59E0B)",
                      transition: "width 0.4s ease",
                    }} />
                  </div>
                </div>
                {/* Notes / storage */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: FONT, display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <Notebook size={12} strokeWidth={1.75} /> Notes
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: FONT }}>
                      {subscription.notebooksUsed}/{subscription.notebooksLimit}
                    </span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: "var(--bg-surface-3)", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 2,
                      width: `${Math.min(100, Math.round((subscription.notebooksUsed / subscription.notebooksLimit) * 100))}%`,
                      background: subscription.notebooksUsed >= subscription.notebooksLimit
                        ? "#F87171"
                        : "linear-gradient(90deg, #34D399, #10B981)",
                      transition: "width 0.4s ease",
                    }} />
                  </div>
                </div>
                <button
                  onClick={() => setUpgradeModal({ limitType: "upgrade" })}
                  style={{
                    width: "100%", height: 30,
                    background: "linear-gradient(135deg, rgba(167,139,250,0.18), var(--acc-bg))",
                    border: "1px solid color-mix(in srgb, var(--acc) 25%, transparent)",
                    borderRadius: 7, color: "var(--acc)",
                    fontSize: 11.5, fontWeight: 600, fontFamily: FONT,
                    cursor: "pointer", letterSpacing: "-0.01em",
                    transition: "all 0.15s",
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                    <Sparkles size={13} strokeWidth={1.75} /> Upgrade to Pro
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Profile card — pinned to bottom, never scrolls away */}
          <div style={{ padding: "0 12px 16px", flexShrink: 0 }}>
          <div ref={profileRef} style={{ position: "relative" }}>
            {profileOpen && (
              <div style={{
                position: "absolute", bottom: "calc(100% + 8px)", left: 0, right: 0,
                background: "var(--bg-surface-1)",
                border: "1px solid var(--border-default)",
                borderRadius: 12, padding: "12px",
                boxShadow: "var(--sh-modal)",
                animation: "slideInUp 0.15s ease",
                zIndex: 100,
              }}>
                {/* Header */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</div>
                </div>
                <div style={{ height: 1, background: "var(--border-subtle)", marginBottom: 6 }} />
                {/* Settings link */}
                <button
                  onClick={() => { setProfileOpen(false); setActiveView("settings"); setActiveNb(null); }}
                  style={{
                    width: "100%", background: "transparent", border: "none",
                    borderRadius: 7, padding: "8px 8px", color: "var(--text-primary)",
                    fontSize: 12.5, fontWeight: 500, cursor: "pointer",
                    fontFamily: FONT, textAlign: "left",
                    display: "flex", alignItems: "center", gap: 8,
                    transition: "background 0.15s",
                    marginBottom: 2,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-surface-2)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  <Settings size={13} strokeWidth={1.75} /> Settings
                </button>
                {/* Sign out */}
                <button
                  onClick={() => { setProfileOpen(false); handleLogout(); }}
                  style={{
                    width: "100%", background: "transparent", border: "none",
                    borderRadius: 7, padding: "8px 8px", color: "var(--danger)",
                    fontSize: 12.5, fontWeight: 500, cursor: "pointer",
                    fontFamily: FONT, textAlign: "left",
                    display: "flex", alignItems: "center", gap: 8,
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(248,113,113,0.08)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  <LogOut size={13} strokeWidth={1.75} /> Sign out
                </button>
              </div>
            )}
            <div
              onClick={() => setProfileOpen(v => !v)}
              style={{
                background: profileOpen ? "var(--bg-surface-2)" : "var(--bg-surface-1)",
                border: `1px solid ${profileOpen ? "var(--border-default)" : "var(--border-subtle)"}`,
                borderRadius: 10, padding: "10px",
                display: "flex", alignItems: "center", gap: 10,
                cursor: "pointer", transition: "background 0.15s, border-color 0.15s",
                userSelect: "none",
              }}
              onMouseEnter={e => { if (!profileOpen) { e.currentTarget.style.background = "var(--bg-surface-2)"; e.currentTarget.style.borderColor = "var(--border-default)"; }}}
              onMouseLeave={e => { if (!profileOpen) { e.currentTarget.style.background = "var(--bg-surface-1)"; e.currentTarget.style.borderColor = "var(--border-subtle)"; }}}
            >
              <Avatar name={displayName} size={32} seed={user?.email ?? displayName} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>{displayName}</div>
                <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</div>
              </div>
              <div style={{ color: "var(--text-tertiary)", flexShrink: 0, display: "inline-flex" }}>
                <ChevronRight size={12} strokeWidth={2} style={{ transform: profileOpen ? "rotate(-90deg)" : "rotate(90deg)", transition: "transform 0.15s" }} />
              </div>
            </div>
          </div>
          </div>{/* end padding wrapper */}
        </div>

        {/* Main */}
        <div className="main-pane" style={{ flex: 1, padding: "36px 44px", overflowY: "auto", display: "flex", flexDirection: "column", height: "100vh" }}>
          <button
            onClick={() => setSidebarOpen(true)}
            title="Open menu"
            className="mobile-menu-btn"
            style={{
              display: "none",
              position: "fixed", bottom: 80, left: 16, zIndex: 50,
              background: "var(--accent)",
              border: "none",
              borderRadius: "50%", width: 44, height: 44,
              alignItems: "center", justifyContent: "center",
              color: "#fff", cursor: "pointer",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            }}
          ><Menu size={20} strokeWidth={1.75} /></button>
          {activeNb ? (
            <div style={{ height: "100%", animation: "fadeIn 0.3s ease" }}>
              <NotebookView
                nb={activeNb}
                currentUserId={user?.id}
                onBack={() => setActiveNb(null)}
                onSetStatus={status => handleSetStatus(activeNb, status)}
                onToast={msg => { setToast(msg); setTimeout(() => setToast(""), 3000); }}
                onUpgradeNeeded={limitType => setUpgradeModal({ limitType })}
                onDeleted={id => {
                  removeNotebooksByIds(new Set([id])); // clears lists, starred, cache, and closes it
                  setActiveView("dashboard");           // the open notebook was just deleted → dashboard
                  setToast("Unit deleted");
                  setTimeout(() => setToast(""), 3000);
                }}
              />
            </div>

          ) : activeView === "settings" ? (
            <div style={{ animation: "fadeIn 0.25s ease", maxWidth: 560 }}>
              <div style={{ fontSize: 28, fontWeight: 600, color: "var(--text-primary)", fontFamily: FONT, letterSpacing: "-0.025em", marginBottom: 32 }}>
                Settings
              </div>

              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", fontFamily: FONT, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                Account
              </div>
              <div style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "14px 0", marginBottom: 32,
                borderBottom: "1px solid var(--border-subtle)",
              }}>
                <Avatar name={displayName} size={42} seed={user?.email ?? displayName} />
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: FONT, marginBottom: 3, fontWeight: 500 }}>Signed in as</div>
                  <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 600, fontFamily: FONT, letterSpacing: "-0.01em" }}>{user?.email}</div>
                </div>
              </div>

              {/* ── Subscription ──────────────────────────────────────────── */}
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", fontFamily: FONT, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                Subscription
              </div>
              <div style={{
                background: subscription.tier === "pro" ? "var(--accent-soft)" : "transparent",
                borderRadius: subscription.tier === "pro" ? 10 : 0,
                padding: subscription.tier === "pro" ? "16px 18px" : "14px 0",
                marginBottom: 32,
                borderBottom: subscription.tier === "pro" ? "none" : "1px solid var(--border-subtle)",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 220px", minWidth: 200 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      {subscription.tier === "pro" && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                          color: "#fff", fontFamily: FONT,
                          background: "linear-gradient(135deg, #A78BFA, #8B5CF6)",
                          padding: "2px 8px", borderRadius: 999,
                        }}>
                          Active
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: 17, fontWeight: 600,
                      color: "var(--text-primary)",
                      fontFamily: FONT, letterSpacing: "-0.02em", marginBottom: 4,
                    }}>
                      {subscription.tier === "pro" ? (
                        <>scholr <span style={{ color: "var(--accent)" }}>Pro</span> · <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)" }}>$8.49/month</span></>
                      ) : "scholr Free"}
                    </div>
                    {subscription.tier === "pro" && subscription.currentPeriodEnd && (
                      <div style={{ fontSize: 12.5, color: "var(--text-secondary)", fontFamily: FONT, lineHeight: 1.5 }}>
                        Next billing on {new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      </div>
                    )}
                    {subscription.tier !== "pro" && (
                      <div style={{ fontSize: 12.5, color: "var(--text-secondary)", fontFamily: FONT, lineHeight: 1.5 }}>
                        Upgrade for unlimited messages, Forge, classes, and storage.
                      </div>
                    )}
                  </div>
                  {subscription.tier === "pro" ? (
                    <button
                      onClick={handleManageSubscription}
                      disabled={portalLoading}
                      className="btn-press"
                      style={{
                        background: "transparent",
                        border: "1px solid color-mix(in srgb, var(--acc) 45%, transparent)",
                        borderRadius: 10, padding: "0 16px", height: 38,
                        color: "var(--acc)",
                        fontSize: 13, fontWeight: 600,
                        cursor: portalLoading ? "wait" : "pointer",
                        fontFamily: FONT, whiteSpace: "nowrap", flexShrink: 0,
                        letterSpacing: "-0.01em",
                        opacity: portalLoading ? 0.7 : 1,
                        transition: "all 0.18s",
                      }}
                      onMouseEnter={e => { if (!portalLoading) { e.currentTarget.style.background = "var(--acc-bg)"; e.currentTarget.style.borderColor = "color-mix(in srgb, var(--acc) 70%, transparent)"; }}}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "color-mix(in srgb, var(--acc) 45%, transparent)"; }}
                    >
                      {portalLoading ? "Opening…" : "Manage subscription"}
                    </button>
                  ) : (
                    <button
                      onClick={() => setUpgradeModal({ limitType: "upgrade" })}
                      className="btn-press"
                      style={{
                        background: "linear-gradient(135deg, #A78BFA, #8B5CF6)",
                        border: "none",
                        borderRadius: 10, padding: "0 18px", height: 38,
                        color: "#fff",
                        fontSize: 13, fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: FONT, whiteSpace: "nowrap", flexShrink: 0,
                        letterSpacing: "-0.01em",
                        boxShadow: "0 6px 18px rgba(167,139,250,0.38)",
                        transition: "transform 0.18s, box-shadow 0.18s",
                      }}
                    >
                      Upgrade to Pro
                    </button>
                  )}
                </div>
              </div>

              {/* ── Referrals (1D) ── */}
              <ReferralSection />

              {/* ── Appearance ────────────────────────────────────────────── */}
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", fontFamily: FONT, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                Appearance
              </div>

              {/* Theme row */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 16, flexWrap: "wrap",
                padding: "14px 0",
                borderBottom: "1px solid var(--border-subtle)",
              }}>
                <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", fontFamily: FONT, letterSpacing: "-0.01em" }}>
                    Theme
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-secondary)", fontFamily: FONT, marginTop: 2 }}>
                    {theme === "light" ? "Light mode" : "Dark mode"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  {[
                    { value: "dark", label: "Dark", Icon: Moon },
                    { value: "light", label: "Light", Icon: Sun },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setTheme(opt.value)}
                      style={{
                        minHeight: 44, padding: "0 14px", borderRadius: 10, cursor: "pointer",
                        fontFamily: FONT, fontSize: 13, fontWeight: 500,
                        background: theme === opt.value ? "var(--accent-soft)" : "transparent",
                        border: `1px solid ${theme === opt.value ? "var(--accent)" : "var(--border-default)"}`,
                        color: theme === opt.value ? "var(--accent)" : "var(--text-secondary)",
                        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                        transition: "background 150ms ease, border-color 150ms ease, color 150ms ease",
                      }}
                      onMouseEnter={e => { if (theme !== opt.value) { e.currentTarget.style.background = "var(--bg-surface-2)"; e.currentTarget.style.color = "var(--text-primary)"; }}}
                      onMouseLeave={e => { if (theme !== opt.value) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}}
                    >
                      <opt.Icon size={15} strokeWidth={1.75} /> {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Accent color row */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 16, flexWrap: "wrap",
                padding: "14px 0",
                borderBottom: "1px solid var(--border-subtle)",
                marginBottom: 32,
              }}>
                <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", fontFamily: FONT, letterSpacing: "-0.01em" }}>
                    Accent color
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-secondary)", fontFamily: FONT, marginTop: 2 }}>
                    {ACCENT_PRESETS.find(p => p.color === accentColor)?.name ?? "Custom"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", flexShrink: 0 }}>
                  {ACCENT_PRESETS.map(p => (
                    <button
                      key={p.color}
                      onClick={() => setAccentColor(p.color)}
                      title={p.name}
                      aria-label={`${p.name} accent`}
                      style={{
                        width: 32, height: 32, minWidth: 32, borderRadius: 8, padding: 0, cursor: "pointer",
                        background: `linear-gradient(135deg, ${p.color} 0%, ${p.deep} 100%)`,
                        border: accentColor === p.color ? `2px solid var(--text-primary)` : "2px solid transparent",
                        outline: accentColor === p.color ? `1px solid ${p.color}` : "none",
                        outlineOffset: "1px",
                        transition: "transform 120ms ease",
                        flexShrink: 0,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.12)"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
                    />
                  ))}
                </div>
              </div>

              {/* Delete account — self-service deletion (satisfies the deletion
                  right + the Privacy Policy/ToS promise that users can delete
                  their account from settings). Backed by DELETE /api/auth/delete-account. */}
              <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(248,113,113,0.75)", fontFamily: FONT, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                Danger zone
              </div>
              <div style={{
                background: "var(--bg-surface-1)",
                border: "1px solid rgba(248,113,113,0.2)",
                borderRadius: 14, padding: "18px 20px",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", fontFamily: FONT, marginBottom: 3, letterSpacing: "-0.01em" }}>Delete my account</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-secondary)", fontFamily: FONT, lineHeight: 1.5 }}>Permanently deletes your account, notebooks, notes, and data. This action cannot be undone.</div>
                </div>
                <button
                  onClick={() => setShowDeleteAccount(true)}
                  className="btn-press"
                  style={{
                    flexShrink: 0,
                    background: "transparent",
                    border: "1px solid rgba(248,113,113,0.4)",
                    color: "var(--danger)",
                    borderRadius: 10, padding: "0 16px", height: 40,
                    fontFamily: FONT, fontSize: 13.5, fontWeight: 600, cursor: "pointer",
                    transition: "background 140ms ease, border-color 140ms ease",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(248,113,113,0.10)"; e.currentTarget.style.borderColor = "var(--danger)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(248,113,113,0.4)"; }}
                >Delete account</button>
              </div>
            </div>

          ) : (
            <div style={{ animation: "fadeIn 0.25s ease" }}>
              {activeView === "dashboard" && streakAtRisk && !streakBannerDismissed && (
                <div className="streak-banner">
                  🔥 Your streak is at risk! Study today to keep it alive.
                  <button onClick={() => setStreakBannerDismissed(true)} aria-label="Dismiss">×</button>
                </div>
              )}
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{
                    fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)",
                    fontFamily: FONT, marginBottom: 4,
                    letterSpacing: "0.08em", textTransform: "uppercase",
                  }}>
                    {activeView === "dashboard" ? "Dashboard" : viewLabel}
                  </div>
                  <div style={{
                    fontSize: "clamp(22px, 6vw, 30px)", fontWeight: 700, color: "var(--text-primary)",
                    fontFamily: FONT_HEADING, letterSpacing: "-0.01em", lineHeight: 1.15,
                    display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                    animation: "fadeIn 0.35s ease",
                  }}>
                    {activeView === "dashboard" ? getGreeting(displayName).text : viewLabel}
                  </div>
                  <div style={{
                    fontSize: 13.5, color: "var(--text-tertiary)",
                    fontFamily: FONT, marginTop: 6,
                  }}>
                    {activeView === "dashboard"
                      ? `${classes.length} ${classes.length === 1 ? "class" : "classes"} · ${notebooks.length} ${notebooks.length === 1 ? "notebook" : "notebooks"}`
                      : `${filtered.length} ${filtered.length === 1 ? "notebook" : "notebooks"}`}
                  </div>
                </div>
                {activeView === "dashboard" && (
                  <button
                    onClick={() => setShowNewClassModal(true)}
                    className="btn-press desktop-only"
                    style={{
                      background: "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)",
                      border: "none", borderRadius: 10, padding: "0 18px", height: 40,
                      color: "#fff", fontWeight: 600, fontSize: 13.5, cursor: "pointer",
                      fontFamily: FONT, flexShrink: 0,
                      boxShadow: "0 6px 18px rgba(167,139,250,0.36), 0 0 0 1px color-mix(in srgb, var(--acc) 45%, transparent)",
                      letterSpacing: "-0.01em",
                      display: "flex", alignItems: "center", gap: 6,
                    }}
                  >+ New Class</button>
                )}
                {/* Mobile-only profile avatar trigger (opens existing dropdown) */}
                <button
                  className="mobile-header-avatar mobile-only"
                  onClick={() => setProfileOpen(v => !v)}
                  aria-label="Open profile menu"
                >
                  <Avatar name={displayName} size={36} seed={user?.email ?? displayName} />
                </button>
              </div>

              {/* Search */}
              <div style={{ position: "relative", marginBottom: 28 }}>
                <span style={{
                  position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                  color: "var(--text-tertiary)", pointerEvents: "none",
                  display: "inline-flex", alignItems: "center",
                }}><Search size={15} strokeWidth={1.75} /></span>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search notebooks…"
                  style={{
                    width: "100%", background: "var(--bg-surface-1)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 10, padding: "0 14px 0 38px", height: 40,
                    color: "var(--text-primary)", fontSize: 13.5, fontFamily: FONT, outline: "none",
                    transition: "all 0.18s", letterSpacing: "-0.01em",
                  }}
                  onFocus={e => { e.target.style.borderColor = "var(--accent)"; e.target.style.boxShadow = "0 0 0 2px var(--accent-soft)"; }}
                  onBlur={e => { e.target.style.borderColor = "var(--border-default)"; e.target.style.boxShadow = "none"; }}
                />
              </div>

              {/* Dashboard: upcoming deadlines */}
              {activeView === "dashboard" && (
                <UpcomingDeadlines
                  notebooks={notebooks}
                  classes={classes}
                  onOpen={(nb, classColor) => openUnitWithClassColor(nb, classColor)}
                />
              )}

              {/* Dashboard: class cards */}
              {activeView === "dashboard" ? (
                filteredClasses.length === 0 ? (
                  <EmptyState
                    icon={search ? <Search size={32} strokeWidth={1.5} /> : <BookOpen size={32} strokeWidth={1.5} />}
                    title={search ? "No classes match" : "Welcome to Scholr"}
                    body={search
                      ? "Try a different search term."
                      : "Create your first class to start organizing your notes and chatting with Derek."}
                    cta={!search ? { label: "+ Create your first class", onClick: () => setShowNewClassModal(true) } : null}
                  />
                ) : (
                  // Drag-to-reorder is enabled only when not searching, since the
                  // SortableContext items would otherwise be a filtered subset and
                  // a persisted order would be incomplete.
                  <>
                    <div style={{
                      fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)",
                      fontFamily: FONT, letterSpacing: "0.08em", textTransform: "uppercase",
                      marginBottom: 6,
                    }}>Classes</div>
                  <DndContext
                    sensors={dndSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleReorderClassesDnd}
                  >
                    <SortableContext
                      items={filteredClasses.map(c => c.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 40 }}>
                        {filteredClasses.map(cls => (
                          <SortableClassCard
                            key={cls.id}
                            cls={cls}
                            dragDisabled={!!search}
                            expanded={expandedClassId === cls.id}
                            units={classUnitsCache[cls.id] ?? null}
                            onToggle={() => handleToggleClass(cls.id)}
                            onChangeColor={color => handleChangeClassColor(cls.id, color)}
                            onOpenUnit={unit => openUnitWithClassColor(unit, cls.color)}
                            onNewUnit={() => setNewUnitFor({ classId: cls.id, classTitle: cls.title })}
                            onDeleteClass={() => setDeleteClassTarget(cls)}
                            onUnitStatusChange={(unit, status) => handleSetStatus(unit, status)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                  </>
                )

              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={
                    search ? <Search size={32} strokeWidth={1.5} />
                    : activeView === "starred" ? <Star size={32} strokeWidth={1.5} />
                    : activeView === "shared" ? <Users size={32} strokeWidth={1.5} />
                    : <Notebook size={32} strokeWidth={1.5} />
                  }
                  title={
                    search ? "No notebooks match"
                    : activeView === "starred" ? "No starred notebooks"
                    : activeView === "shared"  ? "Nothing shared with you yet"
                    : "No notebooks yet"
                  }
                  body={
                    search ? "Try a different search term."
                    : activeView === "starred" ? "Tap the star on any notebook to add it here."
                    : activeView === "shared"  ? "When a classmate invites you to a notebook, it'll show up here."
                    : "Notebooks you create will appear in this view."
                  }
                />
              ) : (
                <>
                  <div style={{
                    fontSize: 11, fontWeight: 600, color: "var(--t3)",
                    fontFamily: FONT, letterSpacing: "0.08em", marginBottom: 14, textTransform: "uppercase",
                  }}>
                    {viewLabel}
                  </div>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                    gap: 12, marginBottom: 40,
                  }}>
                    {filtered.map(nb => (
                      <NotebookCard
                        key={nb.id}
                        nb={nb}
                        onClick={() => setActiveNb(nb)}
                        starred={starredIds.has(nb.id)}
                        onToggleStar={() => handleToggleStar(nb)}
                        onStatusChange={status => handleSetStatus(nb, status)}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* Dashboard: activity heatmap */}
              {activeView === "dashboard" && (
                <ActivityHeatmap data={heatmap} longestStreak={profile?.longest_streak ?? 0} />
              )}

              {/* Notifications — dashboard only */}
              {activeView === "dashboard" && (
                <>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    marginBottom: 14, paddingTop: 20,
                    borderTop: "1px solid var(--border-subtle)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)",
                        fontFamily: FONT, letterSpacing: "0.08em", textTransform: "uppercase",
                      }}>
                        Recent Activity
                      </div>
                      {notifications.length > 0 && (
                        <span style={{
                          fontSize: 10.5, fontWeight: 700, color: "var(--accent)",
                          background: "var(--acc-bg)", border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
                          padding: "1px 7px", borderRadius: 999,
                        }}>{notifications.length}</span>
                      )}
                    </div>
                    {notifications.length > 0 && (
                      <button
                        onClick={async () => {
                          setNotifications([]);
                          try { await api.clearAllNotifications(); } catch { /* silent */ }
                        }}
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          fontSize: 12, color: "var(--text-tertiary)", fontFamily: FONT,
                          padding: "4px 8px", borderRadius: 6, transition: "all 0.15s",
                          fontWeight: 500,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.background = "var(--acc-bg)"; }}
                        onMouseLeave={e => { e.currentTarget.style.color = "var(--text-tertiary)"; e.currentTarget.style.background = "transparent"; }}
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div style={{ padding: "8px 0 12px", color: "var(--text-tertiary)", fontSize: 12.5, fontFamily: FONT }}>
                      You're all caught up. New activity from study groups will appear here.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {notifications.map(n => (
                        <div key={n.id} style={{
                          display: "flex", alignItems: "center", gap: 14,
                          padding: "11px 6px",
                          borderBottom: "1px solid var(--border-subtle)",
                        }}>
                          <div style={{
                            width: 6, height: 6, borderRadius: "50%",
                            background: "var(--accent)", flexShrink: 0,
                          }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: FONT, lineHeight: 1.5, letterSpacing: "-0.005em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {n.activities?.description ?? n.activities?.action}
                            </div>
                            {n.activities?.notebooks?.title && (
                              <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontFamily: FONT, marginTop: 1 }}>
                                in {n.activities.notebooks.title}
                              </div>
                            )}
                          </div>
                          <div style={{
                            fontSize: 11, color: "var(--text-tertiary)", fontFamily: FONT, flexShrink: 0,
                          }}>
                            {timeAgo(n.created_at)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Mobile profile sheet (mobile-only) ── */}
        {profileOpen && (
          <div
            className="mobile-only"
            onClick={e => { if (e.target === e.currentTarget) setProfileOpen(false); }}
            style={{
              position: "fixed", inset: 0, zIndex: 320,
              background: "rgba(0,0,0,0.45)",
              display: "flex", alignItems: "flex-end", justifyContent: "stretch",
              animation: "fadeIn 0.18s ease",
            }}
          >
            <div style={{
              width: "100%",
              background: "var(--bg-surface-1)",
              borderRadius: "18px 18px 0 0",
              padding: `16px 20px calc(24px + env(safe-area-inset-bottom))`,
              animation: "slideUpSheet 0.26s cubic-bezier(0.32,0.72,0.32,1)",
            }}>
              <div style={{
                width: 36, height: 4, borderRadius: 999,
                background: "var(--border-strong)", margin: "0 auto 14px",
              }} />
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <Avatar name={displayName} size={44} seed={user?.email ?? displayName} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</div>
                </div>
              </div>
              <div style={{ height: 1, background: "var(--border-subtle)", marginBottom: 14 }} />
              {/* Settings link */}
              <button
                onClick={() => { setProfileOpen(false); setActiveView("settings"); setActiveNb(null); }}
                style={{
                  width: "100%", height: 48, borderRadius: 10, cursor: "pointer",
                  background: "transparent", border: "1px solid var(--border-default)",
                  color: "var(--text-primary)", fontSize: 14, fontWeight: 500, fontFamily: FONT,
                  display: "flex", alignItems: "center", gap: 10, padding: "0 14px",
                  marginBottom: 8,
                }}
              >
                <Settings size={16} strokeWidth={1.75} /> Settings
              </button>
              {/* Sign out */}
              <button
                onClick={() => { setProfileOpen(false); handleLogout(); }}
                style={{
                  width: "100%", height: 48, borderRadius: 10, cursor: "pointer",
                  background: "transparent", border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
                  color: "var(--danger)", fontSize: 14, fontWeight: 500, fontFamily: FONT,
                  display: "flex", alignItems: "center", gap: 10, padding: "0 14px",
                }}
              >
                <LogOut size={16} strokeWidth={1.75} /> Sign out
              </button>
            </div>
          </div>
        )}

        {/* ── Mobile bottom tab bar (mobile-only, hidden on desktop via CSS) ── */}
        {user && !activeNb && (
          <nav className="mobile-tab-bar mobile-only" aria-label="Primary">
            {[
              { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
              { id: "my-notes",  label: "Notes",     Icon: FileText },
              { id: "shared",    label: "Shared",    Icon: Users },
              { id: "starred",   label: "Starred",   Icon: Star },
            ].map(({ id, label, Icon }) => {
              const active = activeView === id;
              return (
                <button
                  key={id}
                  className={`mobile-tab ${active ? "active" : ""}`}
                  onClick={() => { setActiveView(id); setActiveNb(null); setSearch(""); }}
                  aria-current={active ? "page" : undefined}
                  aria-label={label}
                >
                  <Icon size={22} strokeWidth={active ? 2 : 1.75} />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
        )}

        {/* ── Mobile FAB: New Class (dashboard only) ── */}
        {user && !activeNb && activeView === "dashboard" && (
          <button
            className="mobile-fab mobile-only"
            onClick={() => setShowNewClassModal(true)}
            aria-label="New class"
            title="New class"
          >
            <Plus size={26} strokeWidth={2} />
          </button>
        )}
      </div>
    </>
  );
}

function EmptyState({ icon, title, body, cta }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "72px 24px", gap: 14, textAlign: "center",
      animation: "fadeIn 0.3s ease",
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 18,
        background: "linear-gradient(135deg, var(--acc-bg) 0%, color-mix(in srgb, var(--accent) 4%, transparent) 100%)",
        border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 6, color: "var(--accent)",
        boxShadow: "0 0 32px var(--acc-bg)",
      }}>{icon}</div>
      <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontWeight: 400, fontSize: 26, color: "var(--text-primary)", letterSpacing: "0.01em", lineHeight: 1.15 }}>
        {title}
      </div>
      <div style={{ fontSize: 14, color: "var(--t2)", fontFamily: FONT, lineHeight: 1.55, maxWidth: 360 }}>
        {body}
      </div>
      {cta && (
        <button
          onClick={cta.onClick}
          className="btn-press"
          style={{
            marginTop: 8,
            background: "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)",
            border: "none", borderRadius: 10, padding: "0 20px", height: 40,
            color: "#fff", fontWeight: 600, fontSize: 13.5, cursor: "pointer",
            fontFamily: FONT,
            boxShadow: "0 6px 18px rgba(167,139,250,0.36), 0 0 0 1px color-mix(in srgb, var(--acc) 45%, transparent)",
            letterSpacing: "-0.01em",
          }}
        >{cta.label}</button>
      )}
    </div>
  );
}
