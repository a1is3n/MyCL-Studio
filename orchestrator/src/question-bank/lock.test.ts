import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { runMetaTest, verifyBankQuestions, type CmdRunner } from "./lock.js";
import type { BankQuestion, Fixture } from "./types.js";

// marker.txt içeriğine göre code döndüren gerçekçi fake runner — fixture'ın
// temp dizine GERÇEKTEN yazıldığını da doğrular (dosya yoksa patlar).
const markerRunner: CmdRunner = async (_cmd, cwd) => {
  const marker = (await readFile(join(cwd, "marker.txt"), "utf-8")).trim();
  return { code: marker === "good" ? 0 : 1 };
};

function q(fixtures: Fixture[], overrides: Partial<BankQuestion> = {}): BankQuestion {
  return {
    id: "q1",
    text: "X doğru mu?",
    check: { cmd: "check.sh" },
    blocking_class: "blocking",
    real_to_proxy: "gerçek → proxy",
    fixtures,
    ...overrides,
  };
}

const good: Fixture = { name: "iyi", files: { "marker.txt": "good" }, expect: "PASS" };
const bad: Fixture = { name: "kötü", files: { "marker.txt": "bad" }, expect: "FAIL" };

describe("runMetaTest — fail-closed lock", () => {
  it("bilinen-iyi PASS + bilinen-kötü FAIL ayırt ediyorsa → lockable", async () => {
    const r = await runMetaTest(q([good, bad]), markerRunner, { stabilityRuns: 3 });
    expect(r.lockable).toBe(true);
    expect(r.perFixture.every((p) => p.matched && p.stable)).toBe(true);
  });

  it("yalnız bilinen-iyi (kötü fixture yok) → kilitlenemez", async () => {
    const r = await runMetaTest(q([good]), markerRunner);
    expect(r.lockable).toBe(false);
    expect(r.reason).toMatch(/fixtures eksik/);
  });

  it("her zaman 0 dönen sahte-yeşil check → kötü fixture FAIL beklenirken PASS → kilitlenemez", async () => {
    const always0: CmdRunner = async () => ({ code: 0 });
    const r = await runMetaTest(q([good, bad]), always0);
    expect(r.lockable).toBe(false);
    const badRes = r.perFixture.find((p) => p.fixture === "kötü")!;
    expect(badRes.matched).toBe(false);
  });

  it("araç yok (exit 127) → INCONCLUSIVE, asla match → kilitlenemez", async () => {
    const missing: CmdRunner = async () => ({ code: 127 });
    const r = await runMetaTest(q([good, bad]), missing);
    expect(r.lockable).toBe(false);
    expect(r.perFixture.every((p) => p.outcomes.every((o) => o === "INCONCLUSIVE"))).toBe(true);
  });

  it("flaky check (koşular arası değişen exit) → kararsız → kilitlenemez", async () => {
    let n = 0;
    const flaky: CmdRunner = async () => ({ code: n++ % 2 });
    const r = await runMetaTest(q([good, bad]), flaky, { stabilityRuns: 3 });
    expect(r.lockable).toBe(false);
    expect(r.perFixture.some((p) => !p.stable)).toBe(true);
  });
});

describe("verifyBankQuestions — load-anı önkoşulu", () => {
  it("güvenilen ve stale ayrışır (kanıtlanan trusted, kanıtlanamayan insana)", async () => {
    const trustedQ = q([good, bad], { id: "ok" });
    const staleQ = q([good], { id: "eksik" });
    const res = await verifyBankQuestions([trustedQ, staleQ], markerRunner);
    expect(res.trusted.map((t) => t.id)).toEqual(["ok"]);
    expect(res.stale.map((s) => s.question.id)).toEqual(["eksik"]);
    expect(res.results).toHaveLength(2);
  });
});
