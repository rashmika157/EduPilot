from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

# User Schemas
class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)

class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Token Schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    user_id: Optional[int] = None

# Note Schemas
class NoteBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=150)
    subject: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None

class NoteCreate(NoteBase):
    pass

class NoteResponse(NoteBase):
    id: int
    file_size: int
    owner_id: int
    topic_extraction_status: str
    extraction_confidence: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Topic and Subtopic Schemas
class SubtopicResponse(BaseModel):
    id: int
    topic_id: int
    parent_id: Optional[int] = None
    title: str
    created_at: datetime
    children: List['SubtopicResponse'] = []

    class Config:
        from_attributes = True

class TopicResponse(BaseModel):
    id: int
    note_id: int
    title: str
    created_at: datetime
    subtopics: List[SubtopicResponse] = []

    class Config:
        from_attributes = True

class NoteWithTopicsResponse(NoteResponse):
    topics: List[TopicResponse] = []

    class Config:
        from_attributes = True

# Chat Schemas
class ChatMessageCreate(BaseModel):
    content: str = Field(..., min_length=1)

class ChatMessageResponse(BaseModel):
    id: int
    session_id: int
    sender: str
    content: str
    source_topic: Optional[str] = None
    confidence_score: Optional[float] = None
    source_references: Optional[List[Dict[str, Any]]] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ChatSessionResponse(BaseModel):
    id: int
    note_id: int
    user_id: int
    created_at: datetime
    messages: List[ChatMessageResponse] = []

    class Config:
        from_attributes = True

# Rebuild forward ref schemas
SubtopicResponse.model_rebuild()

