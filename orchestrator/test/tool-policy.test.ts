// tool-policy — tehlikeli-Bash deny baseline'ının HER ZAMAN korunduğu güvenlik garantisi.
// YZLLM canlı-test 0620: CLI çağrıları bypassPermissions'a geçti (Bash izin-prompt hang'i);
// bu test rm/sudo/git-push'ın deny-list'ten DÜŞMEDİĞİNİ kanıtlar (bypassPermissions güvenli).

import { describe, expect, it } from "vitest";
import {
  DANGEROUS_BASH_DENY,
  withDangerousBashDeny,
  READ_ONLY_DISALLOWED_TOOLS,
  PURE_REASONING_DISALLOWED_TOOLS,
} from "../src/tool-policy.js";

describe("withDangerousBashDeny (bypassPermissions güvenlik baseline'ı)", () => {
  it("undefined deny-list → yalnız tehlikeli-Bash baseline", () => {
    expect(withDangerousBashDeny(undefined)).toEqual(DANGEROUS_BASH_DENY);
  });

  it("READ_ONLY (rm-deny YOK) + baseline → rm/sudo/git-push artık bloklu", () => {
    const merged = withDangerousBashDeny(READ_ONLY_DISALLOWED_TOOLS);
    expect(merged).toContain("Bash(rm *)");
    expect(merged).toContain("Bash(sudo *)");
    expect(merged).toContain("Bash(git push *)");
    // salt-okunur yazma yasağı da korunur
    expect(merged).toContain("Write");
    expect(merged).toContain("Edit");
  });

  it("dedup: baseline zaten varsa tekrar etmez", () => {
    const merged = withDangerousBashDeny(["Bash(rm *)", "Write"]);
    expect(merged.filter((t) => t === "Bash(rm *)").length).toBe(1);
  });

  it("saf-akıl (Bash tümden yasak) + baseline → Bash hâlâ var, baseline zararsız-fazlalık", () => {
    const merged = withDangerousBashDeny(PURE_REASONING_DISALLOWED_TOOLS);
    expect(merged).toContain("Bash");
    expect(merged).toContain("Bash(rm *)");
  });
});
