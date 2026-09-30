import discord
from discord.ext import commands
import config
from utils import db
import os

intents = discord.Intents.default()
intents.message_content = True
intents.members = True

bot = commands.Bot(command_prefix="!", intents=intents)

@bot.event
async def on_ready():
    print(f'Logged in as {bot.user} (ID: {bot.user.id})')
    print('------')
    await db.init_db()

    # Load Cogs
    cogs = ["cogs.onboarding", "cogs.auto_reply", "cogs.engagement", "cogs.courses", "cogs.daily_tasks", "cogs.telegram_sync"]
    for cog in cogs:
        try:
            await bot.load_extension(cog)
            print(f"Loaded {cog}")
        except Exception as e:
            print(f"Failed to load {cog}: {e}")

if __name__ == "__main__":
    if not config.DISCORD_TOKEN or config.DISCORD_TOKEN == "your_discord_bot_token_here":
        print("Please configure DISCORD_TOKEN in .env")
    else:
        bot.run(config.DISCORD_TOKEN)
