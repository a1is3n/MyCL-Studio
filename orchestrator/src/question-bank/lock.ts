// İkili Soru Bankası — fail-closed lock + meta-test (Dilim 2).
//
// Bir check bankaya KİLİTLENMEDEN önce "ayırt-edici" olduğu KANITLANMALI:
// bilinen-kötü fixture'da FAIL, bilinen-iyi fixture'da PASS vermeli — N kez
// %100 kararlı. Aksi halde KİLİTLENEMEZ → yargı/insan hattına gider ("unproven
// oracle"). Bu, test-validity.ts'nin "üretemedim → atla" (fail-OPEN) davranışının
// TERSİ: kanıtlayamadığımız check'e GÜVENMEYİZ (müfettiş paneli fatal buldu).
//
// Aynı meta-test LOAD anında da koşar (verifyBankQuestions): kilitli bir check
// artık bilinen-kötü fixture'ında geçiyorsa ROT olmuştur → STALE, yeşil verme.
//
// CmdRunner enjekte edilir (dependency inversion) — saf birim test mümkün.

import { classifyExit } from "./engine.js";
import { cleanupTempDir, makeTempDir, materializeFixture } from "./fixtures.js";
import type { BankQuestion, CheckOutcome, Fixture } from "./types.js";

export interface CmdRunResult {
  code: number;
  stdout?: string;
  stderr?: string;
}

/** Bir komutu verilen cwd'de koşturur. Gerçek exec slice 3'te bağlanır. */
export type CmdRunner = (cmd: string, cwd: string) => Promise<CmdRunResult>;

export interface FixtureMetaResult {
  fixture: string;
  expect: "PASS" | "FAIL";
  /** N kararlılık koşusunun sonucu. */
  outcomes: CheckOutcome[];
  /** Tüm koşular aynı sonucu mu verdi (flaky değil). */
  stable: boolean;
  /** Kararlı VE beklenenle uyuştu (INCONCLUSIVE asla uymaz). */
  matched: boolean;
}

export interface MetaTestResult {
  question_id: string;
  perFixture: FixtureMetaResult[];
  /** Fail-closed lock kararı. */
  lockable: boolean;
  reason: string;
}

const DEFAULT_STABILITY_RUNS = 3;

/** Tek fixture'ı N kez koş, sonucu sınıflandır + beklenenle karşılaştır. */
async function runFixture(
  question: BankQuestion,
  fx: Fixture,
  runner: CmdRunner,
  runs: number,
): Promise<FixtureMetaResult> {
  const outcomes: CheckOutcome[] = [];
  const dir = await makeTempDir();
  try {
    await materializeFixture(dir, fx);
    for (let i = 0; i < runs; i++) {
      let outcome: CheckOutcome;
      try {
        const res = await runner(question.check.cmd, dir);
        outcome = classifyExit(res.code, question.check.inconclusive_codes ?? []);
      } catch {
        outcome = "INCONCLUSIVE"; // runner patladı → değerlendirilemedi
      }
      outcomes.push(outcome);
    }
  } finally {
    await cleanupTempDir(dir).catch(() => {
      /* temizlik best-effort — temp dizini sistemce toplanır */
    });
  }
  const stable = outcomes.every((o) => o === outcomes[0]);
  // PASS-fixture → her koşu PASS; FAIL-fixture → her koşu FAIL. INCONCLUSIVE
  // (araç-yok/crash/flaky) hiçbir zaman "match" etmez → kilitlenemez.
  const matched = stable && outcomes[0] === fx.expect;
  return { fixture: fx.name, expect: fx.expect, outcomes, stable, matched };
}

/**
 * Bir sorunun meta-testini koş. Kilitlenebilmesi için:
 *   - ≥1 bilinen-iyi (PASS) VE ≥1 bilinen-kötü (FAIL) fixture, ve
 *   - HER fixture N kez stabil + beklenenle uyumlu.
 * Hiçbiri sağlanmazsa lockable=false (fail-closed → yargı hattı).
 */
export async function runMetaTest(
  question: BankQuestion,
  runner: CmdRunner,
  opts: { stabilityRuns?: number } = {},
): Promise<MetaTestResult> {
  const runs = opts.stabilityRuns ?? DEFAULT_STABILITY_RUNS;
  const fixtures = question.fixtures ?? [];
  const hasGood = fixtures.some((f) => f.expect === "PASS");
  const hasBad = fixtures.some((f) => f.expect === "FAIL");
  if (!hasGood || !hasBad) {
    return {
      question_id: question.id,
      perFixture: [],
      lockable: false,
      reason:
        "fixtures eksik — kilitlenmek için ≥1 bilinen-iyi (PASS) VE ≥1 bilinen-kötü (FAIL) şart (fail-closed)",
    };
  }
  const perFixture: FixtureMetaResult[] = [];
  for (const fx of fixtures) {
    perFixture.push(await runFixture(question, fx, runner, runs));
  }
  const allMatched = perFixture.every((r) => r.matched);
  return {
    question_id: question.id,
    perFixture,
    lockable: allMatched,
    reason: allMatched
      ? "ayırt-edici kanıtlandı — tüm fixtures stabil ve beklenenle uyuştu"
      : "meta-test başarısız — bir fixture kararsız veya beklenenle uyuşmadı (kilitlenemez → yargı hattı)",
  };
}

export interface BankTrustResult {
  /** Meta-testi geçen, güvenilen sorular. */
  trusted: BankQuestion[];
  /** Meta-testi geçemeyen (kilitlenemez/rotted) sorular — insana gider. */
  stale: { question: BankQuestion; reason: string }[];
  results: MetaTestResult[];
}

/**
 * LOAD anı önkoşulu: bankadaki HER soruyu meta-testten geçir. Geçen → trusted;
 * geçemeyen → stale (yeşil verilmez, insana yükseltilir). "Üret-bir-kez,
 * sonsuza-kullan"ı "sürekli-doğrula, kendini-attest-ettikçe-kullan"a çevirir.
 */
export async function verifyBankQuestions(
  questions: readonly BankQuestion[],
  runner: CmdRunner,
  opts: { stabilityRuns?: number } = {},
): Promise<BankTrustResult> {
  const trusted: BankQuestion[] = [];
  const stale: { question: BankQuestion; reason: string }[] = [];
  const results: MetaTestResult[] = [];
  for (const q of questions) {
    const r = await runMetaTest(q, runner, opts);
    results.push(r);
    if (r.lockable) trusted.push(q);
    else stale.push({ question: q, reason: r.reason });
  }
  return { trusted, stale, results };
}
