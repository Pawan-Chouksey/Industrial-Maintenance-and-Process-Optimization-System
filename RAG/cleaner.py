import re
def clean_text(text: str) -> str:
    """Clean extracted PDF text while preserving useful content."""
    if not text:
        return ""
    # Normalize line endings
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    # Remove excessive spaces
    text = re.sub(r"[ \t]+", " ", text)
    # Remove excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Remove spaces before/after line breaks
    text = re.sub(r" *\n *", "\n", text)
    return text.strip()