// auto-answer — "Oto-cevap" toggle (saha 3/5). Kullanıcı composer'daki "Orkestrator"
// butonunun yanındaki checkbox'ı tikleyince pipeline kendiliğinden akar:
//   • ÖNERİLİ netleştirme askq'ları → ana ajanın suggested_answer'ıyla,
//   • önerisi-OLMAYAN netleştirme + ONAYLAR (Approve/Revise/Cancel) → ilk/güvenli seçenekle
// otomatik yanıtlanır (f4941dc, YZLLM 2026-06-15: "oto-cevap onayları da yanıtlar").
// AYRIK: Faz 6 görsel-incelemesi bu yoldan GEÇMEZ (deferred) → kullanıcı sürer.
//
// Modül-singleton (setSandboxPolicy deseni); frontend checkbox `set_auto_answer` komutuyla set
// eder. qa-askq backend'leri (CLI + SDK) emitAndAwait/askq noktasında bunu okur.
// YZLLM 2026-06-20: DEFAULT AÇIK isteniyor → FRONTEND default'u açık (App.tsx localStorage !== "0") +
// mount'ta set_auto_answer{true} ile burayı sync eder. Backend default'u FALSE kalır (headless/test
// izolasyonu: frontend sync'i olmayan birim-testler manuel-onay akışını bozmadan koşar).

let _enabled = false;

export function setAutoAnswerSuggested(on: boolean): void {
  _enabled = on;
}

export function autoAnswerSuggested(): boolean {
  return _enabled;
}

/**
 * Oto-cevap AÇIKSA bu askq için seçilecek TR cevabı döndürür (öneri varsa onu, yoksa ilk
 * seçeneği); KAPALIYSA veya hiç seçenek yoksa null → caller normal şekilde kullanıcı cevabını
 * bekler. Mesaj YAZMAZ (saf) — döngüsel import olmasın diye "🤖 Oto-cevap" notunu caller emit eder.
 *
 * YZLLM 2026-06-15 (canlı test): FIX-5 yalnız qa-askq backend'lerini (Faz 1/2 netleştirmeleri)
 * yamamıştı; production-schema (Faz 4 spec / Faz 7 DB), codegen (Faz 8) ve faz-kapsam (index.ts)
 * ONAYLARI bu kontrolü KAÇIRIYORDU → oto-cevap açıkken bile her onayda pipeline 47 dk takıldı.
 * Tüm askq emit yolları emitAskq'den ÖNCE bunu çağırmalı; non-null dönerse askq UI'a hiç
 * gösterilmeden auto-resolve edilir. Faz 6 görsel-incelemesi bu yoldan GEÇMEZ (deferred;
 * controller çağırmaz) → kullanıcı sürer.
 */
export function autoAnswerPick(options_tr: string[], suggested_tr?: string): string | null {
  if (!_enabled) return null;
  if (suggested_tr === undefined && options_tr.length === 0) return null;
  return suggested_tr ?? options_tr[0]!;
}
