import { describe, it, expect } from "vitest";
import { sumSecurityFindings, stepSecurityConvergence } from "./security-convergence.js";

describe("sumSecurityFindings", () => {
  it("tek 'N Code Findings' sayısını okur", () => {
    expect(sumSecurityFindings("┌────┐\n│ 52 Code Findings │\n└────┘")).toBe(52);
  });

  it("birden çok tarayıcı bulgusunu TOPLAR", () => {
    const out = "semgrep-owasp: 52 Code Findings\nsemgrep: 57 Code Findings\nsecrets: 53 Code Findings";
    expect(sumSecurityFindings(out)).toBe(52 + 57 + 53);
  });

  it("büyük/küçük harf duyarsız ('code findings')", () => {
    expect(sumSecurityFindings("3 code findings")).toBe(3);
  });

  it("sayı yoksa null (parse edilemedi → güvenli yol)", () => {
    expect(sumSecurityFindings("no findings here, all clean")).toBeNull();
  });

  it("boş / undefined / null → null", () => {
    expect(sumSecurityFindings("")).toBeNull();
    expect(sumSecurityFindings(undefined)).toBeNull();
    expect(sumSecurityFindings(null)).toBeNull();
  });
});

describe("stepSecurityConvergence", () => {
  const fresh = { prevFindings: null, noProgress: 0 };

  it("ilk deneme (prev null) → noProgress 0, yakınsıyor", () => {
    const s = stepSecurityConvergence(fresh, 52);
    expect(s).toEqual({ prevFindings: 52, noProgress: 0, converging: true });
  });

  it("bulgu AZALDI → noProgress sıfırlanır, yakınsıyor", () => {
    const s = stepSecurityConvergence({ prevFindings: 52, noProgress: 1 }, 40);
    expect(s.noProgress).toBe(0);
    expect(s.converging).toBe(true);
    expect(s.prevFindings).toBe(40);
  });

  it("bulgu AYNI kaldı → noProgress artar", () => {
    const s = stepSecurityConvergence({ prevFindings: 52, noProgress: 0 }, 52);
    expect(s.noProgress).toBe(1);
    expect(s.converging).toBe(true);
  });

  it("bulgu ARTTI → noProgress artar", () => {
    const s = stepSecurityConvergence({ prevFindings: 52, noProgress: 0 }, 60);
    expect(s.noProgress).toBe(1);
  });

  it("2 ardışık azalma-yok → yakınsamıyor (converging=false)", () => {
    // 52 → 52 (noProgress 1) → 52 (noProgress 2 ≥ threshold)
    let s = stepSecurityConvergence(fresh, 52); // ilk: prev null → 0
    s = stepSecurityConvergence(s, 52); // 1
    expect(s.converging).toBe(true);
    s = stepSecurityConvergence(s, 52); // 2 → DUR
    expect(s.noProgress).toBe(2);
    expect(s.converging).toBe(false);
  });

  it("özel threshold'a saygı gösterir", () => {
    let s = stepSecurityConvergence(fresh, 10, 1);
    s = stepSecurityConvergence(s, 10, 1); // noProgress 1 ≥ threshold 1
    expect(s.converging).toBe(false);
  });

  it("curFindings null (ölçülemedi) → noProgress ARTAR (konservatif: belirsizken ilerleme-yok say)", () => {
    const state = { prevFindings: 52, noProgress: 1 };
    const s = stepSecurityConvergence(state, null);
    expect(s.prevFindings).toBe(52); // ölçülemedi → önceki korunur
    expect(s.noProgress).toBe(2); // null → arttı (sonsuz döngüyü engeller)
    expect(s.converging).toBe(false); // 2 >= 2 → yakınsamıyor → escalate/auto-accept
  });

  it("null arka arkaya gelirse breaker eninde sonunda tetiklenir (ölçüm hiç çalışmasa bile)", () => {
    let s = stepSecurityConvergence({ prevFindings: null, noProgress: 0 }, null); // 1
    expect(s.converging).toBe(true);
    s = stepSecurityConvergence(s, null); // 2 → DUR
    expect(s.converging).toBe(false);
  });

  it("azalma noProgress'i sıfırlayıp döngüyü canlı tutar (yanlış-erken-durdurma yok)", () => {
    // 52 → 52 (1) → 50 (azaldı, 0) → 50 (1) → tekrar fırsat
    let s = stepSecurityConvergence(fresh, 52);
    s = stepSecurityConvergence(s, 52); // 1
    s = stepSecurityConvergence(s, 50); // azaldı → 0
    expect(s.noProgress).toBe(0);
    expect(s.converging).toBe(true);
  });
});
