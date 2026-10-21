// rename-agent-kind
// =================
// Renames the message kind "unii" to "agent" in this tree: the kind is the
// agent's own words, as in Kind (AskAI.ts), Memory.show and the chat's
// stored entries. This script is part of Mauria's fork, not upstream
// uniichat. Run it after every merge of upstream, because upstream still
// spells the kind "unii":
//
//     bun scripts/rename-agent-kind.ts
//
// TABLE lists every line to change, as the whole line before and after.
// An entry whose `after` line is already in its file is applied, and is
// skipped, so a second run changes nothing. An entry whose `before` line
// is not in its file exactly once is a failure: the script then writes no
// file at all, prints each such entry, and exits 1. Fix the entry (upstream
// moved or reworded that line) and run again. web/app.js, the built bundle
// of web/src, has its lines in TABLE too, so the bundle needs no rebuild.
//
// A kind site that upstream adds is missing from TABLE. The type check
// finds it: before and after the rename the script runs TypeScript over
// the code, and any error that is new after the rename is a value of type
// Kind compared with, or given, the old "unii". Add that line to TABLE.
// The check is the repo's own `bun run check`, which needs `bun install`
// to have run; if it cannot run, the script says so and exits 0, so check
// by hand with the list of remaining "unii" strings printed at the end. The only ones that stay
// are the sign-in cookie (Cloud.ts), the MCP server's name (Tools.ts) and
// Claude Code's tool prefix (ClaudeCode.ts), which are not the kind.

import * as fs from "node:fs";
import * as path from "node:path";

// Types
// =====

// one line to change: its whole text before, and after
type Entry = { file: string; before: string; after: string };

// Constants
// =========

const ROOT = path.resolve(import.meta.dir, "..");

// Table
// =====

const TABLE: Entry[] = [
  { file: "Agent.ts",
    before: "      const replies = step.entries.filter((e) => e.kind === \"unii\");",
    after : "      const replies = step.entries.filter((e) => e.kind === \"agent\");" },
  { file: "Anthropic.ts",
    before: "      on(\"unii\", delta.text);",
    after : "      on(\"agent\", delta.text);" },
  { file: "Anthropic.ts",
    before: "      if (entry?.kind === \"unii\" && top?.kind === \"unii\") {",
    after : "      if (entry?.kind === \"agent\" && top?.kind === \"agent\") {" },
  { file: "Anthropic.ts",
    before: "        return { kind: \"unii\", text: b.text };",
    after : "        return { kind: \"agent\", text: b.text };" },
  { file: "AskAI.ts",
    before: "export type Kind = \"user\" | \"work\" | \"mind\" | \"unii\" | \"tool\" | \"echo\" | \"note\";",
    after : "export type Kind = \"user\" | \"work\" | \"mind\" | \"agent\" | \"tool\" | \"echo\" | \"note\";" },
  { file: "ClaudeCode.test.ts",
    before: "  expect(events.filter((ev) => ev.$ === \"Delta\").map((ev) => [ev.kind, ev.text])).toEqual([[\"unii\", \"Hello\"], [\"unii\", \" there\"], [\"unii\", \", friend!\"]]);",
    after : "  expect(events.filter((ev) => ev.$ === \"Delta\").map((ev) => [ev.kind, ev.text])).toEqual([[\"agent\", \"Hello\"], [\"agent\", \" there\"], [\"agent\", \", friend!\"]]);" },
  { file: "ClaudeCode.test.ts",
    before: "  expect(events.filter((ev) => ev.$ === \"Entry\")).toEqual([{ $: \"Entry\", kind: \"unii\", text: \"Hello there, friend!\" }]);",
    after : "  expect(events.filter((ev) => ev.$ === \"Entry\")).toEqual([{ $: \"Entry\", kind: \"agent\", text: \"Hello there, friend!\" }]);" },
  { file: "ClaudeCode.test.ts",
    before: "  expect(texts).toEqual([[\"unii\", \"1\\n2\\n3\\n4\\n5\\n6\\n7\\n8\\n9\\n10\\n11\\n12\\n13\\n14\\n15\\n16\\n17\\n18\\n19\\n20\\n21\\n22\\n23\\n24\\n25\\n26\\n27\\n28\\n29\\n30\"], [\"user\", \"now say done\"], [\"unii\", \"done\"]]);",
    after : "  expect(texts).toEqual([[\"agent\", \"1\\n2\\n3\\n4\\n5\\n6\\n7\\n8\\n9\\n10\\n11\\n12\\n13\\n14\\n15\\n16\\n17\\n18\\n19\\n20\\n21\\n22\\n23\\n24\\n25\\n26\\n27\\n28\\n29\\n30\"], [\"user\", \"now say done\"], [\"agent\", \"done\"]]);" },
  { file: "Import.test.ts",
    before: "  expect([show(\"unii\", true), show(\"tool\", true), show(\"user\", true), show(\"unii\")]).toEqual([\"ai: \", \"ai: \", \"user: \", \"unii: \"]);",
    after : "  expect([show(\"agent\", true), show(\"tool\", true), show(\"user\", true), show(\"agent\")]).toEqual([\"ai: \", \"ai: \", \"user: \", \"agent: \"]);" },
  { file: "Import.ts",
    before: "  const keep = (m: Head, last?: string) => (want.tools || m.kind === \"user\" || m.kind === \"unii\") && m.date >= want.since && import_new(m, last);",
    after : "  const keep = (m: Head, last?: string) => (want.tools || m.kind === \"user\" || m.kind === \"agent\") && m.date >= want.since && import_new(m, last);" },
  { file: "Import.ts",
    before: "    const kind = role === \"user\" ? \"user\" : role === \"assistant\" ? (m.recipient === \"all\" ? \"unii\" : \"tool\") : role === \"tool\" ? \"echo\" : null;",
    after : "    const kind = role === \"user\" ? \"user\" : role === \"assistant\" ? (m.recipient === \"all\" ? \"agent\" : \"tool\") : role === \"tool\" ? \"echo\" : null;" },
  { file: "Import.ts",
    before: "    const kind   = m.sender === \"human\" ? \"user\" : \"unii\";",
    after : "    const kind   = m.sender === \"human\" ? \"user\" : \"agent\";" },
  { file: "Import.ts",
    before: "  return blocks_msgs(j.type === \"user\" ? \"user\" : \"unii\", blocks, date);",
    after : "  return blocks_msgs(j.type === \"user\" ? \"user\" : \"agent\", blocks, date);" },
  { file: "Import.ts",
    before: "      const kind  = p.role === \"user\" ? \"user\" : p.role === \"assistant\" ? \"unii\" : null;",
    after : "      const kind  = p.role === \"user\" ? \"user\" : p.role === \"assistant\" ? \"agent\" : null;" },
  { file: "Memory.ts",
    before: "    const who  = root.imported && (root.kind === \"unii\" || root.kind === \"tool\") ? \"ai\" : root.kind;",
    after : "    const who  = root.imported && (root.kind === \"agent\" || root.kind === \"tool\") ? \"ai\" : root.kind;" },
  { file: "OpenAI.ts",
    before: "        on(\"unii\", ev.delta);",
    after : "        on(\"agent\", ev.delta);" },
  { file: "OpenAI.ts",
    before: "        const reply: Entry[] = text ? [{ kind: \"unii\", text }] : [];",
    after : "        const reply: Entry[] = text ? [{ kind: \"agent\", text }] : [];" },
  { file: "Server.ts",
    before: "const HELLO_LINE = \"unii: hello: UniiChat, one endless chat kept in a memory tree, recent days in more detail; build anything for years; recalls the past (ad2cat.py); a chatbot with a memory system; the user's terminal install; asks their email.\";",
    after : "const HELLO_LINE = \"agent: hello: UniiChat, one endless chat kept in a memory tree, recent days in more detail; build anything for years; recalls the past (ad2cat.py); a chatbot with a memory system; the user's terminal install; asks their email.\";" },
  { file: "Server.ts",
    before: "      Memory.push(mem, [{ kind: \"unii\", text: hello, line: HELLO_LINE }, { kind: \"user\", text: user.name }, { kind: \"unii\", text: SIGNED }]);",
    after : "      Memory.push(mem, [{ kind: \"agent\", text: hello, line: HELLO_LINE }, { kind: \"user\", text: user.name }, { kind: \"agent\", text: SIGNED }]);" },
  { file: "Server.ts",
    before: "    if (last !== null && (last.kind === \"unii\" || last.kind === \"note\")) {",
    after : "    if (last !== null && (last.kind === \"agent\" || last.kind === \"note\")) {" },
  { file: "Server.ts",
    before: "    const kinds: Kind[] = [\"user\", \"unii\", \"tool\", \"echo\", \"note\"];",
    after : "    const kinds: Kind[] = [\"user\", \"agent\", \"tool\", \"echo\", \"note\"];" },
  { file: "View.ts",
    before: "  const open  = talk && n === 1 && [\"user\", \"unii\"].includes(entry?.kind ?? \"\");",
    after : "  const open  = talk && n === 1 && [\"user\", \"agent\"].includes(entry?.kind ?? \"\");" },
  { file: "cache.test.ts",
    before: "    say(\"unii\", 100, 2500, rand_span(2e3, 9e3));",
    after : "    say(\"agent\", 100, 2500, rand_span(2e3, 9e3));" },
  { file: "failsafe.test.ts",
    before: "const MSGS    = Array.from({ length: COUNT }, (_, k) => ({ kind: \"unii\" as const, text: k + \" \" + \"word \".repeat(200) }));",
    after : "const MSGS    = Array.from({ length: COUNT }, (_, k) => ({ kind: \"agent\" as const, text: k + \" \" + \"word \".repeat(200) }));" },
  { file: "web/app.js",
    before: "  const keep = (m, last) => (want.tools || m.kind === \"user\" || m.kind === \"unii\") && m.date >= want.since && import_new(m, last);",
    after : "  const keep = (m, last) => (want.tools || m.kind === \"user\" || m.kind === \"agent\") && m.date >= want.since && import_new(m, last);" },
  { file: "web/app.js",
    before: "    const kind = role === \"user\" ? \"user\" : role === \"assistant\" ? m.recipient === \"all\" ? \"unii\" : \"tool\" : role === \"tool\" ? \"echo\" : null;",
    after : "    const kind = role === \"user\" ? \"user\" : role === \"assistant\" ? m.recipient === \"all\" ? \"agent\" : \"tool\" : role === \"tool\" ? \"echo\" : null;" },
  { file: "web/app.js",
    before: "    const kind = m.sender === \"human\" ? \"user\" : \"unii\";",
    after : "    const kind = m.sender === \"human\" ? \"user\" : \"agent\";" },
  { file: "web/app.js",
    before: "  return blocks_msgs(j.type === \"user\" ? \"user\" : \"unii\", blocks, date);",
    after : "  return blocks_msgs(j.type === \"user\" ? \"user\" : \"agent\", blocks, date);" },
  { file: "web/app.js",
    before: "      const kind = p.role === \"user\" ? \"user\" : p.role === \"assistant\" ? \"unii\" : null;",
    after : "      const kind = p.role === \"user\" ? \"user\" : p.role === \"assistant\" ? \"agent\" : null;" },
  { file: "web/app.js",
    before: "  const open2 = talk && n === 1 && [\"user\", \"unii\"].includes(entry?.kind ?? \"\");",
    after : "  const open2 = talk && n === 1 && [\"user\", \"agent\"].includes(entry?.kind ?? \"\");" },
  { file: "web/app.js",
    before: "  v.live.push({ kind: \"unii\", text });",
    after : "  v.live.push({ kind: \"agent\", text });" },
  { file: "web/src/main.ts",
    before: "  v.live.push({ kind: \"unii\", text });",
    after : "  v.live.push({ kind: \"agent\", text });" },
  { file: "Theme.ts",
    before: "  unii : { dim: false, it: false },",
    after : "  agent: { dim: false, it: false }," },
  { file: "web/app.js",
    before: "  unii: { dim: false, it: false },",
    after : "  agent: { dim: false, it: false }," },
  { file: "prompt.txt",
    before: "- unii: Unii's replies",
    after : "- agent: Unii's replies" },
  { file: "web/style.css",
    before: ".msg.unii { font: 16px/1.55 var(--sans); }",
    after : ".msg.agent { font: 16px/1.55 var(--sans); }" },
];

// Plan
// ====

// what each entry needs: `todo` is the file's lines with the entries applied
type Plan = { texts: Map<string, string>; todo: Map<string, string[]>; applied: number; skipped: number; failed: string[] };

function plan(): Plan {
  const texts = new Map<string, string>();
  const todo  = new Map<string, string[]>();
  const p: Plan = { texts, todo, applied: 0, skipped: 0, failed: [] };
  for (const entry of TABLE) {
    if (!texts.has(entry.file)) {
      const text = fs.readFileSync(path.join(ROOT, entry.file), "utf8");
      texts.set(entry.file, text);
      todo.set(entry.file, text.split("\n"));
    }
    const lines  = todo.get(entry.file)!;
    const before = lines.filter((line) => line === entry.before).length;
    const after  = lines.filter((line) => line === entry.after).length;
    if (before === 0 && after > 0) {
      p.skipped++;
    } else if (before === 1) {
      lines[lines.indexOf(entry.before)] = entry.after;
      p.applied++;
    } else {
      p.failed.push(entry.file + ": " + (before === 0 ? "the line is not there" : before + " copies of the line") + ": " + entry.before);
    }
  }
  return p;
}

// Type check
// ==========

// the type errors of the code, each as its file and message without the
// line number; null: the checker did not run (packages not installed, say)
function type_errors(): string[] | null {
  let run;
  try {
    run = Bun.spawnSync(["bun", "run", "check", "--noErrorTruncation"], { cwd: ROOT });
  } catch {
    return null;
  }
  const errors: string[] = [];
  for (const line of (run.stdout.toString() + run.stderr.toString()).split("\n")) {
    const m = line.match(/^(.+?)\(\d+,\d+\): (error TS\d+: .*)$/);
    if (m) errors.push(m[1] + ": " + m[2]);
  }
  return run.exitCode === 0 || errors.length > 0 ? errors : null;
}

// the errors in `after` that `before` did not have, counting repeats
function new_errors(before: string[], after: string[]): string[] {
  const left = [...before];
  const added: string[] = [];
  for (const error of after) {
    const at = left.indexOf(error);
    if (at >= 0) left.splice(at, 1);
    else added.push(error);
  }
  return added;
}

// Remaining
// =========

// every "unii" string left in the code, with its file and line
function remaining(): string[] {
  const files = [
    ...fs.readdirSync(ROOT).filter((name) => name.endsWith(".ts")),
    ...fs.readdirSync(path.join(ROOT, "web/src")).map((name) => "web/src/" + name),
    "web/app.js",
  ];
  const found: string[] = [];
  for (const file of files) {
    fs.readFileSync(path.join(ROOT, file), "utf8").split("\n").forEach((line, i) => {
      if (/"unii"|"mcp__unii/.test(line)) found.push(file + ":" + (i + 1) + ": " + line.trim().slice(0, 120));
    });
  }
  return found;
}

// Main
// ====

function main(): number {
  const p = plan();
  if (p.failed.length > 0) {
    console.error("rename-agent-kind: " + p.failed.length + " entries do not match; nothing was written:");
    for (const why of p.failed) console.error("  " + why);
    return 1;
  }

  const before = type_errors();
  for (const [file, lines] of p.todo) {
    const text = lines.join("\n");
    if (text !== p.texts.get(file)) fs.writeFileSync(path.join(ROOT, file), text);
  }
  console.log("rename-agent-kind: " + p.applied + " lines renamed, " + p.skipped + " already renamed");

  let code = 0;
  const after = before === null ? null : type_errors();
  if (before === null || after === null) {
    console.log("type check: did not run (`bun run check` could not run; run `bun install`); check the list below by hand");
  } else {
    const added = new_errors(before, after);
    console.log("type check: " + before.length + " errors before, " + after.length + " after, " + added.length + " new");
    for (const error of added) console.error("  new: " + error);
    if (added.length > 0) code = 1;
  }

  console.log("\"unii\" strings left (the cookie, the MCP server name and the tool prefix are meant to stay):");
  for (const line of remaining()) console.log("  " + line);
  return code;
}

process.exit(main());
