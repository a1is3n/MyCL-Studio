// inspector-trigger — MÜDAHALE-SEÇİMİ ("müfettiş ne zaman konuşmalı / susmalı").
//
// YZLLM'in vurgusu: "müfettişin konuşması gereken yerleri iyi tespit etmek lazım... LLM'lerin
// zorlandığı bir konu... ince bir sistem gerekebilir." Çözüm: "konuşayım mı"yı YALNIZ LLM
// yargısına bırakma — SAF, deterministik bir iskeleyle sar:
//   1. MEKANİK TABAN — takılma/döngü/yüksek-risk/ilerleme-yok'ta yargı YOK, HER ZAMAN müdahale.
//   2. ASİMETRİK EŞİK — yüksek-riskte düşük eşik (yanlış-alarm ucuz, kaçırmak pahalı);
//      düşük-riskte yüksek eşik (dırdır yok).
//   3. KADEMELİ — "none" (sus) / "flag" (kısa bayrak, ucuz) / "debate" (tam tartışma).
// (4. Tecrübeyle kalibrasyon — eşikler zamanla daralır; AŞAMA 3, tecrübe katmanı.)
//
// SAF + test-edilebilir. Sinyalleri caller toplar (mekanik = audit/state'ten; yumuşak =
// heuristik/LLM). Bu modül yalnız KARARI verir.

export interface InterventionSignals {
  // ── Mekanik (yargı gerektirmez; audit/state'ten) ──
  /** İlerleme yok (N süre yeni dosya/komut yok). */
  isStuck: boolean;
  /** Döngü (tekrar eden faz-geçişi, ör. Faz N↔0). */
  isLoop: boolean;
  /** Gate bulgusu sayısı denemeler boyunca DÜŞMÜYOR. */
  noProgress: boolean;
  /** Geri-alınamaz/yüksek-risk eylem eşiğinde (sil/commit/ikili-doğruluk/güvenlik). */
  highStakesAction: boolean;
  // ── Yumuşak (heuristik/LLM; opsiyonel) ──
  /** Niyetten sapma şüphesi (geniş-açı sinyali). */
  driftSuspected?: boolean;
  /** Bir gate-bulgusu "düzeltilmek" üzere → false-positive riski (Faz 8/11 stall sınıfı). */
  isGateFix?: boolean;
  /** Tecrübe katmanında görülmemiş (yeni → belirsizlik yüksek). */
  isNovel?: boolean;
  /** Konunun ciddiyeti — asimetrik eşiği sürer. */
  severity?: "low" | "medium" | "high";
}

export type InterventionLevel = "none" | "flag" | "debate";

export interface InterventionDecision {
  level: InterventionLevel;
  reason: string;
}

/**
 * Müfettiş müdahale-seviyesini SAF olarak belirler. LLM tek başına "konuşayım mı"yı çözmez —
 * mekanik taban + asimetrik eşik + kademe sistemi çözer.
 */
export function decideIntervention(s: InterventionSignals): InterventionDecision {
  // 1. MEKANİK TABAN — yargı yok. Döngü/takılma/yüksek-risk → tam tartışma; ilerleme-yok → en az bayrak.
  if (s.isLoop) return { level: "debate", reason: "döngü tespit edildi (mekanik taban)" };
  if (s.isStuck) return { level: "debate", reason: "takılma tespit edildi (mekanik taban)" };
  if (s.highStakesAction) return { level: "debate", reason: "yüksek-risk eylem eşiği (mekanik taban)" };
  if (s.noProgress) return { level: "flag", reason: "denemeler boyunca ilerleme yok (mekanik taban)" };

  // 2. ASİMETRİK EŞİK — severity'ye göre. Yumuşak sinyaller: drift / gate-fix / novelty.
  const sev = s.severity ?? "low";
  const softCount = [s.driftSuspected, s.isGateFix, s.isNovel].filter(Boolean).length;

  if (sev === "high") {
    // Düşük eşik: kaçırmak pahalı, yanlış-alarm ucuz.
    if (softCount >= 1) return { level: "debate", reason: "yüksek-risk + yumuşak sinyal → düşük eşik" };
    return { level: "flag", reason: "yüksek-risk → en azından hızlı bayrak" };
  }
  if (sev === "medium") {
    if (softCount >= 2) return { level: "debate", reason: "orta-risk + çoklu yumuşak sinyal" };
    if (softCount >= 1) return { level: "flag", reason: "orta-risk + yumuşak sinyal → bayrak" };
    return { level: "none", reason: "orta-risk, sinyal yok → sus" };
  }
  // low: yüksek eşik — dırdır etme. AMA fix-kararı mahkemenin EVRENSEL yetkisindedir (YZLLM: "yetki
  // evrensel, boyut/severity baypas etmez") → bir fix uygulanmak üzereyse (isGateFix) severity ne olursa
  // olsun mahkeme EN AZ toplanır (flag), "none" ile baypas YOK. (Fix DIŞI düşük-risk sinyaller — drift/
  // novelty — yalnız çoklu olduğunda bayrak; orada dırdır-yok korunur.)
  if (s.isGateFix) return { level: "flag", reason: "fix-kararı → mahkeme evrensel yetki (düşük-risk de en az flag)" };
  if (softCount >= 2) return { level: "flag", reason: "düşük-risk ama çoklu yumuşak sinyal → bayrak" };
  return { level: "none", reason: "düşük-risk, zayıf sinyal → sus (dırdır yok)" };
}
