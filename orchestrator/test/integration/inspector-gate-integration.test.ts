// ENTEGRASYON (taklit/mock): gate-bulgusu incelemesi UÇTAN UCA — inspectGateFinding → runInspectorCheckpoint
// → runInspectorPass → runInspectorTurn (SDK kolu) → mahkemeRuling. Mevcut testler mahkemeRuling'i SAF test
// ediyordu; bu test asıl ASENKRON ZİNCİRİ sabitler (wiring fix'lerden ÖNCE — TDD güvenlik ağı; aşama 2-4
// bir şey bozarsa burası yakalar).
//
// İZOLASYON (YZLLM "sahte cevaplar sistemde kalmasın, iyi temizle"): (1) yalnız claude-api.runTurn taklit
// edilir, GERÇEK API/CLI çağrısı YOK; (2) MYCL_HOME geçici dizine alınır → recallLessons gerçek lessons.jsonl'a
// DOKUNMAZ, hiçbir gerçek veri okunmaz/yazılmaz; (3) test bittiğinde geçici dizin silinir, iz kalmaz.

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// runTurn'ü taklit et — diğer tüm gerçek dışa-aktarımlar korunur (importOriginal). inspector SDK döngüsü
// runTurn çağırır; bunu sabit bir verdict'e bağlarsak GERÇEK çağrı olmaz, sonuç her seferinde aynı.
const runTurnMock = vi.fn();
vi.mock("../../src/claude-api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/claude-api.js")>();
  return { ...actual, runTurn: (...a: unknown[]) => runTurnMock(...a) };
});

import { inspectGateFinding, mahkemeRuling } from "../../src/inspector.js";
import type { MyclConfig } from "../../src/config.js";

// API-modu + Claude anahtarı → inspectorClaudeEnv ANTHROPIC_API_KEY döndürür → runInspectorTurn SDK koluna
// girer (CLI/claude binary'ye DÜŞMEZ). Böylece gerçek komut spawn edilmez; runTurnMock devreye girer.
const cfg = {
  agent_backends: { main: "api" },
  api_keys: { main: "test-key", translator: "t" },
} as unknown as MyclConfig;

/** Müfettişin verdiği sabit (sahte) verdict metni — JSON bloğu, araç-kullanımı YOK (model durdu). */
const verdictTurn = (stance: "agree" | "flag" | "escalate") => ({
  assistantContent: `\`\`\`json\n{"stance":"${stance}","reason":"sabit-test gerekçesi","evidence":"dosyaları okudum"}\n\`\`\``,
  toolUses: [],
  stop_reason: "end_turn",
});

let myclHome: string;
let prevHome: string | undefined;

beforeAll(async () => {
  // Global dizini geçici klasöre al → gerçek ~/.mycl/lessons.jsonl'a DOKUNMA (izolasyon).
  prevHome = process.env.MYCL_HOME;
  myclHome = await mkdtemp(join(tmpdir(), "mycl-inspect-it-"));
  process.env.MYCL_HOME = myclHome;
});

afterAll(async () => {
  // İz bırakma: env eski haline, geçici dizin silinir.
  if (prevHome === undefined) delete process.env.MYCL_HOME;
  else process.env.MYCL_HOME = prevHome;
  await rm(myclHome, { recursive: true, force: true });
});

beforeEach(() => {
  runTurnMock.mockReset();
});

describe("entegrasyon · inspectGateFinding → mahkemeRuling (taklit runTurn, SDK kolu, izole)", () => {
  it("flag yolu + müfettiş AGREE → mahkeme PROCEED (zincir uçtan uca; gerçek çağrı yok)", async () => {
    runTurnMock.mockResolvedValue(verdictTurn("agree"));
    const cp = await inspectGateFinding(cfg, { projectRoot: myclHome, gateLabel: "lint", errors: "'x' kullanılmıyor" });
    // SDK koluna girildi (CLI değil) → runTurn taklidi çağrıldı, gerçek API/CLI yok.
    expect(runTurnMock).toHaveBeenCalled();
    const ruling = mahkemeRuling(cp);
    expect(ruling.action).toBe("proceed");
    expect(ruling.convened).toBe(true);
  });

  it("flag yolu + müfettiş FLAG → mahkeme ESCALATE (tartışmasız SUPPRESS YOK — güvenli eşleme)", async () => {
    runTurnMock.mockResolvedValue(verdictTurn("flag"));
    const cp = await inspectGateFinding(cfg, { projectRoot: myclHome, gateLabel: "lint", errors: "'x' kullanılmıyor" });
    expect(runTurnMock).toHaveBeenCalled();
    expect(mahkemeRuling(cp).action).toBe("escalate");
  });

  it("müfettiş üretemezse (runTurn hata atar) → mahkeme ESCALATE (fail-closed, sessiz-AGREE YOK)", async () => {
    runTurnMock.mockRejectedValue(new Error("api erişilemez"));
    const cp = await inspectGateFinding(cfg, { projectRoot: myclHome, gateLabel: "lint", errors: "'x' kullanılmıyor" });
    expect(runTurnMock).toHaveBeenCalled();
    expect(mahkemeRuling(cp).action).toBe("escalate");
  });
});
