// copy-to-accessible — konum + loop-guard saf mantık testleri (gerçek fs.cp /Users/Shared'a yazacağı için
// canlı koşuda doğrulanır; burada path-mantığı: yanlış loop-guard = sonsuz kopya döngüsü = kritik).

import { describe, expect, it } from "vitest";
import { homedir, platform as osPlatform } from "node:os";
import { myclProjelerDir, isUnderMyclProjeler, isUnderHome } from "../src/onboarding/copy-to-accessible.js";

describe("copy-to-accessible · myclProjelerDir (ev-DIŞI, platforma göre)", () => {
  it("ev-DIŞI bir yol döner (denyRead[home] kapsamaz → ajan okur)", () => {
    const dir = myclProjelerDir();
    expect(isUnderHome(dir)).toBe(false); // KRİTİK: ev altında OLMAMALI (yoksa aynı sandbox engeli)
    if (osPlatform() === "darwin") expect(dir).toBe("/Users/Shared/MyCL Projeler");
  });
});

describe("copy-to-accessible · isUnderMyclProjeler (loop-guard — sonsuz kopya önlemi)", () => {
  const base = myclProjelerDir();
  it("MyCL Projeler altındaki yol → true (tekrar kopyalanmaz)", () => {
    expect(isUnderMyclProjeler(base)).toBe(true);
    expect(isUnderMyclProjeler(`${base}/cave5`)).toBe(true);
    expect(isUnderMyclProjeler(`${base}/cave5/src`)).toBe(true);
  });
  it("dışındaki yol → false (kopyalanabilir)", () => {
    expect(isUnderMyclProjeler(`${homedir()}/cave5`)).toBe(false);
    expect(isUnderMyclProjeler("/tmp/proje")).toBe(false);
    // prefix-benzeri ama altında DEĞİL → false (yanlış-pozitif yok)
    expect(isUnderMyclProjeler(`${base}-baska`)).toBe(false);
  });
});

describe("copy-to-accessible · isUnderHome", () => {
  it("ev altındaki yol → true; dışı → false", () => {
    expect(isUnderHome(`${homedir()}/cave5`)).toBe(true);
    expect(isUnderHome(homedir())).toBe(true);
    expect(isUnderHome("/tmp/x")).toBe(false);
    expect(isUnderHome("/Users/Shared/MyCL Projeler/cave5")).toBe(false);
  });
});
