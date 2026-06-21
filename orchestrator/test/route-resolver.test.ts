import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveUnits, urlToSlug, pageFileSlug } from "../src/fix/route-resolver.js";

describe("route-resolver — slug yardımcıları (saf)", () => {
  it("urlToSlug: /→root, /users→users, /surveys/results→surveys-results, *→root", () => {
    expect(urlToSlug("/")).toBe("root");
    expect(urlToSlug("/users")).toBe("users");
    expect(urlToSlug("/surveys/results")).toBe("surveys-results");
    expect(urlToSlug("*")).toBe("root");
  });
  it("pageFileSlug: UsersPage→users, SurveyResponsePage→survey-response", () => {
    expect(pageFileSlug("src/pages/UsersPage.jsx")).toBe("users");
    expect(pageFileSlug("src/pages/SurveyResponsePage.jsx")).toBe("survey-response");
  });
});

describe("route-resolver — resolveUnits (fallback zinciri: sayfa→endpoint→tablo→shared)", () => {
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "route-resolver-"));
    await mkdir(join(root, "src", "pages"), { recursive: true });
    await mkdir(join(root, "src", "components"), { recursive: true });
    await mkdir(join(root, "backend", "src", "routes"), { recursive: true });
    await mkdir(join(root, "migrations"), { recursive: true });
    await writeFile(
      join(root, "src", "App.jsx"),
      [
        "import UsersPage from './pages/UsersPage';",
        "import SurveyResponsePage from './pages/SurveyResponsePage';",
        "function App() {",
        "  return (",
        "    <Routes>",
        "      <Route path=\"/users\" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />",
        "      <Route path=\"/surveys\" element={<ProtectedRoute><SurveyResponsePage /></ProtectedRoute>} />",
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
    await writeFile(
      join(root, "migrations", "001-init.sql"),
      "CREATE TABLE IF NOT EXISTS survey_responses (id INTEGER);",
    );
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("PAGE: route-map'ten URL slug (UsersPage → /users → users)", async () => {
    const u = await resolveUnits(root, ["src/pages/UsersPage.jsx"]);
    expect(u).toEqual([{ type: "page", key: "users", files: ["src/pages/UsersPage.jsx"] }]);
  });

  it("PAGE: SurveyResponsePage → /surveys → 'surveys' (URL otorite, dosya-adı değil)", async () => {
    const u = await resolveUnits(root, ["src/pages/SurveyResponsePage.jsx"]);
    expect(u[0]).toMatchObject({ type: "page", key: "surveys" });
  });

  it("ENDPOINT: backend/.../routes/surveys.js → endpoint 'surveys'", async () => {
    const u = await resolveUnits(root, ["backend/src/routes/surveys.js"]);
    expect(u).toEqual([
      { type: "endpoint", key: "surveys", files: ["backend/src/routes/surveys.js"] },
    ]);
  });

  it("TABLE: migration CREATE TABLE → tablo adı (survey_responses)", async () => {
    const u = await resolveUnits(root, ["migrations/001-init.sql"]);
    expect(u).toEqual([
      { type: "table", key: "survey_responses", files: ["migrations/001-init.sql"] },
    ]);
  });

  it("SHARED: altyapı dosyası (backend index, sayfa/endpoint/tablo değil) → _shared", async () => {
    const u = await resolveUnits(root, ["backend/src/index.js"]);
    expect(u).toEqual([{ type: "shared", key: "_shared", files: ["backend/src/index.js"] }]);
  });

  it("PAYLAŞILAN component → onu kullanan sayfa(lar)a (dep-graph; Widget → UsersPage → users)", async () => {
    const u = await resolveUnits(root, ["src/components/Widget.jsx"]);
    expect(u.some((x) => x.type === "page" && x.key === "users")).toBe(true);
  });

  it("ÇOK-BİRİM: aynı koşuda farklı dosyalar farklı birimlere ayrışır", async () => {
    const u = await resolveUnits(root, [
      "src/pages/UsersPage.jsx",
      "backend/src/routes/surveys.js",
    ]);
    const keys = u.map((x) => `${x.type}:${x.key}`).sort();
    expect(keys).toEqual(["endpoint:surveys", "page:users"]);
  });
});
