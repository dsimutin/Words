#!/bin/bash

cd "$(dirname "$0")"

echo "=============================="
echo " Запуск Telegram-бота "
echo "=============================="
echo ""

if [ ! -d ".venv" ]; then
    echo "Ошибка: бот еще не установлен."
    echo "Сначала запусти install_mac.command"
    echo ""
    read -p "Нажми Enter, чтобы закрыть окно..."
    exit 1
fi

if [ ! -f ".env" ]; then
    echo "Ошибка: файл .env не найден."
    echo "Сначала запусти install_mac.command и вставь токен."
    echo ""
    read -p "Нажми Enter, чтобы закрыть окно..."
    exit 1
fi

source .venv/bin/activate

echo "Бот запускается..."
echo "Чтобы остановить бота, нажми Ctrl + C"
echo ""

python bot.py

echo ""
read -p "Бот остановлен. Нажми Enter, чтобы закрыть окно..."
