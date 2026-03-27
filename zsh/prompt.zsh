# ─────────────────────────────────────────────────────────────
#  zsh prompt  —  modern Catppuccin Mocha  (no plugin needed)
#  Source this from your ~/.zshrc:
#    source ~/.config/zsh/prompt.zsh
# ─────────────────────────────────────────────────────────────

autoload -Uz vcs_info
precmd_functions+=(vcs_info)

zstyle ':vcs_info:*'         enable git
zstyle ':vcs_info:git:*'     formats       ' %b'
zstyle ':vcs_info:git:*'     actionformats ' %b|%a'

# ── Colours (Catppuccin Mocha) ────────────────────
_C_MAUVE='%F{#cba6f7}'
_C_BLUE='%F{#89b4fa}'
_C_GREEN='%F{#a6e3a1}'
_C_RED='%F{#f38ba8}'
_C_PEACH='%F{#fab387}'
_C_YELLOW='%F{#f9e2af}'
_C_SKY='%F{#89dceb}'
_C_LAVENDER='%F{#b4befe}'
_C_TEAL='%F{#94e2d5}'
_C_SUBTEXT='%F{#a6adc8}'
_C_OVERLAY='%F{#6c7086}'
_C_RESET='%f%b'

# ── Git status glyphs ─────────────────────────────
_git_info() {
  local branch dirty ahead behind
  branch="${vcs_info_msg_0_}"
  [[ -z "$branch" ]] && return

  # dirty?
  git diff --quiet --ignore-submodules HEAD 2>/dev/null || dirty=' *'

  # ahead/behind
  local ab
  ab=$(git rev-list --left-right --count @{u}...HEAD 2>/dev/null)
  if [[ -n "$ab" ]]; then
    local behind_n ahead_n
    behind_n=$(echo "$ab" | awk '{print $1}')
    ahead_n=$(echo "$ab" | awk '{print $2}')
    [[ "$behind_n" -gt 0 ]] && behind=" ↓${behind_n}"
    [[ "$ahead_n" -gt 0 ]]  && ahead=" ↑${ahead_n}"
  fi

  echo -n "${_C_OVERLAY} on ${_C_MAUVE} ${branch}${dirty}${ahead}${behind}${_C_RESET}"
}

# ── Command duration ─────────────────────────────
typeset -g _CMD_DURATION=0
typeset -g _CMD_START=0

_preexec_timer() { _CMD_START=$EPOCHSECONDS }
_precmd_timer()  {
  if (( _CMD_START > 0 )); then
    _CMD_DURATION=$(( EPOCHSECONDS - _CMD_START ))
    _CMD_START=0
  else
    _CMD_DURATION=0
  fi
}

preexec_functions+=(_preexec_timer)
precmd_functions+=(_precmd_timer)

_duration_str() {
  local d=$_CMD_DURATION
  (( d < 2 ))  && return
  (( d < 60 )) && echo -n "${_C_YELLOW}${d}s${_C_RESET} "  && return
  (( d < 3600 )) && echo -n "${_C_YELLOW}$((d/60))m $((d%60))s${_C_RESET} " && return
  echo -n "${_C_RED}$((d/3600))h $((d%3600/60))m${_C_RESET} "
}

# ── Vi-mode indicator ────────────────────────────
_vi_mode_str() {
  case $KEYMAP in
    vicmd)      echo -n "${_C_PEACH}[N]${_C_RESET} " ;;
    viins|main) ;;
  esac
}
zle-keymap-select() { zle reset-prompt }
zle -N zle-keymap-select

# ── Exit code ────────────────────────────────────
_exit_code() {
  local code=$?
  (( code == 0 )) && echo -n "${_C_GREEN}✓${_C_RESET}" || echo -n "${_C_RED}✗ ${code}${_C_RESET}"
}

# ── Main PROMPT ──────────────────────────────────
setopt PROMPT_SUBST

PROMPT='
${_C_BLUE}%~${_C_RESET}$(_git_info)  ${_C_OVERLAY}%D{%H:%M}${_C_RESET}
$(_vi_mode_str)$(_duration_str)$(_exit_code) ${_C_MAUVE}❯${_C_BLUE}❯${_C_TEAL}❯${_C_RESET} '

# Right-prompt: user@host (dim, fades into background)
RPROMPT='${_C_OVERLAY}%n@%m${_C_RESET}'
