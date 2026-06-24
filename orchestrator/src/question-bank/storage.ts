// İkili Soru Bankası — atomic depolama (I/O, Dilim 2).
//
// Banka dosyaları write-temp-then-rename ile yazılır: module-parallel codegen
// worktree'leri aynı KEY'e yarışırsa yarı-yazılmış/pre-review banka asla
// okunmaz (last-writer-wins sessiz overwrite yerine atomic değişim). rename
// aynı dosya-sisteminde atomiktir.

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { QuestionBank } from "./types.js";

/** Aynı-process içi temp-adı çakışmasını önleyen sayaç (pid + sayaç benzersiz). */
let tmpCounter = 0;

/**
 * Bankayı atomik yaz: dirname oluştur → temp dosyaya yaz → rename. Okuyucu
 * yalnız tam-yazılmış dosyayı görür.
 */
export async function writeBankAtomic(path: string, bank: QuestionBank): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${tmpCounter++}.tmp`;
  await writeFile(tmp, JSON.stringify(bank, null, 2) + "\n", "utf-8");
  await rename(tmp, path);
}

/** Bankayı oku. Dosya yoksa null (caller üretime düşer). JSON bozuksa throw. */
export async function readBank(path: string): Promise<QuestionBank | null> {
  let raw: string;
  try {
    raw = await readFile(path, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  return JSON.parse(raw) as QuestionBank;
}
