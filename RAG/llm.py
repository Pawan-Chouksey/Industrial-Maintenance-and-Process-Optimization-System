import os

from google import genai
from google.genai import errors
from dotenv import load_dotenv


MODELS = [
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-3.7-flash",
]


class GeminiConfigurationError(RuntimeError):
    pass


class GeminiLLM:

    def __init__(self):
        load_dotenv()
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise GeminiConfigurationError(
                "Gemini is not configured. Set GEMINI_API_KEY in the project .env file."
            )
        self.client = genai.Client(api_key=api_key)

    def generate(self, prompt: str) -> str:
        """Generate a response with automatic model fallback."""

        if not prompt or not prompt.strip():
            raise ValueError("Prompt cannot be empty.")

        last_error = None

        for model in MODELS:

            try:
                print(f"Trying model: {model}")

                response = self.client.models.generate_content(
                    model=model,
                    contents=prompt,
                )

                if response.text:
                    print(f"Successful model: {model}")
                    return response.text.strip()

            except errors.ServerError as error:

                print(f"{model} unavailable: {error}")
                last_error = error
                continue

        raise RuntimeError(
            "All configured Gemini models are currently unavailable."
        ) from last_error