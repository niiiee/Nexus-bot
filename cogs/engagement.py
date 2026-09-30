import discord
from discord.ext import commands, tasks
import config
from utils import db
import random

class Engagement(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.check_engagement.start()

    def cog_unload(self):
        self.check_engagement.cancel()

    @commands.Cog.listener()
    async def on_message(self, message):
        if message.author.bot:
            return
        await db.log_message()

    @tasks.loop(minutes=60) # Run every hour, adjust as needed
    async def check_engagement(self):
        await self.bot.wait_until_ready()
        if not config.EVENTS_CHANNEL_ID:
            return
            
        count = await db.get_daily_message_count()
        # If engagement is low (arbitrary threshold for example)
        if count < 50:
            channel = self.bot.get_channel(config.EVENTS_CHANNEL_ID)
            if channel:
                event_type = random.choice(["Technical Event 💻", "Design Event 🎨"])
                await channel.send(f"@everyone Activity has been a bit low today! It's time for a **{event_type}**! \nShare your latest work, a problem you solved, or a new tool you found useful. Let's discuss!")

async def setup(bot):
    await bot.add_cog(Engagement(bot))
