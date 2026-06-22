// hasUsableKeys — save_api_keys merge-validasyonu (z.ai, YZLLM 2026-06-22).
// Kayıt PATCH'tir: boş alan mevcut key'i silmez → "her kayıtta translator+main zorunlu" YANLIŞTI
// (z.ai eklerken claude'u yeniden girmeye zorluyor + z.ai-only kurulumu engelliyordu). Saf fonksiyon
// (IO yok → gerçek ~/.mycl secrets'ını clobber etme riski yok).

import { describe, expect, it } from "vitest";
import { hasUsableKeys, type ApiKeys } from "../src/config.js";

const E = {} as Partial<ApiKeys>; // boş mevcut secrets

describe("hasUsableKeys (z.ai save merge-validasyonu)", () => {
  it("boş secrets + boş patch → false (tamamen boş kayıt reddedilir)", () => {
    expect(hasUsableKeys(E, {})).toBe(false);
  });

  it("boş secrets + claude translator+main → true", () => {
    expect(hasUsableKeys(E, { translator: "ck-t", main: "ck-m" })).toBe(true);
  });

  it("boş secrets + sadece translator → false (main eksik + z.ai yok)", () => {
    expect(hasUsableKeys(E, { translator: "ck-t" })).toBe(false);
  });

  it("boş secrets + sadece bir z.ai key → true (z.ai-only kurulum — ASIL BUG)", () => {
    expect(hasUsableKeys(E, { zai_main: "zm" })).toBe(true);
    expect(hasUsableKeys(E, { zai_translator: "zt" })).toBe(true);
    expect(hasUsableKeys(E, { zai_orchestrator: "zo" })).toBe(true);
  });

  it("mevcut claude secrets + sadece z.ai patch → true (kısmi güncelleme, claude yeniden GİRİLMEZ)", () => {
    const existing = { translator: "ck-t", main: "ck-m" } as Partial<ApiKeys>;
    expect(hasUsableKeys(existing, { zai_main: "zm" })).toBe(true);
  });

  it("mevcut claude secrets + boş patch → true (mevcut korunur, merge silmez)", () => {
    const existing = { translator: "ck-t", main: "ck-m" } as Partial<ApiKeys>;
    expect(hasUsableKeys(existing, {})).toBe(true);
  });

  it("mevcut default zai + boş patch → true (eski tek-zai key geriye-uyumlu)", () => {
    const existing = { zai: "zdef" } as Partial<ApiKeys>;
    expect(hasUsableKeys(existing, {})).toBe(true);
  });

  it("boş/whitespace değerler dolu SAYILMAZ", () => {
    expect(hasUsableKeys(E, { translator: "  ", main: "  " })).toBe(false);
    expect(hasUsableKeys(E, { zai_main: "   " })).toBe(false);
  });

  it("mevcut translator + patch main → true (alanlar mevcut+patch'ten birleşir)", () => {
    const existing = { translator: "ck-t" } as Partial<ApiKeys>;
    expect(hasUsableKeys(existing, { main: "ck-m" })).toBe(true);
  });
});
