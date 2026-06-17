#!/bin/bash
# MODE 1 (screen mode) — SERVER side.
# Shares THIS laptop's screen over VNC so the peer can see and control it.
# Uses GPU capture (-g) + in-frame cursor rendering (-r) so the pointer
# shows correctly inside the viewer window.
source "$(dirname "$0")/remote-peer.conf"

if pgrep -x wayvnc >/dev/null; then
    pkill -x wayvnc
    hyprctl keyword cursor:no_hardware_cursors false >/dev/null
    notify-send "Screen share OFF" "VNC server stopped" \
        --icon=network-offline --urgency=normal
else
    # wayvnc needs hardware cursors off on Hyprland, or capturing crashes
    hyprctl keyword cursor:no_hardware_cursors true >/dev/null
    wayvnc -g -r 0.0.0.0 "$VNC_PORT" >/tmp/wayvnc.log 2>&1 &
    IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}')
    notify-send "Screen share ON" "Peer can connect to:\n${IP}:${VNC_PORT}" \
        --icon=network-transmit --urgency=normal
fi
