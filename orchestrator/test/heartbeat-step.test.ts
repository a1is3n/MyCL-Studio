// describeStep — heartbeat'in "şu anki adım" metni. YZLLM 2026-06-12: basit "çalışıyor" değil, modelin
// SON YAPTIĞI/üzerinde çalıştığı somut adım (tool_use → "X yazılıyor / npm test çalıştırılıyor"). text=reasoning atlanır.

import { describe, expect, it } from "vitest";
import { describeStep } from "../src/ipc.js";

describe("ipc · describeStep (heartbeat adım metni)", () => {
  it("Bash → çalışılan DOSYA adı; dosya yoksa generic 'komut çalıştırılıyor'", () => {
    expect(describeStep({ sub: "tool_use", tool_name: "Bash", tool_input: { command: "npm test" } })).toBe(
      "komut çalıştırılıyor",
    );
    expect(
      describeStep({ sub: "tool_use", tool_name: "Bash", tool_input: { command: "cat backend/src/index.js | head" } }),
    ).toBe("`index.js` üzerinde çalışılıyor");
    expect(
      describeStep({ sub: "tool_use", tool_name: "Bash", tool_input: { command: "sed -n '1,5p' a/b/CLAUDE.md" } }),
    ).toBe("`CLAUDE.md` üzerinde çalışılıyor");
  });

  it("Write/Edit/Read → YALNIZ dosya adı (basename, yol değil)", () => {
    expect(
      describeStep({ sub: "tool_use", tool_name: "Write", tool_input: { file_path: "backend/src/utils/sanitize.js" } }),
    ).toBe("`sanitize.js` yazılıyor");
    expect(
      describeStep({ sub: "tool_use", tool_name: "Edit", tool_input: { file_path: "backend/src/index.js" } }),
    ).toBe("`index.js` düzenleniyor");
    expect(describeStep({ sub: "tool_use", tool_name: "Read", tool_input: { file_path: "a.js" } })).toBe(
      "`a.js` okunuyor",
    );
  });

  it("Glob/Grep → arama; bilinmeyen tool → generic", () => {
    expect(describeStep({ sub: "tool_use", tool_name: "Grep", tool_input: { pattern: "TODO" } })).toBe(
      "`TODO` aranıyor",
    );
    expect(describeStep({ sub: "tool_use", tool_name: "WeirdTool" })).toBe("WeirdTool aracı kullanılıyor");
  });

  it("text/non-tool_use → null (reasoning gürültüsü adım sayılmaz)", () => {
    expect(describeStep({ sub: "text" })).toBeNull();
    expect(describeStep({ sub: "init" })).toBeNull();
    expect(describeStep({ sub: "tool_use" })).toBeNull(); // tool_name yok
  });
});
