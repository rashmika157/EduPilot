import os
import uuid
import shutil
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.database import get_db, SessionLocal
from backend.models import Note, User, Topic, Subtopic
from backend.schemas import NoteResponse, NoteWithTopicsResponse
from backend.auth import get_current_user
from backend.config import settings
from backend.services.topic_extractor import extract_topics_from_pdf

router = APIRouter(prefix="/api/notes", tags=["notes"])

def process_note_topics(note_id: int):
    db = SessionLocal()
    try:
        note = db.query(Note).filter(Note.id == note_id).first()
        if not note:
            return
        
        note.topic_extraction_status = "processing"
        db.commit()
        
        file_path = os.path.join(settings.UPLOAD_DIR, note.file_path)
        extracted_data = extract_topics_from_pdf(file_path)
        
        # Clear existing topics for clean slate (in case of re-run)
        db.query(Topic).filter(Topic.note_id == note_id).delete()
        db.commit()
        
        note.extraction_confidence = extracted_data["confidence_score"]
        
        for item in extracted_data["topics"]:
            db_topic = Topic(note_id=note_id, title=item["title"])
            db.add(db_topic)
            db.commit() # commit to generate topic.id
            
            for sub_item in item["subtopics"]:
                db_sub = Subtopic(topic_id=db_topic.id, title=sub_item["title"], parent_id=None)
                db.add(db_sub)
                db.commit() # commit to generate sub.id
                
                for child_item in sub_item.get("children", []):
                    db_child = Subtopic(topic_id=db_topic.id, title=child_item["title"], parent_id=db_sub.id)
                    db.add(db_child)
                    db.commit()
        
        note.topic_extraction_status = "completed"
        db.commit()
    except Exception as e:
        print(f"Error processing topics for note {note_id}: {e}")
        try:
            note = db.query(Note).filter(Note.id == note_id).first()
            if note:
                note.topic_extraction_status = "failed"
                db.commit()
        except Exception:
            pass
    finally:
        db.close()

@router.post("/upload", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
def upload_note(
    title: str = Form(...),
    subject: str = Form(...),
    description: Optional[str] = Form(None),
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Validate PDF content type
    if not file.filename.lower().endswith(".pdf") and file.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are supported!"
        )
        
    # Create safe unique filename
    unique_filename = f"{uuid.uuid4().hex}_{file.filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)
    
    # Save the file to disk
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to write file to local disk: {str(e)}"
        )
        
    # Get actual written file size
    file_size = os.path.getsize(file_path)
    
    # Create DB entry
    new_note = Note(
        title=title,
        subject=subject,
        description=description,
        file_path=unique_filename, # Store just the relative unique file name
        file_size=file_size,
        owner_id=current_user.id,
        topic_extraction_status="pending"
    )
    
    db.add(new_note)
    db.commit()
    db.refresh(new_note)
    
    if background_tasks:
        background_tasks.add_task(process_note_topics, new_note.id)
    
    return new_note

@router.get("", response_model=List[NoteResponse])
def get_user_notes(
    search: Optional[str] = None,
    subject: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Note).filter(Note.owner_id == current_user.id)
    
    if search:
        query = query.filter(Note.title.ilike(f"%{search}%"))
        
    if subject and subject != "All":
        query = query.filter(Note.subject == subject)
        
    return query.order_by(Note.created_at.desc()).all()

@router.get("/with-topics", response_model=List[NoteWithTopicsResponse])
def get_user_notes_with_topics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(Note).filter(Note.owner_id == current_user.id).order_by(Note.created_at.desc()).all()


@router.get("/{note_id}", response_model=NoteResponse)
def get_note_details(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    note = db.query(Note).filter(Note.id == note_id, Note.owner_id == current_user.id).first()
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )
    return note

@router.get("/{note_id}/file")
def get_note_file(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    note = db.query(Note).filter(Note.id == note_id, Note.owner_id == current_user.id).first()
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )
        
    file_path = os.path.join(settings.UPLOAD_DIR, note.file_path)
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF file not found on local disk storage"
        )
        
    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=os.path.basename(note.file_path)
    )

@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    note = db.query(Note).filter(Note.id == note_id, Note.owner_id == current_user.id).first()
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )
        
    # Delete DB entry
    db.delete(note)
    db.commit()
    
    # Try deleting the physical file
    file_path = os.path.join(settings.UPLOAD_DIR, note.file_path)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            # Log the error but don't fail the request since DB entry is gone
            print(f"Failed to delete file {file_path}: {e}")
            
    return None



@router.get("/{note_id}/topics", response_model=NoteWithTopicsResponse)
def get_note_topics(
    note_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    note = db.query(Note).filter(Note.id == note_id, Note.owner_id == current_user.id).first()
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )
        
    # Self-healing: if stuck in pending (e.g. uploaded before extractor was implemented or server restarted), run it
    if note.topic_extraction_status == "pending":
        note.topic_extraction_status = "processing"
        db.commit()
        background_tasks.add_task(process_note_topics, note_id)
        
    return note


@router.post("/{note_id}/topics/extract", status_code=status.HTTP_202_ACCEPTED)
def trigger_topic_extraction(
    note_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    note = db.query(Note).filter(Note.id == note_id, Note.owner_id == current_user.id).first()
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )
    
    note.topic_extraction_status = "pending"
    db.commit()
    
    background_tasks.add_task(process_note_topics, note_id)
    return {"message": "Topic extraction started", "status": "pending"}
