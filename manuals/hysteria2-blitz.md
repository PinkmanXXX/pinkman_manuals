# Установка Hysteria2 (Blitz)

### 1) Обновление Ubuntu

```bash
apt update && apt upgrade -y
```

### 2) Установка панели

```bash
bash <(curl https://raw.githubusercontent.com/ReturnFI/Blitz/main/install.sh)
```

После установки запустите меню командой `hys2`.

### 3) Установка Hysteria2

1. Выбираем пункт **1 - Hysteria2 Menu**.
2. Выбираем пункт **1 - Install**.
3. Введите SNI (например, `github.com`) и порт (например, `1935`).

![Install](assets/%D0%A1%D0%BD%D0%B8%D0%BC%D0%BE%D0%BA_%D1%8D%D0%BA%D1%80%D0%B0%D0%BD%D0%B0_2025-12-19_%D0%B2_18.34.29.png)

### 4) Поднимаем Web-панель 
- Выбираем пункт **2 - Advanced Menu**.
- Пункт **9 - Web panel**.
- Пункт **1 - Start Web panel services**.

Введите домен, порт 443, логин и пароль.

![Web Panel](assets/%D0%A1%D0%BD%D0%B8%D0%BC%D0%BE%D0%BA_%D1%8D%D0%BA%D1%80%D0%B0%D0%BD%D0%B0_2025-12-19_%D0%B2_18.45.51.png)

### 5) Настройка юзера

Заходим в панель, вкладка **users**. Удаляем дефолтного, создаем нового (+).

![Users](assets/%D0%A1%D0%BD%D0%B8%D0%BC%D0%BE%D0%BA_%D1%8D%D0%BA%D1%80%D0%B0%D0%BD%D0%B0_2025-12-19_%D0%B2_18.55.45.png)
