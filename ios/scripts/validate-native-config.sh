#!/bin/bash
set -euo pipefail
TASK_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TASK_BUILD="$TASK_ROOT/Build/native-validation"
mkdir -p "$TASK_BUILD/tmp" "$TASK_BUILD/ModuleCache"
export TMPDIR="$TASK_BUILD/tmp/"
xcrun swiftc "$TASK_ROOT/ios/StudioOS/App/StudioConfiguration.swift" "$TASK_ROOT/ios/Validation/main.swift" -module-cache-path "$TASK_BUILD/ModuleCache" -o "$TASK_BUILD/native-config-tests"
"$TASK_BUILD/native-config-tests"
