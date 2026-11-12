#!/bin/sh
# Pasang jadwal harian 02.30 (waktu Mac) untuk scripts/cadangan-tarik-mac.sh. Dijalankan pemilik sekali:
#   sh scripts/cadangan-tarik-pasang.sh        (lepas: launchctl bootout gui/$(id -u)/com.solvinc.ibv-cadangan-tarik)
set -eu
P="$HOME/Library/LaunchAgents/com.solvinc.ibv-cadangan-tarik.plist"
SCRIPT="$(cd "$(dirname "$0")" && pwd)/cadangan-tarik-mac.sh"
mkdir -p "$HOME/Backups/ibukotavalasindo" "$HOME/Library/LaunchAgents"
cat > "$P" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.solvinc.ibv-cadangan-tarik</string>
  <key>ProgramArguments</key><array><string>/bin/sh</string><string>$SCRIPT</string></array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>2</integer><key>Minute</key><integer>30</integer></dict>
  <key>StandardOutPath</key><string>$HOME/Backups/ibukotavalasindo/tarik.log</string>
  <key>StandardErrorPath</key><string>$HOME/Backups/ibukotavalasindo/tarik.log</string>
</dict></plist>
EOF
plutil -lint "$P"
launchctl bootout "gui/$(id -u)" "$P" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$P"
echo "Terpasang. Log: ~/Backups/ibukotavalasindo/tarik.log"
