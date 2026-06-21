import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  violationsInLine,
  scanCspViolations,
  ensureCspMeta,
  STRICT_CSP,
} from "../src/csp-compliance.js";

describe("csp-compliance · violationsInLine (saf pattern tespiti)", () => {
  it('inline HTML event handler (onclick="...") → ihlal', () => {
    expect(violationsInLine('<button onclick="go()">x</button>')).toContain("inline-event-handler");
  });

  it("JSX onClick={...} ({ ile) → ihlal DEĞİL (addEventListener'a derler, CSP-safe)", () => {
    expect(violationsInLine("<button onClick={() => go()}>x</button>")).not.toContain("inline-event-handler");
  });

  it("eval / new Function → ihlal (unsafe-eval)", () => {
    expect(violationsInLine("const x = eval(src)")).toContain("eval");
    expect(violationsInLine("const f = new Function('a', 'return a')")).toContain("eval");
  });

  it("'retrieval'/'medieval' eval'e false-positive VERMEZ (word-boundary)", () => {
    expect(violationsInLine("doRetrieval(x)")).not.toContain("eval");
    expect(violationsInLine("const medieval = 1")).not.toContain("eval");
  });

  it("string-gövdeli timer → ihlal; fonksiyon-referanslı timer → temiz", () => {
    expect(violationsInLine('setTimeout("doThing()", 100)')).toContain("string-timer");
    expect(violationsInLine("setTimeout(() => doThing(), 100)")).not.toContain("string-timer");
  });

  it("javascript: URL → ihlal", () => {
    expect(violationsInLine('<a href="javascript:void(0)">x</a>')).toContain("javascript-url");
  });

  it('inline style (style="" + React style={{}}) → ihlal', () => {
    expect(violationsInLine('<div style="color:red">x</div>')).toContain("inline-style");
    expect(violationsInLine("<div style={{ color: 'red' }}>x</div>")).toContain("inline-style");
  });

  it("className → ihlal DEĞİL (harici CSS, CSP-safe)", () => {
    expect(violationsInLine('<div className="box">x</div>')).toEqual([]);
  });

  it("unsafe-inline / unsafe-eval token (TIRNAKLI CSP-directive) → ihlal", () => {
    expect(violationsInLine("script-src 'self' 'unsafe-inline'")).toContain("unsafe-token");
  });

  it("DEV-gated unsafe-eval (NODE_ENV/isDev/import.meta.env.DEV) → ARTIK ihlal (YZLLM 2026-06-19: dev carve-out KALDIRILDI)", () => {
    expect(violationsInLine("script-src 'self' \" + (process.env.NODE_ENV !== 'production' ? \"'unsafe-eval'\" : \"\")")).toContain("unsafe-token");
    expect(violationsInLine("const csp = isDev ? \"script-src 'self' 'unsafe-eval'\" : \"script-src 'self'\"")).toContain("unsafe-token");
    expect(violationsInLine("script-src 'self' \" + (import.meta.env.DEV ? \"'unsafe-eval'\" : \"\")")).toContain("unsafe-token");
  });

  it("CSP açıklama YORUMU (tırnaksız 'no unsafe-inline') → ihlal DEĞİL (YZLLM 2026-06-17 yorum yanlış-pozitifi fix)", () => {
    expect(violationsInLine("<!-- Strict CSP: no unsafe-inline, no unsafe-eval, no wildcard. -->")).not.toContain("unsafe-token");
    expect(violationsInLine("// avoid unsafe-inline styles here")).not.toContain("unsafe-token");
  });

  it("temiz React satırı → boş", () => {
    expect(violationsInLine("const [count, setCount] = useState(0)")).toEqual([]);
  });
});

describe("csp-compliance · scanCspViolations + ensureCspMeta (IO, /tmp fixture)", () => {
  it("temiz proje → 0 ihlal + index.html'e katı CSP meta eklenir (added, idempotent)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "csp-clean-"));
    try {
      await mkdir(join(dir, "src"), { recursive: true });
      await writeFile(
        join(dir, "index.html"),
        '<!doctype html>\n<html>\n  <head>\n    <title>x</title>\n  </head>\n  <body><div id="root"></div></body>\n</html>\n',
      );
      await writeFile(
        join(dir, "src", "App.jsx"),
        'export default () => <button className="b" onClick={() => 1}>+</button>\n',
      );
      const v = await scanCspViolations(dir);
      expect(v).toEqual([]);

      const meta = await ensureCspMeta(dir);
      expect(meta.action).toBe("added");
      expect(meta.file).toBe("index.html");
      const html = await readFile(join(dir, "index.html"), "utf-8");
      expect(html).toContain("Content-Security-Policy");
      expect(html).toContain(STRICT_CSP);
      expect(html).not.toContain("unsafe-inline");

      // idempotent: ikinci çağrı eklemez (present)
      expect((await ensureCspMeta(dir)).action).toBe("present");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("kirli proje (inline handler + eval) → ihlaller bulunur; node_modules atlanır", async () => {
    const dir = await mkdtemp(join(tmpdir(), "csp-dirty-"));
    try {
      await mkdir(join(dir, "src"), { recursive: true });
      await mkdir(join(dir, "node_modules", "pkg"), { recursive: true });
      await writeFile(join(dir, "src", "x.html"), '<button onclick="go()">x</button>\n');
      await writeFile(join(dir, "src", "y.js"), "const r = eval(userInput)\n");
      await writeFile(join(dir, "node_modules", "pkg", "z.js"), 'el.onclick = eval("x")\n'); // ATLANMALI
      const v = await scanCspViolations(dir);
      const kinds = v.map((x) => x.kind);
      expect(kinds).toContain("inline-event-handler");
      expect(kinds).toContain("eval");
      expect(v.every((x) => !x.file.includes("node_modules"))).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("giriş HTML yok (Next/SSR) → no-html (deterministik eklenemez, skip)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "csp-nohtml-"));
    try {
      await mkdir(join(dir, "pages"), { recursive: true });
      await writeFile(join(dir, "pages", "index.tsx"), "export default () => <div className='x'/>\n");
      expect((await ensureCspMeta(dir)).action).toBe("no-html");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("config dosyası dev-CSP'sinde unsafe-* → İHLAL (YZLLM 2026-06-19: dev dahil unsafe yasak); test/spec fixture ATLANIR", async () => {
    const dir = await mkdtemp(join(tmpdir(), "csp-config-"));
    try {
      await mkdir(join(dir, "src", "lib"), { recursive: true });
      // vite.config.js: dev-CSP'de unsafe-* — ARTIK İHLAL (Next/Vite header-CSP tam burada tanımlanır;
      // config genel taranmasa da CSP unsafe-token'ı için taranır).
      await writeFile(join(dir, "vite.config.js"), "export default { devCsp: \"script-src 'self' 'unsafe-inline' 'unsafe-eval'\" }\n");
      // csp.test.js: test-fixture'ında 'unsafe-inline' örneği — uygulama davranışı DEĞİL → atlanır.
      await writeFile(join(dir, "src", "lib", "csp.test.js"), "it('x', () => expect(\"script-src 'self' 'unsafe-inline'\").toBeTruthy())\n");
      await writeFile(join(dir, "src", "App.jsx"), 'export default () => <div className="x">hi</div>\n');
      const v = await scanCspViolations(dir);
      // vite.config → unsafe-token bulundu (tek satır, tek hit); test/spec + App temiz.
      expect(v.length).toBe(1);
      expect(v[0]!.file).toBe("vite.config.js");
      expect(v[0]!.kind).toBe("unsafe-token");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("config dosyasında build-zamanı eval/inline-style → İHLAL DEĞİL (yalnız CSP unsafe-token taranır)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "csp-config-noise-"));
    try {
      await writeFile(join(dir, "build.config.js"), "export default { transform: (s) => eval(s), inline: '<div style=\"x\">' }\n");
      const v = await scanCspViolations(dir);
      expect(v).toEqual([]); // config: eval/inline-style build-zamanı → CSP-ihlali değil
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
