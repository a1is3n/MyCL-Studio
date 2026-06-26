// context-builder — pipeline TAMAMLANDIYSA current_phase satırı BAYAT uyarısı taşımalı.
// YZLLM ("söylediği halde 8'e geçmedi"): ajan biten koşudan kalan current_phase=8'i görüp yeni işi
// "Faz 8'de kaldığı yerden sürüyor" diye anlatıyordu. Uyarı current_phase satırına gömülü → ajan kaçıramaz.

import { describe, expect, it } from "vitest";
import {
  renderContextSection,
  type AgentContextSnapshot,
} from "../../src/orchestrator-agent/context-builder.js";

function snap(overrides: Partial<AgentContextSnapshot>): AgentContextSnapshot {
  return {
    current_phase: 8,
    iteration_count: 4,
    was_pipeline_completed: false,
    spec_approved: false,
    intent_summary: null,
    pending_ui_tweak: null,
    pending_diagnostic_phase: null,
    has_database: null,
    skip_ui_phases: false,
    dev_server_pid: null,
    tdd_compliance_score: null,
    feature_headings: [],
    available_modules: [],
    recent_audit: [],
    recent_decisions: [],
    recent_handoffs: [],
    recent_wtf: [],
    project_map: null,
    project_memory: [],
    general_memory: [],
    ...overrides,
  } as unknown as AgentContextSnapshot;
}

describe("renderContextSection — bayat current_phase uyarısı", () => {
  it("pipeline TAMAMLANDIYSA → current_phase satırı STALE + 'Faz 1'den başlar' uyarısı taşır", () => {
    const out = renderContextSection(snap({ current_phase: 8, was_pipeline_completed: true }));
    expect(out).toContain("STALE");
    expect(out).toContain("Faz 1'den başlar");
    // Yeni işi 'Faz 8'de kaldığı yerden' diye anlatma talimatı var.
    expect(out).toMatch(/Faz 8.*kaldığı yerden|kaldığı yerden.*ANLATMA/s);
  });

  it("pipeline tamamlanmadıysa (mid-flight) → uyarı YOK (normal resume davranışı korunur)", () => {
    const out = renderContextSection(snap({ current_phase: 8, was_pipeline_completed: false }));
    expect(out).toContain("- **current_phase**: 8");
    expect(out).not.toContain("STALE");
  });
});
