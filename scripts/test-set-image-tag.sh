#!/usr/bin/env bash
# Proves a deploy: commit changes exactly one line (the newTag line) and keeps the markers.
set -euo pipefail
cd "$(dirname "$0")/.."
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
cp deploy/kustomization.yaml "$tmp/k.yaml"
image="$(yq '.images[] | select(.name == "app") | .newName' deploy/kustomization.yaml)"
scripts/set-image-tag.sh "$image" abc1234 "$tmp/k.yaml"
d="$(diff deploy/kustomization.yaml "$tmp/k.yaml" || true)"
changed="$(printf '%s\n' "$d" | grep -c '^[<>]' || true)"
if [ "$(yq '.images[] | select(.name == "app") | .newTag' deploy/kustomization.yaml)" = abc1234 ]; then
  echo "pick a different test tag" >&2; exit 1
fi
[ "$changed" = 2 ] || { echo "expected 1 changed line (2 diff sides), got $changed" >&2; echo "$d" >&2; exit 1; }
printf '%s\n' "$d" | grep -q 'newTag: abc1234' || { echo "changed line is not newTag" >&2; exit 1; }
grep -c '# >>' deploy/kustomization.yaml > "$tmp/a"; grep -c '# >>' "$tmp/k.yaml" > "$tmp/b"; cmp "$tmp/a" "$tmp/b"
# idempotent: same tag again changes nothing
cp "$tmp/k.yaml" "$tmp/k2.yaml"; scripts/set-image-tag.sh "$image" abc1234 "$tmp/k2.yaml"; cmp "$tmp/k.yaml" "$tmp/k2.yaml"
echo "ok: deploy bump changes exactly one line and keeps markers"
