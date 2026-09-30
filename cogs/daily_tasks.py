import discord
from discord.ext import commands, tasks
import config
from utils import ai_handler

class DailyTasks(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.post_daily_task.start()

    def cog_unload(self):
        self.post_daily_task.cancel()

    @tasks.loop(hours=24)
    async def post_daily_task(self):
        await self.bot.wait_until_ready()
        if not config.EVENTS_CHANNEL_ID:
            return
            
        channel = self.bot.get_channel(config.EVENTS_CHANNEL_ID)
        if channel:
            # Generate a task using AI
            prompt = "Generate a short, engaging daily programming or design challenge for a Discord server. Include a small theoretical reward."
            import google.genai as genai
            client = genai.Client(api_key=config.GEMINI_API_KEY)
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt
            )
            
            embed = discord.Embed(title="🌟 Daily Task 🌟", description=response.text, color=0xffa500)
            await channel.send("@everyone", embed=embed)

async def setup(bot):
    await bot.add_cog(DailyTasks(bot))
