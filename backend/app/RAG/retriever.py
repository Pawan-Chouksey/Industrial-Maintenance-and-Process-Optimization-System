from pathlib import Path
import pickle

import faiss

from embeddings import embed_query


PROJECT_ROOT = Path(__file__).resolve().parents[2]

VECTOR_STORE_PATH = PROJECT_ROOT / "data" / "RAG_vector_store"
INDEX_PATH = VECTOR_STORE_PATH / "vector.index"
METADATA_PATH = VECTOR_STORE_PATH / "metadata.pkl"


class RAGRetriever:

    def __init__(self):
        self.index = faiss.read_index(str(INDEX_PATH))

        with open(METADATA_PATH, "rb") as file:
            self.metadata = pickle.load(file)

    def search(self, query: str, top_k: int = 5) -> list[dict]:
        """Find the most relevant maintenance chunks."""

        if not query or not query.strip():
            return []

        query_embedding = embed_query(query)

        scores, indices = self.index.search(
            query_embedding.reshape(1, -1),
            top_k
        )

        results = []

        for score, index in zip(scores[0], indices[0]):

            if index < 0:
                continue

            result = self.metadata[index].copy()
            result["score"] = float(score)

            results.append(result)

        return results