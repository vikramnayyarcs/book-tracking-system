#!/usr/bin/env bash
# Installs the pinned tools Claude Code cloud sessions need (docs/cloud-environment.md).
# Safe to run repeatedly: anything already at the pinned version is skipped.
# Runs two ways: pasted into the cloud environment's setup script (cached), and from
# the SessionStart hook in .claude/settings.json (every cloud session, a no-op when cached).
# Does nothing on a local machine unless FORCE_CLOUD_SETUP=1.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ] && [ "${FORCE_CLOUD_SETUP:-}" != "1" ] && [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then
  exit 0
fi

NODE_VERSION=24.22.3
TERRAFORM_VERSION=1.17.1
TERRAFORM_MCP_VERSION=1.4.1
GITLEAKS_VERSION=8.30.1
PREFIX="${PREFIX:-/usr/local}"

case "$(uname -m)" in
  x86_64)
    ARCH=amd64 NODE_ARCH=x64 GITLEAKS_ARCH=x64
    NODE_SHA=4f2b175a6d53a5c617a80dba2676238a0688cef28c6da4eba35c7d844e66fcfb
    TERRAFORM_SHA=4638628058e71a55212b1c563712eac03b902128f40740f3dc8174df12135061
    TERRAFORM_MCP_SHA=8b2526451162e16d803ab014f7070f0f412962cdffffdcf446e70a846362481b
    GITLEAKS_SHA=551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb
    ;;
  aarch64 | arm64)
    ARCH=arm64 NODE_ARCH=arm64 GITLEAKS_ARCH=arm64
    NODE_SHA=6e51a2ada00f0011cc266f65d98922b403d7ad88f809ca2aa615a5fe1ce6e86c
    TERRAFORM_SHA=988e950a1c23058093b0e66ab2d5fb53fc18345ecfbd5871acf51dbac9325edd
    TERRAFORM_MCP_SHA=02bd809e7225be9cac7d81be610e1082f63de0b134096f1119ef2d2e1524e662
    GITLEAKS_SHA=e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080
    ;;
  *)
    echo "cloud-setup: unsupported CPU $(uname -m)" >&2
    exit 1
    ;;
esac

if [ ! -w "$PREFIX/bin" ]; then
  echo "cloud-setup: $PREFIX/bin is not writable; run as root or set PREFIX" >&2
  exit 1
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

fetch() {
  local url="$1" sha="$2" file="$work/${1##*/}"
  curl -fsSL --retry 3 "$url" -o "$file"
  echo "$sha  $file" | sha256sum --check --quiet
  echo "$file"
}

has_version() {
  local bin="$PREFIX/bin/$1" expected="$2"
  [ -x "$bin" ] && "$bin" "${@:3}" 2>/dev/null | grep -q -- "$expected"
}

if ! has_version node "v$NODE_VERSION" --version; then
  archive="$(fetch "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-$NODE_ARCH.tar.xz" "$NODE_SHA")"
  tar -xJf "$archive" -C "$PREFIX" --strip-components=1 --exclude='*.md' --exclude=LICENSE
fi

install_zip() {
  local name="$1" url="$2" sha="$3"
  local archive
  archive="$(fetch "$url" "$sha")"
  unzip -o -q "$archive" "$name" -d "$PREFIX/bin"
  chmod +x "$PREFIX/bin/$name"
}

if ! command -v unzip >/dev/null; then
  apt-get update -qq && apt-get install -y -qq unzip
fi

if ! has_version terraform "v$TERRAFORM_VERSION" version; then
  install_zip terraform \
    "https://releases.hashicorp.com/terraform/$TERRAFORM_VERSION/terraform_${TERRAFORM_VERSION}_linux_$ARCH.zip" \
    "$TERRAFORM_SHA"
fi

if ! has_version terraform-mcp-server "$TERRAFORM_MCP_VERSION" --version; then
  install_zip terraform-mcp-server \
    "https://releases.hashicorp.com/terraform-mcp-server/$TERRAFORM_MCP_VERSION/terraform-mcp-server_${TERRAFORM_MCP_VERSION}_linux_$ARCH.zip" \
    "$TERRAFORM_MCP_SHA"
fi

if ! has_version gitleaks "$GITLEAKS_VERSION" version; then
  archive="$(fetch "https://github.com/gitleaks/gitleaks/releases/download/v$GITLEAKS_VERSION/gitleaks_${GITLEAKS_VERSION}_linux_$GITLEAKS_ARCH.tar.gz" "$GITLEAKS_SHA")"
  tar -xzf "$archive" -C "$PREFIX/bin" gitleaks
fi

if [ -n "${CLAUDE_PROJECT_DIR:-}" ] && [ -f "$CLAUDE_PROJECT_DIR/package-lock.json" ] && [ ! -d "$CLAUDE_PROJECT_DIR/node_modules" ]; then
  (cd "$CLAUDE_PROJECT_DIR" && "$PREFIX/bin/npm" ci --no-audit --no-fund)
fi

echo "cloud-setup: node $("$PREFIX/bin/node" --version), $("$PREFIX/bin/terraform" version | head -1), gitleaks $("$PREFIX/bin/gitleaks" version), terraform-mcp-server $("$PREFIX/bin/terraform-mcp-server" --version | tail -1)"

for tool in node terraform gitleaks terraform-mcp-server; do
  if [ "$(command -v "$tool")" != "$PREFIX/bin/$tool" ]; then
    echo "cloud-setup: WARNING $tool on PATH is $(command -v "$tool" || echo missing), not $PREFIX/bin/$tool" >&2
  fi
done
