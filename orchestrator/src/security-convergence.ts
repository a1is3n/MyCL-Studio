// security-convergence — Faz 13 güvenlik fix-loop yakınsama-kırıcısı (YZLLM 2026-06-14: "MyCL'e yakınsama-kırıcı ekle").
//
// SORUN (gerçek-koşu): Faz 13 güvenlik bulgularını (semgrep owasp/secrets/audit) oto-düzeltmeye çalışırken bulgular
// HİÇ azalmıyordu (owasp 52 / semgrep 57 sabit) ama orkestratör fix→re-scan→fix sonsuz döngüsüne girip kotayı yakıyordu.
// Mevcut attempt-cap (_securityAutoResolveCount < 3) iterasyon başında sıfırlandığı için (deep-solution yeni iterasyon
// açınca) hiç dolmuyordu. ÇÖZÜM: deneme-sayısı yerine BULGU-AZALMASINA bak — azalmıyorsa yakınsamıyor → DUR, insana devret.
//
// Bu modül SAF karar mantığıdır (index.ts run-loop'undan ayrı) → orchestrator boot side-effect'i olmadan test edilir.

/** stderr'deki tüm "N Code Findings" (semgrep çıktısı) sayılarını topla. null → hiç sayı yok (parse edilemedi). */
export function sumSecurityFindings(stderr: string | undefined | null): number | null {
  if (!stderr) return null;
  const matches = [...stderr.matchAll(/(\d+)\s+Code Findings/gi)];
  if (matches.length === 0) return null;
  return matches.reduce((n, m) => n + Number(m[1]), 0);
}

export interface ConvergenceState {
  /** Önceki denemedeki toplam bulgu sayısı (null → ilk deneme / parse edilemedi). */
  prevFindings: number | null;
  /** Art arda "bulgu azalmadı" deneme sayısı. */
  noProgress: number;
}

export interface ConvergenceStep extends ConvergenceState {
  /** Hâlâ yakınsıyor mu — true: oto-düzeltmeye devam; false: DUR, bulguları insana devret. */
  converging: boolean;
}

/**
 * SAF: mevcut bulgu sayısını önceki duruma göre değerlendirir.
 * - Bulgu AZALDIYSA → ilerleme var, noProgress sıfırlanır.
 * - Bulgu azalmadıysa (>= önceki) → noProgress artar.
 * - noProgress >= threshold → yakınsamıyor (converging=false → oto-düzeltmeyi durdur, insana devret).
 * - curFindings null (parse edilemedi) → durum DEĞİŞMEZ; güvenli: var olan attempt-cap devreye girer, erken-durdurma yok.
 */
export function stepSecurityConvergence(
  state: ConvergenceState,
  curFindings: number | null,
  threshold = 2,
): ConvergenceStep {
  // curFindings null (bulgu sayısı ölçülemedi — örn. extra-scan'lar outcome.stderr'de değil) → İLERLEME YOK say
  // (noProgress++). Aksi halde breaker hiç tetiklenmez + cap kaldırıldığı için sonsuz auto-fix döngüsü olur.
  // Konservatif: belirsizken escalate/auto-accept'e doğru ittir (escalate zararsız, auto-accept loud-raporlu).
  if (curFindings === null) {
    const noProgress = state.noProgress + 1;
    return { prevFindings: state.prevFindings, noProgress, converging: noProgress < threshold };
  }
  const noProgress =
    state.prevFindings !== null && curFindings >= state.prevFindings ? state.noProgress + 1 : 0;
  return { prevFindings: curFindings, noProgress, converging: noProgress < threshold };
}
