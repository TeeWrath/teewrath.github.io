#!/bin/sh
# Render each cover's HTML to a PNG at its platform's upload size with
# headless Chrome. The budget gives Geist time to load from Google Fonts.
set -e
cd "$(dirname "$0")"
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

shot() { # name width height [scale]
  "$chrome" --headless=new --disable-gpu --hide-scrollbars \
    --force-device-scale-factor="${4:-1}" --window-size="$2,$3" \
    --virtual-time-budget=8000 --screenshot="$PWD/$1.png" "file://$PWD/$1.html" 2>/dev/null
}

shot cover-x        1500  500
shot cover-linkedin 1584  396
shot cover-facebook 1640  720
shot cover-youtube  2560 1440
shot covers-preview 1056 1866 2
