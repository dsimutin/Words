import asyncio
import os
import random
import re
from datetime import datetime, timedelta

import aiosqlite
from aiogram import Bot, Dispatcher, F
from aiogram.enums import ParseMode
from aiogram.filters import Command, CommandStart
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message
from dotenv import load_dotenv


load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
ADMIN_ID = int(os.getenv("ADMIN_ID", "0"))
DATABASE_PATH = os.getenv("DATABASE_PATH", "words_bot.db")
WORDS_DIR = os.getenv("WORDS_DIR", "words")


if not BOT_TOKEN:
    raise RuntimeError("BOT_TOKEN не указан. Открой .env и вставь токен от BotFather.")


# -----------------------------
# КЛАВИАТУРЫ
# -----------------------------


def user_menu_keyboard():
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="▶️ Начать тренировку", callback_data="train")],
            [InlineKeyboardButton(text="📊 Моя статистика", callback_data="my_stats")],
        ]
    )


def show_translation_keyboard(word_id: int):
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="👀 Показать перевод", callback_data=f"show:{word_id}")]
        ]
    )


def answer_keyboard(word_id: int):
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="✅ Запомнил", callback_data=f"answer:{word_id}:yes"),
                InlineKeyboardButton(text="🔁 Не запомнил", callback_data=f"answer:{word_id}:no"),
            ]
        ]
    )


def admin_keyboard():
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="➕ Добавить слово", callback_data="admin_add")],
            [InlineKeyboardButton(text="📋 Список слов", callback_data="admin_list")],
            [InlineKeyboardButton(text="🔄 Импорт из папки words", callback_data="admin_import")],
            [InlineKeyboardButton(text="📊 Статистика", callback_data="admin_stats")],
        ]
    )


def word_action_keyboard(word_id: int):
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="✏️ Редактировать", callback_data=f"edit:{word_id}"),
                InlineKeyboardButton(text="🗑 Удалить", callback_data=f"delete:{word_id}"),
            ],
            [InlineKeyboardButton(text="🏠 Админ-меню", callback_data="admin_menu")],
        ]
    )


# -----------------------------
# БАЗА ДАННЫХ
# -----------------------------


async def init_db():
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS words (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                word TEXT NOT NULL UNIQUE,
                transcription TEXT NOT NULL DEFAULT '',
                translation TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS progress (
                user_id INTEGER NOT NULL,
                word_id INTEGER NOT NULL,
                level INTEGER NOT NULL DEFAULT 0,
                correct_count INTEGER NOT NULL DEFAULT 0,
                wrong_count INTEGER NOT NULL DEFAULT 0,
                next_review_at TEXT NOT NULL,
                PRIMARY KEY (user_id, word_id)
            )
            """
        )
        await db.commit()


async def add_or_update_word(word: str, transcription: str, translation: str):
    now = datetime.now().isoformat(timespec="seconds")
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute(
            """
            INSERT INTO words(word, transcription, translation, created_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(word) DO UPDATE SET
                transcription = excluded.transcription,
                translation = excluded.translation
            """,
            (word.strip(), transcription.strip(), translation.strip(), now),
        )
        await db.commit()


async def delete_word(word_id: int):
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute("DELETE FROM words WHERE id = ?", (word_id,))
        await db.commit()


async def get_word(word_id: int):
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM words WHERE id = ?", (word_id,))
        return await cursor.fetchone()


async def get_all_words(limit: int = 20):
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM words ORDER BY word COLLATE NOCASE LIMIT ?",
            (limit,),
        )
        return await cursor.fetchall()


async def count_words():
    async with aiosqlite.connect(DATABASE_PATH) as db:
        cursor = await db.execute("SELECT COUNT(*) FROM words")
        row = await cursor.fetchone()
        return row[0]


async def get_random_unseen_word(user_id: int):
    """Быстрое получение случайного невиденного слова."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            """
            SELECT id FROM words
            WHERE id NOT IN (
                SELECT word_id FROM progress WHERE user_id = ?
            )
            LIMIT 1000
            """,
            (user_id,),
        )
        ids = await cursor.fetchall()
        if not ids:
            return None

        word_id = random.choice(ids)[0]
        cursor = await db.execute("SELECT * FROM words WHERE id = ?", (word_id,))
        return await cursor.fetchone()


async def get_random_due_word(user_id: int):
    """Быстрое получение случайного слова для повторения."""
    now = datetime.now().isoformat(timespec="seconds")
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            """
            SELECT word_id FROM progress
            WHERE user_id = ? AND next_review_at <= ?
            LIMIT 1000
            """,
            (user_id, now),
        )
        word_ids = await cursor.fetchall()
        if not word_ids:
            return None

        word_id = random.choice(word_ids)[0]
        cursor = await db.execute("SELECT * FROM words WHERE id = ?", (word_id,))
        return await cursor.fetchone()


async def get_next_word(user_id: int):
    # Сначала берем слово, которое пользователь еще не видел
    word = await get_random_unseen_word(user_id)
    if word:
        return word

    # Потом берем слово, которое пора повторить
    word = await get_random_due_word(user_id)
    if word:
        return word

    # Если все слова отложены, показываем случайное из всех слов
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT id FROM words LIMIT 1000")
        word_ids = await cursor.fetchall()
        if not word_ids:
            return None

        word_id = random.choice([w[0] for w in word_ids])
        cursor = await db.execute("SELECT * FROM words WHERE id = ?", (word_id,))
        return await cursor.fetchone()


async def save_answer(user_id: int, word_id: int, remembered: bool):
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM progress WHERE user_id = ? AND word_id = ?",
            (user_id, word_id),
        )
        row = await cursor.fetchone()

        old_level = row["level"] if row else 0

        if remembered:
            level = min(old_level + 1, 5)
            hours_by_level = {
                1: 8,
                2: 24,
                3: 72,
                4: 168,
                5: 336,
            }
            next_review = datetime.now() + timedelta(hours=hours_by_level[level])
            correct_add = 1
            wrong_add = 0
        else:
            level = 0
            next_review = datetime.now()
            correct_add = 0
            wrong_add = 1

        await db.execute(
            """
            INSERT INTO progress(user_id, word_id, level, correct_count, wrong_count, next_review_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, word_id) DO UPDATE SET
                level = excluded.level,
                correct_count = correct_count + ?,
                wrong_count = wrong_count + ?,
                next_review_at = excluded.next_review_at
            """,
            (
                user_id,
                word_id,
                level,
                correct_add,
                wrong_add,
                next_review.isoformat(timespec="seconds"),
                correct_add,
                wrong_add,
            ),
        )
        await db.commit()


async def get_user_stats(user_id: int):
    async with aiosqlite.connect(DATABASE_PATH) as db:
        cursor = await db.execute(
            """
            SELECT
                COUNT(*) as seen,
                COALESCE(SUM(correct_count), 0) as correct,
                COALESCE(SUM(wrong_count), 0) as wrong
            FROM progress
            WHERE user_id = ?
            """,
            (user_id,),
        )
        return await cursor.fetchone()


async def get_admin_stats():
    async with aiosqlite.connect(DATABASE_PATH) as db:
        cursor = await db.execute("SELECT COUNT(*) FROM words")
        words_count = (await cursor.fetchone())[0]

        cursor = await db.execute("SELECT COUNT(DISTINCT user_id) FROM progress")
        users_count = (await cursor.fetchone())[0]

        return words_count, users_count


# -----------------------------
# ИМПОРТ СЛОВ ИЗ ПАПКИ words
# -----------------------------


def parse_word_line(line: str):
    line = line.strip()
    if not line or line.startswith("#"):
        return None

    # Поддерживает:
    # apple - [ˈæpəl] - яблоко
    # apple | [ˈæpəl] | яблоко
    # apple; [ˈæpəl]; яблоко
    for separator in [" - ", " | ", ";"]:
        parts = [p.strip() for p in line.split(separator) if p.strip()]
        if len(parts) >= 3:
            return parts[0], parts[1], " ".join(parts[2:])
        if len(parts) == 2:
            return parts[0], "", parts[1]

    # Поддерживает:
    # apple [ˈæpəl] яблоко
    match = re.match(r"^(.+?)\s+(\[[^\]]+\]|/[^/]+/)\s+(.+)$", line)
    if match:
        return match.group(1), match.group(2), match.group(3)

    return None


async def import_words_from_folder():
    if not os.path.exists(WORDS_DIR):
        os.makedirs(WORDS_DIR, exist_ok=True)
        return 0

    words_to_import = []
    now = datetime.now().isoformat(timespec="seconds")

    for filename in os.listdir(WORDS_DIR):
        if not filename.endswith((".txt", ".md")):
            continue

        path = os.path.join(WORDS_DIR, filename)
        with open(path, "r", encoding="utf-8") as file:
            for line in file:
                parsed = parse_word_line(line)
                if not parsed:
                    continue
                word, transcription, translation = parsed
                words_to_import.append((word.strip(), transcription.strip(), translation.strip(), now))

    if not words_to_import:
        return 0

    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.executemany(
            """
            INSERT INTO words(word, transcription, translation, created_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(word) DO UPDATE SET
                transcription = excluded.transcription,
                translation = excluded.translation
            """,
            words_to_import,
        )
        await db.commit()

    return len(words_to_import)


# -----------------------------
# ТЕКСТЫ КАРТОЧЕК
# -----------------------------


def card_front(word):
    transcription = word["transcription"] or "—"
    return (
        "🧠 <b>Карточка</b>\n\n"
        f"<b>{word['word']}</b>\n"
        f"<i>{transcription}</i>\n\n"
        "Нажми кнопку ниже, чтобы увидеть перевод."
    )


def card_back(word):
    transcription = word["transcription"] or "—"
    return (
        "🧠 <b>Карточка</b>\n\n"
        f"<b>{word['word']}</b>\n"
        f"<i>{transcription}</i>\n\n"
        f"🇷🇺 <b>Перевод:</b> {word['translation']}\n\n"
        "Получилось вспомнить?"
    )


async def send_next_card(message_or_callback, user_id: int, edit: bool = False):
    word = await get_next_word(user_id)

    if not word:
        text = (
            "Пока в базе нет слов.\n\n"
            "Если ты администратор, открой /admin и добавь слово "
            "или нажми импорт из папки words."
        )
        if edit:
            await message_or_callback.message.edit_text(text)
        else:
            await message_or_callback.answer(text)
        return

    if edit:
        await message_or_callback.message.edit_text(
            card_front(word),
            reply_markup=show_translation_keyboard(word["id"]),
            parse_mode=ParseMode.HTML,
        )
    else:
        await message_or_callback.answer(
            card_front(word),
            reply_markup=show_translation_keyboard(word["id"]),
            parse_mode=ParseMode.HTML,
        )


# -----------------------------
# BOT
# -----------------------------


bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

# Простая память для админ-действий.
# Для маленького личного бота этого достаточно.
admin_modes = {}


@dp.message(CommandStart())
async def start(message: Message):
    await message.answer(
        "Привет. Я помогу учить английские слова через флеш-карточки.\n\n"
        "Нажми кнопку ниже или используй /train.",
        reply_markup=user_menu_keyboard(),
    )


@dp.message(Command("train"))
async def train(message: Message):
    await send_next_card(message, message.from_user.id)


@dp.callback_query(F.data == "train")
async def train_callback(callback: CallbackQuery):
    await callback.answer()
    await send_next_card(callback, callback.from_user.id, edit=True)


@dp.callback_query(F.data.startswith("show:"))
async def show_translation(callback: CallbackQuery):
    await callback.answer()
    word_id = int(callback.data.split(":")[1])
    word = await get_word(word_id)

    if not word:
        await callback.message.edit_text("Слово не найдено. Показываю следующее.")
        await send_next_card(callback, callback.from_user.id, edit=True)
        return

    await callback.message.edit_text(
        card_back(word),
        reply_markup=answer_keyboard(word_id),
        parse_mode=ParseMode.HTML,
    )


@dp.callback_query(F.data.startswith("answer:"))
async def answer(callback: CallbackQuery):
    await callback.answer()
    _, word_id, result = callback.data.split(":")
    remembered = result == "yes"
    await save_answer(callback.from_user.id, int(word_id), remembered)
    await send_next_card(callback, callback.from_user.id, edit=True)


@dp.message(Command("stats"))
async def stats(message: Message):
    seen, correct, wrong = await get_user_stats(message.from_user.id)
    await message.answer(
        "📊 <b>Твоя статистика</b>\n\n"
        f"Слов уже встречалось: <b>{seen}</b>\n"
        f"Запомнил: <b>{correct}</b>\n"
        f"Не запомнил: <b>{wrong}</b>",
        parse_mode=ParseMode.HTML,
    )


@dp.callback_query(F.data == "my_stats")
async def my_stats_callback(callback: CallbackQuery):
    await callback.answer()
    seen, correct, wrong = await get_user_stats(callback.from_user.id)
    await callback.message.edit_text(
        "📊 <b>Твоя статистика</b>\n\n"
        f"Слов уже встречалось: <b>{seen}</b>\n"
        f"Запомнил: <b>{correct}</b>\n"
        f"Не запомнил: <b>{wrong}</b>",
        parse_mode=ParseMode.HTML,
        reply_markup=user_menu_keyboard(),
    )


# -----------------------------
# АДМИНКА
# -----------------------------


def is_admin(user_id: int):
    return user_id == ADMIN_ID


@dp.message(Command("admin"))
async def admin(message: Message):
    if not is_admin(message.from_user.id):
        await message.answer("Нет доступа.")
        return

    await message.answer(
        "🛠 <b>Админ-панель</b>\n\nВыбери действие:",
        parse_mode=ParseMode.HTML,
        reply_markup=admin_keyboard(),
    )


@dp.callback_query(F.data == "admin_menu")
async def admin_menu(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("Нет доступа", show_alert=True)
        return

    await callback.answer()
    await callback.message.edit_text(
        "🛠 <b>Админ-панель</b>\n\nВыбери действие:",
        parse_mode=ParseMode.HTML,
        reply_markup=admin_keyboard(),
    )


@dp.callback_query(F.data == "admin_add")
async def admin_add(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("Нет доступа", show_alert=True)
        return

    await callback.answer()
    admin_modes[callback.from_user.id] = {"mode": "add"}
    await callback.message.edit_text(
        "➕ <b>Добавление слова</b>\n\n"
        "Отправь слово в формате:\n\n"
        "<code>apple - [ˈæpəl] - яблоко</code>",
        parse_mode=ParseMode.HTML,
    )


@dp.callback_query(F.data == "admin_import")
async def admin_import(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("Нет доступа", show_alert=True)
        return

    await callback.answer()
    imported = await import_words_from_folder()
    await callback.message.edit_text(
        f"✅ Импорт завершен. Добавлено/обновлено строк: <b>{imported}</b>",
        parse_mode=ParseMode.HTML,
        reply_markup=admin_keyboard(),
    )


@dp.callback_query(F.data == "admin_stats")
async def admin_stats(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("Нет доступа", show_alert=True)
        return

    await callback.answer()
    words_count, users_count = await get_admin_stats()
    await callback.message.edit_text(
        "📊 <b>Статистика</b>\n\n"
        f"Слов в базе: <b>{words_count}</b>\n"
        f"Пользователей с прогрессом: <b>{users_count}</b>",
        parse_mode=ParseMode.HTML,
        reply_markup=admin_keyboard(),
    )


@dp.callback_query(F.data == "admin_list")
async def admin_list(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("Нет доступ", show_alert=True)
        return

    await callback.answer()
    words = await get_all_words(limit=20)

    if not words:
        await callback.message.edit_text("Слов пока нет.", reply_markup=admin_keyboard())
        return

    buttons = []
    for word in words:
        title = f"{word['word']} — {word['translation']}"
        if len(title) > 50:
            title = title[:47] + "..."
        buttons.append([InlineKeyboardButton(text=title, callback_data=f"word:{word['id']}")])

    buttons.append([InlineKeyboardButton(text="🏠 Админ-меню", callback_data="admin_menu")])

    await callback.message.edit_text(
        "📋 <b>Первые 20 слов</b>\n\nНажми на слово, чтобы редактировать или удалить.",
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
    )


@dp.callback_query(F.data.startswith("word:"))
async def admin_word(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("Нет доступа", show_alert=True)
        return

    await callback.answer()
    word_id = int(callback.data.split(":")[1])
    word = await get_word(word_id)

    if not word:
        await callback.message.edit_text("Слово не найдено.", reply_markup=admin_keyboard())
        return

    await callback.message.edit_text(
        "📝 <b>Слово</b>\n\n"
        f"ID: <code>{word['id']}</code>\n"
        f"Слово: <b>{word['word']}</b>\n"
        f"Транскрипция: <i>{word['transcription'] or '—'}</i>\n"
        f"Перевод: <b>{word['translation']}</b>",
        parse_mode=ParseMode.HTML,
        reply_markup=word_action_keyboard(word_id),
    )


@dp.callback_query(F.data.startswith("edit:"))
async def edit_word(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("Нет доступа", show_alert=True)
        return

    await callback.answer()
    word_id = int(callback.data.split(":")[1])
    admin_modes[callback.from_user.id] = {"mode": "edit", "word_id": word_id}
    await callback.message.edit_text(
        "✏️ <b>Редактирование слова</b>\n\n"
        "Отправь новое значение в формате:\n\n"
        "<code>apple - [ˈæpəl] - яблоко</code>",
        parse_mode=ParseMode.HTML,
    )


@dp.callback_query(F.data.startswith("delete:"))
async def remove_word(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("Нет доступа", show_alert=True)
        return

    await callback.answer()
    word_id = int(callback.data.split(":")[1])
    await delete_word(word_id)
    await callback.message.edit_text("✅ Слово удалено.", reply_markup=admin_keyboard())


@dp.message()
async def admin_text_input(message: Message):
    if not is_admin(message.from_user.id):
        return

    mode_data = admin_modes.get(message.from_user.id)
    if not mode_data:
        return

    parsed = parse_word_line(message.text or "")
    if not parsed:
        await message.answer(
            "Не понял формат. Нужно так:\n\n"
            "<code>apple - [ˈæpəl] - яблоко</code>",
            parse_mode=ParseMode.HTML,
        )
        return

    word, transcription, translation = parsed

    if mode_data["mode"] == "add":
        await add_or_update_word(word, transcription, translation)
        admin_modes.pop(message.from_user.id, None)
        await message.answer("✅ Слово добавлено.", reply_markup=admin_keyboard())
        return

    if mode_data["mode"] == "edit":
        word_id = mode_data["word_id"]
        old_word = await get_word(word_id)
        if old_word:
            await delete_word(word_id)
        await add_or_update_word(word, transcription, translation)
        admin_modes.pop(message.from_user.id, None)
        await message.answer("✅ Слово обновлено.", reply_markup=admin_keyboard())
        return


async def main():
    await init_db()
    imported = await import_words_from_folder()
    print(f"Bot started. Imported/updated words from folder: {imported}")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
