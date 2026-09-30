from google import genai
from google.genai import types
import config

client = genai.Client(api_key=config.GEMINI_API_KEY)
MODEL_ID = 'gemini-2.5-flash'

async def generate_interview_question(experience_level: str, previous_questions: list) -> str:
    prompt = f"You are a Senior Programmer interviewing a candidate who claims to have {experience_level} of experience. "
    prompt += "Generate ONE highly specific, non-generic technical question to test their actual problem-solving skills, architecture knowledge, or coding ability. "
    prompt += "DO NOT ask standard questions like 'what is OOP' or 'how does event loop work'. Make it a scenario or a specific edge case. "
    if previous_questions:
        prompt += f"Do NOT ask anything similar to these previous questions: {previous_questions}. "
    prompt += "Just output the question text directly."
    
    response = client.models.generate_content(
        model=MODEL_ID,
        contents=prompt
    )
    return response.text.strip()

async def evaluate_answer(question: str, answer: str, experience_level: str) -> dict:
    prompt = f"Question asked: {question}\nCandidate answer: {answer}\nClaimed experience: {experience_level}\n"
    prompt += "Evaluate this answer. Does it reflect someone with that level of experience? "
    prompt += "Return a JSON object with two fields: 'score' (an integer from 0 to 100), and 'feedback' (a short string explaining why)."
    
    response = client.models.generate_content(
        model=MODEL_ID,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
        )
    )
    import json
    try:
        return json.loads(response.text)
    except:
        return {"score": 0, "feedback": "Failed to parse evaluation."}

async def analyze_reaction(reaction_text: str) -> str:
    prompt = f"A user failed a technical test and reacted with this message: '{reaction_text}'. "
    prompt += "Analyze their reaction. Classify it as one of the following: 'accepted' (they accepted it politely), 'angry' (they are swearing or very angry), 'objecting' (they are arguing but politely). "
    prompt += "Just return the classification word."
    
    response = client.models.generate_content(
        model=MODEL_ID,
        contents=prompt
    )
    return response.text.strip().lower()

async def evaluate_portfolio(portfolio_text: str) -> str:
    prompt = f"A user submitted the following work/portfolio snippet for evaluation: '{portfolio_text}'. "
    prompt += "Evaluate it quickly and determine a suitable role for them (e.g., Junior, Mid-Level, Senior, Designer). "
    prompt += "Just return the role name."
    
    response = client.models.generate_content(
        model=MODEL_ID,
        contents=prompt
    )
    return response.text.strip()

async def auto_reply(message_text: str) -> str:
    prompt = f"A user said: '{message_text}'. "
    prompt += "If it's a technical question, provide a direct, helpful technical answer. "
    prompt += "If it's a general question, chat, or sarcasm, reply with a witty, joking, or casual tone as a 'Senior Programmer' discord bot. "
    
    response = client.models.generate_content(
        model=MODEL_ID,
        contents=prompt
    )
    return response.text.strip()
