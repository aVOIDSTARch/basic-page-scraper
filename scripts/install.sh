#!/usr/bin/env bash
set -euo pipefail

echo "scrapr: running installer to ensure runtimes and project deps are present"

cmd_exists() { command -v "$1" >/dev/null 2>&1; }

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if cmd_exists bun; then
  echo "bun: found at $(command -v bun)"
else
  echo "bun: not found — installing via official installer"
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
fi

if cmd_exists deno; then
  echo "deno: found at $(command -v deno)"
else
  if cmd_exists brew; then
    echo "deno: installing via brew"
    brew install deno
  else
    echo "deno: installing via official installer"
    curl -fsSL https://deno.land/install.sh | sh
    export DENO_INSTALL="$HOME/.deno"
    export PATH="$DENO_INSTALL/bin:$PATH"
  fi
fi

if cmd_exists node; then
  echo "node: found at $(command -v node) ($(node -v))"
else
  if cmd_exists brew; then
    echo "node: installing via brew"
    brew install node
  else
    echo "node: installing nvm and latest LTS node"
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    if [ -s "$NVM_DIR/nvm.sh" ]; then
      # shellcheck source=/dev/null
      . "$NVM_DIR/nvm.sh"
      nvm install --lts
    else
      echo "nvm installation failed or not available; please install Node.js manually."
    fi
  fi
fi

# Install project dependencies (prefer bun when available)
if cmd_exists bun; then
  echo "Installing JS dependencies with bun..."
  (cd "$REPO_ROOT/scraper" && bun install)
else
  if cmd_exists npm; then
    echo "Installing JS dependencies with npm..."
    (cd "$REPO_ROOT/scraper" && npm install)
  else
    echo "No JS package manager found; please install bun or Node/npm and re-run 'scrapr install'."
    exit 1
  fi
fi

echo "Installation finished. You may need to restart your shell to pick up PATH changes."

# Stylized post-install message and colored ASCII art
print_post_install() {
  esc="\033"
  reset="${esc}[0m"
  bold="${esc}[1m"
  cyan="${esc}[36m"
  yellow="${esc}[33m"
  green="${esc}[32m"

  printf "%b\n" "${bold}${green}== scrapr installation complete ==${reset}"
  printf "%b\n" "${cyan}If this run installed Bun, Deno, or modified your shell profile, reload your shell to pick up PATH changes:${reset}"
  printf "%b\n" "  ${yellow}source ~/.bashrc${reset}  # bash"
  printf "%b\n" "  ${yellow}source ~/.zshrc${reset}   # zsh"
  printf "%b\n" "  ${yellow}exec \$SHELL${reset}        # re-exec your login shell"
  printf "%b\n" ""
  printf "%b\n" "${cyan}Basic usage examples:${reset}"
  printf "%b\n" "  ${yellow}./scrapr --url https://example.com --name my-scrape${reset}"
  printf "%b\n" "  ${yellow}./scrapr install${reset}  # re-run installer${reset}"
  printf "%b\n" ""

  # Epic Grim Reaper ASCII Art - THE HARVESTER OF DATA
  local gray="${esc}[38;5;245m"
  local dark="${esc}[38;5;238m"
  local white="${esc}[38;5;255m"
  local purple="${esc}[38;5;135m"
  local dim="${esc}[2m"

  printf "\n"
  printf "%b\n" "${dark}@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@${gray}%%${dark}@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@@@@@@@@@@@@@@${gray}##################%%${dark}@@@@${gray}%#%###%${dark}@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@@@@@@@@@@@@@@${gray}%#%%##%%##%#######%%${dark}@@@${gray}%%%%%%##%%%@%%%%%%%${dark}@@@@@@@@@@@@@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@@@@@@@@@@@@@@@${gray}%#%###${dark}@@@@@@@@@@@@@@${gray}%###%%@%####%${dark}@@@${gray}%%####%%#%%%%${dark}@@@@@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@@@@@@@@@@@@@@@${gray}%##${dark}@@@@@@@@@@@@@@@${gray}%#%#############${dark}@@@@@@@@@@${gray}%%%@##%##%%${dark}@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@@@@@@@@@@@@@@@@${gray}%#%${dark}@@@@@@@@@@@@@${gray}##@%##############${dark}@@@@@@@@@@@@@@@@@@${gray}%@%%#%%${dark}@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@@@@@@@@@@@@@@@@@${gray}%%${dark}@@@@@@@@@@@@${gray}%%#@%######%%##%####%${dark}@@@@@@@@@@@@@@@@@@@@@@@${gray}%%${dark}@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@@@@@@@@@@@@@@@@@${gray}%#${dark}@@@@@@@@@@@@${gray}#%#@%#####%@#%#%#####${dark}@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@@@@@@@@@@@@@@@@@@${gray}##${dark}@@@@@@@@@@${gray}##%#@%####${white}*${gray}%%%####${white}*${gray}####%${dark}@@@@@@@@@@@@@@@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@@@@@@@@@@@@@@@@@@${gray}%#%${dark}@@@@@@@@@@${gray}#%%%@#####@%${dark}@@@@@@@${gray}%%##${dark}@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@@@@@@@@@@@@@@@@@@@${gray}#%${dark}@@@@@@@@@@${gray}#%%%@##%${dark}@@@@@@@@${gray}%%${dark}@@@@@${gray}%${dark}@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@@@@@@@@@@@@@@@@@@@${gray}%#%${dark}@@@@@@@@@${gray}##%%@#${dark}@@${gray}%%%%${dark}@@${gray}%%#%%%${dark}@@@@${gray}%${dark}@@@@@@@@@@@@@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@@@@@@@@@@@@@@@@@@@${gray}%##${dark}@@@@@@@@${gray}%###%${dark}@@${gray}%%%%##${white}**${gray}#%${dark}@@${gray}%%@%${dark}@@${gray}%${dark}@@@@@@@@@@@@@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@@@@@@@@@@@@@@@@@@@@${gray}##%${dark}@@@@@@${gray}%%%##%@%%%%%%#%%#%${dark}@@@@@@@@${gray}%${dark}@@@@@@@@@@@@@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@@@@@@@@@@@@@@@@@@@@${gray}%%#${dark}@@@@${gray}%%%#@%#@@%${dark}@@@@${gray}%@%%##%%%${dark}@@@@${gray}%${dark}@@@@@@@@@@@@@@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@@@@@@@@@@@@@@@@@@@@@${gray}##${dark}@@@@${gray}%###%##@@%@%%%%####%%${dark}@@@${gray}%%%${dark}@@@@@@@@@@@@@@@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@@@@@@@@@@@@@@@@@@@@@${gray}%##${dark}@@@@@${gray}%###%${dark}@@@@@${gray}%%%####@%${dark}@@${gray}%%#${dark}@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@@@@@@@@@@@@@@@@@@@@@@${gray}%#%%###@%%%${dark}@@@@${gray}%%#%%#%#%${dark}@@@${gray}%%%%#%${dark}@@@@@@@@@@@@@@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@@@@@@@@@@@@@@@@@@@@@@@${gray}#%@%#%#%%${dark}@@@@@@@@@@@@@@@@${gray}%%%%%%%%${dark}@@@@@@@@@@@@@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@@@@@@@@@@@@@@@${gray}%%###%${dark}@@${gray}##%%#%%${dark}@@@@@@@@@@@@@@${gray}%%%%%%%####%%%%%%%%${dark}@@@@@@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@@@@@@@@@@@@@${gray}%##%####%@###@###%%%%##${dark}@@@@${gray}%##%##%%%%#%%###########${dark}@@@@@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@@@@@@@@@@@@${gray}%%%%##%%#%@%##%@###%%###%%%${dark}@@${gray}%@%%%%%%%@%#############${dark}@@@@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@@@@@@@@@@@@@@@@@${gray}%%%%#${dark}@@${gray}%#%@%##%%%##%#%${dark}@@${gray}%%%${dark}@@${gray}%%%#%#%%%##%##%##@%%${dark}@@@@@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@@@@@@@@@@${gray}%%%@##${dark}@@${gray}%${dark}@@${gray}%%@%%#%@##%@%%%#%${dark}@@@@@@@${gray}%%####%%###%%#####%@%%${dark}@@@@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@@@@@@@@@${gray}%%%%%####@%${dark}@@${gray}#%@###@####%%%%%@%%%@%%%%#%#%#####%%#####${dark}@@@${gray}%#${dark}@@@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@@@@@@@@${gray}###%%########%%%%%##%%##%%%%#%#%%${dark}@@@${gray}%%@%#########%####%%${dark}@@${gray}###${dark}@@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@@@@@@@${gray}%%%%%%%%%%##%%${dark}@@@@@${gray}##%@%#%%%%%%%${dark}@@@@${gray}%${dark}@@@@@${gray}%%#####%%%#%##%${dark}@@${gray}%#%${dark}@@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@@@@@@${gray}#%%%%%${dark}@@@${gray}%%##${dark}@@@@@@@@${gray}%%@%%%%%######%${dark}@@@@@@${gray}%@%#%%%#%%@####%${dark}@@${gray}%#%#${dark}@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@@@@${gray}##%%%%%%%##@%%%%%${dark}@@@@@${gray}%%%@@@%%%#####${dark}@@${gray}%%%@%%%#@%@%%##%%###%#@%%###${dark}@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@@@${gray}#%%%#####%##@%%%${dark}@@${gray}%@%##%@%@@%%%@#%%##%%%%%%#%${dark}@@${gray}%#####%@%###%#%%#%##%${dark}@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@@${gray}%%%%%#%%%@#%%@%%${dark}@@@${gray}%@%%#%${dark}@@@@${gray}%%%%#%%%##%%%${dark}@@@${gray}%%%%%%##%${dark}@@${gray}%%#%@%%%@#%#${dark}@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@${gray}%%%#%%@%%%%%@%${dark}@@${gray}%%${dark}@@@@@${gray}%%%${dark}@@${gray}%${dark}@@@${gray}%%%${dark}@@@@@@@@@@${gray}%##%@%%#%%${dark}@@${gray}%%#%@%%@%###${dark}@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@${gray}##%%@#%%####@%%@%#@%%${dark}@@@@@@@@@@${gray}%#######%${dark}@@${gray}%%%##%#####%${dark}@@@${gray}###%##${dark}@@${gray}####${dark}@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@${gray}%#%#%%@%##%%%%%@%%#%${dark}@@${gray}%%%${dark}@@@@@@${gray}##%###%######%%%@######${dark}@@@@${gray}###@#%@#####%${dark}@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@${gray}%%@%@%@%${dark}@@@@@${gray}%%%@%%%%#%##%${dark}@@@@${gray}%%%%%###@%${dark}@@${gray}%${dark}@@${gray}%${dark}@@${gray}####%${dark}@@@@@${gray}#%@%%@%#####${dark}@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@${gray}%@%%@%%${dark}@@@@@${gray}%@%%@%#%%%#%%%%${dark}@@@@${gray}%%%%%%####${dark}@@@@${gray}%%%##%%%${dark}@@@@@${gray}#@%%@%%###%%${dark}@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@${gray}%%@#@%%%%${dark}@@@@@${gray}%%############${dark}@@@@${gray}%%#%%#############%##%%${dark}@@@${gray}##@#@%####%%%${dark}@@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@${gray}#%@#@#%%@%${dark}@@@${gray}%@%%#######%###%${dark}@@@@${gray}###@%#########%%%%%##%@%#%@%@######%@%%${dark}@@@@@@@@@@@@@@"
  printf "%b\n" "${dark}@@@@@@@${gray}%%%@%%${dark}@@@@@${gray}%%#%%%#%%%%%%@%${dark}@@@@@${gray}###${dark}@@${gray}##%%%%@%%%%%%#%@%%%@%%####%#%%@%%${dark}@@@@@@@@@@@@@@"
  printf "%b\n" "${reset}"
  printf "\n"

  # Epic SCRAPR block letters with gradient effect
  printf "%b\n" "${purple}       ███████  ${cyan}██████  ${green}██████   ${yellow} █████  ${purple}██████  ${cyan}██████  "
  printf "%b\n" "${purple}      ██       ${cyan}██      ${green}██   ██  ${yellow}██   ██ ${purple}██   ██ ${cyan}██   ██ "
  printf "%b\n" "${purple}      ███████  ${cyan}██      ${green}██████   ${yellow}███████ ${purple}██████  ${cyan}██████  "
  printf "%b\n" "${purple}           ██  ${cyan}██      ${green}██   ██  ${yellow}██   ██ ${purple}██      ${cyan}██   ██ "
  printf "%b\n" "${purple}      ███████  ${cyan} ██████ ${green}██   ██  ${yellow}██   ██ ${purple}██      ${cyan}██   ██ "
  printf "%b\n" "${reset}"
  printf "%b\n" "${dim}${gray}                ╔═════════════════════════════════════════╗${reset}"
  printf "%b\n" "${dim}${gray}                ║   ${white}${bold}  T H E   H A R V E S T E R   O F     ${reset}${dim}${gray}║${reset}"
  printf "%b\n" "${dim}${gray}                ║   ${white}${bold}        W E B   D A T A               ${reset}${dim}${gray}║${reset}"
  printf "%b\n" "${dim}${gray}                ╚═════════════════════════════════════════╝${reset}"
  printf "\n"
}

print_post_install
