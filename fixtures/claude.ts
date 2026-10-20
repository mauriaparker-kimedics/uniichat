#!/usr/bin/env bun
// A fake `claude` for ClaudeCode.test.ts: ignores its arguments but
// records them, then prints the stream-json of a recorded run (its fixture,
// $FAKE_FIXTURE), turn by turn: a turn waits until its message has come
// in on stdin. $FAKE_LOG: where it writes its arguments, whether it has an API key, the system prompt file and MCP config
// they name, and every message read; $FAKE_PIDS: a folder it leaves its
// pid in; $FAKE_HANG: print nothing more and stay; $FAKE_EXIT: its exit code.

import * as fs from "node:fs";
import * as readline from "node:readline";

const env = process.env;
const args = process.argv.slice(2);
const at = args.indexOf("--mcp-config");
const at2 = args.indexOf("--system-prompt-file");
const log: any = { args, prompt: at2 < 0 ? null : fs.readFileSync(args[at2 + 1], "utf8"), mcp: at < 0 ? null : fs.readFileSync(args[at + 1], "utf8"), said: [], key: env.ANTHROPIC_API_KEY ?? null };
const save = () => env.FAKE_LOG && fs.writeFileSync(env.FAKE_LOG, JSON.stringify(log));
save();
if (env.FAKE_PIDS) {
  fs.writeFileSync(env.FAKE_PIDS + "/" + process.pid, "");
}

const lines = fs.existsSync(import.meta.dir + "/" + env.FAKE_FIXTURE + ".jsonl") ? fs.readFileSync(import.meta.dir + "/" + env.FAKE_FIXTURE + ".jsonl", "utf8").trim().split("\n") : [];
const turns: string[][] = [[]];
for (const line of lines) {
  turns[turns.length - 1].push(line);
  if (JSON.parse(line).type === "result") {
    turns.push([]);
  }
}
if (turns[turns.length - 1].length === 0) {
  turns.pop();
}

const read = readline.createInterface({ input: process.stdin });
let came = 0;
let wake = () => {};
read.on("line", (line) => {
  log.said.push(JSON.parse(line));
  save();
  came += 1;
  wake();
});

if (env.FAKE_HANG) {
  console.log(lines[0]);
  await new Promise(() => {});
}
for (const [k, turn] of turns.entries()) {
  while (came < k + 1) {
    await new Promise<void>((ok) => (wake = ok));
  }
  console.log(turn.join("\n"));
}
if (turns.length === 0) {
  console.error("boom");
}
process.exit(Number(env.FAKE_EXIT ?? (turns.length === 0 ? 1 : 0)));
