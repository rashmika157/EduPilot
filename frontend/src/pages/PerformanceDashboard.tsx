import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Activity, 
  BookOpen, 
  Video, 
  Award, 
  AlertTriangle, 
  Loader2,
  RotateCw,
  Flame
} from 'lucide-react';

interface TopicAnalytics {
  note_id: number;
  topic_id: number | null;
  topic_title: string;
  note_title: string;
  subject: string;
  average_score: number;
  attempts_count: number;
}

interface AnalyticsData {
  total_topics_completed: number;
  total_quizzes_attempted: number;
  average_score: number;
  strong_topics_count: number;
  weak_topics_count: number;
  learning_health_score: number;
  progress_percentage: number;
  strong_topics: TopicAnalytics[];
  moderate_topics: TopicAnalytics[];
  weak_topics: TopicAnalytics[];
}

export const PerformanceDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'strong' | 'moderate' | 'weak'>('all');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('edupilot_token');
      const response = await fetch('http://127.0.0.1:8000/api/analytics/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        if (response.status === 401) {
          window.dispatchEvent(new Event('unauthorized'));
        } else {
          setError("Failed to sync student learning telemetry.");
        }
      }
    } catch (err) {
      console.error("Failed to load analytics:", err);
      setError("Unable to connect to analytics router.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '12px' }}>
        <Loader2 size={36} className="spin-icon" color="var(--primary)" />
        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Analyzing learning progress & quiz metrics...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', maxWidth: '500px', margin: '40px auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <AlertTriangle size={48} color="var(--danger)" />
        <h3 style={{ color: 'var(--text-primary)' }}>Telemetry Offline</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{error || "An unexpected error occurred."}</p>
        <button className="btn btn-primary" onClick={fetchAnalytics}>Reconnect</button>
      </div>
    );
  }

  // Radial metrics circle calculations
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (data.learning_health_score / 100) * circumference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 1. Header & Main Indicators Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>Performance & Analytics Dashboard</h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Deep dive into your academic metrics, track syllabus progress, and patch knowledge gaps.
          </p>
        </div>
        <button 
          onClick={fetchAnalytics}
          style={{
            padding: '8px 14px',
            backgroundColor: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.8rem',
            transition: 'all 0.2s'
          }}
          className="btn-refresh"
        >
          <RotateCw size={14} /> Refresh stats
        </button>
      </div>

      {/* 2. Top-Level Health & Progress Visual meters */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 2fr',
        gap: '20px',
      }} className="health-grid">
        
        {/* Radial gauge: Learning Health Score */}
        <div className="glass-panel" style={{
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(6, 182, 212, 0.02) 100%)'
        }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Learning Health Score
          </h4>
          
          <div style={{ position: 'relative', width: '150px', height: '150px', display: 'flex', alignItems: 'center', justifyItems: 'center' }}>
            <svg width="150" height="150" style={{ transform: 'rotate(-90deg)' }}>
              <circle
                cx="75"
                cy="75"
                r={radius}
                fill="transparent"
                stroke="rgba(255,255,255,0.03)"
                strokeWidth="10"
              />
              <circle
                cx="75"
                cy="75"
                r={radius}
                fill="transparent"
                stroke="url(#healthGrad)"
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
              />
              <defs>
                <linearGradient id="healthGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--primary)" />
                  <stop offset="100%" stopColor="var(--secondary)" />
                </linearGradient>
              </defs>
            </svg>
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{ fontSize: '2.2rem', fontWeight: 900, color: 'white', lineHeight: 1 }}>
                {Math.round(data.learning_health_score)}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '2px' }}>
                Health Rating
              </span>
            </div>
          </div>

          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '16px', maxWidth: '240px' }}>
            Calculated as a weighted sum of syllabus completion (40%) and average quiz accuracy (60%).
          </p>
        </div>

        {/* Linear gauge: Syllabus progress & status overview */}
        <div className="glass-panel" style={{
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '20px'
        }}>
          <div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Syllabus Completion
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
              <h3 style={{ fontSize: '2rem', fontWeight: 800, color: 'white', margin: 0 }}>
                {Math.round(data.progress_percentage)}%
              </h3>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                ({data.total_topics_completed} subtopics completed)
              </span>
            </div>

            {/* Linear Progress Bar */}
            <div style={{
              height: '10px',
              backgroundColor: 'rgba(255,255,255,0.03)',
              borderRadius: '99px',
              border: '1px solid var(--border-color)',
              marginTop: '12px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${data.progress_percentage}%`,
                background: 'linear-gradient(90deg, var(--secondary) 0%, #10b981 100%)',
                borderRadius: '99px',
                transition: 'width 1s ease'
              }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Quizzes Taken</span>
              <h4 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white', marginTop: '2px' }}>{data.total_quizzes_attempted}</h4>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Average MCQ Score</span>
              <h4 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white', marginTop: '2px' }}>{data.average_score}%</h4>
            </div>
          </div>
        </div>

      </div>

      {/* 3. Small Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        
        {/* Strong topics card */}
        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#10b981'
          }}>
            <Award size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Strong Concepts</span>
            <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white', marginTop: '2px' }}>{data.strong_topics_count}</h4>
          </div>
        </div>

        {/* Moderate topics card */}
        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f59e0b'
          }}>
            <Activity size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Moderate Concepts</span>
            <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white', marginTop: '2px' }}>
              {data.moderate_topics.length}
            </h4>
          </div>
        </div>

        {/* Weak topics card */}
        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ef4444'
          }}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Weak Concepts</span>
            <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white', marginTop: '2px' }}>{data.weak_topics_count}</h4>
          </div>
        </div>

      </div>

      {/* 4. Topic Analysis list segment with Tabs */}
      <div className="glass-panel" style={{ padding: '24px', minHeight: '350px', display: 'flex', flexDirection: 'column' }}>
        
        {/* Navigation Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '12px',
          marginBottom: '20px',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setActiveTab('all')}
            className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            style={getTabStyle(activeTab === 'all')}
          >
            All Evaluated Topics
          </button>
          <button
            onClick={() => setActiveTab('strong')}
            className={`tab-btn ${activeTab === 'strong' ? 'active' : ''}`}
            style={getTabStyle(activeTab === 'strong', '#10b981')}
          >
            Strong ({data.strong_topics_count})
          </button>
          <button
            onClick={() => setActiveTab('moderate')}
            className={`tab-btn ${activeTab === 'moderate' ? 'active' : ''}`}
            style={getTabStyle(activeTab === 'moderate', '#f59e0b')}
          >
            Moderate ({data.moderate_topics.length})
          </button>
          <button
            onClick={() => setActiveTab('weak')}
            className={`tab-btn ${activeTab === 'weak' ? 'active' : ''}`}
            style={getTabStyle(activeTab === 'weak', '#ef4444')}
          >
            Weak ({data.weak_topics_count})
          </button>
        </div>

        {/* List Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {getFilteredTopics().length === 0 ? (
            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)', minHeight: '200px', gap: '8px' }}>
              <Flame size={32} style={{ opacity: 0.2 }} />
              <span style={{ fontSize: '0.85rem' }}>No topics found in this category.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {getFilteredTopics().map((item, idx) => {
                const pct = item.average_score;
                const scoreColor = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
                const scoreBg = pct >= 80 ? 'rgba(16, 185, 129, 0.1)' : pct >= 50 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)';
                const isWeak = pct < 50;

                return (
                  <div 
                    key={idx}
                    style={{
                      padding: '16px 20px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'rgba(255,255,255,0.01)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '16px',
                      transition: 'border-color 0.2s'
                    }}
                    className="topic-item-row"
                  >
                    {/* Concept Metadata details */}
                    <div style={{ minWidth: '220px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        {item.subject} &bull; {item.note_title}
                      </span>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'white' }}>
                        {item.topic_title}
                      </h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Tested {item.attempts_count} times
                      </span>
                    </div>

                    {/* Score badge / category status */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: '99px',
                        color: scoreColor,
                        backgroundColor: scoreBg,
                        border: `1px solid ${scoreColor}22`
                      }}>
                        {item.average_score}% Accuracy
                      </span>
                      
                      {/* Weak topics direct action buttons */}
                      {isWeak && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => navigate(`/topics?noteId=${item.note_id}`)}
                            style={{
                              padding: '6px 12px',
                              fontSize: '0.75rem',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(139, 92, 246, 0.15)',
                              border: '1px solid rgba(139, 92, 246, 0.3)',
                              color: 'var(--primary-light, #c084fc)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontWeight: 600,
                              transition: 'all 0.2s'
                            }}
                            className="btn-revise"
                          >
                            <BookOpen size={12} />
                            Revise Again
                          </button>
                          
                          <button
                            onClick={() => {
                              if (item.topic_id) {
                                navigate(`/learning-hub?noteId=${item.note_id}&topicId=${item.topic_id}`);
                              } else {
                                navigate(`/learning-hub?noteId=${item.note_id}`);
                              }
                            }}
                            style={{
                              padding: '6px 12px',
                              fontSize: '0.75rem',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(6, 182, 212, 0.15)',
                              border: '1px solid rgba(6, 182, 212, 0.3)',
                              color: 'var(--secondary)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontWeight: 600,
                              transition: 'all 0.2s'
                            }}
                            className="btn-videos"
                          >
                            <Video size={12} />
                            Watch Videos
                          </button>
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spin-icon {
          animation: spin 1.2s linear infinite;
        }
        .btn-refresh:hover, .btn-revise:hover, .btn-videos:hover {
          transform: translateY(-1px);
          filter: brightness(1.15);
        }
        .topic-item-row:hover {
          border-color: rgba(255,255,255,0.08) !important;
          background-color: rgba(255,255,255,0.02) !important;
        }
        @media (max-width: 768px) {
          .health-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );

  // Tab Styles generator helper
  function getTabStyle(isActive: boolean, activeColor: string = 'var(--primary-light, #c084fc)'): React.CSSProperties {
    return {
      padding: '8px 16px',
      fontSize: '0.85rem',
      borderRadius: '6px',
      border: 'none',
      cursor: 'pointer',
      backgroundColor: isActive ? 'rgba(255,255,255,0.03)' : 'transparent',
      color: isActive ? activeColor : 'var(--text-muted)',
      fontWeight: isActive ? 600 : 500,
      borderBottom: isActive ? `2px solid ${activeColor}` : '2px solid transparent',
      transition: 'all 0.2s',
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0
    };
  }

  // Filter list data based on tab choice
  function getFilteredTopics(): TopicAnalytics[] {
    if (!data) return [];
    switch (activeTab) {
      case 'strong':
        return data.strong_topics;
      case 'moderate':
        return data.moderate_topics;
      case 'weak':
        return data.weak_topics;
      case 'all':
      default:
        return [
          ...data.strong_topics,
          ...data.moderate_topics,
          ...data.weak_topics
        ];
    }
  }
};

export default PerformanceDashboard;
