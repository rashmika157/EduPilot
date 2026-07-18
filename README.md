# 🎓 EduPilot – AI-Powered Personalized Learning Platform

EduPilot is an AI-powered study platform that helps students organize, understand, and revise their study materials efficiently. Users can upload PDF notes, automatically extract topics, interact with an AI Tutor, generate quizzes, and access topic-specific learning resources—all from a single platform.

---

## ✨ Features

### 📄 Study Material Management
- Upload PDF study materials
- Organize notes in a personal library
- View uploaded documents anytime

### 🧠 AI Topic Extraction
- Automatically extracts topics and subtopics from uploaded PDFs
- Creates a structured learning hierarchy
- Simplifies navigation through study materials

### 🤖 AI Tutor
- Ask questions based on uploaded study materials
- Context-aware responses using AI
- Interactive chat interface for personalized learning

### 📝 AI Quiz Generator
- Generate quizzes from uploaded notes
- Multiple-choice questions
- Instant score calculation
- Quiz history tracking

### 🎥 Learning Hub
- Topic-based educational YouTube recommendations
- Embedded video player
- Organized learning resources for selected topics

### 📊 Dashboard
- Learning analytics
- Study statistics
- Recent study materials
- Personalized learning overview

### 👤 User Profile
- Secure authentication
- Learning activity
- Progress tracking

---

# 🛠 Tech Stack

## Frontend
- React.js
- TypeScript
- Vite
- Tailwind CSS
- React Router

## Backend
- FastAPI
- Python
- SQLAlchemy
- Pydantic

## Database
- MySQL

## AI & APIs
- OpenRouter API
- DeepSeek Chat Model
- PDF Processing
- Prompt Engineering
- AI-based Topic Extraction
- AI Quiz Generation

---

# 🧠 AI Concepts Used

- Large Language Models (LLMs)
- Prompt Engineering
- Retrieval-Augmented Question Answering (RAG-style)
- Natural Language Processing (NLP)
- AI Topic Extraction
- AI Summarization
- AI Quiz Generation
- Context-aware AI Tutor
- Intelligent Content Recommendation

---

# 📂 Project Structure

```
EduPilot/
│
├── backend/
│   ├── routers/
│   ├── services/
│   ├── models/
│   ├── schemas/
│   ├── database.py
│   └── main.py
│
├── frontend/
│   ├── src/
│   ├── components/
│   ├── pages/
│   ├── services/
│   └── assets/
│
├── README.md
└── run.bat
```

---

# 🚀 Getting Started

## 1. Clone Repository

```bash
git clone https://github.com/rashmika157/EduPilot.git
cd EduPilot
```

---

## 2. Backend Setup

```bash
cd backend

python -m venv venv

venv\Scripts\activate

pip install -r requirements.txt
```

---

## 3. Configure Environment Variables

Create a `.env` file inside the `backend` folder.

Example:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=edupilot

OPENROUTER_API_KEY=your_openrouter_api_key
```

---

## 4. Initialize Database

```bash
python -m backend.init_db
```

---

## 5. Start Backend

```bash
python -m uvicorn backend.main:app --reload
```

Backend runs on:

```
http://127.0.0.1:8000
```

Swagger API Docs:

```
http://127.0.0.1:8000/docs
```

---

## 6. Start Frontend

```bash
cd frontend

npm install

npm run dev
```

Frontend:

```
http://localhost:5173
```

---

# 📸 Application Modules

- Dashboard
- Upload Notes
- Notes Library
- Topic Viewer
- Learning Hub
- AI Tutor
- Quiz History
- User Profile

---

# 📈 Future Enhancements

- AI-generated revision notes
- Enhanced topic recommendations
- Advanced learning analytics
- Improved YouTube recommendation engine
- Mobile responsive enhancements

---

# 👩‍💻 Developed By

**Rashmika Ramesh**

Computer Science Engineering Student

---

# 📄 License

This project is developed for educational and academic purposes.
