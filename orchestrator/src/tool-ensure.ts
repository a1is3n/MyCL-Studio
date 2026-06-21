// tool-ensure — güvenlik araçlarını RUNTIME'da garanti et (YZLLM "güvenlik aracı atlanamaz").
//
// setup.sh yeni makinede kurar; bu modül çalışma-anında bir araç EKSİKSE KURMAYI dener
// (mac: brew, linux: go/pipx) → sessiz skip YOK. Kurulamazsa GÖRÜNÜR hata + false döner;
// çağıran taramayı eksik koşar ama kullanıcı bunu bilir (sahte-yeşil yok).
//
// NOT (linux): `go install` ~/go/bin'e koyar; o dizin PATH'te değilse aynı süreçte bulunmaz —
// bu yüzden install sonrası ~/go/bin'i de kontrol ederiz. Birincil kurulum yolu setup.sh'tir.

import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { emitChatMessage } from "./ipc.js";
import { log } from "./logger.js";

const INSTALL_TIMEOUT_MS = 240_000;

const RECIPE: Record<string, { brew: string; go?: string }> = {
  nuclei: { brew: "nuclei", go: "github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest" },
  katana: { brew: "katana", go: "github.com/projectdiscovery/katana/cmd/katana@latest" },
  semgrep: { brew: "semgrep" }, // go paketi yok → brew (mac) / pipx (linux)
};

function installed(bin: string): boolean {
  try {
    execFileSync("sh", ["-c", `command -v ${bin}`], { stdio: "ignore" });
    return true;
  } catch {
    return existsSync(join(homedir(), "go", "bin", bin)); // go install hedefi (PATH dışı olabilir)
  }
}

/** Kurulum komutunu (brew/go/pipx) çalıştır — gerçek env (brew/go PATH gerekir). Bounded. */
function runInstall(cmd: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok);
    };
    let child: ReturnType<typeof spawn>;
    try {
      // Güvenilir kurulum komutu → gerçek env (brew/go'yu PATH'te bulsun).
      child = spawn(cmd, { shell: true, stdio: "ignore", env: { ...process.env } });
    } catch {
      resolve(false);
      return;
    }
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* zaten ölmüş */
      }
      done(false);
    }, INSTALL_TIMEOUT_MS);
    child.on("error", () => done(false));
    child.on("close", (code) => done(code === 0));
  });
}

/**
 * Güvenlik aracını garanti et: kuruluysa true; değilse KURMAYI dener (mac brew / linux go|pipx).
 * Kurulamazsa GÖRÜNÜR hata + false (sessiz atlama YOK). Bilinmeyen araç → false.
 */
export async function ensureSecurityTool(bin: string): Promise<boolean> {
  if (installed(bin)) return true;
  const r = RECIPE[bin];
  if (!r) return false;
  emitChatMessage("system", `🔧 Güvenlik aracı \`${bin}\` kurulu değil — kuruluyor (atlanmaz, biraz sürebilir)…`);
  log.info("tool-ensure", "installing", { bin });
  const os = platform();
  if (os === "darwin" && installed("brew")) {
    if ((await runInstall(`brew install ${r.brew}`)) && installed(bin)) return ok(bin);
  }
  if (r.go && installed("go")) {
    if ((await runInstall(`GOBIN="$HOME/go/bin" go install ${r.go}`)) && installed(bin)) return ok(bin);
  }
  if (bin === "semgrep") {
    if (installed("pipx") && (await runInstall("pipx install semgrep")) && installed(bin)) return ok(bin);
    if (installed("pip3") && (await runInstall("pip3 install --user semgrep")) && installed(bin)) return ok(bin);
  }
  emitChatMessage(
    "error",
    `❌ \`${bin}\` kurulamadı — güvenlik taraması bu araç olmadan EKSİK kalır (atlanmadı, bilgi veriliyor). ` +
      `Elle kur: \`brew install ${r.brew}\`${r.go ? ` veya \`go install ${r.go}\`` : ""}, sonra tekrar dene.`,
  );
  return false;
}

function ok(bin: string): boolean {
  emitChatMessage("system", `✓ \`${bin}\` kuruldu.`);
  return true;
}

/** Birden çok aracı sırayla garanti et (brew/go kilidi çakışmasın). Hepsi kurulu mu döner. */
export async function ensureSecurityTools(bins: string[]): Promise<boolean> {
  let all = true;
  for (const b of bins) {
    if (!(await ensureSecurityTool(b))) all = false;
  }
  return all;
}
