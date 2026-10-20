// Claude Code test
// ================
// `bun test ClaudeCode.test.ts`. The claude-code vendor (ClaudeCode.ts),
// reached through AskAI.ask, runs against a fake `claude`
// (fixtures/claude.ts) that prints runs recorded from the real one
// (fixtures/*.jsonl: plain, replay, tool, error; refusal is plain with
// its stop reason changed): a reply's deltas, entries and end, the process without the API key Config removed; a tool's
// call and result, named as the tool itself; a message sent mid-run
// reaches stdin and, replayed, keeps the call open; the failures:
// a stop reason is `fail`, an error, an exit with no result and silence
// are `down`; a stop is `lost` and kills the process; the arguments;
// the process cap.

import { expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";

const DIR = fs.mkdtempSync(os.tmpdir() + "/unii-claude-");

process.env.UNII_DIR = DIR;
process.env.UNII_CLAUDE = import.meta.dir + "/fixtures/claude.ts";
process.env.UNII_CLAUDE_JOBS = "2";
process.env.ANTHROPIC_API_KEY = "sk-test-never-sent";

const { AskAI } = await import("./AskAI.ts");

const ASK = { vendor: "claude-code" as const, model: "claude-haiku-5-5", effort: "high", speed: "slow", system: "You are terse.", searches: 0, server: "", blocks: [{ text: "say hi in three words", mark: true }] };

const real = { setTimeout, error: console.error };

function sleep(ms: number): Promise<void> {
  return new Promise((ok) => real.setTimeout(ok, ms));
}

// runs a call on the fake printing `fixture`, with `env` more; its events,
// its log and its end
async function run(fixture: string, env: Record<string, string> = {}, ask: object = {}) {
  const log = DIR + "/log-" + fixture + ".json";
  Object.assign(process.env, { FAKE_FIXTURE: fixture, FAKE_LOG: log }, env);
  const events: any[] = [];
  const call = AskAI.ask({ ...ASK, ...ask }, (ev) => events.push(ev));
  return { call, events, log: () => JSON.parse(fs.readFileSync(log, "utf8")), end: call.done };
}

test("a reply: its deltas, its entry, its end", async () => {
  const { events, end, log } = await run("plain");
  expect(await end).toMatchObject({ ok: true, text: "Hello there, friend!", left: [] });
  expect(events.filter((ev) => ev.$ === "Delta").map((ev) => [ev.kind, ev.text])).toEqual([["unii", "Hello"], ["unii", " there"], ["unii", ", friend!"]]);
  expect(events.filter((ev) => ev.$ === "Entry")).toEqual([{ $: "Entry", kind: "unii", text: "Hello there, friend!" }]);
  const { args, said } = log();
  expect(log().key).toBeNull();
  expect(args).toContain("--replay-user-messages");
  expect(args.slice(args.indexOf("--tools"), args.indexOf("--tools") + 2)).toEqual(["--tools", ""]);
  expect(args).not.toContain("--mcp-config");
  expect(said[0].message.content).toEqual([{ type: "text", text: "say hi in three words" }]);
});

test("a tool call and its result are logged as the tool itself, and the config is gone after", async () => {
  const { events, end, log } = await run("tool", {}, { server: "http://127.0.0.1:1/key/main" });
  expect(await end).toMatchObject({ ok: true, text: "Green." });
  expect(events.filter((ev) => ev.$ === "Delta" && ev.kind === "tool").map((ev) => ev.text)[0]).toBe("lookup ");
  const tools = events.filter((ev) => ev.$ === "Entry" && (ev.kind === "tool" || ev.kind === "echo"));
  expect(tools).toEqual([
    { $: "Entry", kind: "tool", text: 'lookup {"word":"grass"}', of: "toolu_01FyuMvWQuQS4cUZD87XbwHq" },
    { $: "Entry", kind: "echo", text: "the colour of grass is green", of: "toolu_01FyuMvWQuQS4cUZD87XbwHq" },
  ]);
  const { args, mcp } = log();
  expect(JSON.parse(mcp)).toEqual({ mcpServers: { unii: { type: "http", url: "http://127.0.0.1:1/key/main" } } });
  expect(args).toContain("--strict-mcp-config");
  expect(args[args.indexOf("--allowedTools") + 1]).toBe("mcp__unii");
  expect(fs.readdirSync(DIR).filter((f) => f.startsWith("claude-mcp-"))).toEqual([]);
});

test("web search is allowed when asked", async () => {
  const { end, log } = await run("plain", {}, { searches: 3 });
  await end;
  const { args } = log();
  expect(args[args.indexOf("--tools") + 1]).toBe("WebSearch");
  expect(args[args.indexOf("--allowedTools") + 1]).toBe("WebSearch");
});

test("a message sent mid-run reaches stdin, is logged as the user's, and keeps the call open for its answer", async () => {
  const { call, events, end, log } = await run("replay", { FAKE_FIXTURE: "replay" });
  call.send({ text: "now say done", imgs: [] });
  expect(await end).toMatchObject({ ok: true, text: "done", left: [] });
  expect(log().said.map((m: any) => m.message.content[0].text)).toEqual(["say hi in three words", "now say done"]);
  const texts = events.filter((ev) => ev.$ === "Entry").map((ev) => [ev.kind, ev.text]);
  expect(texts).toEqual([["unii", "1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n13\n14\n15\n16\n17\n18\n19\n20\n21\n22\n23\n24\n25\n26\n27\n28\n29\n30"], ["user", "now say done"], ["unii", "done"]]);
});

test("a message sent after the call closed its input is left", async () => {
  const { call, end } = await run("plain");
  await end;
  call.send({ text: "late", imgs: [] });
  const again = await run("plain");
  again.call.send({ text: "early", imgs: [] });
  await sleep(10);
  expect((await again.end).left.map((s) => s.text)).toEqual(["early"]);
});

test("a stop reason fails the call, an error and an exit with no result are down", async () => {
  console.error = () => {};
  try {
    expect(await (await run("refusal")).end).toMatchObject({ ok: false, stop: "fail", text: "stopped: refusal" });
    const error = await (await run("error")).end;
    expect(error).toMatchObject({ ok: false, stop: "down" });
    expect(error.text).toStartWith("There's an issue with the selected model");
    expect(await (await run("none")).end).toMatchObject({ ok: false, stop: "down", text: "claude ended with no result (exit 1): boom" });
  } finally {
    console.error = real.error;
  }
});

test("a call that is stopped is lost, and its process is killed", async () => {
  const pids = fs.mkdtempSync(DIR + "/pids-");
  const { call, end } = await run("plain", { FAKE_HANG: "1", FAKE_PIDS: pids });
  await sleep(500);
  const [pid] = fs.readdirSync(pids).map(Number);
  expect(pid).toBeGreaterThan(0);
  call.stop();
  expect(await end).toMatchObject({ ok: false, stop: "lost", text: "stopped" });
  await sleep(100);
  expect(() => process.kill(pid, 0)).toThrow();
  delete process.env.FAKE_PIDS;
  delete process.env.FAKE_HANG;
});

test("a silent process is killed and the call is down", async () => {
  const pids = fs.mkdtempSync(DIR + "/pids-");
  console.error = () => {};
  globalThis.setTimeout = ((go: () => void, ms = 0) => real.setTimeout(go, ms / 1000)) as any;
  try {
    const { end } = await run("plain", { FAKE_HANG: "1", FAKE_PIDS: pids });
    const done = await end;
    expect(done).toMatchObject({ ok: false, stop: "down", text: "no word from claude in 300 s" });
    await sleep(100);
    const [pid] = fs.readdirSync(pids).map(Number);
    expect(() => process.kill(pid, 0)).toThrow();
  } finally {
    globalThis.setTimeout = real.setTimeout;
    console.error = real.error;
    delete process.env.FAKE_PIDS;
    delete process.env.FAKE_HANG;
  }
});

test("only CLAUDE_JOBS processes run at once; a call stopped while it waits never starts one", async () => {
  const pids = fs.mkdtempSync(DIR + "/pids-");
  Object.assign(process.env, { FAKE_HANG: "1", FAKE_PIDS: pids });
  const [a, b, c, d] = [1, 2, 3, 4].map(() => run("plain", { FAKE_HANG: "1", FAKE_PIDS: pids }));
  const calls = await Promise.all([a, b, c, d]);
  await sleep(600);
  expect(fs.readdirSync(pids)).toHaveLength(2);
  calls[3].call.stop();
  expect(await calls[3].end).toMatchObject({ stop: "lost" });
  await sleep(100);
  expect(fs.readdirSync(pids)).toHaveLength(2);
  calls[0].call.stop();
  await calls[0].end;
  await sleep(600);
  expect(fs.readdirSync(pids)).toHaveLength(3);
  calls[1].call.stop();
  calls[2].call.stop();
  await Promise.all([calls[1].end, calls[2].end]);
  delete process.env.FAKE_PIDS;
  delete process.env.FAKE_HANG;
});
