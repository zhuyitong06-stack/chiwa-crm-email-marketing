#!/usr/bin/env bash
set -euo pipefail

PLIST="/Users/ricky/Documents/Codex/2026-07-14/s/outputs/tdc-crm-web/local-dev/com.tdc.crm.local.plist"
LABEL="com.tdc.crm.local"

launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || launchctl remove "$LABEL" 2>/dev/null || true
echo "Stopped CRM local service if it was running."
