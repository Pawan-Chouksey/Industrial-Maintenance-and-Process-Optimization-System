from pipeline import RAGPipeline


rag = RAGPipeline()


machine_context = {
    "engine_id": 5,
    "cycle": 269,
    "anomaly_status": "ANOMALY",
    "anomaly_score": 5.101747,
    "anomaly_threshold": 0.243426,
    "failure_probability": 0.9999,
    "failure_status": "FAILURE",
    "predicted_rul": 5.27,
    "health_score": 0.79,
    "health_status": "CRITICAL",
}


query = "Why is my engine showing an anomaly?"


response = rag.answer(
    query=query,
    machine_context=machine_context,
    top_k=5,
)


print("\n" + "=" * 80)
print("FINAL RAG ANSWER")
print("=" * 80)

print(response["answer"])


print("\n" + "=" * 80)
print("SOURCES")
print("=" * 80)

for i, source in enumerate(response["sources"], start=1):
    print(
        f"{i}. {source['source']} "
        f"(chunk {source['chunk_id']}, "
        f"score {source['score']:.4f})"
    )