/* A small, safe evaluator for the maths expressions a graph spec carries.
 *
 * These expressions arrive from the model, so `eval` and `new Function` are
 * both off the table — this is a real tokenizer and parser that understands a
 * fixed grammar and nothing else. Anything outside it throws rather than
 * guessing, because a graph that plots the wrong function silently is worse
 * than one that refuses to plot.
 *
 * Grammar, loosest to tightest:
 *   expr   := term (('+' | '-') term)*
 *   term   := unary (('*' | '/' | implicit) unary)*
 *   unary  := ('-' | '+')? power
 *   power  := atom ('^' unary)?          — right associative, so 2^3^2 = 512
 *   atom   := number | const | var | fn '(' expr ')' | '(' expr ')' | '|' expr '|'
 *
 * Implicit multiplication is supported because it is how people actually write
 * maths: 2x, 3sin(x), 2pi, (x+1)(x-1).
 */

const FUNCTIONS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  sqrt: Math.sqrt, abs: Math.abs,
  ln: Math.log, log: x => Math.log10(x), log2: Math.log2,
  exp: Math.exp, floor: Math.floor, ceil: Math.ceil, round: Math.round,
  // The reciprocal trio, which is most of why this exists at all.
  csc: x => 1 / Math.sin(x),
  sec: x => 1 / Math.cos(x),
  cot: x => 1 / Math.tan(x),
};

const CONSTANTS = { pi: Math.PI, e: Math.E, tau: 2 * Math.PI };

export class MathExprError extends Error {}

/* ── Tokenizer ──────────────────────────────────────────────────────────── */

function tokenize(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];

    if (c === " " || c === "\t" || c === "\n") { i++; continue; }

    if (c >= "0" && c <= "9" || (c === "." && src[i + 1] >= "0" && src[i + 1] <= "9")) {
      let j = i;
      while (j < src.length && (src[j] >= "0" && src[j] <= "9" || src[j] === ".")) j++;
      const text = src.slice(i, j);
      const value = Number(text);
      if (!Number.isFinite(value)) throw new MathExprError(`Not a number: ${text}`);
      tokens.push({ type: "num", value });
      i = j;
      continue;
    }

    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      tokens.push({ type: "name", value: src.slice(i, j).toLowerCase() });
      i = j;
      continue;
    }

    // Unicode forms that turn up in maths written for humans.
    if (c === "−") { tokens.push({ type: "op", value: "-" }); i++; continue; } // minus sign
    if (c === "×" || c === "·") { tokens.push({ type: "op", value: "*" }); i++; continue; }
    if (c === "÷") { tokens.push({ type: "op", value: "/" }); i++; continue; }
    if (c === "π") { tokens.push({ type: "name", value: "pi" }); i++; continue; }

    if ("+-*/^(),|".includes(c)) { tokens.push({ type: "op", value: c }); i++; continue; }

    throw new MathExprError(`Unexpected character: ${c}`);
  }
  return tokens;
}

/* ── Parser → an AST of plain objects ───────────────────────────────────── */

function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const eat = v => {
    const t = tokens[pos];
    if (!t || t.value !== v) throw new MathExprError(`Expected ${v}`);
    pos++;
    return t;
  };

  function parseExpr() {
    let left = parseTerm();
    while (peek() && peek().type === "op" && (peek().value === "+" || peek().value === "-")) {
      const op = tokens[pos++].value;
      left = { kind: "binary", op, left, right: parseTerm() };
    }
    return left;
  }

  function parseTerm() {
    let left = parseUnary();
    for (;;) {
      const t = peek();
      if (!t) break;
      if (t.type === "op" && (t.value === "*" || t.value === "/")) {
        pos++;
        left = { kind: "binary", op: t.value, left, right: parseUnary() };
        continue;
      }
      // Implicit multiplication: a number, name or '(' directly after a value.
      if (t.type === "num" || t.type === "name" || (t.type === "op" && t.value === "(")) {
        left = { kind: "binary", op: "*", left, right: parseUnary() };
        continue;
      }
      break;
    }
    return left;
  }

  function parseUnary() {
    const t = peek();
    if (t && t.type === "op" && (t.value === "-" || t.value === "+")) {
      pos++;
      const operand = parseUnary();
      return t.value === "-" ? { kind: "negate", operand } : operand;
    }
    return parsePower();
  }

  function parsePower() {
    const base = parseAtom();
    const t = peek();
    if (t && t.type === "op" && t.value === "^") {
      pos++;
      // Right associative, and the exponent may itself be signed: x^-2.
      return { kind: "binary", op: "^", left: base, right: parseUnary() };
    }
    return base;
  }

  function parseAtom() {
    const t = peek();
    if (!t) throw new MathExprError("Unexpected end of expression");

    if (t.type === "num") { pos++; return { kind: "num", value: t.value }; }

    if (t.type === "op" && t.value === "(") {
      pos++;
      const inner = parseExpr();
      eat(")");
      return inner;
    }

    if (t.type === "op" && t.value === "|") {
      pos++;
      const inner = parseExpr();
      eat("|");
      return { kind: "call", name: "abs", arg: inner };
    }

    if (t.type === "name") {
      pos++;
      const name = t.value;
      if (Object.hasOwn(FUNCTIONS, name)) {
        eat("(");
        const arg = parseExpr();
        eat(")");
        return { kind: "call", name, arg };
      }
      if (Object.hasOwn(CONSTANTS, name)) return { kind: "num", value: CONSTANTS[name] };
      if (name === "x" || name === "t" || name === "theta") return { kind: "var" };
      throw new MathExprError(`Unknown name: ${name}`);
    }

    throw new MathExprError(`Unexpected token: ${t.value}`);
  }

  const ast = parseExpr();
  if (pos !== tokens.length) throw new MathExprError("Trailing characters in expression");
  return ast;
}

/* ── Evaluation ─────────────────────────────────────────────────────────── */

function evaluate(node, x) {
  switch (node.kind) {
    case "num": return node.value;
    case "var": return x;
    case "negate": return -evaluate(node.operand, x);
    case "call": return FUNCTIONS[node.name](evaluate(node.arg, x));
    case "binary": {
      const a = evaluate(node.left, x);
      const b = evaluate(node.right, x);
      switch (node.op) {
        case "+": return a + b;
        case "-": return a - b;
        case "*": return a * b;
        case "/": return a / b;
        case "^": return Math.pow(a, b);
        default: throw new MathExprError(`Unknown operator: ${node.op}`);
      }
    }
    default: throw new MathExprError(`Unknown node: ${node.kind}`);
  }
}

/**
 * Compile an expression to a function of x. Throws MathExprError on anything
 * it does not understand, so a caller can fall back to not drawing the graph
 * rather than drawing a wrong one.
 */
export function compile(source) {
  if (typeof source !== "string" || !source.trim()) {
    throw new MathExprError("Empty expression");
  }
  if (source.length > 500) throw new MathExprError("Expression too long");
  const ast = parse(tokenize(source));
  return x => evaluate(ast, x);
}

/** Convenience for one-off evaluation; compile() when plotting many points. */
export function evaluateAt(source, x) {
  return compile(source)(x);
}
