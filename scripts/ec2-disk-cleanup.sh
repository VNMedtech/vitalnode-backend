#!/usr/bin/env bash
# One-time / emergency disk cleanup for Vitalnode API EC2.
# Run on the server as a user with sudo:
#   bash scripts/ec2-disk-cleanup.sh
set -euo pipefail

echo "==> Disk usage before cleanup"
df -h /

echo "==> Cleaning npm cache"
sudo -u vitalnode -H npm cache clean --force || true
sudo rm -rf /home/vitalnode/.npm/_cacache

echo "==> Removing staging release + old node_modules"
sudo rm -rf /tmp/vitalnode-server-release
if [[ -d /opt/vitalnode/server/node_modules ]]; then
  sudo -u vitalnode -H bash -lc 'cd /opt/vitalnode/server && rm -rf node_modules'
fi

echo "==> Cleaning apt + journal"
sudo apt-get clean || true
sudo journalctl --vacuum-size=100M || true

echo "==> Disk usage after cleanup"
df -h /

echo "Done. Aim for under ~80% used on /, then re-run the Deploy API GitHub Action."
