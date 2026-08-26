#!/usr/bin/env bash
set -euo pipefail

apt update
apt install -y curl ufw

bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install

ufw allow OpenSSH
ufw allow 443/tcp
ufw --force enable

cat > /usr/local/etc/xray/config.json <<'JSON'
{
  "log": {
    "loglevel": "warning"
  },
  "inbounds": [
    {
      "tag": "vless-reality",
      "listen": "0.0.0.0",
      "port": 443,
      "protocol": "vless",
      "settings": {
        "clients": [
          {
            "id": "9f5b32f4-8e47-4600-af0b-5df4d110dbfa",
            "flow": "xtls-rprx-vision",
            "email": "user1"
          }
        ],
        "decryption": "none"
      },
      "streamSettings": {
        "network": "tcp",
        "security": "reality",
        "realitySettings": {
          "show": false,
          "target": "www.google.com:443",
          "serverNames": [
            "www.google.com"
          ],
          "privateKey": "2E9z8k5MbNi3adAs_FY6Qjw6hu6dgM3w-aRoWSbz82o",
          "shortIds": [
            "b1a49ec249fc833e"
          ]
        }
      },
      "sniffing": {
        "enabled": true,
        "destOverride": [
          "http",
          "tls",
          "quic"
        ],
        "routeOnly": true
      }
    }
  ],
  "outbounds": [
    {
      "protocol": "freedom",
      "tag": "direct"
    },
    {
      "protocol": "blackhole",
      "tag": "block"
    }
  ],
  "routing": {
    "rules": [
      {
        "type": "field",
        "ip": [
          "geoip:private"
        ],
        "outboundTag": "block"
      }
    ]
  }
}
JSON

xray run -test -c /usr/local/etc/xray/config.json
systemctl enable xray
systemctl restart xray
systemctl status xray --no-pager
