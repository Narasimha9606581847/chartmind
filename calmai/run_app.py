import subprocess
import os
import time
import webbrowser
import threading

# Get the directory where this script is located
ROOT = os.path.dirname(os.path.abspath(__file__))

# Define backend and frontend directories (assuming this structure is correct)
BACKEND_DIR = os.path.join(ROOT, "backend")
FRONTEND_DIR = os.path.join(ROOT, "frontend")

# FIX: Replaced hardcoded, non-portable path with a generic command.
# This assumes 'python' is accessible and 'uvicorn' is installed in the active environment.
PYTHON_EXECUTABLE = "python"

def start_backend():
    print("🚀 Starting backend with Uvicorn...")
    try:
        subprocess.Popen(
            [
                PYTHON_EXECUTABLE,
                "-m",
                "uvicorn",
                "main:app", # Assumes 'main.py' is inside BACKEND_DIR
                "--reload",
                "--port",
                "8000"
            ],
            # Execute the command from the backend directory where 'main.py' is located
            cwd=BACKEND_DIR
        )
    except Exception as e:
        print("❌ Backend failed to start. Check if uvicorn is installed (pip install uvicorn).", e)

def start_frontend():
    print("🌐 Starting frontend on port 5500...")
    try:
        # Start a simple Python HTTP server for the frontend
        subprocess.Popen(
            [
                PYTHON_EXECUTABLE,
                "-m",
                "http.server",
                "5500"
            ],
            # Execute the command from the frontend directory
            cwd=FRONTEND_DIR
        )
    except Exception as e:
        print("❌ Frontend failed:", e)

def open_browser():
    time.sleep(3) # Wait slightly longer for both services to spin up
    url = "http://localhost:5500"
    print(f"🌍 Opening browser → {url}")
    webbrowser.open(url)

if __name__ == "__main__":
    # Start the backend process
    threading.Thread(target=start_backend).start()
    
    # Give the backend a moment to start
    time.sleep(1)
    
    # Start the frontend process
    threading.Thread(target=start_frontend).start()
    
    # Open the browser in a separate thread
    threading.Thread(target=open_browser).start()

    print("🔥 CalmAI is running with Gemini backend!")
    print("Press CTRL + C to stop this launcher script.")