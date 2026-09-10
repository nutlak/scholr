import { useEffect, useRef, useState } from "react";
import { api } from "../../api.js";
import { Download, Headphones, Pause, Play, Share2, X } from "lucide-react";
import { FONT } from "../../lib/theme.js";
import { formatPodcastTime, timeAgo } from "../../lib/format.js";

const PODCAST_FORMATS = [
  { id: "casual",   label: "Casual",    sub: "Friendly chat" },
  { id: "examcram", label: "Exam Cram", sub: "Testable facts" },
  { id: "eli5",     label: "ELI5",      sub: "Simple analogies" },
  { id: "debate",   label: "Debate",    sub: "Opposing angles" },
];
const PODCAST_LENGTHS = [
  { id: "quick",    label: "Quick",    sub: "~3 min" },
  { id: "standard", label: "Standard", sub: "~8 min" },
  { id: "deep",     label: "Deep",     sub: "~15 min" },
];
const PODCAST_SPEEDS = [1, 1.25, 1.5, 2];

export function PodcastPlayer({ podcast, onShare }) {
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
export function PodcastPanel({ nb, onToast, onUpgradeNeeded }) {
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
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (!isLocked) handleGenerate();
              }
            }}
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
