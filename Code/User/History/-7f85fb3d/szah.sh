#!/usr/bin/env bash
# /* ---- 💫 https://github.com/JaKooLit 💫 ---- */  ##
# Updated KeyHints with custom keybinds

# GDK BACKEND. Change to either wayland or x11 if having issues
BACKEND=wayland

# Check if rofi or yad is running and kill them if they are
if pidof rofi > /dev/null; then
  pkill rofi
fi

if pidof yad > /dev/null; then
  pkill yad
fi

GDK_BACKEND=$BACKEND yad \
    --center \
    --title="KooL Quick Cheat Sheet" \
    --no-buttons \
    --list \
    --column=Key: \
    --column=Description: \
    --column=Command: \
    --timeout-indicator=bottom \
    --css="
        window { background-color: rgba(10, 10, 20, 0.92); border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); }
        treeview { background-color: transparent; color: #cdd6f4; font-family: JetBrainsMono Nerd Font; font-size: 15px; }
        treeview:selected { background-color: rgba(137, 180, 250, 0.2); color: #89b4fa; }
        treeview header button { background-color: rgba(255,255,255,0.05); color: #89b4fa; font-family: JetBrainsMono Nerd Font; font-size: 14px; font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.08); padding: 8px; }
        headerbar { background-color: rgba(20, 20, 35, 0.95); border-bottom: 1px solid rgba(255,255,255,0.08); }
        scrollbar slider { background-color: rgba(137, 180, 250, 0.3); border-radius: 8px; min-width: 6px; }
    " \
"ESC" "close this app" "" \
" = " "SUPER KEY (Windows Key Button)" "(SUPER KEY)" \
"" "" "" \
" SHIFT K" "Searchable Keybinds" "(Search all Keybinds via rofi)" \
" SHIFT E" "KooL Hyprland Settings Menu" "" \
"" "" "" \
"── APPS ──" "" "" \
" Enter" "Terminal" "(kitty)" \
" SHIFT Enter" "DropDown Terminal" "Q to close" \
" SPACE" "Application Launcher" "(rofi)" \
" E" "Open File Manager" "(Thunar)" \
" C" "Open VS Code" "(code)" \
" W" "Launch Browser" "(Default browser)" \
" S" "Web Search" "(rofi)" \
"" "" "" \
"── WINDOW MANAGEMENT ──" "" "" \
" Q" "Close active window" "(not kill)" \
" SHIFT Q" "Kill active window" "(force kill)" \
" D" "Maximize window" "" \
" F" "Fullscreen" "" \
" SHIFT F" "Float current window" "" \
" ALT SPACE" "Float all windows" "" \
" G" "Toggle group" "" \
" Tab" "Change group forward" "" \
" SHIFT Tab" "Change group back" "" \
"" "" "" \
"── FOCUS ──" "" "" \
" ALT SHIFT left/right/up/down" "Focus window" "Move focus between windows" \
" ALT Tab" "Cycle next window" "" \
"" "" "" \
"── MOVE WINDOWS ──" "" "" \
" CTRL left/right/up/down" "Move window position" "on workspace" \
" ALT left" "Move window to previous workspace" "and follow" \
" ALT right" "Move window to next workspace" "and follow" \
" ALT 1-0" "Move window to workspace 1-10" "and follow" \
" SHIFT 1-0" "Move window to workspace 1-10" "and follow" \
" CTRL 1-0" "Move window silently" "stay on current workspace" \
" SHIFT U" "Move to special workspace" "" \
"" "" "" \
"── WORKSPACES ──" "" "" \
" left / right" "Switch workspace prev/next" "" \
" 1-0" "Switch to workspace 1-10" "" \
" Tab" "Next workspace" "" \
" SHIFT Tab" "Previous workspace" "" \
" U" "Toggle special workspace" "" \
"" "" "" \
"── CLIPBOARD & MEDIA ──" "" "" \
" V" "Clipboard Manager" "(cliphist)" \
" ALT E" "Emoji Menu" "(rofi)" \
" ALT C" "Calculator" "(rofi)" \
"" "" "" \
"── WALLPAPER ──" "" "" \
"CTRL ALT W" "Select Wallpaper" "(Wallpaper Menu)" \
" CTRL W" "Random Wallpaper" "(via swww)" \
" SHIFT W" "Wallpaper Effects" "(imagemagick + swww)" \
"" "" "" \
"── THEMING ──" "" "" \
" T" "Global Theme Switcher" "(wallust)" \
" SHIFT A" "Animations Menu" "" \
" CTRL R" "Rofi Themes Menu" "" \
" CTRL B" "Waybar Styles Menu" "" \
" ALT B" "Waybar Layout Menu" "" \
" CTRL ALT B" "Hide/Show Waybar" "" \
" ALT O" "Toggle Blur" "" \
" CTRL O" "Toggle Window Opacity" "" \
" SHIFT G" "Toggle Game Mode" "" \
" N" "Toggle Night Light" "(hyprsunset)" \
"" "" "" \
"── SYSTEM ──" "" "" \
" L" "Lock Screen" "(blazinlock)" \
"CTRL ALT L" "Lock Screen" "(blazinlock)" \
" SHIFT N" "Notification Panel" "(swaync)" \
" ALT R" "Reload Waybar/Rofi/Swaync" "CHECK NOTIFICATIONS FIRST!" \
"CTRL ALT P" "Power Menu" "(wlogout)" \
"CTRL ALT Del" "Exit Hyprland" "WARNING: Exits immediately!" \
"" "" "" \
"── SCREENSHOTS ──" "" "" \
" Print" "Screenshot now" "(grim)" \
" SHIFT Print" "Screenshot region" "(grim + slurp)" \
" SHIFT S" "Screenshot region" "(swappy)" \
" CTRL Print" "Screenshot in 5 secs" "(grim)" \
" CTRL SHIFT Print" "Screenshot in 10 secs" "(grim)" \
"ALT Print" "Screenshot active window" "" \
"" "" "" \
"── LAYOUT ──" "" "" \
" ALT L" "Toggle Dwindle/Master Layout" "" \
" P" "Toggle Pseudo (dwindle)" "" \
" SHIFT I" "Toggle Split (dwindle)" "" \
" I" "Add master" "" \
" CTRL D" "Remove master" "" \
" H" "Launch this Cheat Sheet" "" \
"" "" "" \
"More tips:" "https://github.com/JaKooLit/Hyprland-Dots/wiki" ""