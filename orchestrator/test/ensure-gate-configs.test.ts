import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, readFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureTsPruneConfig } from "../src/ensure-gate-configs.js";

describe("ensure-gate-configs · ensureTsPruneConfig (Faz 11 ts-prune Next.js-aware)", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "ensure-tsprune-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("Next.js projesi + config yok → .ts-prunerc.json yazılır (framework-convention ignore)", async () => {
    await writeFile(join(dir, "package.json"), JSON.stringify({ dependencies: { next: "15.0.0", react: "19" } }));
    const res = await ensureTsPruneConfig(dir);
    expect(res).toBe("written");
    const cfg = JSON.parse(await readFile(join(dir, ".ts-prunerc.json"), "utf-8"));
    expect(typeof cfg.ignore).toBe("string");
    // app router convention + pages router + middleware/next.config ignore edilmeli
    expect(cfg.ignore).toContain("page");
    expect(cfg.ignore).toContain("layout");
    expect(cfg.ignore).toContain("route");
    expect(cfg.ignore).toContain("pages/");
    expect(cfg.ignore).toContain("middleware");
    expect(cfg.ignore).toContain("config\\."); // tool config (next/vite/vitest/playwright...) ignore
    // ignore desenleri GERÇEK Next.js convention yollarıyla eşleşmeli (regex doğrulaması)
    const re = new RegExp(cfg.ignore);
    expect(re.test("app/dashboard/page.tsx")).toBe(true);
    expect(re.test("src/app/(admin)/layout.tsx")).toBe(true);
    expect(re.test("app/api/users/route.ts")).toBe(true);
    expect(re.test("pages/index.tsx")).toBe(true);
    expect(re.test("middleware.ts")).toBe(true);
    expect(re.test("next.config.mjs")).toBe(true);
    expect(re.test("vitest.config.ts")).toBe(true); // tool-config (Vestel'de yakalanmıştı)
    // GERÇEK bileşen dosyası muaf DEĞİL (ölü export yine yakalanır)
    expect(re.test("components/Button.tsx")).toBe(false);
    expect(re.test("lib/utils.ts")).toBe(false);
  });

  it("mevcut .ts-prunerc.json → DOKUNMA (present)", async () => {
    await writeFile(join(dir, "package.json"), JSON.stringify({ dependencies: { next: "15.0.0" } }));
    await writeFile(join(dir, ".ts-prunerc.json"), '{"ignore":"custom"}');
    const res = await ensureTsPruneConfig(dir);
    expect(res).toBe("present");
    const cfg = JSON.parse(await readFile(join(dir, ".ts-prunerc.json"), "utf-8"));
    expect(cfg.ignore).toBe("custom"); // kullanıcının config'i korundu
  });

  it("Next.js DEĞİL → no-op (not-next, dosya yazılmaz)", async () => {
    await writeFile(join(dir, "package.json"), JSON.stringify({ dependencies: { vite: "5", react: "19" } }));
    const res = await ensureTsPruneConfig(dir);
    expect(res).toBe("not-next");
    const written = await access(join(dir, ".ts-prunerc.json")).then(() => true).catch(() => false);
    expect(written).toBe(false);
  });

  it("package.json yok → not-next (fail-soft)", async () => {
    const res = await ensureTsPruneConfig(dir);
    expect(res).toBe("not-next");
  });
});
