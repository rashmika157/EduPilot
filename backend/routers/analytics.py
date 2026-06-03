from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
import datetime
from typing import List, Dict, Any

from backend.database import get_db
from backend.models import Note, User, Topic, Subtopic, UserTopicProgress, QuizAttempt, UserAnalytics
from backend.auth import get_current_user

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("/dashboard")
def get_performance_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Fetch user's notes
    user_notes = db.query(Note).filter(Note.owner_id == current_user.id).all()
    user_note_ids = [n.id for n in user_notes]

    if not user_note_ids:
        # Return empty metrics if no notes exist yet
        return {
            "total_topics_completed": 0,
            "total_quizzes_attempted": 0,
            "average_score": 0.0,
            "strong_topics_count": 0,
            "weak_topics_count": 0,
            "learning_health_score": 0.0,
            "progress_percentage": 0.0,
            "strong_topics": [],
            "moderate_topics": [],
            "weak_topics": []
        }

    # 2. Compute completed topics/subtopics and total items across all notes
    # To determine progress percent:
    # A syllabus item is a subtopic if it exists, or a topic if it has no subtopics.
    total_syllabus_items = 0
    completed_items_count = 0

    # Get all progress records for the user
    progress_records = db.query(UserTopicProgress).filter(
        UserTopicProgress.user_id == current_user.id
    ).all()
    
    # Organize progress by subtopic_id or topic_id
    progress_map = {}
    for pr in progress_records:
        if pr.subtopic_id:
            progress_map[f"subtopic_{pr.subtopic_id}"] = pr.status
        elif pr.topic_id:
            progress_map[f"topic_{pr.topic_id}"] = pr.status

    for note in user_notes:
        topics = db.query(Topic).filter(Topic.note_id == note.id).all()
        for t in topics:
            subtopics_count = db.query(Subtopic).filter(Subtopic.topic_id == t.id).count()
            if subtopics_count > 0:
                # If topic has subtopics, count each subtopic
                total_syllabus_items += subtopics_count
                subtopics = db.query(Subtopic).filter(Subtopic.topic_id == t.id).all()
                for sub in subtopics:
                    status = progress_map.get(f"subtopic_{sub.id}", "not_started")
                    if status == "completed":
                        completed_items_count += 1
            else:
                # If topic has no subtopics, count the topic itself
                total_syllabus_items += 1
                status = progress_map.get(f"topic_{t.id}", "not_started")
                if status == "completed":
                    completed_items_count += 1

    progress_percentage = 0.0
    if total_syllabus_items > 0:
        progress_percentage = (completed_items_count / total_syllabus_items) * 100.0

    # 3. Fetch all quiz attempts and compute average score
    attempts = db.query(QuizAttempt).filter(QuizAttempt.user_id == current_user.id).all()
    total_quizzes_attempted = len(attempts)

    total_accuracy_sum = 0.0
    for a in attempts:
        total_accuracy_sum += (a.score / a.total_questions) * 100.0

    average_score = 0.0
    if total_quizzes_attempted > 0:
        average_score = total_accuracy_sum / total_quizzes_attempted

    # 4. Group attempts by note_id and topic_title to categorize topics
    topic_attempts: Dict[tuple, List[float]] = {}
    for a in attempts:
        key = (a.note_id, a.topic_title)
        pct = (a.score / a.total_questions) * 100.0
        if key not in topic_attempts:
            topic_attempts[key] = []
        topic_attempts[key].append(pct)

    strong_topics = []
    moderate_topics = []
    weak_topics = []

    for (note_id, topic_title), scores in topic_attempts.items():
        avg_topic_score = sum(scores) / len(scores)
        
        # Load note title and subject
        note = db.query(Note).filter(Note.id == note_id).first()
        note_title = note.title if note else "Deleted Note"
        subject = note.subject if note else "Unknown"

        # Try to resolve the topic_id to allow learning hub/topics redirects
        topic_db = db.query(Topic).filter(Topic.note_id == note_id, Topic.title == topic_title).first()
        topic_id = topic_db.id if topic_db else None

        topic_data = {
            "note_id": note_id,
            "topic_id": topic_id,
            "topic_title": topic_title,
            "note_title": note_title,
            "subject": subject,
            "average_score": round(avg_topic_score, 1),
            "attempts_count": len(scores)
        }

        if avg_topic_score >= 80.0:
            strong_topics.append(topic_data)
        elif avg_topic_score >= 50.0:
            moderate_topics.append(topic_data)
        else:
            weak_topics.append(topic_data)

    strong_topics_count = len(strong_topics)
    weak_topics_count = len(weak_topics)

    # 5. Compute Learning Health Score:
    # 40% weight on completed progress, 60% on quiz performance
    learning_health_score = 0.0
    if total_syllabus_items > 0 or total_quizzes_attempted > 0:
        # If no quizzes attempted, health score is based entirely on progress
        if total_quizzes_attempted == 0:
            learning_health_score = progress_percentage
        # If no progress but quizzes exist
        elif total_syllabus_items == 0:
            learning_health_score = average_score
        else:
            learning_health_score = (0.4 * progress_percentage) + (0.6 * average_score)

    # 6. Save analytics in database
    analytics = db.query(UserAnalytics).filter(UserAnalytics.user_id == current_user.id).first()
    if not analytics:
        analytics = UserAnalytics(
            user_id=current_user.id,
            total_topics_completed=completed_items_count,
            total_quizzes_attempted=total_quizzes_attempted,
            average_score=round(average_score, 1),
            strong_topics_count=strong_topics_count,
            weak_topics_count=weak_topics_count,
            learning_health_score=round(learning_health_score, 1),
            progress_percentage=round(progress_percentage, 1)
        )
        db.add(analytics)
    else:
        analytics.total_topics_completed = completed_items_count
        analytics.total_quizzes_attempted = total_quizzes_attempted
        analytics.average_score = round(average_score, 1)
        analytics.strong_topics_count = strong_topics_count
        analytics.weak_topics_count = weak_topics_count
        analytics.learning_health_score = round(learning_health_score, 1)
        analytics.progress_percentage = round(progress_percentage, 1)
        analytics.updated_at = datetime.datetime.utcnow()

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        # Log error, but proceed to return data so the page functions
        print(f"[Analytics] Failed to save/update user analytics cache: {e}")

    return {
        "total_topics_completed": completed_items_count,
        "total_quizzes_attempted": total_quizzes_attempted,
        "average_score": round(average_score, 1),
        "strong_topics_count": strong_topics_count,
        "weak_topics_count": weak_topics_count,
        "learning_health_score": round(learning_health_score, 1),
        "progress_percentage": round(progress_percentage, 1),
        "strong_topics": strong_topics,
        "moderate_topics": moderate_topics,
        "weak_topics": weak_topics
    }
