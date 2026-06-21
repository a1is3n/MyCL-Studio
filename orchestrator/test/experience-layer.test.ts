// experience-layer — ders deposu (AŞAMA 3 temeli). MYCL_HOME izole (gerçek ~/.mycl kirlenmez).
// İlkeler: ders=iddia (recall öneri, auto-uygula yok), geri-alınabilir (retracted hariç), verified önce.

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  normalizeSignature,
  signatureOverlap,
  recordLesson,
  recallLessons,
  retractLesson,
  type Lesson,
} from "../src/experience-layer.js";

const L = (over: Partial<Lesson>): Lesson => ({
  signature: "sig",
  problem: "p",
  resolution: "r",
  principle: "pr",
  verified: false,
  ts: 1,
  ...over,
});

describe("experience-layer · saf imza fonksiyonları", () => {
  it("normalizeSignature: küçük harf + noktalama→boşluk", () => {
    expect(normalizeSignature("ts-prune: Next.js Export!")).toBe("ts prune next js export");
  });
  it("signatureOverlap: ortak kelime oranı", () => {
    expect(signatureOverlap("ts-prune next export", "ts-prune next false-positive")).toBeGreaterThan(0.4);
    expect(signatureOverlap("ts-prune next", "tamamen alakasız konu başka")).toBe(0);
  });
});

describe("experience-layer · depo (MYCL_HOME izole)", () => {
  let home: string;
  const orig = process.env.MYCL_HOME;
  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "mycl-lessons-"));
    process.env.MYCL_HOME = home;
  });
  afterEach(async () => {
    if (orig === undefined) delete process.env.MYCL_HOME;
    else process.env.MYCL_HOME = orig;
    await rm(home, { recursive: true, force: true }).catch(() => {});
  });

  it("record + recall round-trip (benzer imza)", async () => {
    await recordLesson(L({ signature: "ts-prune Next framework-export false-positive", principle: "CLI -i" }));
    const hits = await recallLessons("ts-prune Next export flag");
    expect(hits.length).toBe(1);
    expect(hits[0].principle).toBe("CLI -i");
  });

  it("dedup: aynı imza → GÜNCELLER (çift kayıt değil)", async () => {
    await recordLesson(L({ signature: "i18n password label", verified: false }));
    await recordLesson(L({ signature: "i18n password label", verified: true, principle: "scanner i18n-skip" }));
    const hits = await recallLessons("i18n password label");
    expect(hits.length).toBe(1);
    expect(hits[0].verified).toBe(true);
  });

  it("retracted ders → recall'da YOK (zehirlenme önleme)", async () => {
    await recordLesson(L({ signature: "yanlış ders konu" }));
    expect((await recallLessons("yanlış ders konu")).length).toBe(1);
    expect(await retractLesson("yanlış ders konu")).toBe(true);
    expect((await recallLessons("yanlış ders konu")).length).toBe(0);
  });

  it("verified ders öncelikli sıralanır", async () => {
    await recordLesson(L({ signature: "konu A weak", verified: false }));
    await recordLesson(L({ signature: "konu A strong", verified: true }));
    const hits = await recallLessons("konu A", { minOverlap: 0.3 });
    expect(hits[0].verified).toBe(true); // verified önce
  });

  it("alakasız imza → recall boş (yanlış-uygulama önleme)", async () => {
    await recordLesson(L({ signature: "ts-prune next export" }));
    expect((await recallLessons("tamamen başka bir güvenlik konusu")).length).toBe(0);
  });
});
