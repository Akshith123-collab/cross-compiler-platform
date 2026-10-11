const sampleProgram = `int a = 10;
int b = 20;
int c;
c = a + b * 2;
print c;`;

const sourceInput = document.getElementById("sourceInput");
const compileBtn = document.getElementById("compileBtn");
const sampleBtn = document.getElementById("sampleBtn");
const output = document.getElementById("output");
const outputTitle = document.getElementById("outputTitle");
const symbolBody = document.getElementById("symbolBody");
const statusBadge = document.getElementById("statusBadge");
const processLog = document.getElementById("processLog");
const sourceStream = document.getElementById("sourceStream");
const stepBtn = document.getElementById("stepBtn");
const targetButtons = [...document.querySelectorAll(".target")];
const tabs = [...document.querySelectorAll(".tab")];
const flowNodes = [...document.querySelectorAll(".flow-node")];

let activeView = "tokens";
let activeTarget = "c";
let latest = null;
let animationIndex = 0;
const stages = ["lexical", "syntax", "semantic", "ast", "tac", "optimized", "targetCode"];

sourceInput.value = sampleProgram;
sourceStream.textContent = sampleProgram.replace(/\s+/g, " ");

const tokenTypes = [
  ["KEYWORD", /^(int|print)\b/],
  ["IDENT", /^[A-Za-z_][A-Za-z0-9_]*/],
  ["NUMBER", /^\d+/],
  ["ASSIGN", /^=/],
  ["PLUS", /^\+/],
  ["MINUS", /^-/],
  ["STAR", /^\*/],
  ["SLASH", /^\//],
  ["LPAREN", /^\(/],
  ["RPAREN", /^\)/],
  ["SEMICOLON", /^;/]
];

function tokenize(source) {
  const tokens = [];
  let index = 0;
  let line = 1;
  let col = 1;

  while (index < source.length) {
    const char = source[index];
    if (char === "\n") {
      index++;
      line++;
      col = 1;
      continue;
    }
    if (/\s/.test(char)) {
      index++;
      col++;
      continue;
    }

    const slice = source.slice(index);
    let matched = false;
    for (const [type, pattern] of tokenTypes) {
      const result = slice.match(pattern);
      if (result) {
        const value = result[0];
        tokens.push({ type, value, line, col });
        index += value.length;
        col += value.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      throw new Error(`Lexical error at line ${line}, column ${col}: unexpected '${char}'`);
    }
  }
  tokens.push({ type: "EOF", value: "EOF", line, col });
  return tokens;
}

function parser(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const match = (type, value) => {
    const token = peek();
    if (token.type === type && (value === undefined || token.value === value)) {
      pos++;
      return token;
    }
    const expected = value ? `${type} '${value}'` : type;
    throw new Error(`Syntax error at line ${token.line}, column ${token.col}: expected ${expected}, found '${token.value}'`);
  };

  function parseProgram() {
    const body = [];
    while (peek().type !== "EOF") body.push(parseStatement());
    return { kind: "Program", body };
  }

  function parseStatement() {
    const token = peek();
    if (token.type === "KEYWORD" && token.value === "int") return parseDeclaration();
    if (token.type === "KEYWORD" && token.value === "print") return parsePrint();
    if (token.type === "IDENT") return parseAssignment();
    throw new Error(`Syntax error at line ${token.line}, column ${token.col}: invalid statement start '${token.value}'`);
  }

  function parseDeclaration() {
    match("KEYWORD", "int");
    const id = match("IDENT").value;
    let init = null;
    if (peek().type === "ASSIGN") {
      match("ASSIGN");
      init = parseExpression();
    }
    match("SEMICOLON");
    return { kind: "Declaration", id, valueType: "int", init };
  }

  function parseAssignment() {
    const id = match("IDENT").value;
    match("ASSIGN");
    const expr = parseExpression();
    match("SEMICOLON");
    return { kind: "Assignment", id, expr };
  }

  function parsePrint() {
    match("KEYWORD", "print");
    const expr = parseExpression();
    match("SEMICOLON");
    return { kind: "Print", expr };
  }

  function parseExpression() {
    let node = parseTerm();
    while (["PLUS", "MINUS"].includes(peek().type)) {
      const op = match(peek().type).value;
      node = { kind: "BinaryExpr", op, left: node, right: parseTerm() };
    }
    return node;
  }

  function parseTerm() {
    let node = parseFactor();
    while (["STAR", "SLASH"].includes(peek().type)) {
      const op = match(peek().type).value;
      node = { kind: "BinaryExpr", op, left: node, right: parseFactor() };
    }
    return node;
  }

  function parseFactor() {
    const token = peek();
    if (token.type === "NUMBER") return { kind: "NumberLiteral", value: Number(match("NUMBER").value) };
    if (token.type === "IDENT") return { kind: "Identifier", name: match("IDENT").value };
    if (token.type === "LPAREN") {
      match("LPAREN");
      const expr = parseExpression();
      match("RPAREN");
      return expr;
    }
    throw new Error(`Syntax error at line ${token.line}, column ${token.col}: expression expected`);
  }

  return parseProgram();
}

function semanticAnalyze(ast) {
  const symbols = new Map();
  const errors = [];
  const values = new Map();

  function checkExpr(node) {
    if (node.kind === "Identifier" && !symbols.has(node.name)) {
      errors.push(`Undeclared identifier '${node.name}'`);
    }
    if (node.kind === "BinaryExpr") {
      checkExpr(node.left);
      checkExpr(node.right);
    }
  }

  for (const stmt of ast.body) {
    if (stmt.kind === "Declaration") {
      if (symbols.has(stmt.id)) errors.push(`Duplicate declaration of '${stmt.id}'`);
      symbols.set(stmt.id, { name: stmt.id, type: stmt.valueType, value: stmt.init ? "initialized" : "undefined" });
      if (stmt.init) checkExpr(stmt.init);
    }
    if (stmt.kind === "Assignment") {
      if (!symbols.has(stmt.id)) errors.push(`Assignment to undeclared identifier '${stmt.id}'`);
      checkExpr(stmt.expr);
      values.set(stmt.id, "assigned");
      if (symbols.has(stmt.id)) symbols.get(stmt.id).value = "assigned";
    }
    if (stmt.kind === "Print") checkExpr(stmt.expr);
  }

  return { symbols: [...symbols.values()], errors, values };
}

function generateTAC(ast) {
  const code = [];
  let tempCount = 1;
  const nextTemp = () => `t${tempCount++}`;

  function emitExpr(node) {
    if (node.kind === "NumberLiteral") return String(node.value);
    if (node.kind === "Identifier") return node.name;
    const left = emitExpr(node.left);
    const right = emitExpr(node.right);
    const temp = nextTemp();
    code.push({ op: node.op, arg1: left, arg2: right, result: temp });
    return temp;
  }

  for (const stmt of ast.body) {
    if (stmt.kind === "Declaration" && stmt.init) {
      code.push({ op: "=", arg1: emitExpr(stmt.init), arg2: "", result: stmt.id });
    }
    if (stmt.kind === "Assignment") {
      code.push({ op: "=", arg1: emitExpr(stmt.expr), arg2: "", result: stmt.id });
    }
    if (stmt.kind === "Print") {
      code.push({ op: "print", arg1: emitExpr(stmt.expr), arg2: "", result: "" });
    }
  }
  return code;
}

function optimizeTAC(tac) {
  const constants = new Map();
  const optimized = [];
  const calc = (op, a, b) => {
    if (op === "+") return a + b;
    if (op === "-") return a - b;
    if (op === "*") return a * b;
    if (op === "/") return Math.trunc(a / b);
    return null;
  };
  const resolve = (x) => constants.has(x) ? constants.get(x) : x;

  for (const instr of tac) {
    if (["+", "-", "*", "/"].includes(instr.op)) {
      const a = resolve(instr.arg1);
      const b = resolve(instr.arg2);
      if (/^-?\d+$/.test(String(a)) && /^-?\d+$/.test(String(b))) {
        const folded = calc(instr.op, Number(a), Number(b));
        constants.set(instr.result, String(folded));
        optimized.push({ op: "=", arg1: String(folded), arg2: "", result: instr.result, note: "constant folded" });
      } else if ((instr.op === "+" && b === "0") || (instr.op === "*" && b === "1")) {
        optimized.push({ op: "=", arg1: a, arg2: "", result: instr.result, note: "algebraic identity" });
      } else {
        optimized.push({ ...instr, arg1: a, arg2: b });
      }
    } else if (instr.op === "=") {
      const value = resolve(instr.arg1);
      constants.set(instr.result, value);
      optimized.push({ ...instr, arg1: value });
    } else {
      optimized.push({ ...instr, arg1: resolve(instr.arg1) });
    }
  }
  return optimized;
}

function generateTargets(tac, symbols) {
  const names = symbols.map((s) => s.name);
  const temps = [...new Set(tac.map((i) => i.result).filter((r) => /^t\d+$/.test(r)))];
  const cLines = ["#include <stdio.h>", "", "int main() {"];
  if (names.length) cLines.push(`  int ${names.join(", ")};`);
  if (temps.length) cLines.push(`  int ${temps.join(", ")};`);
  for (const i of tac) {
    if (["+", "-", "*", "/"].includes(i.op)) cLines.push(`  ${i.result} = ${i.arg1} ${i.op} ${i.arg2};`);
    if (i.op === "=") cLines.push(`  ${i.result} = ${i.arg1};`);
    if (i.op === "print") cLines.push(`  printf("%d\\n", ${i.arg1});`);
  }
  cLines.push("  return 0;", "}");

  const armLoad = (reg, value) => /^-?\d+$/.test(String(value)) ? `  MOV ${reg}, #${value}` : `  LDR ${reg}, [${value}]`;
  const riscvLoad = (reg, value) => /^-?\d+$/.test(String(value)) ? `  li ${reg}, ${value}` : `  lw ${reg}, ${value}`;

  const arm = [".data", ...[...names, ...temps].map((n) => `${n}: .word 0`), "", ".text", ".global _start", "_start:"];
  for (const i of tac) {
    if (["+", "-", "*", "/"].includes(i.op)) {
      arm.push(armLoad("R0", i.arg1), armLoad("R1", i.arg2));
      arm.push(i.op === "+" ? "  ADD R2, R0, R1" : i.op === "-" ? "  SUB R2, R0, R1" : i.op === "*" ? "  MUL R2, R0, R1" : "  SDIV R2, R0, R1");
      arm.push(`  STR R2, [${i.result}]`);
    }
    if (i.op === "=") arm.push(armLoad("R0", i.arg1), `  STR R0, [${i.result}]`);
    if (i.op === "print") arm.push(`  ; print ${i.arg1} using platform syscall/printf bridge`);
  }
  arm.push("  ; exit");

  const riscv = [".data", ...[...names, ...temps].map((n) => `${n}: .word 0`), "", ".text", ".globl main", "main:"];
  for (const i of tac) {
    if (["+", "-", "*", "/"].includes(i.op)) {
      riscv.push(riscvLoad("t0", i.arg1), riscvLoad("t1", i.arg2));
      riscv.push(i.op === "+" ? "  add t2, t0, t1" : i.op === "-" ? "  sub t2, t0, t1" : i.op === "*" ? "  mul t2, t0, t1" : "  div t2, t0, t1");
      riscv.push(`  sw t2, ${i.result}`);
    }
    if (i.op === "=") riscv.push(riscvLoad("t0", i.arg1), `  sw t0, ${i.result}`);
    if (i.op === "print") riscv.push(`  # print ${i.arg1} with ecall runtime`);
  }
  riscv.push("  li a0, 0", "  ret");

  return { c: cLines.join("\n"), arm: arm.join("\n"), riscv: riscv.join("\n") };
}

function execute(ast) {
  const env = new Map();
  const out = [];
  const evalExpr = (node) => {
    if (node.kind === "NumberLiteral") return node.value;
    if (node.kind === "Identifier") return env.get(node.name) ?? 0;
    const l = evalExpr(node.left);
    const r = evalExpr(node.right);
    if (node.op === "+") return l + r;
    if (node.op === "-") return l - r;
    if (node.op === "*") return l * r;
    if (node.op === "/") return Math.trunc(l / r);
    return 0;
  };
  for (const stmt of ast.body) {
    if (stmt.kind === "Declaration") env.set(stmt.id, stmt.init ? evalExpr(stmt.init) : 0);
    if (stmt.kind === "Assignment") env.set(stmt.id, evalExpr(stmt.expr));
    if (stmt.kind === "Print") out.push(String(evalExpr(stmt.expr)));
  }
  return out.join("\n") || "(no output)";
}

function compile() {
  try {
    const source = sourceInput.value;
    sourceStream.textContent = source.replace(/\s+/g, " ");
    const tokens = tokenize(source);
    const ast = parser(tokens);
    const semantic = semanticAnalyze(ast);
    if (semantic.errors.length) throw new Error(`Semantic error: ${semantic.errors.join("; ")}`);
    const tac = generateTAC(ast);
    const optimized = optimizeTAC(tac);
    const targets = generateTargets(optimized, semantic.symbols);
    latest = { tokens, ast, semantic, tac, optimized, targets, run: execute(ast), errors: [] };
    statusBadge.textContent = "Compiled";
    processLog.innerHTML = [
      "Lexical analyzer produced token stream.",
      "Parser accepted grammar and formed AST.",
      "Semantic pass built symbol table.",
      "TAC generated and optimized by constant folding.",
      "Target code emitted for selected platform."
    ].map((x) => `<div class="ok">✓ ${x}</div>`).join("");
    renderSymbols(semantic.symbols);
    setFlow("targetCode");
  } catch (err) {
    latest = { errors: [err.message] };
    statusBadge.textContent = "Error";
    processLog.innerHTML = `<div class="err">${escapeHtml(err.message)}</div>`;
    symbolBody.innerHTML = "";
  }
  render();
}

function renderSymbols(symbols = []) {
  symbolBody.innerHTML = symbols.length
    ? symbols.map((s) => `<tr><td>${s.name}</td><td>${s.type}</td><td>${s.value}</td></tr>`).join("")
    : `<tr><td colspan="3">No symbols yet</td></tr>`;
}

function render() {
  outputTitle.textContent = tabs.find((tab) => tab.dataset.view === activeView).textContent;
  if (!latest) {
    output.innerHTML = "<pre>Press Compile to start.</pre>";
    return;
  }
  if (latest.errors?.length) {
    output.innerHTML = `<pre class="err">${escapeHtml(latest.errors.join("\n"))}</pre>`;
    return;
  }
  const renderers = {
    tokens: () => table(latest.tokens.filter((t) => t.type !== "EOF"), ["type", "value", "line", "col"]),
    syntax: () => `<pre class="ok">Syntax accepted.\nGrammar path: Program -> Statement* -> Declaration | Assignment | Print</pre>`,
    semantic: () => `<pre class="ok">Semantic analysis successful.\nAll identifiers are declared before use and stored in the symbol table.</pre>`,
    ast: () => `<div class="ast-tree">${renderAst(latest.ast)}</div>`,
    tac: () => table(latest.tac, ["op", "arg1", "arg2", "result"]),
    optimized: () => table(latest.optimized, ["op", "arg1", "arg2", "result", "note"]),
    targetCode: () => `<pre>${escapeHtml(latest.targets[activeTarget])}</pre>`,
    run: () => `<pre>Simulated output:\n${escapeHtml(latest.run)}</pre>`,
    writeup: renderWriteup
  };
  output.innerHTML = renderers[activeView]();
}

function table(rows, cols) {
  return `<table class="grid-table"><thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${cols.map((c) => `<td>${escapeHtml(row[c] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function renderAst(node, depth = 0) {
  const pad = "&nbsp;".repeat(depth * 4);
  let label = node.kind;
  if (node.id) label += `: ${node.id}`;
  if (node.name) label += `: ${node.name}`;
  if (node.value !== undefined) label += `: ${node.value}`;
  if (node.op) label += `: ${node.op}`;
  const children = [];
  if (node.body) children.push(...node.body);
  if (node.init) children.push(node.init);
  if (node.expr) children.push(node.expr);
  if (node.left) children.push(node.left);
  if (node.right) children.push(node.right);
  return `<div class="ast-row">${pad}${escapeHtml(label)}</div>${children.map((c) => renderAst(c, depth + 1)).join("")}`;
}

function renderWriteup() {
  return `<div class="writeup">
    <h2>Task 1: Familiarization of Cross Compiler</h2>
    <p>A cross compiler is a compiler that runs on one machine but produces target code for a different machine or platform. For example, a compiler may run on a Windows laptop and generate ARM assembly for an embedded board, or RISC-V assembly for a simulator. It still performs the usual compiler phases: lexical analysis, syntax analysis, semantic analysis, intermediate code generation, optimization, and target code generation. The difference is that the final code generator is designed for a target architecture that may not be the same as the host system.</p>
    <p>In this mini project, the source language is a tiny C-like language with integer declarations, assignments, arithmetic expressions, and print statements. The platform shows each compiler phase interactively. After syntax and semantic checking, it creates TAC, applies constant folding and simple algebraic optimization, then emits code for C, ARM-style assembly, and RISC-V-style assembly.</p>
    <div class="tdiagram">
      <div class="tbox"><strong>Host</strong><br>Windows / Browser<br>Runs this compiler platform</div>
      <div class="tbox"><strong>Compiler</strong><br>Source language -> IR -> Target backend</div>
      <div class="tbox"><strong>Target</strong><br>C, ARM Assembly, RISC-V Assembly</div>
    </div>
    <h3>T-diagram Illustration</h3>
    <pre>        Source Language
              |
              v
   +-----------------------+
   | Cross Compiler        |  runs on Host Platform
   | Host: Browser/Windows |
   | Target: ARM/RISC-V/C  |
   +-----------------------+
              |
              v
        Target Program</pre>
  </div>`;
}

function setFlow(step) {
  const index = stages.indexOf(step);
  flowNodes.forEach((node, i) => {
    node.classList.toggle("active", i === index);
    node.classList.toggle("done", i < index);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[ch]));
}

compileBtn.addEventListener("click", compile);
sampleBtn.addEventListener("click", () => {
  sourceInput.value = sampleProgram;
  compile();
});
stepBtn.addEventListener("click", () => {
  setFlow(stages[animationIndex % stages.length]);
  statusBadge.textContent = stages[animationIndex % stages.length];
  animationIndex++;
});
tabs.forEach((tab) => tab.addEventListener("click", () => {
  tabs.forEach((t) => t.classList.remove("active"));
  tab.classList.add("active");
  activeView = tab.dataset.view;
  setFlow(activeView === "targetCode" ? "targetCode" : activeView);
  render();
}));
targetButtons.forEach((btn) => btn.addEventListener("click", () => {
  targetButtons.forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  activeTarget = btn.dataset.target;
  if (activeView === "targetCode") render();
}));

compile();
