#!/bin/bash

PIDFILE="/tmp/wl-kbptr.pid"

# If already running, kill it and exit
if [ -f "$PIDFILE" ]; then
    PID=$(cat "$PIDFILE")
    if kill -0 "$PID" 2>/dev/null; then
        kill "$PID"
        rm -f "$PIDFILE"
        exit 0
    fi
fi

# Not running — start it and save PID
wl-kbptr -o modes=floating,click -o mode_floating.source=detect &
echo $! > "$PIDFILE"
