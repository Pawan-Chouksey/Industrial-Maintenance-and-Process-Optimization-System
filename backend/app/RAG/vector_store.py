from pathlib import Path
import pickle

import faiss
import numpy as np

from loader import load_all_documents
from cleaner import clean_text
from chunker import chunk_text
from embeddings import EmbeddingModel


# Paths
PROJECT_ROOT = Path(__file__).resolve().parents[2]

VECTOR_STORE_PATH = PROJECT_ROOT / "data" / "RAG_vector_store"
INDEX_PATH = VECTOR_STORE_PATH / "vector.index"
METADATA_PATH = VECTOR_STORE_PATH / "metadata.pkl"


def build_vector_store():
    """Build and save the FAISS vector store from RAG documents."""

    VECTOR_STORE_PATH.mkdir(parents=True, exist_ok=True)

    embedding_model = EmbeddingModel()

    all_chunks = []
    metadata = []

    documents = load_all_documents()

    print(f"Documents found: {len(documents)}")

    for document in documents:

        source = document["source"]

        cleaned_text = clean_text(document["text"])
        chunks = chunk_text(cleaned_text)

        print(f"{source}: {len(chunks)} chunks")

        for chunk_id, chunk in enumerate(chunks):

            all_chunks.append(chunk)

            metadata.append({
                "source": source,
                "chunk_id": chunk_id,
                "text": chunk,
            })

    if not all_chunks:
        raise ValueError("No document chunks were created.")

    print(f"\nTotal chunks: {len(all_chunks)}")
    print("Creating embeddings...")

    embeddings = embedding_model.embed_texts(all_chunks)

    embeddings = np.asarray(embeddings, dtype="float32")

    # Since embeddings are normalized, inner product gives cosine similarity.
    dimension = embeddings.shape[1]

    index = faiss.IndexFlatIP(dimension)
    index.add(embeddings)

    # Save FAISS index
    faiss.write_index(index, str(INDEX_PATH))

    # Save metadata
    with open(METADATA_PATH, "wb") as file:
        pickle.dump(metadata, file)

    print("\nVector store created successfully.")
    print(f"Vectors stored: {index.ntotal}")
    print(f"Embedding dimension: {dimension}")
    print(f"Index: {INDEX_PATH}")
    print(f"Metadata: {METADATA_PATH}")
    
if __name__ == "__main__":
    build_vector_store()