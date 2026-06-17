#!/bin/bash
# MODE 2 (input-only mode) — software KVM via lan-mouse.
# Each laptop keeps its OWN screen. Push the cursor off the screen edge
# toward the peer to control it with this laptop's keyboard + mouse.
# While controlling the peer, ALL keys/shortcuts go to the peer.
# Release back to this machine: press Ctrl+Shift+Super+Alt together.
source "$(dirname "$0")/remote-peer.conf"

if pgrep -x lan-mouse >/dev/null; then
    pkill -x lan-mouse
    notify-send "Input sharing OFF" "lan-mouse stopped" \
        --icon=input-mouse --urgency=normal
else
    lan-mouse daemon >/tmp/lan-mouse.log 2>&1 &
    notify-send "Input sharing ON" \
        "Move cursor to the screen edge toward ${PEER_NAME}.\nRelease: Ctrl+Shift+Super+Alt" \
        --icon=input-mouse --urgency=normal
fi
