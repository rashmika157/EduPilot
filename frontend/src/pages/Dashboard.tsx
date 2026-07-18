import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Layers, 
  Plus, 
  Clock,
  BookOpen
} from 'lucide-react';
import { apiRequest } from '../api';

import { CollapsiblePanel } from '../components/CollapsiblePanel';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await apiRequest('/api/dashboard/stats', {
          method: 'GET',
          requiresAuth: true
        });
        setStats(data);
      } catch (err: any) {
        setError(err.message || 'Failed to retrieve academic metrics.');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

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

  const username = stats?.user_profile?.username || 'Student';

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
          <h1 style={{ fontSize: '2.2rem', margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800 }}>
            Welcome to EduPilot, <span style={{
              background: 'linear-gradient(135deg, #fff 0%, var(--secondary) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>{username}</span>! 🚀
          </h1>
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
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '20px'
      }}>
        {/* Metric 1 */}
        <div className="glass-card stat-card">
          <div className="stat-icon primary">
            <FileText size={24} />
          </div>
          <div className="stat-info">
            <h4>Uploaded Notes</h4>
            <p>{stats?.total_notes || 0}</p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="glass-card stat-card">
          <div className="stat-icon success">
            <Layers size={24} />
          </div>
          <div className="stat-info">
            <h4>Subjects</h4>
            <p>{stats?.subject_distribution?.length || 0}</p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="glass-card stat-card">
          <div className="stat-icon secondary">
            <Clock size={24} />
          </div>
          <div className="stat-info">
            <h4>Today’s Learning Hours</h4>
            <p>{stats?.todays_learning_hours ?? 0}h</p>
          </div>
        </div>

      </div>

      {/* Main Panel Content */}
      <div style={{ width: '100%' }}>
        
        {/* Recent Study Materials */}
        <CollapsiblePanel
          storageKey="edupilot_db_recent_collapsed"
          className="glass-card"
          headerStyle={{ padding: '20px 24px' }}
          contentStyle={{ padding: '24px' }}
          title={
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem', margin: 0 }}>
              Recent Study Materials
            </h3>
          }
          icon={<Clock size={18} color="var(--primary)" />}
        >
          {(!stats?.recent_study_materials || stats.recent_study_materials.length === 0) ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'var(--text-secondary)'
            }}>
              <p style={{ marginBottom: '16px' }}>No recent study materials. Upload a PDF to start learning.</p>
              <button className="btn btn-ghost" onClick={() => navigate('/upload')}>
                <Plus size={16} />
                Upload Notes
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '14px' }}>
              {stats.recent_study_materials.map((material: any) => (
                <div
                  key={material.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    padding: '18px 22px',
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '18px', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                      <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{material.title}</p>
                      <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{material.subject}</p>
                    </div>
                    <div style={{ flex: '0 0 auto', textAlign: 'right' }}>
                      <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--secondary)', fontWeight: 700 }}>{material.progress_percentage}% Completed</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-primary"
                      style={{ padding: '10px 18px', minWidth: '170px' }}
                      onClick={() => navigate(`/learning-hub?noteId=${material.id}`)}
                    >
                      Continue Learning →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsiblePanel>

      </div>

      {showProfileModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }} onClick={() => setShowProfileModal(false)}>
          <div style={{
            width: 'min(520px, calc(100% - 40px))',
            backgroundColor: 'rgba(15, 12, 35, 0.98)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            padding: '28px',
            boxShadow: '0 30px 80px rgba(0,0,0,0.35)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>My Profile</h2>
                <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Personal details and learning summary.</p>
              </div>
              <button
                onClick={() => setShowProfileModal(false)}
                style={{
                  background: 'none',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '50%',
                  width: '38px',
                  height: '38px',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  lineHeight: 1
                }}
                aria-label="Close profile modal"
              >
                ×
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
              <div style={{ display: 'grid', gap: '14px' }}>
                <div>
                  <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '6px' }}>Name</span>
                  <p style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 700 }}>{stats?.user_profile?.username || username}</p>
                </div>
                <div>
                  <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '6px' }}>Email</span>
                  <p style={{ margin: 0, color: 'var(--text-primary)' }}>{stats?.user_profile?.email || 'Not available'}</p>
                </div>
                <div>
                  <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '6px' }}>Joined</span>
                  <p style={{ margin: 0, color: 'var(--text-primary)' }}>{stats?.user_profile?.created_at ? new Date(stats.user_profile.created_at).toLocaleDateString() : '—'}</p>
                </div>
              </div>
              <div style={{ display: 'grid', gap: '14px' }}>
                <div>
                  <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '6px' }}>Uploaded Notes</span>
                  <p style={{ margin: 0, color: 'var(--text-primary)' }}>{stats?.total_notes || 0}</p>
                </div>
                <div>
                  <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '6px' }}>Subjects Covered</span>
                  <p style={{ margin: 0, color: 'var(--text-primary)' }}>{stats?.subject_distribution?.length || 0}</p>
                </div>
                <div>
                  <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '6px' }}>Videos Watched</span>
                  <p style={{ margin: 0, color: 'var(--text-primary)' }}>{stats?.videos_watched || 0}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`
        .recent-note-row:hover {
          background-color: rgba(255, 255, 255, 0.05) !important;
          border-color: rgba(139, 92, 246, 0.3) !important;
          transform: translateX(3px);
        }
      `}</style>
    </div>
  );
};
