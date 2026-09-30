from pathlib import Path
import pickle

import faiss

from .embeddings import embed_query


RAG_DIR = Path(__file__).resolve().parent

VECTOR_STORE_PATH = RAG_DIR / "data" / "RAG_vector_store"
INDEX_PATH = VECTOR_STORE_PATH / "vector.index"
META_PATH = VECTOR_STORE_PATH / "metadata.pkl"


class RAGStoreError(RuntimeError):
    pass


class RAGRetriever:

    def __init__(self):
        missing_files = [path.name for path in (INDEX_PATH, META_PATH) if not path.is_file()]
        if missing_files:
            names = ", ".join(missing_files)
            raise RAGStoreError(
                f"RAG vector store is incomplete: missing {names} in {VECTOR_STORE_PATH}."
            )

        try:
            self.index = faiss.read_index(str(INDEX_PATH))
            with open(META_PATH, "rb") as file:
                self.metadata = pickle.load(file)
        except Exception as error:
            raise RAGStoreError("RAG vector store files could not be loaded.") from error

        if not isinstance(self.metadata, list) or self.index.ntotal != len(self.metadata):
            raise RAGStoreError(
                "RAG vector index and metadata do not contain matching entries. Rebuild the vector store."
            )
        if self.index.ntotal == 0:
            raise RAGStoreError("RAG vector store is empty. Add maintenance PDFs and rebuild it.")

    def search(self, query: str, top_k: int = 5) -> list[dict]:
        """Find the most relevant maintenance chunks."""

        if not query or not query.strip():
            return []

        query_embedding = embed_query(query)
        if query_embedding.shape[-1] != self.index.d:
            raise RAGStoreError(
                "Query embedding dimensions do not match the RAG vector index. Rebuild the vector store."
            )

        scores, indices = self.index.search(
            query_embedding.reshape(1, -1),
            min(top_k, self.index.ntotal),
        )

        results = []

        for score, index in zip(scores[0], indices[0]):

            if index < 0:
                continue

            result = self.metadata[index].copy()
            result["score"] = float(score)

            results.append(result)

        return results