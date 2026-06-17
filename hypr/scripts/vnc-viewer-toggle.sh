#!/bin/bash
# MODE 1 (screen mode) — VIEWER side.
# Opens the peer laptop's screen in a window so you can see and control it.
source "$(dirname "$0")/remote-peer.conf"

if pgrep -x vncviewer >/dev/null; then
    pkill -x vncviewer
    notify-send "Remote view closed" "Disconnected from ${PEER_NAME}" \
        --icon=network-offline --urgency=normal
else
    notify-send "Connecting…" "Opening ${PEER_NAME} (${PEER_IP}:${VNC_PORT})" \
        --icon=network-transmit --urgency=normal
    vncviewer "${PEER_IP}:${VNC_PORT}" >/tmp/vncviewer.log 2>&1 &
fi
