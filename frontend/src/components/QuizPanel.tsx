import React, { useState } from 'react';
import { 
  X, 
  HelpCircle, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Award, 
  ArrowRight, 
  RefreshCw,
  Loader2
} from 'lucide-react';

interface Question {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

interface QuizPanelProps {
  noteId: number;
  topicTitle: string;
  questions: Question[];
  onClose: () => void;
}

export const QuizPanel: React.FC<QuizPanelProps> = ({ noteId, topicTitle, questions, onClose }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [savingScore, setSavingScore] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSelectOption = (optionIndex: number) => {
    if (quizSubmitted) return;
    setSelectedAnswers(prev => ({
      ...prev,
      [currentIdx]: optionIndex
    }));
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
    }
  };

  // Calculate final score
  const getScore = () => {
    let score = 0;
    questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correct_index) {
        score += 1;
      }
    });
    return score;
  };

  const handleSubmitQuiz = async () => {
    const finalScore = getScore();
    setQuizSubmitted(true);
    setSavingScore(true);
    setSaveError(null);

    try {
      const token = localStorage.getItem('edupilot_token');
      const response = await fetch('http://127.0.0.1:8000/api/quiz/attempt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          note_id: noteId,
          topic_title: topicTitle,
          score: finalScore,
          total_questions: questions.length
        })
      });

      if (!response.ok) {
        setSaveError("Attempt saved locally, but database sync failed.");
      }
    } catch (err) {
      console.error("Failed to submit score:", err);
      setSaveError("Network error. Unable to save attempt history.");
    } finally {
      setSavingScore(false);
    }
  };

  const currentQuestion = questions[currentIdx];
  const isAnswered = selectedAnswers[currentIdx] !== undefined;
  const isLastQuestion = currentIdx === questions.length - 1;
  const progressPercent = ((currentIdx + 1) / questions.length) * 100;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(10, 8, 28, 0.85)',
      backdropFilter: 'blur(16px)',
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      overflowY: 'auto'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '720px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255,255,255,0.01)'
        }}>
          <div>
            <span style={{ fontSize: '0.72rem', color: 'var(--primary-light, #c084fc)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Practice Assessment
            </span>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
              Quiz: {topicTitle}
            </h3>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.03)'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {!quizSubmitted ? (
            /* ACTIVE QUIZ MODE */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Progress Tracker */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  <span>Question <strong>{currentIdx + 1}</strong> of {questions.length}</span>
                  <span>{Math.round(progressPercent)}% Complete</span>
                </div>
                <div style={{
                  height: '6px',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  borderRadius: '99px',
                  overflow: 'hidden',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${progressPercent}%`,
                    background: 'linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%)',
                    borderRadius: '99px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>

              {/* Question Text Box */}
              <div style={{
                padding: '20px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                gap: '12px'
              }}>
                <HelpCircle size={20} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <p style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  {currentQuestion?.question}
                </p>
              </div>

              {/* Options Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {currentQuestion?.options.map((opt, idx) => {
                  const isSelected = selectedAnswers[currentIdx] === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectOption(idx)}
                      style={{
                        textAlign: 'left',
                        padding: '16px 20px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: isSelected ? 'rgba(139, 92, 246, 0.1)' : 'rgba(255, 255, 255, 0.01)',
                        border: isSelected ? '1px solid var(--primary-light, #c084fc)' : '1px solid var(--border-color)',
                        color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                      className="quiz-option"
                    >
                      <span>{opt}</span>
                      <div style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        border: isSelected ? '5px solid var(--primary)' : '2px solid var(--border-color)',
                        backgroundColor: isSelected ? 'white' : 'transparent',
                        transition: 'all 0.15s ease'
                      }} />
                    </button>
                  );
                })}
              </div>

              {/* Navigation Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <button
                  disabled={currentIdx === 0}
                  onClick={handlePrev}
                  style={{
                    padding: '10px 18px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'transparent',
                    color: currentIdx === 0 ? 'var(--text-muted)' : 'var(--text-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    cursor: currentIdx === 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  Previous
                </button>

                {isLastQuestion ? (
                  <button
                    disabled={!isAnswered}
                    onClick={handleSubmitQuiz}
                    style={{
                      padding: '10px 24px',
                      background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                      border: 'none',
                      color: 'white',
                      fontWeight: 600,
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.85rem',
                      cursor: !isAnswered ? 'not-allowed' : 'pointer',
                      opacity: !isAnswered ? 0.5 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    Finish Quiz
                  </button>
                ) : (
                  <button
                    disabled={!isAnswered}
                    onClick={handleNext}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-color)',
                      color: !isAnswered ? 'var(--text-muted)' : 'var(--text-primary)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.85rem',
                      cursor: !isAnswered ? 'not-allowed' : 'pointer',
                      opacity: !isAnswered ? 0.5 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    Next Question <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* SUBMITTED RESULTS REVIEW MODE */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              {/* Score Award Summary Banner */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(6, 182, 212, 0.05) 100%)',
                border: '1px solid rgba(139, 92, 246, 0.25)',
                borderRadius: 'var(--radius-sm)',
                padding: '24px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Award size={40} color="var(--secondary)" />
                <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Quiz Completed!
                </h4>
                <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'white', margin: '10px 0' }}>
                  {getScore()} <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ {questions.length}</span>
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  {getScore() >= 8 ? "🚀 Exceptional performance! You have mastered this concept." : 
                   getScore() >= 5 ? "👍 Good job! Review the explanations below to patch gaps." : 
                   "📖 Keep studying. Try re-reading the syllabus section and take the quiz again."}
                </p>

                {savingScore ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                    <Loader2 size={12} className="spin-icon" /> Saving attempt score to vault...
                  </div>
                ) : saveError ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#f87171', marginTop: '8px' }}>
                    <AlertCircle size={12} /> {saveError}
                  </div>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 600, marginTop: '8px' }}>
                    ✓ Score recorded in your Quiz History
                  </span>
                )}
              </div>

              {/* Incorrect/Correct Answer Explanations Review list */}
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
                  Question Review
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {questions.map((q, idx) => {
                    const selectedIdx = selectedAnswers[idx];
                    const isCorrect = selectedIdx === q.correct_index;
                    return (
                      <div 
                        key={idx}
                        style={{
                          padding: '20px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'rgba(255,255,255,0.01)',
                          border: isCorrect ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}
                      >
                        {/* Question title with status badge */}
                        <div style={{ display: 'flex', justifyItems: 'center', gap: '10px' }}>
                          {isCorrect ? (
                            <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                          ) : (
                            <XCircle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                          )}
                          <h5 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {idx + 1}. {q.question}
                          </h5>
                        </div>

                        {/* Selected & correct answer lines */}
                        <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '28px' }}>
                          <div style={{ color: isCorrect ? '#a7f3d0' : '#fca5a5' }}>
                            Your Answer: <strong>{selectedIdx !== undefined ? q.options[selectedIdx] : 'None'}</strong>
                          </div>
                          {!isCorrect && (
                            <div style={{ color: '#a7f3d0' }}>
                              Correct Answer: <strong>{q.options[q.correct_index]}</strong>
                            </div>
                          )}
                        </div>

                        {/* Explanation block */}
                        <div style={{
                          padding: '12px 16px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(255,255,255,0.02)',
                          borderLeft: '3px solid var(--primary)',
                          fontSize: '0.82rem',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.4,
                          marginLeft: '28px'
                        }}>
                          <strong>Explanation:</strong> {q.explanation}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Close/Retry buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <button
                  onClick={() => {
                    // Reset quiz state
                    setCurrentIdx(0);
                    setSelectedAnswers({});
                    setQuizSubmitted(false);
                    setSaveError(null);
                  }}
                  style={{
                    padding: '10px 18px',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <RefreshCw size={14} /> Retry Quiz
                </button>
                <button
                  onClick={onClose}
                  style={{
                    padding: '10px 24px',
                    background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                    border: 'none',
                    color: 'white',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  Close Review
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
