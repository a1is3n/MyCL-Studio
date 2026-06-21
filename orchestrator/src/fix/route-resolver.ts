// route-resolver — değişen dosya → iş-birimi (sayfa/endpoint/tablo/shared) DETERMİNİSTİK eşleme.
// YZLLM 2026-06-16 fallback zinciri: sayfa → endpoint → tablo → shared (çözümsüz kalmaz). LLM YOK.
//
// Girdi: bu iterasyonun değişen dosyaları (fix/scope.ts computeChangedScope.files — git veya audit).
// Çıktı: birim → ona düşen dosyalar. Faz 4 bununla devs/pages|endpoints|tables/<key>/<ts>/ böler.
//
// Mevcut altyapıyı KULLANIR (yeni graf yazmaz): dep-graph getAffected (paylaşılan-component→sayfa).
// Route otoritesi: App.jsx-benzeri router (import-map × <Route path→component>). MINIMAL parse
// (regex'e güvenme: substring + dar regex). Route-config bulunamazsa sayfa ekseni dosya-adı
// konvansiyonuna düşer; yine de fallback zinciri çözer.

import { promises as fs } from "node:fs";
import { join, basename, relative, isAbsolute } from "node:path";
import { buildReverseImportGraph, getAffected, type DependencyGraph } from "./dep-graph/index.js";
import { log } from "../logger.js";

export type UnitType = "page" | "endpoint" | "table" | "shared";

export interface ResolvedUnit {
  type: UnitType;
  /** Klasör adı: page→URL/dosya slug, endpoint→route adı, table→tablo adı, shared→"_shared". */
  key: string;
  /** Bu birime düşen değişen dosyalar (projectRoot-relative). */
  files: string[];
}

const SHARED_KEY = "_shared";

// ---- slug yardımcıları ----

/** URL → klasör slug: "/"→"root", "/surveys/results"→"surveys-results", "*"→"root". */
export function urlToSlug(url: string): string {
  const u = (url ?? "").trim();
  if (u === "/" || u === "" || u === "*") return "root";
  const s = u.replace(/^\/+/, "").replace(/\/+$/, "").replace(/[/:]+/g, "-");
  return s || "root";
}

/** Sayfa dosya adı → slug fallback: "UsersPage"→"users", "SurveyResponsePage"→"survey-response". */
export function pageFileSlug(file: string): string {
  const noExt = basename(file).replace(/\.[^.]+$/, "");
  const noPage = noExt.replace(/Page$/, "");
  const kebab = noPage.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  return kebab || "root";
}

function isTestFile(p: string): boolean {
  const l = p.toLowerCase();
  return l.includes(".test.") || l.includes(".spec.") || l.includes("/test/") || l.includes("/__tests__/");
}

/** Test dosyasını kaynağına indir: "x.test.js"→"x.js" (kaba; yalnız birim-çözümü için). */
function stripTestSuffix(p: string): string {
  return p.replace(/\.(test|spec)\.(jsx?|tsx?|mjs|cjs)$/, ".$2");
}

function isPageFile(rel: string): boolean {
  // Frontend kökü ^src/ ile çapalı — `backend/src/...` (backend) frontend sayfa SAYILMAZ.
  return /^src\/pages\//.test(rel) || /^pages\//.test(rel);
}
function isEndpointFile(rel: string): boolean {
  return /(^|\/)routes\//.test(rel) && !isPageFile(rel);
}
function isTableFile(rel: string): boolean {
  return (
    /\.sql$/i.test(rel) ||
    /(^|\/)migrations?\//i.test(rel) ||
    /Store\.(jsx?|tsx?|mjs|cjs)$/.test(rel) ||
    /(^|\/)(schema|models?|entities)\//i.test(rel)
  );
}

// ---- route config parse (sayfa ekseni otoritesi) ----

const ROUTE_CONFIG_CANDIDATES = [
  "src/App.jsx", "src/App.tsx", "src/App.js", "src/App.ts",
  "src/routes.jsx", "src/routes.tsx", "src/router.jsx", "src/router.tsx",
  "src/main.jsx", "src/main.tsx",
];

/** Route config dosyasını bul: bilinen adaylar, sonra src/ sığ taraması (<Route + path=). */
async function findRouteConfig(projectRoot: string): Promise<string | null> {
  for (const c of ROUTE_CONFIG_CANDIDATES) {
    const full = join(projectRoot, c);
    try {
      const txt = await fs.readFile(full, "utf-8");
      if (txt.includes("<Route") && txt.includes("path=")) return full;
    } catch {
      /* yok */
    }
  }
  // sığ tarama: src/ (1 seviye) içinde <Route içeren ilk dosya
  try {
    const srcDir = join(projectRoot, "src");
    for (const name of await fs.readdir(srcDir)) {
      if (!/\.(jsx?|tsx?)$/.test(name)) continue;
      const full = join(srcDir, name);
      try {
        const txt = await fs.readFile(full, "utf-8");
        if (txt.includes("<Route") && txt.includes("path=")) return full;
      } catch {
        /* atla */
      }
    }
  } catch {
    /* src yok */
  }
  return null;
}

/** import sembol → projectRoot-relative dosya yolu (yalnız pages/ import'ları). */
async function parseImportMap(configPath: string, projectRoot: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  let txt: string;
  try {
    txt = await fs.readFile(configPath, "utf-8");
  } catch {
    return out;
  }
  const cfgDir = configPath.slice(0, configPath.lastIndexOf("/"));
  const re = /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(txt)) !== null) {
    const sym = m[1];
    const spec = m[2];
    if (!spec.startsWith(".")) continue; // proje-içi yollar
    // spec'i dosyaya çöz: cfgDir + spec, uzantı dene
    const baseAbs = join(cfgDir, spec);
    const candidates = ["", ".jsx", ".tsx", ".js", ".ts", "/index.jsx", "/index.tsx", "/index.js"];
    for (const ext of candidates) {
      const p = baseAbs + ext;
      try {
        await fs.access(p);
        out.set(sym, relative(projectRoot, p));
        break;
      } catch {
        /* dene */
      }
    }
  }
  return out;
}

/**
 * Route haritası: projectRoot-relative sayfa dosyası → URL. Her `<Route ... path="..." ...>`
 * bloğunda import-map'teki bir component sembolü aranır (element içi); bulunursa o dosya → URL.
 */
async function parseRouteMap(projectRoot: string): Promise<Map<string, string>> {
  const fileToUrl = new Map<string, string>();
  const configPath = await findRouteConfig(projectRoot);
  if (!configPath) return fileToUrl;
  const importMap = await parseImportMap(configPath, projectRoot);
  if (importMap.size === 0) return fileToUrl;
  let txt: string;
  try {
    txt = await fs.readFile(configPath, "utf-8");
  } catch {
    return fileToUrl;
  }
  // <Route ...> bloklarına böl (ilk parça router öncesi → atlanır)
  const chunks = txt.split(/<Route\b/).slice(1);
  for (const chunk of chunks) {
    const pathM = /path\s*=\s*["']([^"']+)["']/.exec(chunk);
    if (!pathM) continue;
    const url = pathM[1];
    // bu Route'un sonuna kadar (sonraki Route'a kadar zaten split'lendi) ilk pages-component
    const compRe = /<(\w+)/g;
    let cm: RegExpExecArray | null;
    while ((cm = compRe.exec(chunk)) !== null) {
      const file = importMap.get(cm[1]);
      if (file && isPageFile(file)) {
        if (!fileToUrl.has(file)) fileToUrl.set(file, url);
        break;
      }
    }
  }
  return fileToUrl;
}

// ---- tablo adı çıkarımı ----

async function tableKeyFor(projectRoot: string, rel: string): Promise<string> {
  // .sql / schema: CREATE TABLE [IF NOT EXISTS] <name>
  if (/\.sql$/i.test(rel)) {
    try {
      const txt = await fs.readFile(join(projectRoot, rel), "utf-8");
      const m = /create\s+table\s+(?:if\s+not\s+exists\s+)?[`"']?(\w+)/i.exec(txt);
      if (m) return m[1].toLowerCase();
    } catch {
      /* dosya-adına düş */
    }
  }
  // *Store.js → "users" (UserStore/userStore → user → çoğul bırakmadan ham)
  const b = basename(rel).replace(/\.[^.]+$/, "");
  const store = b.replace(/Store$/i, "");
  return (store || b).toLowerCase();
}

// ---- ana çözüm ----

/**
 * Değişen dosyaları iş-birimlerine ayırır (fallback zinciri). Saf-deterministik, salt-okuma.
 * Test dosyaları kaynak adına indirilerek aynı birime düşer; çözülemeyen → _shared.
 */
export async function resolveUnits(
  projectRoot: string,
  changedFiles: string[],
): Promise<ResolvedUnit[]> {
  const rels = changedFiles.map((f) => (isAbsolute(f) ? relative(projectRoot, f) : f));
  const routeMap = await parseRouteMap(projectRoot);

  // paylaşılan frontend dosyaları için dep-graph (yalnız gerekiyorsa, bir kez kurulur).
  // undefined = henüz kurulmadı; null = kurulamadı (catch); aksi → graf.
  let graph: DependencyGraph | null | undefined = undefined;
  const ensureGraph = async (): Promise<DependencyGraph | null> => {
    if (graph === undefined) {
      graph = await buildReverseImportGraph(projectRoot).catch((e) => {
        log.warn("route-resolver", "dep-graph kurulamadı (paylaşılan→sayfa atlanır)", e);
        return null;
      });
    }
    return graph;
  };

  // birim-key → dosya kümesi
  const buckets = new Map<string, { type: UnitType; files: Set<string> }>();
  const add = (type: UnitType, key: string, file: string): void => {
    const k = `${type}:${key}`;
    let b = buckets.get(k);
    if (!b) {
      b = { type, files: new Set() };
      buckets.set(k, b);
    }
    b.files.add(file);
  };

  for (const rel of rels) {
    // birim-çözümü için test → kaynağına indir; ama dosyanın KENDİSİ (test) bucket'a yazılır
    const probe = isTestFile(rel) ? stripTestSuffix(rel) : rel;

    // 1) PAGE
    if (isPageFile(probe)) {
      const url = routeMap.get(probe);
      add("page", url ? urlToSlug(url) : pageFileSlug(probe), rel);
      continue;
    }
    // 1b) paylaşılan frontend dosyası → onu kullanan sayfalar (dep-graph). ^src/ frontend kökü.
    if (/^src\//.test(probe) && /\.(jsx?|tsx?)$/.test(probe)) {
      const g = await ensureGraph();
      let mappedToPage = false;
      if (g && g.available) {
        const seed = join(projectRoot, probe);
        for (const aff of getAffected(g, [seed], 3, projectRoot)) {
          if (isPageFile(aff.module)) {
            const url = routeMap.get(aff.module);
            add("page", url ? urlToSlug(url) : pageFileSlug(aff.module), rel);
            mappedToPage = true;
          }
        }
      }
      if (mappedToPage) continue;
    }
    // 2) ENDPOINT
    if (isEndpointFile(probe)) {
      add("endpoint", basename(probe).replace(/\.[^.]+$/, ""), rel);
      continue;
    }
    // 3) TABLE
    if (isTableFile(probe)) {
      add("table", await tableKeyFor(projectRoot, probe), rel);
      continue;
    }
    // 4) SHARED
    add("shared", SHARED_KEY, rel);
  }

  const units: ResolvedUnit[] = [];
  for (const [k, b] of buckets) {
    // bucket anahtarı "<type>:<key>" — ilk ":" sonrası birim adı.
    units.push({ type: b.type, key: k.slice(k.indexOf(":") + 1), files: [...b.files] });
  }
  if (units.length === 0) {
    log.info("route-resolver", "değişen dosya yok / çözülemedi → birim yok");
  }
  return units;
}
