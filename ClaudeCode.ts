// ClaudeCode
// ==========
// claude-code: a call run by Claude Code (`claude -p`, the user's own
// login and plan) in place of an API in our loop (Agent.ts). One process
// per call: the call's message goes in as stream-json, and its stdout is
// read as Claude Code's stream-json, whose stream events are the Messages
// API's own, so Anthropic.live and Anthropic.entries read them as they do
// the API's (Claude Code names the tools of an MCP server "mcp__unii__*":
// that prefix goes, so a tool is logged under its own name). Its own
// tools are off: the agent's are ours, at `ask.server`; and web search,
// if asked. No user or project settings, hooks or sessions are loaded. The
// system prompt and the MCP config go in files of the call's own (mode
// 0600, in Config's DIR), removed when the call ends, however it ends: a
// prompt as an argument is cut at 128 KB on Linux.
//
// What it leaves out, as each has nothing to act on: the payer (a call
// is billed to the user's own plan, so a server that sells credits does
// not offer claude-code), single flight (Claude Code places its own cache
// marks), and `yields` (the process cap shares Claude Code among calls).
// A call waits for one of CLAUDE_JOBS processes, as each is far heavier
// than a request.
//
// send() writes the message to the process at once; Claude Code replays
// each message it takes, which tells a taken one from one still queued. A
// turn ends when its result does, unless a message is queued: then Claude
// Code answers it too. A result ends the call as Anthropic.step ends a
// step: answered, or `fail` (a stop reason, a turn limit: asked again it
// fails alike), or `down` (an error, an exit with no result, silence for
// 5 minutes, which kills the process). A message sent after the call
// closed its input, or written and never taken, is in `left`.

import * as fs from "node:fs";
import { AskAI, type Ask, type End, type Event, type Img, type Say, type Try } from "./AskAI.ts";
import { Anthropic } from "./Anthropic.ts";
import * as config from "./Config.ts";

// Types
// =====

// a running call: `held` sent before its process began, `pending` written
// and not yet taken, `left` sent after its input closed
type Run = {
  ask     : Ask;
  on      : (ev: Event) => void;
  proc    : Bun.Subprocess<"pipe", "pipe", "pipe"> | null;
  open    : boolean;
  shut    : boolean;
  held    : Say[];
  pending : Say[];
  left    : Say[];
  begun   : boolean;
  abort   : AbortController;
  end     : End;
};

// Constants
// =========

// Claude Code's name of an MCP server's tool: this prefix, then its own
const PREFIX = "mcp__unii__";

// how long a process may be silent (Anthropic.ts: the API pings while a
// model thinks, so 5 silent minutes mean it is dead), and how long it has
// to exit once its input is closed, in ms
const IDLE  = 300e3;
const GRACE = 5e3;

// the most of Claude Code's own message a failure says
const CLIP = 300;

// the processes running, and the calls waiting for one to end
const RUNNING = { n: 0 };
const WAITING: Array<() => void> = [];

// ClaudeCode
// ==========

export namespace ClaudeCode {

  export function ask(ask: Ask, on: (ev: Event) => void): Try {
    const end = AskAI.end("");
    const run: Run = { ask, on, proc: null, open: false, shut: false, held: [], pending: [], left: [], begun: false, abort: new AbortController(), end };
    const send = (say: Say) => ClaudeCode.send(run, say);
    const stop = () => {
      end.text = "stopped";
      run.abort.abort();
      run.proc?.kill();
    };
    const done = (async () => {
      try {
        if (await ClaudeCode.slot(run.abort.signal)) {
          try {
            await ClaudeCode.drive(run);
          } finally {
            ClaudeCode.free();
          }
        }
      } catch (err: any) {
        end.text ||= err.message;
      }
      if (run.abort.signal.aborted) {
        end.ok   = false;
        end.stop = "lost";
      }
      end.left = [...run.pending, ...run.held, ...run.left];
      return end;
    })();
    return { send, stop, done };
  }

  // a message sent to the call: written to its process if its input is
  // open, held till then if its process has not begun, else left
  export function send(run: Run, say: Say): void {
    if (run.shut) {
      run.left.push(say);
    } else if (!run.open) {
      run.held.push(say);
    } else if (ClaudeCode.put(run, say)) {
      run.pending.push(say);
    } else {
      run.left.push(say);
    }
  }

  // a message written to the process; false: it could not be
  export function put(run: Run, say: Say): boolean {
    const texts = say.text === "" ? [] : [{ type: "text", text: say.text }];
    return ClaudeCode.write(run, ClaudeCode.user(texts, say.imgs));
  }

  // a user message of stream-json input
  export function user(texts: object[], imgs: Img[]): object {
    const pics = imgs.map((img) => ({ type: "image", source: { type: "base64", media_type: img.type, data: img.data } }));
    return { type: "user", message: { role: "user", content: [...texts, ...pics] } };
  }

  export function write(run: Run, msg: object): boolean {
    try {
      run.proc!.stdin.write(JSON.stringify(msg) + "\n");
      Promise.resolve(run.proc!.stdin.flush()).catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  // the call's input is closed: Claude Code ends once it is answered
  export function close(run: Run): void {
    run.shut = true;
    run.open = false;
    try {
      Promise.resolve(run.proc?.stdin.end()).catch(() => {});
    } catch {}
  }

  // the arguments of its process: Claude Code on the call's model, with no
  // settings, sessions or tools of its own but those asked
  export function args(ask: Ask, prompt: string, mcp: string | null): string[] {
    const allow = [...(mcp ? ["mcp__unii"] : []), ...(ask.searches > 0 ? ["WebSearch"] : [])];
    return [
      "-p",
      "--input-format", "stream-json",
      "--output-format", "stream-json",
      "--include-partial-messages",
      "--verbose",
      "--replay-user-messages",
      "--no-session-persistence",
      "--setting-sources", "",
      "--model", ask.model,
      "--effort", ask.effort,
      "--system-prompt-file", prompt,
      "--tools", ask.searches > 0 ? "WebSearch" : "",
      ...(mcp ? ["--mcp-config", mcp, "--strict-mcp-config"] : []),
      ...(allow.length > 0 ? ["--allowedTools", allow.join(",")] : []),
    ];
  }

  // a call's process, its message in and its events out, to its end
  export async function drive(run: Run): Promise<void> {
    const { ask, end } = run;
    const signal = run.abort.signal;
    if (signal.aborted) {
      return;
    }
    fs.mkdirSync(config.DIR, { recursive: true });
    const files: string[] = [];
    // `env` is given, as Bun's default is the one the process started with,
    // which still holds the API keys Config removed (Claude Code would bill
    // the API with one, not the user's plan)
    let timer: Timer | undefined;
    let kill: Timer | undefined;
    try {
      const prompt = ClaudeCode.file(files, "prompt", ask.system);
      const mcp = ask.server === "" ? null : ClaudeCode.file(files, "mcp", JSON.stringify({ mcpServers: { unii: { type: "http", url: ask.server } } }));
      const proc = Bun.spawn([config.CLAUDE, ...ClaudeCode.args(ask, prompt, mcp)], { cwd: config.DIR, env: process.env, stdin: "pipe", stdout: "pipe", stderr: "pipe" });
      run.proc = proc;
      const errs = new Response(proc.stderr).text();
      if (signal.aborted) {
        proc.kill();
      }
      const texts = ask.blocks.filter((b) => b.text !== "").map((b) => ({ type: "text", text: b.text }));
      ClaudeCode.write(run, ClaudeCode.user(texts, ask.imgs ?? []));
      run.open = true;
      run.held.splice(0).forEach((say) => ClaudeCode.send(run, say));

      let idle = false;
      const bump = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          idle = true;
          proc.kill();
        }, IDLE);
      };
      bump();
      for await (const line of AskAI.lines(proc.stdout)) {
        bump();
        if (ClaudeCode.read(run, ClaudeCode.parse(line))) {
          break;
        }
      }
      clearTimeout(timer);
      ClaudeCode.close(run);
      kill = setTimeout(() => proc.kill(), GRACE);
      const code = await proc.exited;
      if (!end.ok && end.stop === undefined && !signal.aborted) {
        end.stop = "down";
        end.text = idle ? "no word from claude in " + IDLE / 1e3 + " s" : ("claude ended with no result (exit " + code + "): " + (await errs)).trim().slice(0, CLIP);
        console.error(ask.model + ": " + end.text);
      }
    } finally {
      clearTimeout(timer);
      clearTimeout(kill);
      run.proc?.kill();
      files.forEach((file) => fs.rmSync(file, { force: true }));
    }
  }

  // a file of the call's own (its system prompt, its MCP config: the
  // endpoint's key is in it), private to the user, listed in `files` to be
  // removed when the call ends
  export function file(files: string[], name: string, text: string): string {
    const path = config.DIR + "/claude-" + name + "-" + crypto.randomUUID();
    files.push(path);
    fs.writeFileSync(path, text, { mode: 0o600 });
    return path;
  }

  export function parse(line: string): any {
    try {
      return JSON.parse(line);
    } catch {
      return {};
    }
  }

  // one event of Claude Code's output; true: the call is over
  export function read(run: Run, ev: any): boolean {
    const { on } = run;
    switch (ev.type) {
      case "stream_event": {
        if (!ev.parent_tool_use_id) {
          Anthropic.live(ClaudeCode.plain(ev.event), (kind, text, fresh) => on({ $: "Delta", kind, text, fresh }));
        }
        return false;
      }
      case "assistant": {
        if (!ev.parent_tool_use_id) {
          const out = (ev.message?.content ?? []).map(ClaudeCode.named);
          Anthropic.entries(out).forEach((entry) => on({ $: "Entry", ...entry }));
        }
        return false;
      }
      case "user": {
        ClaudeCode.took(run, ev.message?.content);
        return false;
      }
      case "result": {
        return ClaudeCode.result(run, ev);
      }
    }
    return false;
  }

  // a stream event with its tool's own name
  export function plain(ev: any): any {
    const block = ev?.content_block;
    return block?.name === undefined ? ev : { ...ev, content_block: ClaudeCode.named(block) };
  }

  // a content block with its tool's own name
  export function named(block: any): any {
    const name = block.name;
    return typeof name === "string" && name.startsWith(PREFIX) ? { ...block, name: name.slice(PREFIX.length) } : block;
  }

  // a user message: tool results (echoes), or one of ours taken (replayed)
  export function took(run: Run, content: any): void {
    const parts: any[] = Array.isArray(content) ? content : [];
    const backs = parts.filter((p) => p.type === "tool_result");
    for (const back of backs) {
      const text = (back.is_error ? "error: " : "") + AskAI.show(back.content);
      run.on({ $: "Entry", kind: "echo", text, of: back.tool_use_id });
    }
    if (backs.length > 0) {
      return;
    }
    if (!run.begun) {
      run.begun = true;
      return;
    }
    const text = typeof content === "string" ? content : parts.filter((p) => p.type === "text").map((p) => p.text).join("\n\n");
    run.on({ $: "Entry", kind: "user", text: run.pending.shift()?.text ?? text });
  }

  // a turn's result: the call goes on while a message is queued, else ends
  export function result(run: Run, ev: any): boolean {
    const { end } = run;
    const why = ClaudeCode.why(ev);
    if (why !== null) {
      end.text = why.text;
      end.stop = why.stop;
      console.error(run.ask.model + ": " + end.text);
      return true;
    }
    end.text = String(ev.result ?? "");
    if (ev.queued_turn_count > 0 || run.pending.length > 0) {
      return false;
    }
    end.ok = true;
    return true;
  }

  // how a result failed, as Anthropic.step reads a stop; null: it did not.
  // An error (an API's, as for a model that is not there) says "success"
  // with is_error, and its stop_reason is not the model's
  export function why(ev: any): { stop: "fail" | "down"; text: string } | null {
    const said = String(ev.result ?? "").slice(0, CLIP);
    if (ev.subtype === "error_max_turns") {
      return { stop: "fail", text: "stopped: " + ev.subtype };
    }
    if (ev.is_error || (typeof ev.subtype === "string" && ev.subtype.startsWith("error"))) {
      return { stop: "down", text: said || String(ev.subtype) };
    }
    if (ev.stop_reason !== "end_turn") {
      return { stop: "fail", text: "stopped: " + ev.stop_reason };
    }
    return null;
  }

  // Process cap
  // -----------

  // waits for one of CLAUDE_JOBS processes; false: stopped while it waited
  export function slot(signal: AbortSignal): Promise<boolean> {
    if (RUNNING.n < config.CLAUDE_JOBS) {
      RUNNING.n += 1;
      return Promise.resolve(true);
    }
    const { promise, resolve } = Promise.withResolvers<boolean>();
    const go = () => resolve(true);
    WAITING.push(go);
    signal.addEventListener("abort", () => {
      const at = WAITING.indexOf(go);
      if (at >= 0) {
        WAITING.splice(at, 1);
        resolve(false);
      }
    }, { once: true });
    return promise;
  }

  // its process ended: the next call waiting has its place
  export function free(): void {
    const next = WAITING.shift();
    if (next === undefined) {
      RUNNING.n -= 1;
    } else {
      next();
    }
  }

}
