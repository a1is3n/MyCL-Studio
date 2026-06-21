import { describe, expect, it } from "vitest";
import { escalatedModelEffort } from "../src/escalation.js";
import type { State } from "../src/types.js";
import type { MyclConfig } from "../src/config.js";

// escalatedModelEffort YALNIZ config.selected_models.model_tiers + claude_code_flags.effort okur → minimal cast yeterli.
function makeConfig(tiers?: Partial<Record<string, string>>, effort?: string): MyclConfig {
  return {
    selected_models: { model_tiers: tiers },
    claude_code_flags: { effort },
  } as unknown as MyclConfig;
}
const state = {} as State;

describe("escalatedModelEffort (YZLLM 2026-06-16: merdiven kaldırıldı → model+efor İŞ-TÜRÜNE göre)", () => {
  it("kalite-kritik domain (spec/codegen/db-design) → strong tier modeli", () => {
    const cfg = makeConfig({ strong: "claude-opus-4-8" }, "high");
    expect(escalatedModelEffort(state, cfg, "spec").modelId).toBe("claude-opus-4-8");
    expect(escalatedModelEffort(state, cfg, "tdd-codegen").modelId).toBe("claude-opus-4-8");
    expect(escalatedModelEffort(state, cfg, "ui-codegen").modelId).toBe("claude-opus-4-8");
    expect(escalatedModelEffort(state, cfg, "db-design").modelId).toBe("claude-opus-4-8");
    expect(escalatedModelEffort(state, cfg, "risk-review").modelId).toBe("claude-opus-4-8");
  });

  it("hafif domain (intent) → balanced tier modeli (kalite-kritik değil)", () => {
    const cfg = makeConfig({ balanced: "claude-sonnet-4-6", strong: "claude-opus-4-8" }, "high");
    expect(escalatedModelEffort(state, cfg, "intent").modelId).toBe("claude-sonnet-4-6");
  });

  it("bilinmeyen domain → codegen (strong; güvenli taraf, kaliteyi riske atmaz)", () => {
    const cfg = makeConfig({ strong: "claude-opus-4-8" }, "high");
    expect(escalatedModelEffort(state, cfg, "bilinmeyen-xyz").modelId).toBe("claude-opus-4-8");
  });

  it("efor iş-türüne göre (selectEffortForTask) — strong tier config eforunu olduğu gibi alır", () => {
    const cfg = makeConfig({ strong: "claude-opus-4-8" }, "max");
    expect(escalatedModelEffort(state, cfg, "spec").effort).toBe("max");
  });

  it("merdiven YOK: aynı domain her zaman AYNI model+efor döner (state'e bağlı tırmanma yok)", () => {
    const cfg = makeConfig({ strong: "claude-opus-4-8" }, "high");
    const a = escalatedModelEffort(state, cfg, "spec");
    const b = escalatedModelEffort({ escalation_rungs: { spec: { tier: "cheap", effort: "low" } } } as unknown as State, cfg, "spec");
    expect(a).toEqual(b); // eski escalation_rungs state'i ARTIK etkilemez
  });
});
