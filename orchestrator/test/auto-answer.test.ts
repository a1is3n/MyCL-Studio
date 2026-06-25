// auto-answer — entegre-modu bastırma (YZLLM cave5): foreign-origin projede oto-cevap kullanıcıya yönlenir.

import { describe, expect, it, afterEach } from "vitest";
import {
  setAutoAnswerSuggested,
  setIntegrateModeSuppression,
  isIntegrateSuppressed,
  autoAnswerSuggested,
  autoAnswerPick,
} from "../src/auto-answer.js";

describe("auto-answer · entegre-modu bastırma", () => {
  afterEach(() => {
    // Modül-singleton → testler arası sıfırla.
    setAutoAnswerSuggested(false);
    setIntegrateModeSuppression(false);
  });

  it("oto-cevap AÇIK + entegre-bastırma AÇIK → suggested=false, pick=null (kullanıcı yanıtlar)", () => {
    setAutoAnswerSuggested(true);
    setIntegrateModeSuppression(true);
    expect(isIntegrateSuppressed()).toBe(true);
    expect(autoAnswerSuggested()).toBe(false);
    expect(autoAnswerPick(["a", "b"], "a")).toBeNull();
  });

  it("oto-cevap AÇIK + bastırma KAPALI → normal (suggested=true, pick=öneri)", () => {
    setAutoAnswerSuggested(true);
    setIntegrateModeSuppression(false);
    expect(autoAnswerSuggested()).toBe(true);
    expect(autoAnswerPick(["a", "b"], "b")).toBe("b");
  });

  it("oto-cevap KAPALI → bastırmadan bağımsız null (geriye-uyum, default davranış)", () => {
    setAutoAnswerSuggested(false);
    expect(autoAnswerSuggested()).toBe(false);
    expect(autoAnswerPick(["a"], undefined)).toBeNull();
  });
});
