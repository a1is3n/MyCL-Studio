# MyCL Studio — proje talimatları

## Değişmez katı kurallar (her zaman sağlam ilerle)

Bu kurallar her oturumda, her işte geçerlidir — koddan ve aşağıdaki gate'ten önce gelir.
Yeni bir katı kural konuşulduğunda buraya ekle (tek doğruluk kaynağı budur).

1. **Stack-bağımsızlık.** Güvenlik taraması butonu dahil MyCL'deki HER süreç stack-bağımsızdır.
   Stack'e bağlı her komut (lint/test/build/security/perf/e2e) [stack profilinden](assets/profiles/)
   okunur; `npm`/`Next.js`/tek bir framework hiçbir yere hardcode EDİLMEZ. Framework-spesifik
   mantık (örn. dosya→route eşlemesi) agnostik olmalı VEYA güvenli fallback'e düşmeli (kuşkuda full).
2. **Kalite sabit kısıt; yarım iş yok.** Hız yalnız kaliteyi DÜŞÜRMEYEN yerde. Bir işi ya tam bitir
   ya da temiz bir sınırda durup durumu dürüstçe söyle — yarım/half-finished bırakma.
3. **Doğrula sonra iddia et.** "Çalışıyor / bitti / temiz" demeden ÖNCE kanıtla (ilgili kod-yolunu
   gez, testi/komutu koş). Araç çıktısını, kendi varsayımını, hatta kullanıcı çerçevesini kendi
   kanıtınla doğrula.
4. **Sessiz fallback yok.** Hiçbir şey sessizce bozulmasın/atlanmasın → görünür hata + dur.
   Güvenlik aracı eksikse atlamak YOK: ya kur ya görünür hata ver.
5. **MyCL-kodu vs proje-spesifik.** MyCL'in tekrar-takıldığı / loop / yanlış-teşhis = MyCL kodunda
   BEN çözerim; proje-spesifik sorun = MyCL'in runtime işi. İkisini karıştırma.
6. **Önden-çöz (correct-by-construction).** Doğruyu kaynağında kur (doğru talimat/tip/default) —
   sonradan gate/test/retry ile yakalamak yerine. Gate son-çare emniyet ağıdır, ilk savunma değil.
7. **Çapraz-platform = macOS + Linux.** Windows kapsam dışı; araç eksikse görünür + fail-closed.
8. **Faz 5 sonrası uygulama AÇILIR.** UI kurulduktan sonra MyCL uygulamayı ÇALIŞTIRIR (dev server +
   tarayıcı) — inceleme/kullanıcı için ayakta olmalı; sessizce geçmez.
9. **Faz 6 HER ZAMAN kullanıcıdan inceleme ister.** UI'lı projede (skip_ui_phases=false) Faz 6 ASLA
   atlanmaz/oto-geçilmez; uygulamayı açıp kullanıcı UI'yi inceleyip karar verene kadar park eder
   (kullanıcı sürer; spec-keyword heuristiğiyle skip YASAK).
10. **README güncel kalsın.** Kullanıcıya görünür bir özellik/davranış değiştiğinde README'yi AYNI
    değişiklikte güncelle ve push'la — README hiçbir zaman bayat kalmasın (özellikler tek bakışta doğru
    görünsün). Saf-iç fix'te (test/CI/refactor) README değişmez ama her seferinde "değişti mi?" diye bak.

## Geliştirme sonrası gate (DEĞİŞMEZ KURAL)

Bu projede her anlamlı kod/davranış değişikliğinden sonra **`npm run check`** koş.
Tek doğruluk kaynağı [scripts/check.sh](scripts/check.sh): build + test + frontend
typecheck + sızıntı + eski-iddia taraması. Detay: [dev.md](dev.md).

- Gerçek zorlayıcı **CI**'dır ([.github/workflows/check.yml](.github/workflows/check.yml)) —
  her push'ta sunucuda koşulsuz çalışır; ben (AI) onu çağırmayı atlasam bile devreye girer.
- Yine de **push'tan önce yerelde `npm run check` koş** ki kırmızıyı CI'dan önce gör.
- **Yerel-yeşil ≠ CI-yeşil.** Bir fix'i "düzeldi/çözüldü" diye iddia etmeden ÖNCE CI'nın GERÇEKTEN
  yeşile döndüğünü gör (gerçek ortam = hâkim). Yerel hızlı/çekirdek-sayısı/stray-server gibi farklar
  CI'da bambaşka davranabilir (bu oturum: 4 "kök" hipotezi yerelde geçip CI'da çürüdü). Kanıtlanmamış
  teşhisi "GERÇEK kök" diye commit'leme; "hipotez — CI doğrulaması bekliyor" de.
- Otomatize edilemeyen tek iş: **zihinsel kod-yolu gezintisi** — değişen path'leri elle
  gez, kullanıcıdan önce bug'ı yakala.

Yeni bir kontrol gerekiyorsa prose listeye değil, `scripts/check.sh`'e ekle.
