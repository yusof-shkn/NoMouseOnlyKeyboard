#!/bin/bash
# Switch keyboard + mouse over to the peer (laptop 1) without using the screen edge.
# Same effect as shoving the cursor off the edge. Bound to SUPER+H.
# Release control back to this laptop: press Ctrl+Shift+Super+Alt.
source "$(dirname "$0")/remote-peer.conf"

# Make sure the daemon is up (autostart normally handles this)
pgrep -x lan-mouse >/dev/null || { lan-mouse daemon >/tmp/lan-mouse.log 2>&1 & sleep 1; }

# Find the peer's client id by hostname, then activate it
ID=$(lan-mouse cli list 2>/dev/null | awk -v p="$PEER_NAME" '$0 ~ p {gsub(/[^0-9]/,"",$2); print $2; exit}')
[ -z "$ID" ] && ID=0
lan-mouse cli activate "$ID"
