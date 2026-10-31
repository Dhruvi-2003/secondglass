#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
for dependency in mvn node npm; do
  command -v "$dependency" >/dev/null || { echo "Please install $dependency first. See README.md."; exit 1; }
done
runtime_java="$(command -v java || true)"
if ! "$runtime_java" -version >/dev/null 2>&1; then
  for candidate in /opt/homebrew/opt/openjdk@17/bin/java /usr/local/opt/openjdk@17/bin/java; do
    if [ -x "$candidate" ]; then runtime_java="$candidate"; break; fi
  done
fi
"$runtime_java" -version >/dev/null 2>&1 || { echo "Please install Java 17 or newer. See README.md."; exit 1; }
(
  cd frontend
  npm ci --no-audit --no-fund
  npm run build
)
cd backend
mvn -q -DskipTests package
exec "$runtime_java" -jar target/catalog-0.1.0.jar
