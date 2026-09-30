from functools import lru_cache

from sentence_transformers import SentenceTransformer


MODEL_NAME = "all-MiniLM-L6-v2"


@lru_cache(maxsize=1)
def get_embedding_model():
    """Load the embedding model only once."""
    return SentenceTransformer(MODEL_NAME)


def embed_texts(texts: list[str]):
    """Create embeddings for multiple texts."""
    model = get_embedding_model()

    return model.encode(
        texts,
        convert_to_numpy=True,
        normalize_embeddings=True,
        show_progress_bar=True,
    )


def embed_query(query: str):
    """Create an embedding for one user query."""
    model = get_embedding_model()

    return model.encode(
        query,
        convert_to_numpy=True,
        normalize_embeddings=True,
    )