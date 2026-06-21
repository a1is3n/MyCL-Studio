import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { finalizeDevsArtifacts } from "../src/devs-finalize.js";
import { deriveDevsPaths, pendingSpecPath, formatIterationTs } from "../src/devs-paths.js";
import { appendAudit } from "../src/audit.js";
import type { State } from "../src/types.js";

// Bu iterasyonun tek-kaynak <ts>'i (sabit ms → deterministik tsLabel).
const ITER_TS = new Date(2026, 5, 16, 14, 32, 7).getTime();

async function exists(p: string): Promise<boolean> {
  return access(p)
    .then(() => true)
    .catch(() => false);
}

/** route-resolver testindeki proje ağacının aynısı (App.jsx route-map + sayfalar + endpoint + component). */
async function setupProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "devs-finalize-"));
  await mkdir(join(root, "src", "pages"), { recursive: true });
  await mkdir(join(root, "src", "components"), { recursive: true });
  await mkdir(join(root, "backend", "src", "routes"), { recursive: true });
  await writeFile(
    join(root, "src", "App.jsx"),
    [
      "import UsersPage from './pages/UsersPage';",
      "import SurveyResponsePage from './pages/SurveyResponsePage';",
      "function App() {",
      "  return (",
      "    <Routes>",
      '      <Route path="/users" element={<UsersPage />} />',
      '      <Route path="/surveys" element={<SurveyResponsePage />} />',
      "    </Routes>",
      "  );",
      "}",
    ].join("\n"),
  );
  await writeFile(
    join(root, "src", "pages", "UsersPage.jsx"),
    "import Widget from '../components/Widget';\nexport default function UsersPage(){ return <Widget/>; }",
  );
  await writeFile(
    join(root, "src", "pages", "SurveyResponsePage.jsx"),
    "export default function SurveyResponsePage(){ return null; }",
  );
  await writeFile(
    join(root, "src", "components", "Widget.jsx"),
    "export default function Widget(){ return null; }",
  );
  await writeFile(join(root, "backend", "src", "routes", "surveys.js"), "module.exports = {};");
  await writeFile(join(root, "backend", "src", "index.js"), "console.log('entry');");
  return root;
}

/** Non-git projede computeChangedScope audit write-event'lerinden değişen-dosya türetir → onları yaz. */
async function markChanged(root: string, files: string[]): Promise<void> {
  for (const f of files) {
    await appendAudit(root, {
      ts: ITER_TS + 1000,
      phase: 8,
      event: "ui-file-write",
      caller: "mycl-orchestrator",
      detail: f,
    });
  }
}

/** _pending/<ts>/iter-spec.md yaz (Faz 4 bu iterasyonda spec üretti varsayımı). */
async function writePendingSpec(root: string, body: string): Promise<void> {
  const { pendingDir } = deriveDevsPaths(root, ITER_TS);
  await mkdir(pendingDir, { recursive: true });
  await writeFile(pendingSpecPath(root, ITER_TS), body, "utf-8");
}

function makeState(root: string): State {
  return {
    project_root: root,
    iteration_started_at: ITER_TS,
    intent_summary: "kullanıcı sayfası + anket endpoint düzeltmesi",
  } as unknown as State;
}

describe("devs-finalize — iterasyon-sonu birim bölme", () => {
  let root: string;
  const tsLabel = formatIterationTs(ITER_TS);

  beforeEach(async () => {
    root = await setupProject();
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("ÇOK-BİRİM: iter-spec birincil birime (en çok dosya), ikincil birim spec_ref ile referans verir (kopya YOK)", async () => {
    // UsersPage + Widget → page:users (2 dosya, birincil); surveys.js → endpoint:surveys (1 dosya, ikincil).
    await markChanged(root, [
      "src/pages/UsersPage.jsx",
      "src/components/Widget.jsx",
      "backend/src/routes/surveys.js",
    ]);
    await writePendingSpec(root, "# iter-spec\nbu iterasyonun detaylı spec'i");

    const outcome = await finalizeDevsArtifacts(makeState(root));
    // Outcome: dokunulan birimler + birincil iter-spec yolu (Faz 4b refresh bunu tüketir).
    expect(outcome).not.toBeNull();
    expect(outcome!.units.map((u) => `${u.type}:${u.key}`).sort()).toEqual([
      "endpoint:surveys",
      "page:users",
    ]);
    expect(outcome!.iterSpecPath).toContain(join("pages", "users", tsLabel, "iter-spec.md"));

    const { devsRoot } = deriveDevsPaths(root, ITER_TS);
    // Birincil: tam iter-spec burada.
    const primarySpec = join(devsRoot, "pages", "users", tsLabel, "iter-spec.md");
    expect(await exists(primarySpec)).toBe(true);
    expect(await readFile(primarySpec, "utf-8")).toContain("detaylı spec");
    const primaryMeta = JSON.parse(
      await readFile(join(devsRoot, "pages", "users", tsLabel, "meta.json"), "utf-8"),
    );
    expect(primaryMeta.unit).toEqual({ type: "page", key: "users" });
    expect(primaryMeta.spec_ref).toBeUndefined();

    // İkincil: iter-spec KOPYALANMAZ, spec_ref birincile işaret eder.
    const secSpec = join(devsRoot, "endpoints", "surveys", tsLabel, "iter-spec.md");
    expect(await exists(secSpec)).toBe(false);
    const secMeta = JSON.parse(
      await readFile(join(devsRoot, "endpoints", "surveys", tsLabel, "meta.json"), "utf-8"),
    );
    expect(secMeta.unit).toEqual({ type: "endpoint", key: "surveys" });
    expect(secMeta.spec_ref).toBe(`../../pages/users/${tsLabel}/iter-spec.md`);

    // _pending taşındıktan sonra temizlenir.
    expect(await exists(deriveDevsPaths(root, ITER_TS).pendingDir)).toBe(false);
  });

  it("BİRİM YOK: sayfa/endpoint/tablo yoksa devs/<ts>/ doğrudan (çözümsüz kalmaz)", async () => {
    // Saf altyapı dosyası (backend entry) → resolver shared'a düşer → gerçek birim yok.
    await markChanged(root, ["backend/src/index.js"]);
    await writePendingSpec(root, "# iter-spec\naltyapı değişikliği");

    const outcome = await finalizeDevsArtifacts(makeState(root));
    expect(outcome!.units).toEqual([]);
    expect(outcome!.directDir).toContain(tsLabel);

    const { devsRoot } = deriveDevsPaths(root, ITER_TS);
    const directSpec = join(devsRoot, tsLabel, "iter-spec.md");
    expect(await exists(directSpec)).toBe(true);
    const meta = JSON.parse(await readFile(join(devsRoot, tsLabel, "meta.json"), "utf-8"));
    expect(meta.unit.type).toBe("shared");
    // pages/ altında hiçbir şey yok.
    expect(await exists(join(devsRoot, "pages"))).toBe(false);
  });

  it("SPEC YOK: _pending/iter-spec.md yoksa sessiz no-op (devs/ oluşmaz)", async () => {
    await markChanged(root, ["src/pages/UsersPage.jsx"]);
    // writePendingSpec çağrılmaz.
    expect(await finalizeDevsArtifacts(makeState(root))).toBeNull();
    const { devsRoot } = deriveDevsPaths(root, ITER_TS);
    expect(await exists(devsRoot)).toBe(false);
  });

  it("iteration_started_at yoksa no-op", async () => {
    const state = { project_root: root } as unknown as State;
    expect(await finalizeDevsArtifacts(state)).toBeNull();
    expect(await exists(join(root, "devs"))).toBe(false);
  });
});
