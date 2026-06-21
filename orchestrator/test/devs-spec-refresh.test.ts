// devs-spec-refresh — saf yardımcı testleri (buildSpecRefreshPrompt + parseSpecRefreshBlock).
import { describe, expect, it } from "vitest";
import { buildSpecRefreshPrompt, parseSpecRefreshBlock } from "../src/devs-spec-refresh.js";

describe("buildSpecRefreshPrompt", () => {
  const tmpl =
    "ITER={{ITER_SPEC}} UNITS={{TOUCHED_UNITS}} ROOT={{EXISTING_ROOT_SPEC}} PAGES={{EXISTING_PAGE_SPECS}}";

  it("tüm placeholder'ları doldurur (dokunulan birimler madde listesi)", () => {
    const p = buildSpecRefreshPrompt({
      tmpl,
      iterSpec: "# iter",
      touchedUnits: ["page:users", "endpoint:surveys"],
      existingRootSpec: "## Proje",
      existingPageSpecs: "### page:users\n(none yet)",
    });
    expect(p).toContain("ITER=# iter");
    expect(p).toContain("- page:users");
    expect(p).toContain("- endpoint:surveys");
    expect(p).toContain("ROOT=## Proje");
  });

  it("birim yoksa görünür sentinel (yalnız kök spec tazelenir)", () => {
    const p = buildSpecRefreshPrompt({
      tmpl,
      iterSpec: "",
      touchedUnits: [],
      existingRootSpec: "(none yet)",
      existingPageSpecs: "(no units touched this iteration)",
    });
    expect(p).toContain("only the root spec is refreshed");
    expect(p).toContain("(no iter-spec recorded)"); // boş iterSpec → sentinel
  });
});

describe("parseSpecRefreshBlock", () => {
  const valid = new Set(["page:users", "endpoint:surveys"]);

  it("geçerli {kind:specs} bloğu → root + dokunulan birimlerin page_specs'i", () => {
    const text = `İşte:\n{"kind":"specs","root_spec_md":"## Proje\\nGenel anlatım","page_specs":[{"unit":"page:users","spec_md":"## Users\\nyapar"}]}`;
    const r = parseSpecRefreshBlock(text, valid);
    expect(r).not.toBeNull();
    expect(r!.root_spec_md).toContain("Genel anlatım");
    expect(r!.page_specs).toHaveLength(1);
    expect(r!.page_specs[0].unit).toBe("page:users");
  });

  it("root_spec_md boş/yok → null (kök spec ZORUNLU)", () => {
    expect(parseSpecRefreshBlock(`{"kind":"specs","root_spec_md":"  "}`, valid)).toBeNull();
    expect(parseSpecRefreshBlock(`{"kind":"specs","page_specs":[]}`, valid)).toBeNull();
  });

  it("dokunulMAYAN birime ait page_spec elenir (uydurma birim)", () => {
    const text = `{"kind":"specs","root_spec_md":"## P","page_specs":[{"unit":"page:ghost","spec_md":"x"},{"unit":"page:users","spec_md":"ok"}]}`;
    const r = parseSpecRefreshBlock(text, valid);
    expect(r!.page_specs.map((p) => p.unit)).toEqual(["page:users"]);
  });

  it("boş spec_md elenir; page_specs yoksa root + []", () => {
    const text = `{"kind":"specs","root_spec_md":"## P","page_specs":[{"unit":"page:users","spec_md":"   "}]}`;
    expect(parseSpecRefreshBlock(text, valid)!.page_specs).toEqual([]);
    expect(parseSpecRefreshBlock(`{"kind":"specs","root_spec_md":"## P"}`, valid)!.page_specs).toEqual([]);
  });

  it("blok yok → null", () => {
    expect(parseSpecRefreshBlock("düz metin", valid)).toBeNull();
  });
});
