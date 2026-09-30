import logging
from threading import Lock
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from RAG.llm import GeminiConfigurationError
from RAG.pipeline import RAGPipeline
from RAG.retriever import RAGStoreError

router = APIRouter(
    prefix="/rag",
    tags=["RAG"],
)

logger = logging.getLogger(__name__)
pipeline = None
pipeline_lock = Lock()


class RAGRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=4000)
    machine_context: dict = Field(default_factory=dict)
    top_k: int = Field(default=5, ge=1, le=20)
    history: list["ChatTurn"] = Field(default_factory=list, max_length=8)

    @field_validator("query")
    @classmethod
    def strip_query(cls, query: str) -> str:
        query = query.strip()
        if not query:
            raise ValueError("Query must not be blank.")
        return query


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=2000)


def get_pipeline() -> RAGPipeline:
    global pipeline
    if pipeline is None:
        with pipeline_lock:
            if pipeline is None:
                try:
                    pipeline = RAGPipeline()
                except (GeminiConfigurationError, RAGStoreError) as error:
                    raise HTTPException(status_code=503, detail=str(error)) from error
    return pipeline

def get_quick_reply(query: str) -> str | None:
    """Respond instantly to simple greetings and conversational messages."""
    message = query.strip().lower()
    message = message.strip("!.,? ")

    greetings = {
        "hi", "hello", "hey", "hii", "hiii",
        "good morning", "good afternoon", "good evening",
    }

    if message in greetings:
        return (
            "Hi! 👋 How can I help you today? "
            "You can ask me about machine faults, maintenance, "
            "troubleshooting, or predictive maintenance."
        )

    if message in {"thanks", "thank you", "thankyou", "thx"}:
        return "You're welcome! 😊 Let me know if you need help with anything else."

    if message in {"bye", "goodbye", "see you"}:
        return "Goodbye! 👋 Feel free to come back whenever you need maintenance help."

    return None
@router.post("/chat")
def rag_chat(request: RAGRequest):
    try:
        quick_reply = get_quick_reply(request.query)
        if quick_reply:
            return {
                "query": request.query,
                "answer": quick_reply,
                "sources": [],
            }
        machine_context = request.machine_context.copy()
        if request.history:
            machine_context["recent conversation"] = "\n".join(
                f"{turn.role}: {turn.content}" for turn in request.history
            )
        result = get_pipeline().answer(
            query=request.query,
            machine_context=machine_context,
            top_k=request.top_k,
        )
        return result

    except HTTPException:
        raise
    except Exception as error:
        logger.exception("RAG request failed")
        raise HTTPException(
            status_code=503,
            detail="The AI Maintenance Assistant is unavailable. Check the Gemini configuration and RAG vector store.",
        ) from error