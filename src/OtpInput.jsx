import { useRef } from "react";

export default function OtpInput({ value = "", onChange, disabled = false }) {
  const refs = useRef([]);
  // Derive individual cell values from the parent string
  const cells = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  function handleChange(i, e) {
    const raw = e.target.value.replace(/\D/g, "");

    if (raw.length > 1) {
      // Multi-char input (e.g. autofill or browser suggestions) — fill forward
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
    <div style={{ display: "flex", gap: 10, justifyContent: "center", margin: "4px 0" }}>
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
          }}
          onBlur={e => {
            e.target.style.borderColor = d ? "#A78BFA55" : "#2A2A38";
          }}
          style={{
            width: 46,
            height: 54,
            textAlign: "center",
            fontSize: 22,
            fontWeight: 700,
            fontFamily: "'DM Mono', monospace",
            background: "#0D0D14",
            border: `2px solid ${d ? "#A78BFA55" : "#2A2A38"}`,
            borderRadius: 10,
            color: "#E8E8F0",
            outline: "none",
            transition: "border-color 0.15s",
            caretColor: "transparent",
            opacity: disabled ? 0.5 : 1,
          }}
        />
      ))}
    </div>
  );
}
