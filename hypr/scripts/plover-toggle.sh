#!/bin/bash

if pgrep -x "plover" > /dev/null; then
    # Plover is running — toggle output on/off
    plover_send_command toggle
    notify-send "Plover" "Steno toggled" --icon=keyboard
else
    # Plover not running — start it then enable
    plover &
    sleep 2
    plover_send_command toggle
    notify-send "Plover" "Steno STARTED & ENABLED" --icon=keyboard
fi