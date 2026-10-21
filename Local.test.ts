// Local mode test
// ===============
// `bun test Local.test.ts`. With `local` set (README), the app's page signs
// in a browser that typed its URL on a loopback Host and no other; with it
// off, the page signs in no one.

import { expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";

// `./Server.ts <port>` on a fresh dir, with `env`, asked for "/" with
// `headers` (then, with the cookie it set, for /api/me and the chat's
// messages): the answers
async function local_get(port: number, env: Record<string, string>, headers: Record<string, string>) {
  const dir = fs.mkdtempSync(os.tmpdir() + "/unii-local-");
  const site = "http://127.0.0.1:" + port;
  const proc = Bun.spawn([process.execPath, import.meta.dir + "/Server.ts", String(port)], {
    env    : { ...process.env, UNII_DIR: dir, UNII_HOME: dir, UNII_SITE: site, ...env },
    stdout : "ignore",
    stderr : "inherit",
  });
  try {
    for (let k = 0; k < 100; k++) {
      const res = await fetch(site + "/", { headers, redirect: "manual" }).catch(() => null);
      if (res !== null) {
        const cookie = res.headers.get("set-cookie")?.split(";")[0] ?? null;
        const me = cookie === null ? null : await fetch(site + "/api/me", { headers: { cookie } });
        const chat = cookie === null ? null : await fetch(site + "/export", { headers: { cookie } }).then((r) => r.json());
        return { status: res.status, cookie, me: me?.status ?? null, messages: chat?.messages ?? [], token: fs.existsSync(dir + "/127.0.0.1:" + port + "/token") };
      }
      await Bun.sleep(50);
    }
    throw new Error("no answer on " + site);
  } finally {
    proc.kill();
    await proc.exited;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const HOST = (port: number) => "127.0.0.1:" + port;

test("local: a typed URL on a loopback Host is signed in as the one user", async () => {
  const got = await local_get(9481, { UNII_LOCAL: "me@localhost" }, { host: HOST(9481), "sec-fetch-site": "none" });
  expect(got.cookie).toStartWith("unii=");
  expect(got.me).toBe(200);
  expect(got.token).toBe(true);
});

// a new chat in local mode holds one plain greeting: no email asked, no
// user line, no SIGNED
test("local: a new chat opens with the one local greeting", async () => {
  const got = await local_get(9490, { UNII_LOCAL: "me@localhost" }, { host: HOST(9490), "sec-fetch-site": "none" });
  expect(got.messages.length).toBe(1);
  expect(got.messages[0].kind).toBe("agent");
  expect(got.messages[0].text).toStartWith("Hello. This is your uniichat, running on this machine.");
  expect(got.messages[0].text).not.toContain("email");
});

// off, a new chat still opens as before: hello asking for the email, the
// email, and SIGNED
const FIRST = `
const { Chat } = await import(${JSON.stringify(import.meta.dir + "/Server.ts")});
const { Cloud } = await import(${JSON.stringify(import.meta.dir + "/Cloud.ts")});
Chat.cloud = Cloud.open(() => {}, () => {}, async () => null);
const chat = Chat.open({ id: "u1", name: "a@b.c" });
console.log(JSON.stringify({ count: chat.mem.count }));
process.exit(0);
`;

test("local off: a new chat still opens with hello, the email and SIGNED", async () => {
  const dir = fs.mkdtempSync(os.tmpdir() + "/unii-local-");
  fs.writeFileSync(dir + "/first.ts", FIRST);
  const env = { ...process.env, UNII_DIR: dir, UNII_LOCAL: "" };
  const proc = Bun.spawn([process.execPath, dir + "/first.ts"], { env, stdout: "pipe", stderr: "inherit" });
  const out = JSON.parse((await new Response(proc.stdout).text()).trim().split("\n").at(-1) ?? "{}");
  expect(out.count).toBe(3);
});

test("local: localhost as the Host is signed in too", async () => {
  const got = await local_get(9482, { UNII_LOCAL: "me@localhost" }, { host: "localhost:9482", "sec-fetch-site": "same-origin" });
  expect(got.cookie).toStartWith("unii=");
});

test("local: a request from another site, or to another Host, is not", async () => {
  for (const [port, headers] of [
    [9483, { host: HOST(9483), "sec-fetch-site": "cross-site" }],
    [9484, { host: HOST(9484), "sec-fetch-site": "same-site" }],
    [9485, { host: HOST(9485) }],
    [9486, { host: "evil.example:9486", "sec-fetch-site": "none" }],
    [9487, { host: "127.0.0.1:1", "sec-fetch-site": "none" }],
  ] as [number, Record<string, string>][]) {
    const got = await local_get(port, { UNII_LOCAL: "me@localhost" }, headers);
    expect(got.cookie).toBeNull();
  }
});

test("local off: nothing signs in", async () => {
  const got = await local_get(9488, {}, { host: HOST(9488), "sec-fetch-site": "none" });
  expect(got.status).toBe(200);
  expect(got.cookie).toBeNull();
  expect(got.token).toBe(false);
});

test("local refuses a site that is not loopback, and workers", async () => {
  const run = (env: Record<string, string>) =>
    Bun.spawnSync([process.execPath, import.meta.dir + "/Server.ts", "9489"], { env: { ...process.env, UNII_DIR: os.tmpdir() + "/unii-local-none", UNII_LOCAL: "me@localhost", ...env }, stdout: "ignore", stderr: "pipe", timeout: 5000 });
  const site = run({ UNII_SITE: "https://example.com" });
  expect(site.exitCode).not.toBe(0);
  expect(site.stderr.toString()).toContain("config: local needs site");
  const workers = run({ UNII_SITE: "http://127.0.0.1:9489", UNII_WORKERS: "2" });
  expect(workers.exitCode).not.toBe(0);
  expect(workers.stderr.toString()).toContain("config: local serves one process");
});
