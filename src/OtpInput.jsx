import { useRef } from "react";

const FONT = `"Mulish", -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;

export default function OtpInput({ value = "", onChange, disabled = false }) {
  const refs = useRef([]);
  const cells = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  function handleChange(i, e) {
    const raw = e.target.value.replace(/\D/g, "");

    if (raw.length > 1) {
      const digits = raw.slice(0, 6 - i);
      const next = [...cells];
      for (let j = 0; j < digits.length; j++) next[i + j] = digits[j];
      onChange(next.join(""));
      refs.current[Math.min(i + digits.length, 5)]?.focus();
    } else {
      const next = [...cells];
      next[i] = raw;
      onChange(next.join(""));
      if (raw && i < 5) refs.current[i + 1]?.focus();
    }
  }

  function handleKeyDown(i, e) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (cells[i]) {
        const next = [...cells];
        next[i] = "";
        onChange(next.join(""));
      } else if (i > 0) {
        const next = [...cells];
        next[i - 1] = "";
        onChange(next.join(""));
        refs.current[i - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < 5) {
      refs.current[i + 1]?.focus();
    }
  }

  function handlePaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(pasted);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  }

  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center", margin: "4px 0" }}>
      {cells.map((d, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          value={d}
          disabled={disabled}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={e => {
            e.target.select();
            e.target.style.borderColor = "#A78BFA";
            e.target.style.boxShadow = "0 0 0 3px rgba(167,139,250,0.14)";
          }}
          onBlur={e => {
            e.target.style.borderColor = d ? "rgba(167,139,250,0.45)" : "rgba(255,255,255,0.1)";
            e.target.style.boxShadow = "none";
          }}
          style={{
            width: 44,
            height: 52,
            textAlign: "center",
            fontSize: 20,
            fontWeight: 600,
            fontFamily: FONT,
            background: "#14141F",
            border: `1.5px solid ${d ? "rgba(167,139,250,0.45)" : "rgba(255,255,255,0.1)"}`,
            borderRadius: 10,
            color: "#F5F5FA",
            outline: "none",
            transition: "border-color 0.18s, box-shadow 0.18s",
            caretColor: "transparent",
            opacity: disabled ? 0.5 : 1,
            letterSpacing: "-0.02em",
          }}
        />
      ))}
    </div>
  );
}
