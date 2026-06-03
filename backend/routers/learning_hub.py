from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from backend.database import get_db
from backend.models import Note, User, Topic, Subtopic, UserTopicProgress
from backend.auth import get_current_user
from backend.services.youtube_service import search_youtube_videos

router = APIRouter(prefix="/api/learning-hub", tags=["learning-hub"])

class ProgressUpdateRequest(BaseModel):
    note_id: int
    topic_id: Optional[int] = None
    subtopic_id: Optional[int] = None
    status: str # 'not_started', 'in_progress', 'completed'
    last_watched_video_id: Optional[str] = None

@router.get("/{note_id}/progress")
def get_learning_progress(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Verify note belongs to user
    note = db.query(Note).filter(Note.id == note_id, Note.owner_id == current_user.id).first()
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    # 2. Get all subtopics to determine total counts
    total_subtopics = db.query(Subtopic).join(Topic).filter(Topic.note_id == note_id).count()
    
    # 3. Fetch progress records
    progress_records = db.query(UserTopicProgress).filter(
        UserTopicProgress.user_id == current_user.id,
        UserTopicProgress.note_id == note_id
    ).all()

    # 4. Construct response maps
    progress_map = {}
    last_watched_map = {}
    completed_subtopic_count = 0

    for r in progress_records:
        key = f"subtopic_{r.subtopic_id}" if r.subtopic_id else f"topic_{r.topic_id}"
        progress_map[key] = r.status
        if r.last_watched_video_id:
            last_watched_map[key] = r.last_watched_video_id
            
        if r.subtopic_id and r.status == "completed":
            completed_subtopic_count += 1

    # 5. Calculate progress percentage based on subtopics
    progress_percentage = 0
    if total_subtopics > 0:
        progress_percentage = int((completed_subtopic_count / total_subtopics) * 100)
    else:
        # Fallback to topic-level progress if no subtopics exist
        total_topics = db.query(Topic).filter(Topic.note_id == note_id).count()
        completed_topic_count = sum(1 for r in progress_records if r.topic_id and r.status == "completed")
        if total_topics > 0:
            progress_percentage = int((completed_topic_count / total_topics) * 100)

    return {
        "progress_percentage": min(100, progress_percentage),
        "progress_map": progress_map,
        "last_watched_map": last_watched_map
    }

@router.post("/progress")
def update_learning_progress(
    payload: ProgressUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not payload.topic_id and not payload.subtopic_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either topic_id or subtopic_id must be provided"
        )

    # Verify status value
    if payload.status not in ["not_started", "in_progress", "completed"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be 'not_started', 'in_progress', or 'completed'"
        )

    # 1. Verify note ownership
    note = db.query(Note).filter(Note.id == payload.note_id, Note.owner_id == current_user.id).first()
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    # 2. Get or create progress entry
    query = db.query(UserTopicProgress).filter(
        UserTopicProgress.user_id == current_user.id,
        UserTopicProgress.note_id == payload.note_id
    )
    
    if payload.subtopic_id:
        query = query.filter(UserTopicProgress.subtopic_id == payload.subtopic_id)
    else:
        query = query.filter(UserTopicProgress.topic_id == payload.topic_id, UserTopicProgress.subtopic_id == None)
        
    progress = query.first()

    if not progress:
        progress = UserTopicProgress(
            user_id=current_user.id,
            note_id=payload.note_id,
            topic_id=payload.topic_id,
            subtopic_id=payload.subtopic_id,
            status=payload.status,
            last_watched_video_id=payload.last_watched_video_id
        )
        db.add(progress)
    else:
        progress.status = payload.status
        if payload.last_watched_video_id:
            progress.last_watched_video_id = payload.last_watched_video_id
            
    try:
        db.commit()
        db.refresh(progress)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Database commit failed: {str(e)}")

    return {"status": "success", "progress_id": progress.id}

@router.get("/videos")
def get_topic_videos(
    query: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        videos = search_youtube_videos(query, db)
        return videos
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"YouTube search request failed: {str(e)}"
        )
