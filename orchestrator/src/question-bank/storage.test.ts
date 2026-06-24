import { describe, it, expect } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readBank, writeBankAtomic } from "./storage.js";
import { BANK_SCHEMA_VERSION, type QuestionBank } from "./types.js";

const sampleBank: QuestionBank = {
  key: { checkpoint: "phase-10", stack: "node-npm", artifact: "*" },
  version: BANK_SCHEMA_VERSION,
  questions: [
    {
      id: "q1",
      text: "X JSON ile mi yapılmış?",
      check: { cmd: "node check.mjs", inconclusive_codes: [2] },
      blocking_class: "blocking",
      real_to_proxy: "gerçek: geçerli JSON → proxy: JSON.parse hata vermiyor",
      fixtures: [
        { name: "iyi", files: { "a.json": "{}" }, expect: "PASS" },
        { name: "kötü", files: { "a.json": "{bozuk" }, expect: "FAIL" },
      ],
    },
  ],
};

describe("storage — atomic round-trip", () => {
  it("yaz → oku aynı bankayı verir (ara dizinler oluşturulur)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qbank-store-"));
    const p = join(dir, "phase-10", "node-npm", "_all.json");
    await writeBankAtomic(p, sampleBank);
    const back = await readBank(p);
    expect(back).toEqual(sampleBank);
  });

  it("olmayan dosya → null (caller üretime düşer)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qbank-store-"));
    expect(await readBank(join(dir, "yok.json"))).toBeNull();
  });

  it("bozuk JSON → throw (sessizce yutma yok)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qbank-store-"));
    const p = join(dir, "bozuk.json");
    await writeFile(p, "{ not json", "utf-8");
    await expect(readBank(p)).rejects.toThrow();
  });
});
