import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  Loader2, 
  Calendar, 
  BookOpen, 
  Award,
  AlertCircle,
  TrendingUp
} from 'lucide-react';

interface QuizHistoryRecord {
  id: number;
  topic_title: string;
  score: number;
  total_questions: number;
  created_at: string;
  note_title: string;
  subject: string;
}

export const QuizHistory: React.FC = () => {
  const [history, setHistory] = useState<QuizHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('edupilot_token');
      const response = await fetch('http://127.0.0.1:8000/api/quiz/history', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      } else {
        if (response.status === 401) {
          window.dispatchEvent(new Event('unauthorized'));
        } else {
          setError("Failed to retrieve quiz logs from server.");
        }
      }
    } catch (err) {
      console.error("Failed to load quiz history:", err);
      setError("Unable to connect to service router.");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return isoString;
    }
  };

  // Aggregate stats
  const totalQuizzes = history.length;
  const averageScore = totalQuizzes > 0 
    ? Math.round((history.reduce((sum, item) => sum + (item.score / item.total_questions), 0) / totalQuizzes) * 100)
    : 0;
  
  const highScoresCount = history.filter(item => (item.score / item.total_questions) >= 0.8).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Header and Statistics */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>Quiz Assessment History</h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Track and review your generated practice quiz records to review your conceptual progress.
          </p>
        </div>
      </div>

      {/* Aggregate Score Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--primary)'
          }}>
            <ClipboardList size={22} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Quizzes Attempted</span>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'white', marginTop: '2px' }}>{totalQuizzes}</h3>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--secondary)'
          }}>
            <TrendingUp size={22} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Average Accuracy</span>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'white', marginTop: '2px' }}>{averageScore}%</h3>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#10b981'
          }}>
            <Award size={22} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Mastery Badges (&ge;80%)</span>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'white', marginTop: '2px' }}>{highScoresCount}</h3>
          </div>
        </div>
      </div>

      {/* 2. Main History Log */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', minHeight: '300px' }}>
        {loading ? (
          <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '200px', gap: '12px' }}>
            <Loader2 size={36} className="spin-icon" color="var(--primary)" />
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Loading history records...</span>
          </div>
        ) : error ? (
          <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '200px', color: '#f87171', gap: '10px' }}>
            <AlertCircle size={36} />
            <span style={{ fontSize: '0.9rem' }}>{error}</span>
          </div>
        ) : history.length === 0 ? (
          <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '200px', color: 'var(--text-muted)', gap: '12px', textAlign: 'center' }}>
            <ClipboardList size={40} style={{ opacity: 0.3 }} />
            <div>
              <h4 style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>No attempts recorded yet</h4>
              <p style={{ fontSize: '0.82rem', maxWidth: '300px', marginTop: '4px' }}>
                Navigate to a note package in the Syllabus or Learning Hub and generate a practice quiz to get started.
              </p>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '12px 16px' }}>Note Package</th>
                  <th style={{ padding: '12px 16px' }}>Subject</th>
                  <th style={{ padding: '12px 16px' }}>Quiz Concept Topic</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Accuracy Score</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Date Attempted</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                {history.map((record) => {
                  const pct = (record.score / record.total_questions) * 100;
                  const scoreColor = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
                  const scoreBg = pct >= 80 ? 'rgba(16, 185, 129, 0.1)' : pct >= 50 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)';
                  
                  return (
                    <tr 
                      key={record.id} 
                      style={{ 
                        borderBottom: '1px solid var(--border-color)',
                        transition: 'background-color 0.2s ease'
                      }}
                      className="table-row-hover"
                    >
                      {/* Note Title */}
                      <td style={{ padding: '16px', fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <BookOpen size={14} color="var(--primary)" />
                          <span>{record.note_title}</span>
                        </div>
                      </td>

                      {/* Subject Badge */}
                      <td style={{ padding: '16px' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-secondary)'
                        }}>
                          {record.subject}
                        </span>
                      </td>

                      {/* Topic Title */}
                      <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>
                        {record.topic_title}
                      </td>

                      {/* Score Indicator */}
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: '99px',
                            color: scoreColor,
                            backgroundColor: scoreBg,
                            border: `1px solid ${scoreColor}22`
                          }}>
                            {record.score} / {record.total_questions} ({Math.round(pct)}%)
                          </span>
                        </div>
                      </td>

                      {/* Time */}
                      <td style={{ padding: '16px', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                          <Calendar size={12} />
                          <span>{formatDate(record.created_at)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
