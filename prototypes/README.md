# prototypes/ — golden prototip önbelleği (git'te, public)

MyCL bir projeyi **tam-yeşil** koşturduğunda (gate-fail yok), o stack'in baseline iskelesini
(config + giriş dosyaları + `public/**`; feature/business kodu HARİÇ) buraya kaydeder:

```
prototypes/<tam-stack>/            # ör. node-npm_typescript_react/
prototypes/<tam-stack>.meta.json   # stack, tarih, dosya sayısı (bayatlama tespiti)
```

`<tam-stack>` = base stack + spec'ten dil/framework (deterministik parmak izi). Yeni bir proje
aynı stack'te ise, codegen BAŞLAMADAN bu baseline projeye kopyalanır → sıfırdan değil,
doğrulanmış iskele üzerine geliştirilir (hızlı + sağlam başlangıç).

**Neden git'te (public):** taze bir clone'da hazır prototipler gelsin → her makinede hızlı
başlangıç. İçerik yalnız iskele/config'dir; sır içermez (secrets ASLA buraya girmez).

Kod: [orchestrator/src/prototype-cache.ts](../orchestrator/src/prototype-cache.ts)
(`snapshotPrototype` yazar, `applyPrototype` okur). Test/izole koşu için `MYCL_PROTOTYPES_DIR`
env override'ı vardır.
