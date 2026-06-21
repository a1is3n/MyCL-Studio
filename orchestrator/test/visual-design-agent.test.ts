import { describe, expect, it } from "vitest";
import { nonStyleFiles, VISUAL_SYSTEM_PROMPT } from "../src/visual-design-agent.js";

// Görsel ajan güvenliğinin SAF çekirdeği: git-diff sonrası "yalnız stil dosyaları değişmeli" kontrolü.
// Stil-dışı (JSX/TS/HTML/backend) dosyalar offender → phase-5 onları git ile GERİ ALIR (işlev/güvenlik koruması).

describe("visual-design-agent · nonStyleFiles (stil-only güvenlik ayrımı)", () => {
  it("CSS/SCSS/SASS/LESS/module → stil (offender DEĞİL)", () => {
    expect(
      nonStyleFiles(["src/App.css", "src/x.module.css", "styles/a.scss", "b.sass", "c.less", "d.pcss"]),
    ).toEqual([]);
  });

  it("JSX/TSX/TS/JS/HTML/backend → offender (stil-dışı = geri alınır)", () => {
    const off = nonStyleFiles([
      "src/App.jsx",
      "src/main.tsx",
      "src/api/db.ts",
      "server/index.js",
      "index.html",
      "src/App.css", // bu stil — offender DEĞİL
    ]);
    expect(off).toEqual(["src/App.jsx", "src/main.tsx", "src/api/db.ts", "server/index.js", "index.html"]);
  });

  it("boş liste → offender yok", () => {
    expect(nonStyleFiles([])).toEqual([]);
  });

  it("boş string'leri yok sayar (git diff artefaktı)", () => {
    expect(nonStyleFiles(["", "src/App.css", ""])).toEqual([]);
  });
});

describe("visual-design-agent · sistem prompt güvenlik kısıtları", () => {
  it("prompt CSP (no inline-style) + stil-only + komut-yok kurallarını içerir", () => {
    expect(VISUAL_SYSTEM_PROMPT).toMatch(/CSP/);
    expect(VISUAL_SYSTEM_PROMPT).toMatch(/inline style/i);
    expect(VISUAL_SYSTEM_PROMPT).toMatch(/Stylesheet files ONLY|stylesheet/i);
    expect(VISUAL_SYSTEM_PROMPT).toMatch(/WCAG/);
  });
});
