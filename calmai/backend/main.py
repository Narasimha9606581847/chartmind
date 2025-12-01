import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from dotenv import load_dotenv
import google.generativeai as genai

# Load .env
load_dotenv()

GEMINI_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_KEY:
    raise RuntimeError("🔥 GEMINI_API_KEY missing. Add it in .env")

# Configure Gemini
genai.configure(api_key=GEMINI_KEY)

# Define the correct, stable model name for use throughout the app (Fix 1)
CHAT_MODEL_NAME = "gemini-2.5-flash"

# Create app
app = FastAPI()

# Allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# SYSTEM PROMPT (ChartMind AI - Academic Assistant)
# -----------------------------
SYSTEM_PROMPT = """
You are ChartMind AI — an expert academic tutor and comprehensive study assistant.
Your primary mission is to help students excel by solving all academic problems, clarifying doubts, and providing in-depth learning support.

Your Core Responsibilities:
1. **Solve All Academic Problems**: Answer homework, assignments, exams, and conceptual questions across all subjects with complete solutions.
2. **Clarify All Doubts**: Identify confusion and explain concepts from multiple angles until the student fully understands.
3. **Step-by-Step Solutions**: Break down complex problems into clear, manageable steps with detailed explanations.
4. **Adapt to Learning Level**: Adjust explanations based on grade level (elementary, high school, college, professional).
5. **Multiple Explanations**: If something isn't clear, provide alternative explanations and analogies.
6. **Problem-Solving Frameworks**: Teach problem-solving techniques and strategies for different types of questions.
7. **Verification & Checking**: Double-check answers and explain why solutions are correct.

What You Cover:
- Mathematics (Algebra, Geometry, Calculus, Statistics, etc.)
- Science (Physics, Chemistry, Biology, Environmental Science)
- Languages (Grammar, Literature, Essays, Comprehension)
- History & Social Studies
- Computer Science & Programming
- Economics & Business
- Arts & Humanities
- Test Preparation (SAT, ACT, GMAT, IIT-JEE, Board Exams, etc.)

Your Rules:
1. Always provide COMPLETE and ACCURATE solutions to all academic queries.
2. Use clear formatting: headings, bullet points, numbered lists, and code blocks where needed.
3. For essays/reports: Follow ALL constraints (word count, format, structure, citation style).
4. For ambiguous questions: Ask brief clarifying questions to provide the MOST accurate answer.
5. For problem-solving: Show ALL work and reasoning, not just final answers.
6. For new concepts: Start with fundamentals, then build to advanced understanding.
7. Maintain a patient, professional, and encouraging tone that motivates learning.
8. If you make an error, correct it immediately and explain the mistake.

When Students Ask For:
- **Homework Help**: Solve completely with explanations
- **Concept Clarification**: Explain thoroughly with examples and real-world applications
- **Exam Preparation**: Provide practice problems, key concepts, and test-taking strategies
- **Essay/Projects**: Guide structure, outline, content, and formatting
- **Code/Programming**: Provide working code with line-by-line explanations
- **Research Help**: Suggest reliable sources and how to structure research

Your Focus: ACADEMICS ONLY - Solving problems, clarifying doubts, and helping students learn and succeed.
"""

# -----------------------------
# /chat — Gemini Chat API
# -----------------------------
@app.post("/chat")
async def chat(request: Request):
    data = await request.json()
    user_message = data.get("message", "").strip()

    if not user_message:
        return JSONResponse({"reply": "I didn't receive anything to respond to."})

    # Build conversation input
    full_prompt = f"{SYSTEM_PROMPT}\nUser: {user_message}\nAssistant:"

    try:
        # FIX 2: Corrected model instantiation (using genai.GenerativeModel)
        # and using the new model name to resolve the 404 error.
        model = genai.GenerativeModel(CHAT_MODEL_NAME)
        
        response = model.generate_content(full_prompt)
        reply_text = response.text
    except Exception as e:
        # This will now show the correct error if the API key is wrong or if there's a different issue
        return JSONResponse({"reply": f"Error generating reply: {e}"})

    return JSONResponse({"reply": reply_text})

# -----------------------------
# /tts — Gemini Text → Speech (MP3)
# -----------------------------
@app.post("/tts")
async def tts(request: Request):
    data = await request.json()
    text = data.get("text", "")

    if not text:
        return JSONResponse({"error": "No text provided"}, status_code=400)

    # NOTE: The Google Generative API's `generate_content` method does not
    # currently support returning audio/mp3 via `response_mime_type` for the
    # LLM endpoints in this client. Many deployments use a separate TTS
    # endpoint/service for audio generation.
    #
    # For reliability and to support client-side speech synthesis, return the
    # plain text here. The frontend will use the browser's Web Speech API to
    # speak the reply when available.
    return JSONResponse({"text": text})

# -----------------------------
# Root endpoint
# -----------------------------
@app.get("/")
def root():
    return {"status": "Gemini CalmAI Backend Running"}