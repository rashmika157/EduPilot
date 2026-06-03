import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  HardDrive, 
  Layers, 
  ArrowUpRight, 
  Plus, 
  Lightbulb, 
  Clock,
  Sparkles,
  BookOpen
} from 'lucide-react';
import { apiRequest } from '../api';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await apiRequest('/api/dashboard/stats', {
          method: 'GET',
          requiresAuth: true
        });
        setStats(data);
      } catch (err: any) {
        setError(err.message || 'Failed to retrieve flight data metrics.');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '60vh',
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-display)',
        fontSize: '1.2rem',
        gap: '12px'
      }}>
        <div style={{
          width: '24px',
          height: '24px',
          border: '3px solid var(--border-color)',
          borderTopColor: 'var(--secondary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <span>Syncing Dashboard telemetry...</span>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card" style={{ padding: '30px', textAlign: 'center', margin: '40px auto', maxWidth: '600px' }}>
        <h3 style={{ color: 'var(--danger)', marginBottom: '12px' }}>Connection Failure</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>{error}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry Handshake</button>
      </div>
    );
  }

  const username = stats?.user_profile?.username || 'Co-Pilot';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* Dynamic Welcoming Card */}
      <div className="glass-card" style={{
        padding: '30px 40px',
        background: 'linear-gradient(135deg, rgba(26, 21, 56, 0.6) 0%, rgba(139, 92, 246, 0.15) 100%)',
        borderLeft: '4px solid var(--secondary)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '24px'
      }}>
        <div>
          <h1 style={{ fontSize: '2.2rem', marginBottom: '8px', fontFamily: 'var(--font-display)', fontWeight: 800 }}>
            Welcome to the Cockpit, <span style={{
              background: 'linear-gradient(135deg, #fff 0%, var(--secondary) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>{username}</span>! 🚀
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: '600px' }}>
            EduPilot helps you catalog your engineering, medical, or school study materials inline. Ready for another high-altitude study session?
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-primary" onClick={() => navigate('/upload')}>
            <Plus size={18} />
            Upload PDF
          </button>
          <button className="btn btn-ghost" onClick={() => navigate('/library')}>
            <BookOpen size={18} />
            Library
          </button>
        </div>
      </div>

      {/* Grid Statistics Counters */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px'
      }}>
        {/* Metric 1 */}
        <div className="glass-card stat-card">
          <div className="stat-icon primary">
            <FileText size={24} />
          </div>
          <div className="stat-info">
            <h4>Uploaded Sets</h4>
            <p>{stats?.total_notes || 0}</p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="glass-card stat-card">
          <div className="stat-icon secondary">
            <HardDrive size={24} />
          </div>
          <div className="stat-info">
            <h4>Cloud Weight</h4>
            <p>{formatBytes(stats?.total_size_bytes)}</p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="glass-card stat-card">
          <div className="stat-icon success">
            <Layers size={24} />
          </div>
          <div className="stat-info">
            <h4>Active Subjects</h4>
            <p>{stats?.subject_distribution?.length || 0}</p>
          </div>
        </div>
      </div>

      {/* Main Panel Content Split */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '30px',
        alignItems: 'start'
      }} className="dashboard-grid">
        
        {/* Left Side: Recent Notes */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem' }}>
              <Clock size={18} color="var(--primary)" />
              Recent Notebooks
            </h3>
            {stats?.recent_notes?.length > 0 && (
              <a onClick={() => navigate('/library')} style={{
                fontSize: '0.85rem',
                color: 'var(--secondary)',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                Full Vault
                <ArrowUpRight size={14} />
              </a>
            )}
          </div>

          {(!stats?.recent_notes || stats.recent_notes.length === 0) ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'var(--text-secondary)'
            }}>
              <p style={{ marginBottom: '16px' }}>No PDFs uploaded yet. Let's upload your first study set!</p>
              <button className="btn btn-ghost" onClick={() => navigate('/upload')}>
                <Plus size={16} />
                Create First Entry
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {stats.recent_notes.map((note: any) => (
                <div 
                  key={note.id}
                  onClick={() => navigate('/library')}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px',
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  className="recent-note-row"
                >
                  <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <p style={{
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>{note.title}</p>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Added {new Date(note.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: '16px' }}>
                    <span className="badge badge-subject">{note.subject}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {formatBytes(note.file_size)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Tips and Quick Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Study Tips Card */}
          <div className="glass-card" style={{
            padding: '24px',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.05) 100%)',
          }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', marginBottom: '16px' }}>
              <Lightbulb size={18} color="var(--warning)" />
              Weekly Pilot Guidelines
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {stats?.study_tips?.map((tip: string, idx: number) => (
                <div key={idx} style={{
                  padding: '12px',
                  backgroundColor: 'rgba(11, 8, 27, 0.4)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem',
                  lineHeight: '1.4',
                  color: 'var(--text-secondary)',
                  borderLeft: '2px solid var(--primary)'
                }}>
                  {tip}
                </div>
              )) || (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No telemetry tips loaded.</p>
              )}
            </div>
          </div>

          {/* Quick Motivation Card */}
          <div className="glass-card" style={{
            padding: '20px',
            textAlign: 'center',
            background: 'radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 80%)'
          }}>
            <Sparkles size={28} color="var(--secondary)" className="floating" style={{ margin: '0 auto 12px auto' }} />
            <h4 style={{ fontSize: '0.95rem', marginBottom: '4px', fontFamily: 'var(--font-display)' }}>Study Tracker</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Keep logging study notes regularly. Organizing materials makes revisions 3x faster!
            </p>
          </div>
        </div>

      </div>

      <style>{`
        @media (max-width: 992px) {
          .dashboard-grid {
            grid-template-columns: 1fr !important;
          }
        }
        .recent-note-row:hover {
          background-color: rgba(255, 255, 255, 0.05) !important;
          border-color: rgba(139, 92, 246, 0.3) !important;
          transform: translateX(3px);
        }
      `}</style>
    </div>
  );
};
