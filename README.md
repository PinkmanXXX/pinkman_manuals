<div align="center">

<img alt="3X-UI + Hysteria2 Kit" src="manuals/assets/banner.svg" width="820">

**Пошаговые инструкции: свой VPN-сервер за 15 минут и прокси на роутере Keenetic**

[![Инструкций](https://img.shields.io/badge/инструкций-3-3fb950)](#инструкции)
[![Обновлено](https://img.shields.io/github/last-commit/itsnotkubrick/Reality_Hysteria2?label=обновлено&color=3fb950)](https://github.com/itsnotkubrick/Reality_Hysteria2/commits)

[Инструкции](#инструкции) · [Генераторы](#генераторы-конфигов-для-xkeen) · [Что понадобится](#что-понадобится) · [Полезное](#полезное) · [Поддержать](#поддержать-проект)

</div>

---

Свой VPN-сервер — одной командой. Скрипты из этого репозитория ставят
3X-UI с REALITY или Hysteria2 на чистый VPS, сами настраивают сертификаты
и файрвол и выдают готовую ссылку с QR-кодом. А инструкция по XKeen поможет
пустить трафик через прокси прямо на роутере Keenetic.

## Инструкции

| | Инструкция | Что получится | Сложность |
|---|---|---|---|
| 🛡 | [3X-UI + REALITY](manuals/3x-ui.md) | Панель и подключение VLESS REALITY одной командой, без доменов | ●○○ |
| 🚀 | [Hysteria2](manuals/hysteria2.md) | Быстрый протокол на UDP, друзья добавляются командой `hy2 add` | ●○○ |
| 📶 | [XKeen на Keenetic](manuals/xkeen-keenetic.md) | Прокси для выбранных устройств прямо на роутере | ●●○ |

> [!WARNING]
> Инструкции подготовлены в образовательных целях. Убедитесь, что ваши
> действия соответствуют законодательству вашей страны.

## Генераторы конфигов для XKeen

Вставьте ссылку на сервер или подписку, отметьте нужные сервисы — и получите
готовый конфиг и одну команду, которая сама положит его на роутер.
Всё считается в браузере, ссылки никуда не отправляются.

| | Генератор | Что получится |
|---|---|---|
| ⚙️ | [Xray](https://itsnotkubrick.github.io/Reality_Hysteria2/tools/xray/) | `04_outbounds.json` и `05_routing.json`: серверы, выбор сервисов, реклама, свои сайты |
| 🧩 | [Mihomo](https://itsnotkubrick.github.io/Reality_Hysteria2/tools/mihomo/) | `config.yaml` с автовыбором сервера, подпиской, Hysteria2 и веб-панелью |

## Что понадобится

- VPS с **Ubuntu 22.04/24.04** или **Debian 12/13** и доступом root по SSH
- Для Hysteria2 по желанию — домен, направленный на IP сервера
- Для XKeen — роутер **Keenetic/Netcraze** и USB-флешка

## Полезное

- [XKeen](https://github.com/jameszeroX/XKeen) и его [вики](https://github.com/jameszeroX/XKeen/wiki) — документация по маршрутизации на Keenetic
- [XKeen UI](https://github.com/zxc-rv/XKeen-UI) — веб-интерфейс для XKeen
- [IP-адреса для AmneziaWG](https://github.com/RockBlack-VPN/ip-address) — актуальные списки от RockBlack

## Как устроены скрипты

Скрипты ставят только официальные сборки — [3X-UI](https://github.com/MHSanaei/3x-ui)
и [Hysteria](https://github.com/HyNetworks/hysteria) — в версиях, которые мы
проверили: версия закреплена в начале каждого скрипта, скачанный файл сверяется
с контрольной суммой. Код открыт: [scripts/](scripts/).

## Поддержать проект

Инструкции и скрипты бесплатные. Донат добровольный — он помогает оплачивать
тестовые серверы и держать скрипты в актуальном состоянии. Спасибо! 💜

| Способ | |
|---|---|
| Российской картой, СБП, Tinkoff Pay | [CloudTips](https://pay.cloudtips.ru/p/d4f9e3d1) |
| Зарубежной картой, Apple Pay, Google Pay | [Buy Me a Coffee](https://buymeacoffee.com/relo.cate) |
| USDT (TRC-20) | `TS83ViXrdezUpp1eFadqj1rBhGLZaba1c1` |
| TON | `UQBchO4XFPwF9MMa_tjXpwqTo8IL2FhUDyllhYuFo8WM-Qbf` |
| Ethereum (ERC-20) | `0xC06F6B3A029d7Ea00705B7028490744e2BC16799` |

## Благодарности

Скрипты и инструкции опираются на работу авторов этих проектов:
[3X-UI](https://github.com/MHSanaei/3x-ui) ·
[Hysteria](https://github.com/HyNetworks/hysteria) ·
[XKeen](https://github.com/jameszeroX/XKeen) ·
[Xray-core](https://github.com/XTLS/Xray-core)
