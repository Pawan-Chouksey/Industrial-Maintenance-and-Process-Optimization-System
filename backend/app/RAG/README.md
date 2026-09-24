# RAG Maintenance Assistant

This module provides a Retrieval-Augmented Generation (RAG) pipeline
for the Industrial Maintenance and Process Optimization System.

## What it does

The RAG system:

1. Loads maintenance PDF documents.
2. Cleans and chunks the document text.
3. Creates embeddings using Sentence Transformers.
4. Stores embeddings in FAISS.
5. Retrieves relevant maintenance information for a user question.
6. Combines the retrieved knowledge with machine/ML results.
7. Uses Google Gemini to generate a concise maintenance response.

## Architecture

User Question
    ↓
FAISS Semantic Search
    ↓
Relevant Maintenance Documents
    ↓
Machine/ML Context + Retrieved Knowledge
    ↓
Gemini LLM
    ↓
Maintenance Response + Sources

## RAG Documents

The current knowledge base contains maintenance documentation for:

- ABB motors
- SKF bearings
- Fluke vibration fault detection
- Siemens motor controllers

## Technologies

- Python
- PyPDF
- Sentence Transformers
- all-MiniLM-L6-v2
- FAISS
- Google Gemini
- NumPy

## Required Packages

```text
pypdf==6.19.0
sentence-transformers==6.1.0
faiss-cpu==1.15.1
google-genai==2.24.0