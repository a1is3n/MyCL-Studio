#!/usr/bin/env bash
# desktop-icon.sh — MyCL Studio'yu masaüstüne kısayol/ikon olarak koy (macOS + Linux).
#
# Paketlenmiş uygulama gerekir (`npm run tauri build`). Yoksa görünür hata + ne yapılacağını söyler.
# Çift-tıkla açılınca uygulama ilk açılışta API anahtarlarını zaten sorar.

set -uo pipefail
cd "$(dirname "$0")/.."
OS="$(uname -s)"

if [ "$OS" = "Darwin" ]; then
  APP="$(find src-tauri/target/release/bundle/macos -maxdepth 1 -name '*.app' 2>/dev/null | head -1)"
  if [ -z "$APP" ]; then
    echo "✗ Paketlenmiş .app yok — önce: npm run tauri build"
    exit 1
  fi
  ln -sf "$(pwd)/$APP" "$HOME/Desktop/$(basename "$APP")"
  echo "✓ Masaüstüne kısayol kondu: $(basename "$APP") (çift-tıkla aç)"
else
  # Linux: çalıştırılabilir binary'yi bul (bundle/ veya release/ kökü).
  BIN="$(find src-tauri/target/release -maxdepth 1 -type f -perm -u+x ! -name '*.so' 2>/dev/null | head -1)"
  if [ -z "$BIN" ]; then
    echo "✗ Paketlenmiş binary yok — önce: npm run tauri build"
    exit 1
  fi
  ICON="$(pwd)/src-tauri/icons/128x128.png"
  DESK="$HOME/Desktop/MyCL-Studio.desktop"
  mkdir -p "$HOME/Desktop" "$HOME/.local/share/applications"
  cat > "$DESK" <<EOF
[Desktop Entry]
Type=Application
Name=MyCL Studio
Comment=Yapay zeka destekli yazılım geliştirme
Exec=$BIN
Icon=$ICON
Terminal=false
Categories=Development;
EOF
  chmod +x "$DESK"
  cp "$DESK" "$HOME/.local/share/applications/MyCL-Studio.desktop" 2>/dev/null || true
  echo "✓ Masaüstü kısayolu oluşturuldu: $DESK (çift-tıkla aç)"
fi
