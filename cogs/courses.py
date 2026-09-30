import discord
from discord.ext import commands
import config

class Courses(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.command(name="liveshare")
    async def live_share(self, ctx, title: str, link: str):
        """Share a live course or recorded course link to the courses channel."""
        if not config.COURSES_CHANNEL_ID:
            await ctx.send("Courses channel not configured.")
            return
            
        courses_channel = self.bot.get_channel(config.COURSES_CHANNEL_ID)
        if courses_channel:
            embed = discord.Embed(title="📚 New Course / Live Share", description=title, color=0x00ff00)
            embed.add_field(name="Link", value=link)
            embed.set_footer(text=f"Shared by {ctx.author.name}")
            await courses_channel.send(embed=embed)
            await ctx.send("Course shared successfully!")
        else:
            await ctx.send("Could not find the courses channel.")

async def setup(bot):
    await bot.add_cog(Courses(bot))
