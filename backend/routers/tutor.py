import os
import fitz
import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import google.generativeai as genai

from backend.database import get_db
from backend.models import Note, User, Topic, ChatSession, ChatMessage
from backend.schemas import ChatMessageResponse, ChatMessageCreate
from backend.auth import get_current_user
from backend.config import settings

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
    # 1. Verify Gemini API key configuration
    if not settings.GEMINI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Gemini API Key is not configured on the backend. Please add GEMINI_API_KEY to your backend/.env file."
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
    topic_list_str = ", ".join([f"'{t.title}'" for t in topics]) if topics else "None (General)"
    
    # 6. Fetch previous chat history context (last 8 messages for context)
    history_messages = db.query(ChatMessage).filter(
        ChatMessage.session_id == session.id
    ).order_by(ChatMessage.created_at.desc()).limit(8).all()
    
    # Reverse to chronological order
    history_messages.reverse()
    
    history_context = ""
    for msg in history_messages:
        role = "Student" if msg.sender == "user" else "Tutor"
        history_context += f"{role}: {msg.content}\n"
        
    # 7. Configure and Call Gemini
    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-2.0-flash")
        
        prompt = f"""
You are an expert AI study tutor designed to help students study from their notes.
Your task is to answer user questions using only the provided notes text.

Grounding rules:
1. Your answers MUST be generated ONLY from the provided notes text.
2. If the user asks about something not mentioned or cannot be inferred from the notes, reply: "I'm sorry, but I can only answer questions related to the content of the uploaded document. This concept is not covered in the notes."
3. Do not make up facts or use general knowledge not present in the notes.
4. Keep explanations clear, structured, and easy for students to understand.

Here is the notes text from the uploaded PDF:
---
{pdf_text[:250000]}
---

Available topics of this note package:
{topic_list_str}

Current conversation history:
{history_context}

User question: {payload.content}

Instructions:
1. Provide a detailed answer.
2. Select the most relevant topic from the available topics list. If the content spans multiple, select the main one. If none apply, select 'General Overview'.
3. Assign a confidence score between 0.0 and 1.0 indicating how confident you are in this answer being grounded in the text.

Output MUST be a JSON object matching this structure:
{{
  "answer": "Your detailed answer...",
  "source_topic": "Selected Topic Name",
  "confidence_score": 0.95
}}
"""
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        result = json.loads(response.text)
        answer = result.get("answer", "No answer generated.")
        source_topic = result.get("source_topic", "General Overview")
        confidence = float(result.get("confidence_score", 0.9))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gemini API generation failed: {str(e)}"
        )
        
    # 8. Save User Message
    db_user_msg = ChatMessage(
        session_id=session.id,
        sender="user",
        content=payload.content
    )
    db.add(db_user_msg)
    
    # 9. Save AI Message
    db_ai_msg = ChatMessage(
        session_id=session.id,
        sender="ai",
        content=answer,
        source_topic=source_topic,
        confidence_score=confidence
    )
    db.add(db_ai_msg)
    
    db.commit()
    db.refresh(db_ai_msg)
    
    return db_ai_msg
