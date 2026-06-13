#!/usr/bin/env bash
set -euo pipefail

REPO_NAME="${1:-Friends-Chat-Online}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required. Install: https://cli.github.com/"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Log in to GitHub first:"
  echo "  gh auth login"
  exit 1
fi

OWNER="$(gh api user -q .login)"
echo "Creating private repo: $OWNER/$REPO_NAME"

if git remote get-url origin >/dev/null 2>&1; then
  echo "Remote 'origin' already exists."
else
  gh repo create "$REPO_NAME" --private --source=. --remote=origin
fi

git push -u origin main

echo "Enabling GitHub Pages from /docs on main..."
gh api "repos/$OWNER/$REPO_NAME/pages" -X POST \
  -f build_type=legacy \
  -f "source[branch]=main" \
  -f "source[path]=/docs" 2>/dev/null || \
gh api "repos/$OWNER/$REPO_NAME/pages" -X PUT \
  -f build_type=legacy \
  -f "source[branch]=main" \
  -f "source[path]=/docs"

echo ""
echo "Done! Your site will be live at:"
echo "  https://$OWNER.github.io/$REPO_NAME/"
echo ""
echo "Next steps:"
echo "  1. Visit that URL and complete the setup wizard (GitHub PAT + admin login)"
echo "  2. Or use config.json with mode github (do not commit it)"
