#!/bin/bash
echo "$1" | socat - UNIX-CONNECT:/tmp/cursor-daemon.sock
