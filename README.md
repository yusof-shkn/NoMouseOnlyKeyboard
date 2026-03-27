# dotfiles

My personal Arch Linux dotfiles running on Hyprland.

## Setup

- **OS**: Arch Linux
- **WM**: Hyprland
- **Bar**: Waybar
- **Launcher**: Rofi / Walker
- **Terminal**: Kitty / Ghostty
- **Shell**: Zsh / Fish
- **Editor**: Neovim
- **Notifications**: Swaync
- **File Manager**: Nautilus / Thunar
- **Theme**: ML4W Dotfiles

## Structure
```
.config/
├── hypr/          # Hyprland config + custom keybindings + scripts
├── waybar/        # Status bar
├── rofi/          # App launcher
├── swaync/        # Notification center
├── kitty/         # Terminal
├── nvim/          # Neovim
├── fish/          # Fish shell
├── zsh/           # Zsh shell
├── ohmyposh/      # Shell prompt
├── fastfetch/     # System info
└── ml4w/          # ML4W settings
```

## Custom Keybindings

### Cursor Control (keyboard mouse)
| Shortcut | Action |
|----------|--------|
| `ALT+I` | Move cursor up |
| `ALT+K` | Move cursor down |
| `ALT+J` | Move cursor left |
| `ALT+L` | Move cursor right |
| `ALT+W` | Hold left click (drag) |
| `ALT+R` | Hold right click |

### Scrolling
| Shortcut | Action |
|----------|--------|
| `ALT+E` | Scroll up |
| `ALT+D` | Scroll down |
| `ALT+S` | Scroll left |
| `ALT+F` | Scroll right |

### Windows
| Shortcut | Action |
|----------|--------|
| `ALT+Space` | Cycle windows |
| `ALT+H` | Swap with next window |
| `ALT+Y` | Pin window |
| `ALT+-` | Shrink window |
| `ALT+=` | Grow window |
| `SUPER+CTRL+←/→` | Move window left/right |

### Workspaces
| Shortcut | Action |
|----------|--------|
| `ALT+U` | Previous workspace |
| `ALT+O` | Next workspace |
| `SUPER+1-0` | Jump to workspace |
| `ALT+SHIFT+U/O` | Move window to prev/next workspace |

### Apps
| Shortcut | Action |
|----------|--------|
| `SUPER+D` | App launcher |
| `SUPER+C` | VSCode |
| `SUPER+W` | Browser |
| `SUPER+L` | Lock screen |
| `SUPER+P` | Screenshot |
| `SUPER+F1/F2/F3` | Chrome instances |

## Cursor Daemon

The cursor control uses a Python daemon (`hypr/scripts/cursor-daemon.py`)
that runs on login via `exec-once`. It requires the `uinput` kernel module:
```bash
# Load uinput on boot
echo "uinput" | sudo tee /etc/modules-load.d/uinput.conf
sudo modprobe uinput

# Install dependency
pip install python-uinput --break-system-packages
```

## Dependencies
```bash
yay -S hyprland waybar rofi-wayland walker kitty ghostty \
       neovim fish zsh oh-my-posh fastfetch swaync wl-kbptr \
       wlrctl socat python-uinput nwg-dock-hyprland \
       swww waypaper hyprlock
```

## Credits

Base setup by [ML4W](https://github.com/mylinuxforwork/dotfiles).
