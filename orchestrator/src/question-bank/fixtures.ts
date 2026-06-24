// İkili Soru Bankası — fixture materyalizasyonu (I/O, Dilim 2).
//
// Bir fixture, check'in ayırt-ediciliğini kanıtlamak için izole bir temp
// dizinine yazılan minik dosya-ağacıdır. Meta-test bu dizinde check'i koşar.

import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import type { Fixture } from "./types.js";

/** Benzersiz bir temp dizini aç (mycl-qbank- öneki). */
export async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "mycl-qbank-"));
}

/** Fixture dosyalarını `dir` içine yaz (alt-dizinleri oluşturur). */
export async function materializeFixture(dir: string, fixture: Fixture): Promise<void> {
  for (const [rel, content] of Object.entries(fixture.files)) {
    const abs = join(dir, rel);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, content, "utf-8");
  }
}

/** Temp dizini güvenli sil (hata yutulmaz; çağıran log'lar). */
export async function cleanupTempDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}
