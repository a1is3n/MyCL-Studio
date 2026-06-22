// phase-contribution — saf fonksiyonlar (parse + format). LLM/FS yok → izole test.
import { describe, expect, it } from "vitest";
import { parsePhaseContribution, formatContributionReport } from "../src/phase-contribution.js";

describe("parsePhaseContribution (mahkeme JSON ayıklama)", () => {
  it("geçerli JSON bloğu → fazlar (pct 0-100'e clamp + yuvarlama)", () => {
    const text = `Hüküm:\n{"phases":[{"phase":8,"pct":85,"why":"TDD gerçek test üretti"},{"phase":11,"pct":120,"why":"x"}]}`;
    const r = parsePhaseContribution(text);
    expect(r).not.toBeNull();
    expect(r!.length).toBe(2);
    expect(r![0]).toEqual({ phase: 8, pct: 85, why: "TDD gerçek test üretti" });
    expect(r![1].pct).toBe(100); // 120 → clamp 100
  });

  it("JSON yok / bozuk → null (fail-soft)", () => {
    expect(parsePhaseContribution("hiç json yok")).toBeNull();
    expect(parsePhaseContribution(`{"phases": bozuk}`)).toBeNull();
  });

  it("phases boş / geçersiz alanlar elenir → null veya filtrelenmiş", () => {
    expect(parsePhaseContribution(`{"phases":[]}`)).toBeNull();
    const r = parsePhaseContribution(`{"phases":[{"phase":"x","pct":5},{"phase":9,"pct":40,"why":"ok"}]}`);
    expect(r!.length).toBe(1);
    expect(r![0].phase).toBe(9);
  });

  it("pct ondalık → yuvarlanır; why uzunsa kırpılır", () => {
    const r = parsePhaseContribution(`{"phases":[{"phase":1,"pct":33.7,"why":"${"a".repeat(300)}"}]}`);
    expect(r![0].pct).toBe(34);
    expect(r![0].why.length).toBeLessThanOrEqual(200);
  });
});

describe("formatContributionReport (Türkçe rapor)", () => {
  it("düşük→yüksek sıralı + faz adı + düşük-katkı budama-ipucu", () => {
    const out = formatContributionReport([
      { phase: 8, pct: 85, why: "TDD" },
      { phase: 11, pct: 10, why: "değişiklik yok" },
    ]);
    expect(out).toContain("Faz-Katkı Raporu");
    expect(out).toContain("Faz 11 (Sadeleştirme)");
    expect(out).toContain("%85");
    // düşük (<20) → budama ipucu
    expect(out).toContain("Düşük katkı");
    expect(out).toContain("Faz 11");
    // sıralama: düşük (11) yüksek'ten (8) ÖNCE
    expect(out.indexOf("Faz 11")).toBeLessThan(out.indexOf("Faz 8"));
  });

  it("hepsi yüksek-katkı → budama ipucu YOK", () => {
    const out = formatContributionReport([{ phase: 8, pct: 90, why: "x" }, { phase: 9, pct: 50, why: "y" }]);
    expect(out).not.toContain("Düşük katkı");
  });
});
