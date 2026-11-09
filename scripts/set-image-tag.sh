#!/usr/bin/env bash
# Point deploy/kustomization.yaml at a new image tag. Used by deploy.yaml and its test.
# Usage: scripts/set-image-tag.sh <image> <tag> [kustomization-file]
# Rewrites only the newTag line of the `app` entry in the bot-owned images: block, so
# the per-change marker comments and formatting survive (not `kustomize edit set image`).
set -euo pipefail
IMAGE="${1:?image required}" TAG="${2:?tag required}" FILE="${3:-deploy/kustomization.yaml}"
export IMAGE TAG
yq -i '(.images[] | select(.name == "app")) |= (.newName = strenv(IMAGE) | .newTag = strenv(TAG))' "$FILE"
