def build_maintenance_prompt(
    query: str,
    machine_context: dict,
    retrieved_results: list[dict],
) -> str:
    """
    Build a concise, user-friendly maintenance chatbot prompt.
    """

    machine_info = "\n".join(
        f"- {key}: {value}"
        for key, value in machine_context.items()
    )

    knowledge = []

    for i, result in enumerate(retrieved_results, start=1):
        knowledge.append(
            f"""
Source {i}: {result["source"]}
Chunk: {result["chunk_id"]}

{result["text"]}
"""
        )

    retrieved_context = "\n".join(knowledge)

    prompt = f"""
You are an AI Maintenance Assistant for an industrial machine monitoring system.

Answer the user's question like a helpful chatbot.

Use:
1. The machine/ML results.
2. The retrieved maintenance documentation.

IMPORTANT:
- Keep the answer SHORT, CLEAR, and EASY TO UNDERSTAND.
- Usually answer in 1-3 short sentences or 2-4 concise bullet points.
- Do not write long reports unless the user asks for details.
- Do not invent faults or component failures.
- ML results indicate machine condition/risk; they do not automatically
  prove a physical component failure.
- Give practical maintenance checks only when supported by the documentation.
- If the cause is not confirmed, say that clearly.
- Do not give false certainty.
- Do not tell the user to shut down the machine unless the provided
  information supports that recommendation.
- Do not mention "Knowledge 1", "Knowledge 2", etc. to the user.
- Do not expose internal similarity scores or technical RAG details.
- Do not mention PDF filenames or internal source names in the main answer.
- The application will display sources separately.

MACHINE CONDITION:
{machine_info}

USER QUESTION:
{query}

RETRIEVED MAINTENANCE DOCUMENTATION:
{retrieved_context}

RESPONSE STYLE:

For a normal question:
Give a direct, conversational answer.

For a question about a problem:
1. Briefly explain what the ML results indicate.
2. Give 2-4 relevant checks.

For a "why" question:
Explain the likely possibilities supported by the documentation,
but clearly state when the exact cause is not confirmed.

For "explain in detail":
Provide a more detailed explanation.

End with a short source reference when appropriate.
"""

    return prompt.strip()