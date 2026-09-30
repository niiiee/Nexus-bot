import aiosqlite
import json

DB_PATH = "bot_database.db"

async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute('''
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY,
                status TEXT, -- 'interviewing', 'passed', 'failed', 'larper'
                experience_level TEXT,
                strikes INTEGER DEFAULT 0
            )
        ''')
        await db.execute('''
            CREATE TABLE IF NOT EXISTS server_stats (
                date TEXT PRIMARY KEY,
                message_count INTEGER DEFAULT 0
            )
        ''')
        await db.commit()

async def get_user(user_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT status, experience_level, strikes FROM users WHERE user_id = ?", (user_id,)) as cursor:
            return await cursor.fetchone()

async def set_user_status(user_id: int, status: str, experience_level: str = None):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute('''
            INSERT INTO users (user_id, status, experience_level)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET status = excluded.status, experience_level = coalesce(excluded.experience_level, users.experience_level)
        ''', (user_id, status, experience_level))
        await db.commit()

async def log_message():
    import datetime
    today = datetime.date.today().isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute('''
            INSERT INTO server_stats (date, message_count)
            VALUES (?, 1)
            ON CONFLICT(date) DO UPDATE SET message_count = message_count + 1
        ''', (today,))
        await db.commit()

async def get_daily_message_count():
    import datetime
    today = datetime.date.today().isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT message_count FROM server_stats WHERE date = ?", (today,)) as cursor:
            row = await cursor.fetchone()
            return row[0] if row else 0
