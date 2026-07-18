from datetime import datetime
from fastapi import FastAPI, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
import random

from backend.database import get_db
from backend.models import Note, User, UserTopicProgress, QuizAttempt, Topic, Subtopic
from backend.auth import get_current_user
from backend.routers import users, notes, tutor, learning_hub, quiz, analytics

app = FastAPI(
    title="EduPilot API",
    description="Backend API services for the EduPilot notes uploading and management platform.",
    version="1.0.0"
)

# CORS configurations
# Allowing all origins in dev environment for smooth developer experience
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(users.router)
app.include_router(notes.router)
app.include_router(tutor.router)
app.include_router(learning_hub.router)
app.include_router(quiz.router)
app.include_router(analytics.router)

# Sample study tips for student motivation
STUDY_TIPS = [
    "🚀 Space your study sessions! 20-minute chunks are much more effective than 4-hour cram marathons.",
    "🧠 The Feynman Technique: Explain a concept in simple terms to someone else to solidify your own understanding.",
    "🍅 Pomodoro Rule: Focus completely for 25 minutes, then reward yourself with a 5-minute break.",
    "✍️ Active Recall: Test yourself rather than just highlighting or re-reading notes. It builds stronger neural pathways!",
    "💤 Sleep is part of studying! Your brain consolidates information and memories during deep sleep cycles.",
    "📅 Consistency beats intensity. Uploading 1 note set a day keeps the exam stress away!"
]

@app.get("/")
def read_root():
    return {
        "message": "Welcome to the EduPilot API!",
        "status": "online",
        "docs_url": "/docs"
    }

@app.get("/api/dashboard/stats")
def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Total notes uploaded
    total_notes = db.query(Note).filter(Note.owner_id == current_user.id).count()
    
    # Total storage used (bytes)
    total_bytes = db.query(func.sum(Note.file_size)).filter(Note.owner_id == current_user.id).scalar() or 0
    
    # Recent notes (last 3 uploads)
    recent_notes_db = db.query(Note).filter(
        Note.owner_id == current_user.id
    ).order_by(Note.created_at.desc()).limit(3).all()
    
    recent_notes = [
        {
            "id": note.id,
            "title": note.title,
            "subject": note.subject,
            "created_at": note.created_at,
            "file_size": note.file_size
        }
        for note in recent_notes_db
    ]
    
    # Subject breakdown
    subject_counts = db.query(
        Note.subject, func.count(Note.id)
    ).filter(
        Note.owner_id == current_user.id
    ).group_by(Note.subject).all()
    
    subject_distribution = [
        {"subject": subject, "count": count} for subject, count in subject_counts
    ]
    
    # Random study tips (select 3 unique tips)
    selected_tips = random.sample(STUDY_TIPS, min(3, len(STUDY_TIPS)))
    
    # Videos Watched: count of completed progress
    videos_watched = db.query(UserTopicProgress).filter(
        UserTopicProgress.user_id == current_user.id,
        UserTopicProgress.status == "completed"
    ).count()

    # Quiz Score: average accuracy of quiz attempts
    attempts = db.query(QuizAttempt).filter(QuizAttempt.user_id == current_user.id).all()
    if attempts:
        total_accuracy_sum = sum([(a.score / a.total_questions) * 100.0 for a in attempts])
        quiz_score = f"{round(total_accuracy_sum / len(attempts))}%"
    else:
        quiz_score = "0%"

    # Today's learning hours estimate based on today's progress events
    today = datetime.utcnow().date()
    todays_progress_count = db.query(UserTopicProgress).filter(
        UserTopicProgress.user_id == current_user.id,
        func.date(UserTopicProgress.updated_at) == today
    ).count()
    todays_learning_hours = round(todays_progress_count * 0.5, 1)

    # Build a complete list of user's notes, with optional last access timestamp
    user_notes = db.query(Note).filter(Note.owner_id == current_user.id).all()

    def calculate_note_progress(note_id: int) -> int:
        total_subtopics = db.query(Subtopic).join(Topic).filter(Topic.note_id == note_id).count()
        progress_records = db.query(UserTopicProgress).filter(
            UserTopicProgress.user_id == current_user.id,
            UserTopicProgress.note_id == note_id
        ).all()

        completed_subtopic_count = sum(1 for r in progress_records if r.subtopic_id and r.status == "completed")

        if total_subtopics > 0:
            return min(100, int((completed_subtopic_count / total_subtopics) * 100))

        total_topics = db.query(Topic).filter(Topic.note_id == note_id).count()
        if total_topics > 0:
            completed_topic_count = sum(1 for r in progress_records if r.topic_id and r.status == "completed")
            return min(100, int((completed_topic_count / total_topics) * 100))

        return 0

    def get_last_accessed(note_id: int):
        return db.query(func.max(UserTopicProgress.updated_at)).filter(
            UserTopicProgress.user_id == current_user.id,
            UserTopicProgress.note_id == note_id
        ).scalar()

    recent_study_materials = []
    for note in user_notes:
        recent_study_materials.append({
            "id": note.id,
            "title": note.title,
            "subject": note.subject,
            "progress_percentage": calculate_note_progress(note.id),
            "last_accessed": get_last_accessed(note.id) or note.created_at,
            "uploaded_at": note.created_at
        })

    recent_study_materials.sort(
        key=lambda item: (item["last_accessed"], item["uploaded_at"]),
        reverse=True
    )
    recent_study_materials = recent_study_materials[:5]

    return {
        "total_notes": total_notes,
        "total_size_bytes": total_bytes,
        "recent_notes": recent_notes,
        "subject_distribution": subject_distribution,
        "study_tips": selected_tips,
        "videos_watched": videos_watched,
        "quiz_score": quiz_score,
        "todays_learning_hours": todays_learning_hours,
        "recent_study_materials": recent_study_materials,
        "user_profile": {
            "username": current_user.username,
            "email": current_user.email,
            "created_at": current_user.created_at
        }
    }
