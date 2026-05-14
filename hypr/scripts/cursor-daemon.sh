#!/bin/bash
# cursor-daemon.sh — handles diagonal movement and hold click

SOCKET="/tmp/cursor-daemon.sock"
STEP=30

# Clean up old socket
rm -f "$SOCKET"

declare -A keys_held=()
left_held=false
right_held=false

move_cursor() {
    local dx=0
    local dy=0

    [[ "${keys_held[up]}"    == "1" ]] && dy=$((dy - STEP))
    [[ "${keys_held[down]}"  == "1" ]] && dy=$((dy + STEP))
    [[ "${keys_held[left]}"  == "1" ]] && dx=$((dx - STEP))
    [[ "${keys_held[right]}" == "1" ]] && dx=$((dx + STEP))

    [[ $dx -ne 0 || $dy -ne 0 ]] && wlrctl pointer move $dx $dy
}

# Listen for commands over socket
while true; do
    cmd=$(nc -lU "$SOCKET" 2>/dev/null)
    case "$cmd" in
        press:up)    keys_held[up]=1 ;;
        release:up)  keys_held[up]=0 ;;
        press:down)  keys_held[down]=1 ;;
        release:down) keys_held[down]=0 ;;
        press:left)  keys_held[left]=1 ;;
        release:left) keys_held[left]=0 ;;
        press:right) keys_held[right]=1 ;;
        release:right) keys_held[right]=0 ;;
        press:lclick)
            wlrctl pointer click
            left_held=true ;;
        release:lclick)
            left_held=false ;;
        press:rclick)
            wlrctl pointer click right
            right_held=true ;;
        release:rclick)
            right_held=false ;;
    esac
    move_cursor
done
