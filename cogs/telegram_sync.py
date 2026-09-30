import discord
from discord.ext import commands
import aiohttp
import config

class TelegramSync(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.telegram_url = f"https://api.telegram.org/bot{config.TELEGRAM_BOT_TOKEN}/sendMessage"
        self.telegram_doc_url = f"https://api.telegram.org/bot{config.TELEGRAM_BOT_TOKEN}/sendDocument"

    async def send_to_telegram(self, text: str):
        if not config.TELEGRAM_BOT_TOKEN or not config.TELEGRAM_CHAT_ID:
            return
        async with aiohttp.ClientSession() as session:
            payload = {
                "chat_id": config.TELEGRAM_CHAT_ID,
                "text": text
            }
            await session.post(self.telegram_url, json=payload)

    async def send_file_to_telegram(self, file_url: str, caption: str):
        if not config.TELEGRAM_BOT_TOKEN or not config.TELEGRAM_CHAT_ID:
            return
        async with aiohttp.ClientSession() as session:
            payload = {
                "chat_id": config.TELEGRAM_CHAT_ID,
                "document": file_url,
                "caption": caption
            }
            await session.post(self.telegram_doc_url, json=payload)

    @commands.Cog.listener()
    async def on_message(self, message):
        if message.author.bot:
            return

        # Sync files, tips, open source code
        if message.attachments:
            for attachment in message.attachments:
                await self.send_file_to_telegram(attachment.url, f"File shared by {message.author.name} in #{message.channel.name}")
        
        # Simple heuristic: if message has code blocks or is long, consider it a tip/code
        if "```" in message.content or len(message.content) > 500:
            await self.send_to_telegram(f"Important message/Code from {message.author.name} in #{message.channel.name}:\n{message.content}")

async def setup(bot):
    await bot.add_cog(TelegramSync(bot))
