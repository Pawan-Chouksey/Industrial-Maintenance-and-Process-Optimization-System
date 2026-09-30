import os
import unittest
from unittest.mock import Mock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from RAG.llm import GeminiConfigurationError, GeminiLLM, MODELS
from routes.rag import router

from RAG.pipeline import RAGPipeline


class RAGPipelineTests(unittest.TestCase):

    @patch("RAG.pipeline.GeminiLLM")
    @patch("RAG.pipeline.RAGRetriever")
    def test_answer_returns_generated_text_and_retrieved_sources(
        self,
        retriever_class,
        llm_class,
    ):
        sources = [{"source": "Bearing_Manual.pdf", "chunk_id": 4, "text": "Check lubrication."}]
        retriever_class.return_value.search.return_value = sources
        llm_class.return_value.generate.return_value = "Check the lubrication system."
        pipeline = RAGPipeline()

        result = pipeline.answer("  Bearing runs hot?  ", {"machine_type": "motor"}, top_k=2)

        self.assertEqual(result["query"], "Bearing runs hot?")
        self.assertEqual(result["answer"], "Check the lubrication system.")
        self.assertEqual(result["sources"], sources)
        retriever_class.return_value.search.assert_called_once_with(
            query="Bearing runs hot?",
            top_k=2,
        )

    @patch("RAG.pipeline.GeminiLLM")
    @patch("RAG.pipeline.RAGRetriever")
    def test_blank_query_skips_retrieval_and_generation(self, retriever_class, llm_class):
        pipeline = RAGPipeline()

        result = pipeline.answer("   ")

        self.assertEqual(result, {"query": "   ", "answer": "", "sources": []})
        retriever_class.return_value.search.assert_not_called()
        llm_class.return_value.generate.assert_not_called()


class RAGRouteTests(unittest.TestCase):

    def setUp(self):
        app = FastAPI()
        app.include_router(router)
        self.client = TestClient(app)

    @patch("routes.rag.get_pipeline")
    def test_chat_forwards_context_history_and_sources(self, get_pipeline):
        pipeline = Mock()
        pipeline.answer.return_value = {
            "query": "Why is it vibrating?",
            "answer": "Check bearing alignment.",
            "sources": [{"source": "SKF_Bearing_Maintenance_Handbook.pdf", "page": 12}],
        }
        get_pipeline.return_value = pipeline

        response = self.client.post(
            "/rag/chat",
            json={
                "query": " Why is it vibrating? ",
                "machine_context": {"machine_type": "motor"},
                "top_k": 3,
                "history": [{"role": "user", "content": "There is a high-pitched noise."}],
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["sources"], pipeline.answer.return_value["sources"])
        pipeline.answer.assert_called_once_with(
            query="Why is it vibrating?",
            machine_context={
                "machine_type": "motor",
                "recent conversation": "user: There is a high-pitched noise.",
            },
            top_k=3,
        )

    def test_chat_rejects_blank_query_and_unbounded_top_k(self):
        blank_query = self.client.post("/rag/chat", json={"query": "   "})
        excessive_top_k = self.client.post("/rag/chat", json={"query": "Inspect bearing", "top_k": 21})

        self.assertEqual(blank_query.status_code, 422)
        self.assertEqual(excessive_top_k.status_code, 422)


class GeminiLLMTests(unittest.TestCase):

    @patch("RAG.llm.genai.Client")
    def test_generation_uses_configured_client_without_network(self, client_class):
        client = client_class.return_value
        client.models.generate_content.return_value.text = "Inspect the bearing lubrication."

        with patch.dict(os.environ, {"GEMINI_API_KEY": "offline-test-key"}):
            llm = GeminiLLM()

        answer = llm.generate("What should I inspect?")

        self.assertEqual(answer, "Inspect the bearing lubrication.")
        client_class.assert_called_once_with(api_key="offline-test-key")
        client.models.generate_content.assert_called_once_with(
            model=MODELS[0],
            contents="What should I inspect?",
        )

    def test_missing_key_raises_configuration_error(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}):
            with self.assertRaises(GeminiConfigurationError):
                GeminiLLM()


if __name__ == "__main__":
    unittest.main()