#!/usr/bin/env bash
# 3X-UI + VLESS REALITY одной командой — https://github.com/PinkmanXXX/pinkman_manuals
#
# Установка:  bash <(curl -fsSL https://raw.githubusercontent.com/PinkmanXXX/pinkman_manuals/main/scripts/3x-ui.sh)
#
# Ставит официальную панель 3X-UI (версия закреплена ниже) её собственным
# установщиком, получает для панели сертификат Let's Encrypt на IP, создаёт
# подключение VLESS REALITY на 443 порту, настраивает ufw и выдаёт ссылку
# vless:// с QR-кодом. Домены не нужны.

set -Eeuo pipefail

XUI_VERSION="v3.8.5"
XUI_REPO="MHSanaei/3x-ui"
RESULT=/root/3x-ui.txt
XUI_ENV=/etc/x-ui/install-result.env
# Сайты для маскировки REALITY: нужны TLS 1.3 и HTTP/2. Берём первый доступный.
SNI_CANDIDATES=(www.microsoft.com www.apple.com dl.google.com www.amazon.com)

if [[ -t 1 ]]; then
  G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; B=$'\e[1m'; D=$'\e[2m'; N=$'\e[0m'
else
  G=; Y=; R=; B=; D=; N=
fi
say()  { printf '%s\n' "${G}==>${N} $*"; }
warn() { printf '%s\n' "${Y}!${N}  $*" >&2; }
die()  { printf '%s\n' "${R}✗${N}  $*" >&2; exit 1; }
trap 'die "Ошибка в строке $LINENO. Исправьте причину и запустите скрипт ещё раз."' ERR

rand_str() { openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c "$1"; }
port_busy() { ss -H -ln"${2:0:1}" "sport = :$1" 2>/dev/null | grep -q .; }

public_ip() {
  local ip
  for u in https://api.ipify.org https://ifconfig.me/ip https://ipv4.icanhazip.com; do
    ip=$(curl -4 -fsS -m 6 "$u" 2>/dev/null | tr -d '[:space:]') || true
    [[ $ip =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] && { echo "$ip"; return; }
  done
  ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}'
}

free_port() {
  local p
  for _ in $(seq 1 50); do
    p=$(shuf -i 20000-60000 -n 1)
    port_busy "$p" tcp || { echo "$p"; return; }
  done
  die "Не нашёл свободный порт для панели."
}

# REALITY маскируется под чужой сайт: он должен отвечать по TLS 1.3 и HTTP/2.
sni_ok() {
  echo | timeout 8 openssl s_client -connect "$1:443" -servername "$1" -tls1_3 -alpn h2 2>/dev/null \
    | grep -q 'ALPN protocol: h2'
}

# ---------- API панели ----------

api() { # METHOD path [json]
  local url="$API/$2" out
  if [[ $1 == GET ]]; then
    out=$(curl -fsSk -m 20 -H "Authorization: Bearer $TOKEN" "$url")
  else
    out=$(curl -fsSk -m 20 -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -X "$1" -d "$3" "$url")
  fi
  [[ $(jq -r '.success' <<<"$out") == true ]] || die "Панель ответила ошибкой на $2: $(jq -r '.msg // .' <<<"$out" | head -c 300)"
  jq -c '.obj' <<<"$out"
}

wait_panel() {
  local i
  for i in $(seq 1 60); do
    curl -fsk -m 5 -o /dev/null -H "Authorization: Bearer $TOKEN" "$API/server/getNewUUID" 2>/dev/null && return 0
    sleep 2
  done
  die "Панель не отвечает. Лог: journalctl -u x-ui -n 50"
}

# ---------- установка ----------

main() {
  [[ $EUID -eq 0 ]] || die "Запустите от root: sudo -i, затем команду ещё раз."
  command -v systemctl >/dev/null || die "Нужен systemd."
  [[ -f $RESULT ]] && die "3X-UI уже установлена этим скриптом. Управление: команда x-ui, данные для входа: cat $RESULT"
  if [[ -d /usr/local/x-ui && ! -f $XUI_ENV ]]; then
    die "3X-UI уже установлена другим способом — не трогаю её. Удалите её (x-ui uninstall) или добавьте REALITY в панели вручную."
  fi

  local PORT=443 SNI="" PANEL_SSL=auto HOST="" UFW=yes NAME="admin" yes=no
  while [[ $# -gt 0 ]]; do
    case $1 in
      --port) PORT=$2; shift 2 ;;
      --sni) SNI=$2; shift 2 ;;
      --panel-ssl) PANEL_SSL=$2; shift 2 ;;
      --host) HOST=$2; shift 2 ;;
      --user) NAME=$2; shift 2 ;;
      --no-ufw) UFW=no; shift ;;
      -y|--yes) yes=yes; shift ;;
      -h|--help) usage; exit 0 ;;
      *) die "Неизвестный параметр: $1 (см. --help)" ;;
    esac
  done
  [[ $PORT =~ ^[0-9]+$ ]] && ((PORT > 0 && PORT < 65536)) || die "Неверный порт: $PORT"
  [[ $NAME =~ ^[A-Za-z0-9_.-]{1,32}$ ]] || die "Имя: латиница, цифры, _ . - (до 32 символов)."
  [[ $PANEL_SSL =~ ^(auto|ip|none)$ ]] || die "--panel-ssl: auto, ip или none"
  if port_busy "$PORT" tcp && ! { [[ -f $XUI_ENV ]] && ss -H -ltnp "sport = :$PORT" | grep -q xray; }; then
    die "Порт $PORT/tcp уже занят. REALITY нужен свободный порт — укажите другой: --port 8443"
  fi

  if [[ $PANEL_SSL == auto ]]; then
    if port_busy 80 tcp; then
      PANEL_SSL=none
      warn "Порт 80 занят — сертификат для панели не получить. Панель будет доступна только через SSH-туннель."
    else
      PANEL_SSL=ip
    fi
  fi
  [[ $PANEL_SSL == ip ]] && port_busy 80 tcp && die "Для сертификата панели нужен свободный порт 80/tcp."

  say "Ставлю пакеты: curl, jq, openssl, qrencode, ufw"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq curl jq openssl qrencode ca-certificates iproute2 ufw socat cron >/dev/null

  HOST=${HOST:-$(public_ip)}
  [[ -n $HOST ]] || die "Не удалось узнать внешний IP. Укажите его: --host 1.2.3.4"

  if [[ -z $SNI ]]; then
    say "Выбираю сайт для маскировки REALITY"
    for s in "${SNI_CANDIDATES[@]}"; do
      if sni_ok "$s"; then SNI=$s; break; fi
    done
    [[ -n $SNI ]] || die "Ни один сайт из списка не ответил по TLS 1.3 + HTTP/2. Укажите свой: --sni example.com"
  elif ! sni_ok "$SNI"; then
    die "$SNI не отвечает по TLS 1.3 + HTTP/2 — REALITY с ним работать не будет. Выберите другой сайт."
  fi
  say "Маскировка: ${B}$SNI${N}"

  # --- официальный установщик 3X-UI с закреплённой версией ---
  local panel_port panel_path panel_user panel_pass tmp
  panel_port=$(free_port)
  panel_path=$(rand_str 18)
  panel_user=$(rand_str 10)
  panel_pass=$(rand_str 20)
  if [[ -f $XUI_ENV ]]; then
    say "3X-UI уже стоит после прошлого запуска — продолжаю с создания подключения"
  else
  tmp=$(mktemp)
  say "Ставлю 3X-UI $XUI_VERSION официальным установщиком (пара минут)"
  curl -fsSL --retry 3 -o "$tmp" "https://raw.githubusercontent.com/$XUI_REPO/$XUI_VERSION/install.sh"
  if ! XUI_NONINTERACTIVE=1 XUI_SSL_MODE="$PANEL_SSL" XUI_SERVER_IP="$HOST" \
      XUI_PANEL_PORT="$panel_port" XUI_WEB_BASE_PATH="$panel_path" \
      XUI_USERNAME="$panel_user" XUI_PASSWORD="$panel_pass" \
      bash "$tmp" "$XUI_VERSION" </dev/null >/var/log/3x-ui-install.log 2>&1; then
    tail -20 /var/log/3x-ui-install.log >&2
    die "Установщик 3X-UI завершился с ошибкой. Полный лог: /var/log/3x-ui-install.log"
  fi
  rm -f "$tmp"
  fi
  [[ -f $XUI_ENV ]] || die "Установщик не сохранил данные входа. Лог: /var/log/3x-ui-install.log"

  # Данные для входа — из файла, который пишет сам установщик.
  # shellcheck disable=SC1090
  . "$XUI_ENV"
  TOKEN=$XUI_API_TOKEN
  local scheme=http
  [[ $XUI_ACCESS_URL == https://* ]] && scheme=https
  API="$scheme://127.0.0.1:$XUI_PANEL_PORT/$XUI_WEB_BASE_PATH/panel/api"
  wait_panel

  # Без сертификата панель и подписки не должны торчать наружу по HTTP.
  if [[ $PANEL_SSL == none ]]; then
    say "Панель без сертификата — открываю её только для SSH-туннеля (127.0.0.1)"
    local all
    all=$(api POST setting/all '{}')
    api POST setting/update "$(jq -c '.webListen = "127.0.0.1" | .subListen = "127.0.0.1"' <<<"$all")" >/dev/null
    systemctl restart x-ui
    wait_panel
  fi

  # --- подключение VLESS REALITY ---
  local keys priv pub uuid sid sub settings stream sniffing body existing
  existing=$(api GET inbounds/list | jq -c --argjson p "$PORT" '[.[] | select(.port == $p)][0] // empty')
  if [[ -n $existing ]]; then
    [[ $(jq -r '.protocol' <<<"$existing") == vless ]] || die "Порт $PORT в панели уже занят другим подключением."
    say "Подключение на порту $PORT уже есть после прошлого запуска — беру его"
    # API отдаёт настройки то строкой JSON, то объектом — поддерживаем оба.
    stream=$(jq -c '.streamSettings | if type == "string" then fromjson else . end' <<<"$existing")
    settings=$(jq -c '.settings | if type == "string" then fromjson else . end' <<<"$existing")
    uuid=$(jq -r '.clients[0].id' <<<"$settings")
    NAME=$(jq -r '.clients[0].email' <<<"$settings")
    pub=$(jq -r '.realitySettings.settings.publicKey' <<<"$stream")
    sid=$(jq -r '.realitySettings.shortIds[0]' <<<"$stream")
    SNI=$(jq -r '.realitySettings.serverNames[0]' <<<"$stream")
  else
  say "Создаю подключение VLESS REALITY на порту $PORT"
  keys=$(api GET server/getNewX25519Cert)
  priv=$(jq -r '.privateKey' <<<"$keys")
  pub=$(jq -r '.publicKey' <<<"$keys")
  uuid=$(cat /proc/sys/kernel/random/uuid)
  sid=$(openssl rand -hex 8)
  sub=$(rand_str 16 | tr 'A-Z' 'a-z')

  settings=$(jq -nc --arg id "$uuid" --arg email "$NAME" --arg sub "$sub" '{
    clients: [{id: $id, flow: "xtls-rprx-vision", email: $email, limitIp: 0, totalGB: 0,
               expiryTime: 0, enable: true, tgId: 0, subId: $sub, reset: 0}],
    decryption: "none", fallbacks: []}')
  stream=$(jq -nc --arg sni "$SNI" --arg priv "$priv" --arg pub "$pub" --arg sid "$sid" '{
    network: "tcp", security: "reality", externalProxy: [],
    realitySettings: {show: false, xver: 0, target: ($sni + ":443"), serverNames: [$sni],
      privateKey: $priv, minClientVer: "", maxClientVer: "", maxTimediff: 0, shortIds: [$sid],
      settings: {publicKey: $pub, fingerprint: "chrome", serverName: "", spiderX: "/"}},
    tcpSettings: {acceptProxyProtocol: false, header: {type: "none"}}}')
  sniffing='{"enabled":true,"destOverride":["http","tls","quic"],"metadataOnly":false,"routeOnly":false}'
  body=$(jq -nc --argjson port "$PORT" --arg s "$settings" --arg st "$stream" --arg sn "$sniffing" '{
    remark: "REALITY", enable: true, listen: "", port: $port, protocol: "vless",
    settings: $s, streamSettings: $st, sniffing: $sn, expiryTime: 0, total: 0}')
  api POST inbounds/add "$body" >/dev/null
  fi

  local link
  link="vless://$uuid@$HOST:$PORT?type=tcp&security=reality&pbk=$pub&fp=chrome&sni=$SNI&sid=$sid&spx=%2F&flow=xtls-rprx-vision#$NAME@$HOST"

  # Ждём, пока Xray поднимет порт.
  for _ in $(seq 1 20); do port_busy "$PORT" tcp && break; sleep 1; done
  port_busy "$PORT" tcp || die "Xray не открыл порт $PORT. Лог: x-ui log"

  # --- файрвол ---
  if [[ $UFW == yes ]]; then
    local ssh_port
    ssh_port=$(ss -H -ltnp 2>/dev/null | awk '/sshd/ {sub(/.*:/,"",$4); print $4; exit}')
    ssh_port=${ssh_port:-22}
    local extra=""
    [[ $PANEL_SSL == ip ]] && extra=", панель $XUI_PANEL_PORT и 80 для продления сертификата"
    say "Настраиваю ufw: SSH $ssh_port, REALITY $PORT$extra"
    ufw allow "$ssh_port/tcp" >/dev/null
    ufw allow "$PORT/tcp" >/dev/null
    if [[ $PANEL_SSL == ip ]]; then
      ufw allow "$XUI_PANEL_PORT/tcp" >/dev/null
      ufw allow 80/tcp >/dev/null
    fi
    ufw --force enable >/dev/null || warn "ufw не включился (так бывает в контейнерах) — откройте порты у хостера вручную."
  fi

  # --- итог ---
  local panel_url
  if [[ $PANEL_SSL == ip ]]; then
    panel_url="https://$HOST:$XUI_PANEL_PORT/$XUI_WEB_BASE_PATH"
  else
    panel_url="http://127.0.0.1:$XUI_PANEL_PORT/$XUI_WEB_BASE_PATH  (через SSH-туннель: ssh -L $XUI_PANEL_PORT:127.0.0.1:$XUI_PANEL_PORT root@$HOST)"
  fi
  umask 077
  cat >"$RESULT" <<EOF
3X-UI $XUI_VERSION — данные для входа (файл виден только root)

Панель:  $panel_url
Логин:   $XUI_USERNAME
Пароль:  $XUI_PASSWORD

Подключение REALITY ($NAME):
$link
EOF

  echo
  echo "${G}${B}Готово! 3X-UI и REALITY работают.${N}"
  echo
  echo "Панель:  ${B}$panel_url${N}"
  echo "Логин:   ${B}$XUI_USERNAME${N}"
  echo "Пароль:  ${B}$XUI_PASSWORD${N}"
  echo
  echo "Ссылка для ${B}$NAME${N} — вставьте в Hiddify, v2rayN, Streisand или Happ:"
  echo
  echo "$link"
  echo
  qrencode -t ANSIUTF8 -m 1 "$link" || true
  echo
  echo "Всё это сохранено в ${B}$RESULT${N}. Друзей добавляйте в панели:"
  echo "Клиенты → Добавить клиента → подключение REALITY."
}

usage() {
  cat <<EOF
3X-UI + VLESS REALITY одной командой

  --port 443          порт REALITY (по умолчанию 443)
  --sni сайт          сайт для маскировки (по умолчанию подбирается сам)
  --panel-ssl ip|none сертификат панели: ip — Let's Encrypt на IP (нужен порт 80),
                      none — панель только через SSH-туннель (по умолчанию выбирается сам)
  --user admin        имя первого клиента
  --host 1.2.3.4      адрес в ссылке, если IP определился неверно
  --no-ufw            не трогать файрвол
  -y                  не задавать вопросов
EOF
}

main "$@"
