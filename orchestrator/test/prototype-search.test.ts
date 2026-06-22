// searchPrototypeModules — çapraz-prototip modül araması. MYCL_PROTOTYPES_DIR ile izole (gerçek prototypes/ kirletilmez).
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { searchPrototypeModules } from "../src/prototype-cache.js";

describe("searchPrototypeModules (çapraz-prototip modül araması)", () => {
  let dir: string; let prev: string | undefined;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "proto-search-"));
    prev = process.env.MYCL_PROTOTYPES_DIR;
    process.env.MYCL_PROTOTYPES_DIR = dir;
    await writeFile(join(dir, "node-npm_react_next.meta.json"), JSON.stringify({
      stack: "node-npm_react_next", createdAt: 0, nodeVersion: "x", fileCount: 10, full: true,
      modules: [{ name: "login sayfası", path: "app/login/page.js", kind: "page" }, { name: "urunler sayfası", path: "app/urunler/page.js", kind: "page" }],
    }));
    await writeFile(join(dir, "python-pip_django.meta.json"), JSON.stringify({
      stack: "python-pip_django", createdAt: 0, nodeVersion: "x", fileCount: 5, full: true,
      modules: [{ name: "login API", path: "api/login.py", kind: "api" }],
    }));
  });
  afterEach(async () => {
    if (prev === undefined) delete process.env.MYCL_PROTOTYPES_DIR; else process.env.MYCL_PROTOTYPES_DIR = prev;
    await rm(dir, { recursive: true, force: true });
  });

  it("query boş → TÜM prototiplerin tüm modülleri (stack ile)", async () => {
    const r = await searchPrototypeModules("");
    expect(r.length).toBe(3);
    expect(r.some((m) => m.name === "login sayfası" && m.stack === "node-npm_react_next")).toBe(true);
    expect(r.some((m) => m.name === "login API" && m.stack === "python-pip_django")).toBe(true);
  });

  it("query 'login' → İKİ prototipten de login (çapraz bulur)", async () => {
    const r = await searchPrototypeModules("kullanıcı login ekranı lazım");
    expect(r.length).toBe(2);
    expect(r.every((m) => m.name.toLowerCase().includes("login"))).toBe(true);
  });

  it("query 'urunler' → yalnız o sayfa", async () => {
    const r = await searchPrototypeModules("urunler listesi sayfası");
    expect(r.length).toBe(1);
    expect(r[0].name).toBe("urunler sayfası");
  });

  it("eşleşme yok → boş", async () => {
    expect((await searchPrototypeModules("blockchain nft")).length).toBe(0);
  });
});
