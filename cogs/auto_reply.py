import discord
from discord.ext import commands
from utils import ai_handler

class AutoReply(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_message(self, message):
        if message.author.bot:
            return
            
        # Only reply if mentioned or in specific circumstances, to avoid spam
        if self.bot.user in message.mentions:
            # Clean message from the mention
            clean_text = message.content.replace(f'<@{self.bot.user.id}>', '').strip()
            if not clean_text:
                await message.reply("What's up? Ask me a technical question or just chat.")
                return
                
            async with message.channel.typing():
                response = await ai_handler.auto_reply(clean_text)
                await message.reply(response)

async def setup(bot):
    await bot.add_cog(AutoReply(bot))
