#!/bin/bash
exec > /tmp/otg-toggle.log 2>&1
if pgrep -x scrcpy > /dev/null; then
    pkill -x scrcpy
else
    /usr/bin/scrcpy --otg -s wkbau8wkeubijz5h &
fi
