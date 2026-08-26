# FR2 protocol tests

These tests are isolated from the production VLESS/Bunny/Cloudflare/Relay services.

## Shadowsocks 2022 direct

- Server: `185.209.230.46`
- Port: `10443`
- Method: `2022-blake3-aes-128-gcm`
- Password: `xvtNW9840vKTXhqLr1MPmg==`
- URI: see `fr2-ss2022-test.txt`

## ShadowTLS v3 + Shadowsocks 2022

- Server: `185.209.230.46`
- ShadowTLS port: `20443`
- ShadowTLS version: `3`
- ShadowTLS password: `cSi2ovI+626fHQ2oeDxbsw==`
- Handshake SNI: `www.microsoft.com`
- Inner Shadowsocks method: `2022-blake3-aes-128-gcm`
- Inner Shadowsocks password: `xRdM7aBl5X3Jn3kGIl//tg==`
- Client config: `fr2-shadowtls-singbox-client.json`

## Server status at creation

- `levospeed-ss2022-test.service`: active
- `levospeed-shadowtls-test.service`: active
- External TCP connect tested open:
  - `185.209.230.46:10443`
  - `185.209.230.46:20443`

