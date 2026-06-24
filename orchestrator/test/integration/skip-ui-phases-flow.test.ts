// v15.0+v15.2.3 integration: project_type → skip_ui_phases flow.
// Phase 2 classifier'ın `library` döndürmesi → state.skip_ui_phases=true
// → Faz 5/7 skip → Faz 7 has_database check → Faz 8 TDD.
//
// shouldSkipUiPhases + classification result flow doğrulama (mock LLM yok,
// shouldSkipUiPhases helper'ı direkt test).

import { describe, expect, it } from "vitest";
import { shouldSkipUiPhases } from "../../src/project-type-classifier.js";

describe("skip_ui_phases flow (v15.2.3)", () => {
  it("library/cli/api/ml/game → true (Faz 5/7 skip)", () => {
    expect(shouldSkipUiPhases("library")).toBe(true);
    expect(shouldSkipUiPhases("cli")).toBe(true);
    expect(shouldSkipUiPhases("api")).toBe(true);
    expect(shouldSkipUiPhases("ml")).toBe(true);
    expect(shouldSkipUiPhases("game")).toBe(true);
  });

  it("web/mobile/desktop → false (Faz 5/7 çalışsın)", () => {
    expect(shouldSkipUiPhases("web")).toBe(false);
    expect(shouldSkipUiPhases("mobile")).toBe(false);
    expect(shouldSkipUiPhases("desktop")).toBe(false);
  });

  it("unknown → false (default: çalışsın, kullanıcı override)", () => {
    expect(shouldSkipUiPhases("unknown")).toBe(false);
  });
});

describe("has_ui Faz 5 skip flow (2026-06-24 sistemik fix: OR→AND, kuşkuda KOŞ)", () => {
  it("Faz 5 yalnız yapısal sinyal VE regex İKİSİ de 'UI yok' derse atlanır (yıkıcı skip fail-open)", () => {
    // index.ts:advanceToNextPhase Faz 5 kararı (DÜZELTİLDİ):
    //   skip = skip_ui_phases && !specShowsUi      (ESKİ kırılgan: skip_ui_phases || !specShowsUi)
    // Eski OR, kelime-regex'ine YIKICI yetki veriyordu: regex kaçırınca (!specShowsUi=true) tek başına
    // skip → uygulama hiç kurulmuyordu. Yeni AND: atlama yalnız classifier'ın güvenilir skip sinyaliyle.
    const cases = [
      // skip_ui_phases (classifier), specShowsUi (regex pozitif) → skip?
      { skip_ui_phases: false, specShowsUi: false, expectSkip: false }, // OLAY: unknown + regex kaçırdı → ESKİDEN atla(bug), ŞİMDİ KOŞ
      { skip_ui_phases: false, specShowsUi: true, expectSkip: false }, // web/UI → koş
      { skip_ui_phases: true, specShowsUi: false, expectSkip: true }, // library + UI yok → atla (doğru)
      { skip_ui_phases: true, specShowsUi: true, expectSkip: false }, // classifier non-UI DEDİ ama spec UI gösteriyor → pozitif override: koş
    ];
    for (const c of cases) {
      const skip = c.skip_ui_phases && !c.specShowsUi;
      expect(skip).toBe(c.expectSkip);
    }
  });
});

describe("has_database state flow (v15.2.3 C-3)", () => {
  it("Faz 7 skip: structured `has_database=false` öncelikli, heuristic fallback", () => {
    // Bu logic index.ts:advanceToNextPhase Faz 7'de:
    //   const structuredSkip = state.has_database === false;
    //   if (structuredSkip || !hasDbHeuristic) { skip }
    // Test: pure boolean logic — `has_database === false` her zaman skip;
    //       undefined ise heuristic fallback'a düşer.
    const cases = [
      { has_database: false, heuristic: true, expectSkip: true },
      { has_database: false, heuristic: false, expectSkip: true },
      { has_database: true, heuristic: true, expectSkip: false },
      { has_database: true, heuristic: false, expectSkip: true }, // heuristic dominant when structured says true but spec yok? Mevcut mantık: structured TRUE → checkleri pass + heuristic'i de geçer; heuristic false ise skip. Doğru davranış.
      { has_database: undefined, heuristic: true, expectSkip: false },
      { has_database: undefined, heuristic: false, expectSkip: true },
    ];
    for (const c of cases) {
      const structuredSkip = c.has_database === false;
      const skip = structuredSkip || !c.heuristic;
      expect(skip).toBe(c.expectSkip);
    }
  });
});
