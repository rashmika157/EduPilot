import os
import fitz
import json
from typing import List
import re
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.services.openrouter_service import call_openrouter, parse_json_content

from backend.database import get_db
from backend.models import Note, User, Topic, ChatSession, ChatMessage
from backend.schemas import ChatMessageResponse, ChatMessageCreate
from backend.auth import get_current_user
from backend.config import settings


def normalize_text(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def get_page_heading(page_text: str) -> str:
    for line in page_text.splitlines():
        line = line.strip()
        if line and len(line) <= 120:
            return line
    return "General Section"


def build_pdf_chunks(file_path: str, max_pages: int = 50):
    chunks = []
    try:
        doc = fitz.open(file_path)
    except Exception:
        return chunks

    toc = doc.get_toc()
    toc_map = {item[2]: item[1].strip() for item in toc if len(item) >= 3}

    for page_idx in range(min(len(doc), max_pages)):
        page_text = doc[page_idx].get_text("text")
        if not page_text.strip():
            continue

        page_number = page_idx + 1
        section_title = toc_map.get(page_number) or get_page_heading(page_text)
        chunks.append({
            "page": page_number,
            "section": section_title,
            "content": page_text.strip(),
            "snippet": page_text.strip()[:2000]
        })

    doc.close()
    return chunks


def rank_chunks(query: str, chunks: list, top_n: int = 3):
    if not chunks:
        return []

    query_tokens = set(normalize_text(query).split())
    scored = []
    for chunk in chunks:
        chunk_tokens = set(normalize_text(chunk["content"]).split())
        score = len(query_tokens.intersection(chunk_tokens))
        scored.append((score, chunk))

    scored.sort(key=lambda x: x[0], reverse=True)
    selected = [chunk for score, chunk in scored if score > 0]
    if len(selected) < top_n:
        selected = [chunk for _, chunk in scored[:top_n]]
    return selected[:top_n]

router = APIRouter(prefix="/api/tutor", tags=["tutor"])

@router.get("/{note_id}/history", response_model=List[ChatMessageResponse])
def get_chat_history(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify note belongs to user
    note = db.query(Note).filter(Note.id == note_id, Note.owner_id == current_user.id).first()
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
        
    # Get or create session
    session = db.query(ChatSession).filter(
        ChatSession.user_id == current_user.id,
        ChatSession.note_id == note_id
    ).first()
    
    if not session:
        return []
        
    return session.messages


@router.post("/{note_id}/ask", response_model=ChatMessageResponse)
def ask_tutor_question(
    note_id: int,
    payload: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Verify OpenRouter API key configuration
    if not settings.OPENROUTER_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OpenRouter API Key is not configured on the backend. Please add OPENROUTER_API_KEY to your backend/.env file."
        )
        
    # 2. Verify note belongs to user
    note = db.query(Note).filter(Note.id == note_id, Note.owner_id == current_user.id).first()
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
        
    # 3. Get or create session
    session = db.query(ChatSession).filter(
        ChatSession.user_id == current_user.id,
        ChatSession.note_id == note_id
    ).first()
    
    if not session:
        session = ChatSession(user_id=current_user.id, note_id=note_id)
        db.add(session)
        db.commit()
        db.refresh(session)
        
    # 4. Extract PDF text content
    file_path = os.path.join(settings.UPLOAD_DIR, note.file_path)
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF file not found on local disk storage"
        )
        
    try:
        doc = fitz.open(file_path)
        text_content = []
        # Limit to first 100 pages to avoid overwhelming context length
        for page_idx in range(min(100, len(doc))):
            text_content.append(doc[page_idx].get_text("text"))
        doc.close()
        pdf_text = "\n".join(text_content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extract text from PDF: {str(e)}"
        )
        
    # 5. Fetch available topics for grounding metadata
    topics = db.query(Topic).filter(Topic.note_id == note_id).all()
    hierarchy_paths = []
    for t in topics:
        for sub in t.subtopics:
            if sub.children:
                for child in sub.children:
                    hierarchy_paths.append(f"{t.title} → {sub.title} → {child.title}")
            else:
                hierarchy_paths.append(f"{t.title} → {sub.title}")
        if not t.subtopics:
            hierarchy_paths.append(t.title)
            
    topic_list_str = "\n".join([f"- {path}" for path in hierarchy_paths]) if hierarchy_paths else "None (General)"

    # 6. Build and rank PDF chunks for source references
    chunks = build_pdf_chunks(file_path, max_pages=50)
    top_chunks = rank_chunks(payload.content, chunks, top_n=3)
    if not top_chunks and chunks:
        top_chunks = [chunks[0]]

    source_reference_payload = []
    source_snippet_sections = []
    for chunk in top_chunks:
        snippet = chunk.get("snippet") or chunk.get("content", "")[:2000]
        section = chunk.get("section") or f"Page {chunk.get('page', '?')}"
        source_reference_payload.append({
            "section": section,
            "page": chunk.get("page"),
            "snippet": snippet
        })
        source_snippet_sections.append(
            f"Section: {section}\nPage: {chunk.get('page')}\nSnippet:\n{snippet}\n---"
        )

    source_context = "\n\n".join(source_snippet_sections) if source_snippet_sections else "No source snippets available."

    # 7. Fetch previous chat history context (last 8 messages for context)
    history_messages = db.query(ChatMessage).filter(
        ChatMessage.session_id == session.id
    ).order_by(ChatMessage.created_at.desc()).limit(8).all()
    
    # Reverse to chronological order
    history_messages.reverse()
    
    # Format a list of topic names for selection
    flat_topic_names = ", ".join([f"'{t.title}'" for t in topics]) if topics else "None (General)"
    
    history_context = ""
    for msg in history_messages:
        role = "Student" if msg.sender == "user" else "Tutor"
        history_context += f"{role}: {msg.content}\n"
        
    # 8. Configure and Call OpenRouter
    try:
        prompt = f"""
You are a friendly, encouraging AI study tutor designed to help students learn and review their notes.
Your task is to answer user questions using only the provided notes text. Behave like a supportive study companion/tutor rather than a dry search engine.

Grounding rules:
1. Your answers MUST be generated ONLY from the provided notes text.
2. If the user asks about something not mentioned or cannot be inferred from the notes, reply: "I'm sorry, but I can only answer questions related to the content of the uploaded document. This concept is not covered in the notes."
3. Do not make up facts or use general knowledge not present in the notes.
4. When you cite evidence, use the provided note sections and page numbers, not slide or page citations.

Tutor Guidelines:
1. **Friendly & Relatable Tone**: Act like a supportive peer or mentor. Use engaging, educational encouragement.
2. **Handling Confusion**: If the student says "I didn't understand" (or indicates difficulty/confusion), break down the concept again in much simpler language and explain it using a relatable **real-world analogy**.
3. **Conversational Context**: Carefully read the previous chat history to handle follow-up questions fluidly. If a question is a follow-up, answer in relation to the previous discussion.

Response Formatting & Quality Guidelines:
1. **Concise & Student-Friendly**: Keep explanations direct, clean, and easy for students to study.
2. **Structure**: Format your answers with clear markdown headings, bullet points, and practical examples where appropriate.
3. **No Slide/Page Citations**: NEVER output references like "Source: Slide X" or "(Page Y)".
4. **Hierarchical Citations**: Cite where the concept comes from using the exact topic hierarchy path(s) provided below (e.g. `Disk Scheduling → FCFS`).
5. **Multi-Section Coverage**: If the concept or topic is discussed in multiple sections of the notes, list all relevant topic paths.
6. **Key Terms**: Highlight important keywords and concepts in **bold**.
7. **Exam Tip**: When applicable, add a brief section at the end titled "🎓 **Exam Tip:**" pointing out common pitfalls, important exam highlights, or typical questions on this concept.
8. **Source References**: Return a `source_references` array where each object contains `section`, `page`, and a short `snippet` that directly supports the answer.

PDF sections selected for this question:
{source_context}

Available topic hierarchy paths:
{topic_list_str}

Current conversation history:
{history_context}

User question: {payload.content}

Instructions:
1. Provide a concise, well-formatted answer following the guidelines above.
2. Select the most relevant main topic from the list of available main topics: [{flat_topic_names}] to populate the "source_topic" field. If none apply, select 'General Overview'.
3. Assign a confidence score between 0.0 and 1.0 indicating how confident you are in this answer being grounded in the text.
4. Output must be valid JSON and must include `answer`, `source_topic`, `confidence_score`, and `source_references`.

Output MUST be a JSON object matching this structure:
{{
  "answer": "Your formatted answer...",
  "source_topic": "Selected Main Topic Name",
  "confidence_score": 0.95,
  "source_references": [
    {{"section": "...", "page": 3, "snippet": "..."}}
  ]
}}
"""
        response_text = call_openrouter(prompt, json_mode=True)
        result = parse_json_content(response_text)
        answer = result.get("answer", "No answer generated.")
        source_topic = result.get("source_topic", "General Overview")
        confidence = float(result.get("confidence_score", 0.9))
        source_references = result.get("source_references")
        if not isinstance(source_references, list):
            source_references = source_reference_payload
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OpenRouter API generation failed: {str(e)}"
        )
        
    # 9. Save User Message
    db_user_msg = ChatMessage(
        session_id=session.id,
        sender="user",
        content=payload.content
    )
    db.add(db_user_msg)
    
    # 10. Save AI Message
    db_ai_msg = ChatMessage(
        session_id=session.id,
        sender="ai",
        content=answer,
        source_topic=source_topic,
        confidence_score=confidence,
        source_references=source_references
    )
    db.add(db_ai_msg)
    
    db.commit()
    db.refresh(db_ai_msg)
    
    return db_ai_msg
