from retriever import RAGRetriever
from prompt import build_maintenance_prompt
from llm import GeminiLLM


class RAGPipeline:

    def __init__(self):
        self.retriever = RAGRetriever()
        self.llm = GeminiLLM()

    def answer(
        self,
        query: str,
        machine_context: dict | None = None,
        top_k: int = 5,
    ) -> dict:
        """
        Complete RAG pipeline:
        retrieve → build prompt → generate answer
        """

        if not query or not query.strip():
            return {
                "query": query,
                "answer": "",
                "sources": [],
            }

        machine_context = machine_context or {}

        # Retrieve relevant maintenance knowledge
        results = self.retriever.search(
            query=query.strip(),
            top_k=top_k,
        )

        # Build LLM prompt
        prompt = build_maintenance_prompt(
            query=query.strip(),
            machine_context=machine_context,
            retrieved_results=results,
        )

        # Generate final answer
        answer = self.llm.generate(prompt)

        return {
            "query": query.strip(),
            "answer": answer,
            "sources": results,
        }