#!/bin/bash
exec > /tmp/otg-toggle.log 2>&1
if pgrep -x scrcpy > /dev/null; then
    pkill -x scrcpy
else
    /usr/bin/scrcpy --otg -s wkbau8wkeubijz5h \
        --window-borderless \
        --window-width=160 \
        --window-height=120 \
        --window-x=-160 \
        --window-y=9999 &
    sleep 1.5
    hyprctl dispatch focuswindow title:scrcpy
fi