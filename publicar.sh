#!/bin/bash
# Publica app/ en GitHub Pages. Requiere haber hecho: gh auth login
set -euo pipefail
cd "$(dirname "$0")"
REPO=${1:-oro-de-rio}
gh auth status >/dev/null || { echo "Primero inicia sesión: gh auth login"; exit 1; }
gh auth setup-git
USUARIO=$(gh api user -q .login)
gh repo view "$USUARIO/$REPO" >/dev/null 2>&1 || gh repo create "$REPO" --public --description "Oro de río: trampas de oro aluvial sobre la cámara"
git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$USUARIO/$REPO.git"
git push -u origin main
PAG=$(git subtree split --prefix app main)
git push -f origin "$PAG:refs/heads/gh-pages"
gh api "repos/$USUARIO/$REPO/pages" >/dev/null 2>&1 || gh api -X POST "repos/$USUARIO/$REPO/pages" -f 'source[branch]=gh-pages' -f 'source[path]=/' >/dev/null
URL=$(gh api "repos/$USUARIO/$REPO/pages" -q .html_url)
echo "Publicando en $URL"
for i in $(seq 1 30); do curl -sf -m 10 -o /dev/null "${URL}models/segformer.onnx" && { echo "Listo: $URL"; exit 0; }; sleep 10; done
echo "Aún no responde; prueba en unos minutos: $URL"
