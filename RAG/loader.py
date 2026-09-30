from pathlib import Path
from pypdf import PdfReader
# RAG document directory
RAG_DIR = Path(__file__).resolve().parent
DOCUMENTS_PATH = RAG_DIR / "data" / "RAG_documents"
def load_pdf(file_path: Path) -> str:
    """Extract text from a single PDF."""
    reader = PdfReader(file_path)
    pages = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text)
    return "\n".join(pages)
def load_all_documents() -> list[dict]:
    """Load all PDF documents from the RAG document directory."""
    documents = []
    for file_path in DOCUMENTS_PATH.glob("*.pdf"):
        text = load_pdf(file_path)
        if text.strip():
            documents.append({
                "source": file_path.name,
                "text": text,
            })
    return documents