#!/usr/bin/env bash
set -euo pipefail

echo "Preparing FirstFlush India project..."

mkdir -p public data scripts test .github/workflows

if [ ! -f package.json ]; then
  echo "package.json is missing."
  echo "Create the project files using the separate file instructions before running npm commands."
else
  echo "Project files already exist."
fi

echo "Directories ready:"
echo "  public/"
echo "  data/"
echo "  scripts/"
echo "  test/"
echo "  .github/workflows/"
echo
echo "Next: create the project files separately."
