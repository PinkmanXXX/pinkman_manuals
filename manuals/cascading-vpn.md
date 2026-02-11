# Каскадный VPN (client - VPS Russia - VPS World)

Схема для максимальной маскировки трафика.

## Что понадобится
1. Российский сервер (Ubuntu 24.04).
2. Зарубежный сервер (Ubuntu 24.04).
3. Домены для обоих серверов.

## Этапы установки

1. **Настройка российского сервера:**
Устанавливаем 3x-ui:
```bash
sudo su -c "bash <(wget -qO- https://raw.githubusercontent.com/mozaroc/x-ui-pro/refs/heads/master/x-ui-pro-nodomain.sh) -install yes -panel 1 -ONLY_CF_IP_ALLOW no -auto_domain y"
```

2. **Настройка зарубежного сервера:**
Аналогичная установка 3x-ui.

3. **Создание каскада:**
В 3x-ui на российском сервере создайте **Outbound** с данными зарубежного сервера.

![Outbound](assets/%D0%A1%D0%BD%D0%B8%D0%BC%D0%BE%D0%BA_%D1%8D%D0%BA%D1%80%D0%B0%D0%BD%D0%B0_2025-12-23_%D0%B2_11.45.17.png)

В разделе **Маршрутизация** создайте правило: `Inbound Tag` (ваш РФ вход) -> `Outbound Tag` (ваш зарубежный выход).

![Routing](assets/%D0%A1%D0%BD%D0%B8%D0%BC%D0%BE%D0%BA_%D1%8D%D0%BA%D1%80%D0%B0%D0%BD%D0%B0_2025-12-23_%D0%B2_11.57.42.png)
