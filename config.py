import os
from dotenv import load_dotenv

load_dotenv()

DISCORD_TOKEN = os.getenv("DISCORD_TOKEN")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")
GUILD_ID = int(os.getenv("GUILD_ID", 0))

WELCOME_CHANNEL_ID = int(os.getenv("WELCOME_CHANNEL_ID", 0))
COURSES_CHANNEL_ID = int(os.getenv("COURSES_CHANNEL_ID", 0))
EVENTS_CHANNEL_ID = int(os.getenv("EVENTS_CHANNEL_ID", 0))
CEO_CHANNEL_ID = int(os.getenv("CEO_CHANNEL_ID", 0))

# Roles
LARPER_ROLE_NAME = "Larper"
MEMBER_ROLE_NAME = "Member"
