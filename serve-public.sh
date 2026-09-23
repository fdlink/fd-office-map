#!/bin/sh
# HTTPS tunnel so play.workadventu.re can load this map.
# Do not leave this running unattended on a public network.
cd "$(dirname "$0")"
python3 serve-map.py 8766 &
pid=$!
trap 'kill $pid 2>/dev/null' EXIT INT TERM
echo "When cloudflared prints a https://*.trycloudflare.com URL, open:"
echo "  https://play.workadventu.re/_/global/<host-without-https>/office.tmj"
exec cloudflared tunnel --url http://localhost:8766
