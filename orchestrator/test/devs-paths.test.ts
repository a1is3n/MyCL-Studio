import { describe, expect, it } from "vitest";
import {
  formatIterationTs,
  deriveDevsPaths,
  pendingSpecPath,
  currentSpecPath,
  currentSpecRelPath,
  withDevsPath,
} from "../src/devs-paths.js";
import type { ProductionConfig } from "../src/types.js";

const TS_RE = /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/;

describe("devs-paths (Faz 0)", () => {
  it("formatIterationTs → YYYY-MM-DD-HH-MM-SS biçimi (timezone-bağımsız)", () => {
    expect(formatIterationTs(1781600000000)).toMatch(TS_RE);
  });

  it("formatIterationTs deterministik — aynı ms her zaman aynı etiket (resume invaryantı)", () => {
    expect(formatIterationTs(1781600000000)).toBe(formatIterationTs(1781600000000));
  });

  it("formatIterationTs farklı ms → farklı etiket", () => {
    expect(formatIterationTs(1781600000000)).not.toBe(formatIterationTs(1781600060000));
  });

  it("deriveDevsPaths yolları doğru türetir (pendingDir = devs/_pending/<ts>)", () => {
    const p = deriveDevsPaths("/proj", 1781600000000);
    expect(p.devsRoot).toBe("/proj/devs");
    expect(p.tsLabel).toMatch(TS_RE);
    expect(p.pendingDir).toBe(`/proj/devs/_pending/${p.tsLabel}`);
  });
});

describe("devs-paths — Faz 2/3 spec yazım/okuma yolları", () => {
  const ts = 1781600000000;
  const label = formatIterationTs(ts);

  it("pendingSpecPath = devs/_pending/<ts>/iter-spec.md (MUTLAK)", () => {
    expect(pendingSpecPath("/proj", ts)).toBe(`/proj/devs/_pending/${label}/iter-spec.md`);
  });

  it("currentSpecPath: ts varsa per-iter, yoksa kök .mycl/spec.md (defansif fallback)", () => {
    expect(currentSpecPath({ project_root: "/proj", iteration_started_at: ts })).toBe(
      `/proj/devs/_pending/${label}/iter-spec.md`,
    );
    expect(currentSpecPath({ project_root: "/proj" })).toBe("/proj/.mycl/spec.md");
  });

  it("currentSpecRelPath: projectRoot-RELATIVE (agent prompt için)", () => {
    expect(currentSpecRelPath({ iteration_started_at: ts })).toBe(`devs/_pending/${label}/iter-spec.md`);
    expect(currentSpecRelPath({})).toBe(".mycl/spec.md");
  });

  it("withDevsPath: spec.md→iter-spec.md, brief.md korunur, ts yoksa DEĞİŞMEZ (parite choke-point)", () => {
    const spec: ProductionConfig = {
      write_tool_name: "write_spec",
      approval_tool_name: "request_spec_approval",
      output_artifact_path: ".mycl/spec.md",
    };
    expect(
      withDevsPath(spec, { project_root: "/proj", iteration_started_at: ts }).output_artifact_path,
    ).toBe(`devs/_pending/${label}/iter-spec.md`);

    const brief: ProductionConfig = { ...spec, output_artifact_path: ".mycl/brief.md" };
    expect(
      withDevsPath(brief, { project_root: "/proj", iteration_started_at: ts }).output_artifact_path,
    ).toBe(`devs/_pending/${label}/brief.md`);

    // iteration_started_at yok → config DEĞİŞMEDEN döner (güvenli fallback)
    expect(withDevsPath(spec, { project_root: "/proj" }).output_artifact_path).toBe(".mycl/spec.md");
  });
});
