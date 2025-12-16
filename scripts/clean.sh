#!/usr/bin/env bash
set -euo pipefail

# Colors
esc="\033"
reset="${esc}[0m"
bold="${esc}[1m"
red="${esc}[38;5;196m"
yellow="${esc}[33m"
cyan="${esc}[36m"
gray="${esc}[38;5;245m"
green="${esc}[32m"

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEFAULT_OUTPUT="$SCRIPT_DIR/output"

# Parse arguments
FORCE=false
OUTPUT_DIR=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--force)
            FORCE=true
            shift
            ;;
        -h|--help)
            printf "%b\n" "${bold}${cyan}scrapr clean${reset} - Empty the output folder"
            printf "\n"
            printf "%b\n" "${bold}Usage:${reset}"
            printf "  ./scrapr clean [output-dir] [options]\n"
            printf "\n"
            printf "%b\n" "${bold}Arguments:${reset}"
            printf "  output-dir    Directory to clean (default: ./output)\n"
            printf "\n"
            printf "%b\n" "${bold}Options:${reset}"
            printf "  -f, --force   Skip confirmation prompt\n"
            printf "  -h, --help    Show this help message\n"
            printf "\n"
            printf "%b\n" "${bold}Examples:${reset}"
            printf "  ./scrapr clean                    # Clean default output folder\n"
            printf "  ./scrapr clean /tmp/scrapes       # Clean custom folder\n"
            printf "  ./scrapr clean -f                 # Clean without confirmation\n"
            exit 0
            ;;
        -*)
            printf "%b\n" "${red}Unknown option: $1${reset}"
            printf "Run './scrapr clean --help' for usage.\n"
            exit 1
            ;;
        *)
            OUTPUT_DIR="$1"
            shift
            ;;
    esac
done

# Default to output folder if not specified
OUTPUT_DIR="${OUTPUT_DIR:-$DEFAULT_OUTPUT}"

# Resolve to absolute path
if [[ "$OUTPUT_DIR" != /* ]]; then
    OUTPUT_DIR="$SCRIPT_DIR/$OUTPUT_DIR"
fi

# Check if directory exists
if [[ ! -d "$OUTPUT_DIR" ]]; then
    printf "%b\n" "${yellow}Directory does not exist:${reset} $OUTPUT_DIR"
    printf "%b\n" "${gray}Nothing to clean.${reset}"
    exit 0
fi

# Count items
item_count=$(find "$OUTPUT_DIR" -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')

if [[ "$item_count" -eq 0 ]]; then
    printf "%b\n" "${green}✓${reset} Output folder is already empty: ${cyan}$OUTPUT_DIR${reset}"
    exit 0
fi

# Calculate size
if command -v du &> /dev/null; then
    total_size=$(du -sh "$OUTPUT_DIR" 2>/dev/null | cut -f1 || echo "unknown")
else
    total_size="unknown"
fi

# Display what will be deleted
printf "\n"
printf "%b\n" "${bold}${red}⚠  WARNING: This will permanently delete all scraped data${reset}"
printf "\n"
printf "%b\n" "${bold}Target:${reset}  ${cyan}$OUTPUT_DIR${reset}"
printf "%b\n" "${bold}Items:${reset}   ${yellow}$item_count${reset} folder(s)/file(s)"
printf "%b\n" "${bold}Size:${reset}    ${yellow}$total_size${reset}"
printf "\n"

# List contents (first 10)
printf "%b\n" "${gray}Contents:${reset}"
find "$OUTPUT_DIR" -mindepth 1 -maxdepth 1 -printf "  %f\n" 2>/dev/null | head -10 || \
    ls -1 "$OUTPUT_DIR" 2>/dev/null | head -10 | sed 's/^/  /'

if [[ "$item_count" -gt 10 ]]; then
    printf "%b\n" "${gray}  ... and $((item_count - 10)) more${reset}"
fi
printf "\n"

# Confirmation
if [[ "$FORCE" != true ]]; then
    printf "%b" "${bold}Are you sure you want to delete all contents? ${reset}[y/N] "
    read -r response

    case "$response" in
        [yY]|[yY][eE][sS])
            # Proceed
            ;;
        *)
            printf "%b\n" "${yellow}Cancelled.${reset} No files were deleted."
            exit 0
            ;;
    esac
fi

# Delete contents
printf "%b" "${cyan}Cleaning...${reset} "

if rm -rf "${OUTPUT_DIR:?}"/*; then
    printf "%b\n" "${green}Done!${reset}"
    printf "\n"
    printf "%b\n" "${green}✓${reset} Removed ${bold}$item_count${reset} item(s) (${total_size})"
    printf "%b\n" "${gray}Output folder is now empty: $OUTPUT_DIR${reset}"
else
    printf "%b\n" "${red}Failed!${reset}"
    printf "%b\n" "${red}Error: Could not delete contents of $OUTPUT_DIR${reset}"
    exit 1
fi
