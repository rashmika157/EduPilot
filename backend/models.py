import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from backend.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    notes = relationship("Note", back_populates="owner", cascade="all, delete-orphan")


class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(150), index=True, nullable=False)
    subject = Column(String(100), index=True, nullable=False)
    description = Column(Text, nullable=True)
    file_path = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=False) # Size in bytes
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    topic_extraction_status = Column(String(50), default="pending") # pending, processing, completed, failed
    extraction_confidence = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    owner = relationship("User", back_populates="notes")
    topics = relationship("Topic", back_populates="note", cascade="all, delete-orphan")


class Topic(Base):
    __tablename__ = "topics"

    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(150), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    note = relationship("Note", back_populates="topics")
    all_subtopics = relationship("Subtopic", back_populates="topic", cascade="all, delete-orphan")
    subtopics = relationship(
        "Subtopic",
        primaryjoin="and_(Topic.id==Subtopic.topic_id, Subtopic.parent_id==None)",
        viewonly=True
    )


class Subtopic(Base):
    __tablename__ = "subtopics"

    id = Column(Integer, primary_key=True, index=True)
    topic_id = Column(Integer, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(Integer, ForeignKey("subtopics.id", ondelete="CASCADE"), nullable=True)
    title = Column(String(150), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    topic = relationship("Topic", back_populates="all_subtopics")
    parent = relationship("Subtopic", remote_side=[id], backref="children")


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    note = relationship("Note")
    user = relationship("User")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    sender = Column(String(10), nullable=False) # 'user' or 'ai'
    content = Column(Text, nullable=False)
    source_topic = Column(String(150), nullable=True)
    confidence_score = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    session = relationship("ChatSession", back_populates="messages")


class YoutubeVideoCache(Base):
    __tablename__ = "youtube_video_cache"

    id = Column(Integer, primary_key=True, index=True)
    search_query = Column(String(255), index=True, nullable=False)
    video_id = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    thumbnail_url = Column(String(255), nullable=False)
    channel_name = Column(String(150), nullable=False)
    views = Column(String(50), nullable=False)
    duration = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class UserTopicProgress(Base):
    __tablename__ = "user_topic_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    note_id = Column(Integer, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False)
    topic_id = Column(Integer, ForeignKey("topics.id", ondelete="CASCADE"), nullable=True)
    subtopic_id = Column(Integer, ForeignKey("subtopics.id", ondelete="CASCADE"), nullable=True)
    status = Column(String(50), default="not_started") # 'not_started', 'in_progress', 'completed'
    last_watched_video_id = Column(String(50), nullable=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    note_id = Column(Integer, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False)
    topic_title = Column(String(150), nullable=False)
    score = Column(Integer, nullable=False)
    total_questions = Column(Integer, default=10, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    user = relationship("User")
    note = relationship("Note")


class UserAnalytics(Base):
    __tablename__ = "user_analytics"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    total_topics_completed = Column(Integer, default=0)
    total_quizzes_attempted = Column(Integer, default=0)
    average_score = Column(Float, default=0.0)
    strong_topics_count = Column(Integer, default=0)
    weak_topics_count = Column(Integer, default=0)
    learning_health_score = Column(Float, default=0.0)
    progress_percentage = Column(Float, default=0.0)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    user = relationship("User")

