// inspector-trigger — müdahale-seçimi SAF mantığı. Mekanik taban + asimetrik eşik + kademe.

import { describe, expect, it } from "vitest";
import { decideIntervention, type InterventionSignals } from "../src/inspector-trigger.js";

const base: InterventionSignals = {
  isStuck: false,
  isLoop: false,
  noProgress: false,
  highStakesAction: false,
};

describe("inspector-trigger · decideIntervention", () => {
  it("MEKANİK TABAN: döngü → debate (yargı yok)", () => {
    expect(decideIntervention({ ...base, isLoop: true }).level).toBe("debate");
  });
  it("MEKANİK TABAN: takılma → debate", () => {
    expect(decideIntervention({ ...base, isStuck: true }).level).toBe("debate");
  });
  it("MEKANİK TABAN: yüksek-risk eylem → debate (severity düşük olsa bile)", () => {
    expect(decideIntervention({ ...base, highStakesAction: true, severity: "low" }).level).toBe("debate");
  });
  it("MEKANİK TABAN: ilerleme-yok → en az flag", () => {
    expect(decideIntervention({ ...base, noProgress: true }).level).toBe("flag");
  });

  it("ASİMETRİ: yüksek-risk + tek yumuşak sinyal → debate (düşük eşik)", () => {
    expect(decideIntervention({ ...base, severity: "high", isGateFix: true }).level).toBe("debate");
  });
  it("ASİMETRİ: yüksek-risk + sinyal yok → yine flag (kaçırma)", () => {
    expect(decideIntervention({ ...base, severity: "high" }).level).toBe("flag");
  });

  it("ASİMETRİ: düşük-risk + tek yumuşak sinyal → none (dırdır yok, yüksek eşik)", () => {
    expect(decideIntervention({ ...base, severity: "low", isNovel: true }).level).toBe("none");
  });
  it("ASİMETRİ: düşük-risk + ÇOKLU yumuşak sinyal → flag", () => {
    expect(
      decideIntervention({ ...base, severity: "low", isNovel: true, driftSuspected: true }).level,
    ).toBe("flag");
  });
  it("EVRENSEL YETKİ: düşük-risk + isGateFix-tek → flag (fix-kararı baypas EDİLMEZ)", () => {
    expect(decideIntervention({ ...base, severity: "low", isGateFix: true }).level).toBe("flag");
  });

  it("orta-risk + sinyal yok → sus", () => {
    expect(decideIntervention({ ...base, severity: "medium" }).level).toBe("none");
  });
});
