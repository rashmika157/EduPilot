import os
import fitz
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from backend.database import get_db
from backend.models import Note, User, QuizAttempt
from backend.auth import get_current_user
from backend.config import settings
from backend.services.quiz_service import generate_mcq_quiz

router = APIRouter(prefix="/api/quiz", tags=["quiz"])

class QuizGenerateRequest(BaseModel):
    note_id: int
    topic_title: str

class QuizAttemptRequest(BaseModel):
    note_id: int
    topic_title: str
    score: int
    total_questions: int = 10

@router.post("/generate")
def generate_quiz_for_topic(
    payload: QuizGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Verify note belongs to user
    note = db.query(Note).filter(Note.id == payload.note_id, Note.owner_id == current_user.id).first()
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
        
    # 2. Extract PDF text content
    file_path = os.path.join(settings.UPLOAD_DIR, note.file_path)
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF file not found on local disk storage"
        )
        
    try:
        doc = fitz.open(file_path)
        matching_pages = []
        topic_lower = payload.topic_title.lower()
        
        # 1. Search for pages containing the topic title
        for page_idx in range(len(doc)):
            page_text = doc[page_idx].get_text("text")
            if topic_lower in page_text.lower():
                matching_pages.append(page_idx)
                
        # 2. Extract text from matching pages (with a small context window)
        pages_to_extract = set()
        for p in matching_pages:
            # Extract current page, previous page, and next page
            for offset in [-1, 0, 1]:
                target_page = p + offset
                if 0 <= target_page < len(doc):
                    pages_to_extract.add(target_page)
                    
        # 3. If no matching pages found, default to first 30 pages
        if not pages_to_extract:
            pages_to_extract = set(range(min(30, len(doc))))
            
        text_content = []
        for page_idx in sorted(list(pages_to_extract)):
            text_content.append(f"--- Page {page_idx + 1} ---\n" + doc[page_idx].get_text("text"))
        doc.close()
        pdf_text = "\n".join(text_content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extract text from PDF for quiz generation: {str(e)}"
        )

    # 3. Generate 10 MCQs
    questions = generate_mcq_quiz(pdf_text, payload.topic_title)
    return questions


@router.post("/attempt")
def save_quiz_attempt(
    payload: QuizAttemptRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify note belongs to user
    note = db.query(Note).filter(Note.id == payload.note_id, Note.owner_id == current_user.id).first()
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    attempt = QuizAttempt(
        user_id=current_user.id,
        note_id=payload.note_id,
        topic_title=payload.topic_title,
        score=payload.score,
        total_questions=payload.total_questions
    )
    
    db.add(attempt)
    try:
        db.commit()
        db.refresh(attempt)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to persist quiz attempt to database: {str(e)}"
        )

    return {"status": "success", "attempt_id": attempt.id}


@router.get("/history")
def get_quiz_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    attempts = db.query(QuizAttempt).filter(
        QuizAttempt.user_id == current_user.id
    ).order_by(QuizAttempt.created_at.desc()).all()

    response = []
    for a in attempts:
        # Load associated note details
        note = db.query(Note).filter(Note.id == a.note_id).first()
        response.append({
            "id": a.id,
            "topic_title": a.topic_title,
            "score": a.score,
            "total_questions": a.total_questions,
            "created_at": a.created_at.isoformat(),
            "note_title": note.title if note else "Deleted Note",
            "subject": note.subject if note else "Unknown"
        })

    return response
