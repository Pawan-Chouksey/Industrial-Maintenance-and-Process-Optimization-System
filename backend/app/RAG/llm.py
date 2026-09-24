from google import genai
from google.genai import errors


MODELS = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
]


class GeminiLLM:

    def __init__(self):
        self.client = genai.Client()

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