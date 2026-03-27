#!/usr/bin/env python3
import uinput
import socket
import os
import threading
import time

SOCKET_PATH = "/tmp/cursor-daemon.sock"
STEP = 10
INTERVAL = 0.016

device = uinput.Device(
    [
        uinput.REL_X,
        uinput.REL_Y,
        uinput.BTN_LEFT,
        uinput.BTN_RIGHT,
    ]
)

time.sleep(1)

keys = {
    "up": False,
    "down": False,
    "left": False,
    "right": False,
}
lock = threading.Lock()
last_press_time = {}


def move_loop():
    while True:
        time.sleep(INTERVAL)
        with lock:
            now = time.time()
            # Auto-release movement keys only after 500ms
            for key in ["up", "down", "left", "right"]:
                if keys[key] and (now - last_press_time.get(key, 0)) > 0.5:
                    keys[key] = False

            dx = 0
            dy = 0
            if keys["up"]:
                dy -= STEP
            if keys["down"]:
                dy += STEP
            if keys["left"]:
                dx -= STEP
            if keys["right"]:
                dx += STEP
            if dx != 0 or dy != 0:
                if dx != 0:
                    device.emit(uinput.REL_X, dx, syn=False)
                if dy != 0:
                    device.emit(uinput.REL_Y, dy, syn=False)
                device.syn()


threading.Thread(target=move_loop, daemon=True).start()

if os.path.exists(SOCKET_PATH):
    os.remove(SOCKET_PATH)

server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
server.bind(SOCKET_PATH)
server.listen(5)

while True:
    conn, _ = server.accept()
    cmd = conn.recv(64).decode().strip()
    conn.close()
    with lock:
        if cmd == "press:up":
            keys["up"] = True
            last_press_time["up"] = time.time()
        elif cmd == "release:up":
            keys["up"] = False
        elif cmd == "press:down":
            keys["down"] = True
            last_press_time["down"] = time.time()
        elif cmd == "release:down":
            keys["down"] = False
        elif cmd == "press:left":
            keys["left"] = True
            last_press_time["left"] = time.time()
        elif cmd == "release:left":
            keys["left"] = False
        elif cmd == "press:right":
            keys["right"] = True
            last_press_time["right"] = time.time()
        elif cmd == "release:right":
            keys["right"] = False
        elif cmd == "press:lclick":
            device.emit(uinput.BTN_LEFT, 1)
        elif cmd == "release:lclick":
            device.emit(uinput.BTN_LEFT, 0)
        elif cmd == "press:rclick":
            device.emit(uinput.BTN_RIGHT, 1)
        elif cmd == "release:rclick":
            device.emit(uinput.BTN_RIGHT, 0)
