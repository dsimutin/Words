#!/bin/bash

cd "$(dirname "$0")"

echo "===================================="
echo " Установка Telegram-бота со словами "
echo "===================================="
echo ""

if ! command -v python3 &> /dev/null
then
    echo "Ошибка: Python3 не найден."
    echo "Установи Python с сайта https://www.python.org/downloads/"
    echo ""
    read -p "Нажми Enter, чтобы закрыть окно..."
    exit 1
fi

echo "Python найден:"
python3 --version
echo ""

if [ ! -d ".venv" ]; then
    echo "Создаю виртуальное окружение..."
    python3 -m venv .venv
else
    echo "Виртуальное окружение уже есть."
fi

echo ""
echo "Активирую окружение..."
source .venv/bin/activate

echo ""
echo "Устанавливаю зависимости..."
pip install --upgrade pip
pip install -r requirements.txt

echo ""
if [ ! -f ".env" ]; then
    echo "Создаю файл .env из шаблона..."
    cp .env.example .env
else
    echo "Файл .env уже есть."
fi

echo ""
echo "===================================="
echo " Установка завершена "
echo "===================================="
echo ""
echo "Сейчас откроется файл .env."
echo "Вставь туда:"
echo "1) BOT_TOKEN от BotFather"
echo "2) ADMIN_ID из @userinfobot"
echo ""
echo "Потом сохрани файл и запусти run_mac.command"
echo ""

open -e .env

read -p "Нажми Enter, чтобы закрыть окно..."
