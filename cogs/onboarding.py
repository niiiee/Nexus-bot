import discord
from discord.ext import commands
import config
from utils import db, ai_handler
import asyncio

class Onboarding(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.interviews = {} # user_id -> {'questions': [], 'experience': '', 'state': ''}

    @commands.Cog.listener()
    async def on_member_join(self, member):
        # 1. Welcome Message
        if config.WELCOME_CHANNEL_ID:
            welcome_channel = self.bot.get_channel(config.WELCOME_CHANNEL_ID)
            if welcome_channel:
                await welcome_channel.send(f"Welcome to the server, {member.mention}! Please check your DMs or private channel for the next steps.")
        
        # 2. Create private channel
        guild = member.guild
        overwrites = {
            guild.default_role: discord.PermissionOverwrite(read_messages=False),
            member: discord.PermissionOverwrite(read_messages=True, send_messages=True),
            guild.me: discord.PermissionOverwrite(read_messages=True, send_messages=True)
        }
        private_channel = await guild.create_text_channel(f"interview-{member.name}", overwrites=overwrites)
        
        await private_channel.send(f"Hello {member.mention}, I am the Senior AI. To verify your skills, please tell me your experience level in your field (e.g., '1 year', '3-4 years', 'Senior').")
        await db.set_user_status(member.id, "interviewing")
        self.interviews[member.id] = {'channel_id': private_channel.id, 'state': 'awaiting_experience', 'questions': []}

    @commands.Cog.listener()
    async def on_message(self, message):
        if message.author.bot:
            return
            
        user_id = message.author.id
        if user_id in self.interviews and message.channel.id == self.interviews[user_id]['channel_id']:
            state = self.interviews[user_id]['state']
            
            if state == 'awaiting_experience':
                exp_text = message.content.lower()
                self.interviews[user_id]['experience'] = exp_text
                await db.set_user_status(user_id, "interviewing", exp_text)
                
                # Check for 3-4 years claim
                if "3" in exp_text or "4" in exp_text or "senior" in exp_text:
                    await message.channel.send("Interesting. Let's test that experience. Generating a real-time scenario for you...")
                    question = await ai_handler.generate_interview_question(exp_text, [])
                    self.interviews[user_id]['questions'].append(question)
                    self.interviews[user_id]['state'] = 'awaiting_answer'
                    await message.channel.send(f"**Test Question:**\n{question}")
                else:
                    await message.channel.send("Thank you. Please share a snippet of your portfolio or past work for evaluation.")
                    self.interviews[user_id]['state'] = 'awaiting_portfolio'
                    
            elif state == 'awaiting_answer':
                answer = message.content
                exp_text = self.interviews[user_id]['experience']
                question = self.interviews[user_id]['questions'][-1]
                
                eval_result = await ai_handler.evaluate_answer(question, answer, exp_text)
                score = eval_result.get('score', 0)
                feedback = eval_result.get('feedback', '')
                
                if score < 50:
                    await message.channel.send(f"You failed the test. Score: {score}/100. Feedback: {feedback}\nHow do you respond to this assessment?")
                    self.interviews[user_id]['state'] = 'awaiting_reaction'
                    
                    # Alert CEO
                    if config.CEO_CHANNEL_ID:
                        ceo_channel = self.bot.get_channel(config.CEO_CHANNEL_ID)
                        if ceo_channel:
                            await ceo_channel.send(f"⚠️ **Suspicious User Alert** ⚠️\nUser {message.author.mention} claimed {exp_text} experience but scored {score}/100. Awaiting their reaction.")
                else:
                    await message.channel.send(f"Good job. You passed. Score: {score}/100.\nNow, please share a snippet or description of your best work (Portfolio) for role assignment.")
                    self.interviews[user_id]['state'] = 'awaiting_portfolio'
                    
            elif state == 'awaiting_reaction':
                reaction = message.content
                classification = await ai_handler.analyze_reaction(reaction)
                
                punishment_duration = "1 day"
                if "angry" in classification:
                    punishment_duration = "1 week"
                elif "objecting" in classification:
                    punishment_duration = "3 days"
                    
                await message.channel.send(f"Your reaction was classified as '{classification}'. You have been assigned the Larper role. Your access to free resources is restricted for {punishment_duration}.")
                
                # Assign role
                role = discord.utils.get(message.guild.roles, name=config.LARPER_ROLE_NAME)
                if role:
                    await message.author.add_roles(role)
                
                await db.set_user_status(user_id, "larper")
                del self.interviews[user_id]
                
            elif state == 'awaiting_portfolio':
                portfolio = message.content
                assigned_role = await ai_handler.evaluate_portfolio(portfolio)
                await message.channel.send(f"Evaluation complete. You have been assigned the role: **{assigned_role}**.")
                
                role = discord.utils.get(message.guild.roles, name=assigned_role)
                if role:
                    try:
                        await message.author.add_roles(role)
                    except Exception:
                        pass # Role might not exist
                
                member_role = discord.utils.get(message.guild.roles, name=config.MEMBER_ROLE_NAME)
                if member_role:
                    await message.author.add_roles(member_role)
                
                await db.set_user_status(user_id, "passed")
                del self.interviews[user_id]
                await asyncio.sleep(5)
                await message.channel.delete(reason="Interview complete")

async def setup(bot):
    await bot.add_cog(Onboarding(bot))
