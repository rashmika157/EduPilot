import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Flame, Clock3, BookmarkCheck, CheckCircle2, Play, Hourglass, User as UserIcon, BookOpen, Clock } from 'lucide-react';
import { apiRequest } from '../api';
import { CollapsiblePanel } from '../components/CollapsiblePanel';

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await apiRequest('/api/dashboard/stats', { method: 'GET', requiresAuth: true });
        setProfile(data);
      } catch (err: any) {
        setError(err.message || 'Unable to load profile information.');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', padding: '24px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            borderRadius: '999px',
            border: '1px solid var(--border-color)',
            background: 'rgba(255,255,255,0.04)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '6px' }}>Personal Profile</div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>My Profile</h1>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        <CollapsiblePanel
          storageKey="edupilot_profile_details_collapsed"
          className="glass-card"
          headerStyle={{ padding: '20px 24px' }}
          contentStyle={{ padding: '24px' }}
          title={
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Account details</h2>
          }
          icon={<UserIcon size={18} color="var(--primary)" />}
        >
          {loading ? (
            <p style={{ color: 'var(--text-secondary)' }}>Loading profile...</p>
          ) : error ? (
            <p style={{ color: 'var(--danger)' }}>{error}</p>
          ) : (
            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <span style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '6px' }}>Name</span>
                <p style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 700 }}>{profile?.user_profile?.username || 'Student'}</p>
              </div>
              <div>
                <span style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '6px' }}>Email</span>
                <p style={{ margin: 0, color: 'var(--text-primary)' }}>{profile?.user_profile?.email || 'Not available'}</p>
              </div>
              <div>
                <span style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '6px' }}>Joined</span>
                <p style={{ margin: 0, color: 'var(--text-primary)' }}>{profile?.user_profile?.created_at ? new Date(profile.user_profile.created_at).toLocaleDateString() : '—'}</p>
              </div>
              <div>
                <span style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '6px' }}>Status</span>
                <p style={{ margin: 0, color: 'var(--text-primary)' }}>Active Learner</p>
              </div>
            </div>
          )}
        </CollapsiblePanel>

        <CollapsiblePanel
          storageKey="edupilot_profile_summary_collapsed"
          className="glass-card"
          headerStyle={{ padding: '20px 24px' }}
          contentStyle={{ padding: '24px' }}
          title={
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Learning summary</h2>
          }
          icon={<BookOpen size={18} color="var(--secondary)" />}
        >
          {loading ? (
            <p style={{ color: 'var(--text-secondary)' }}>Waiting for stats...</p>
          ) : error ? (
            <p style={{ color: 'var(--danger)' }}>{error}</p>
          ) : (
            <div style={{ display: 'grid', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Uploaded Notes</span>
                <strong style={{ color: 'var(--text-primary)' }}>{profile?.total_notes ?? '—'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Subjects Covered</span>
                <strong style={{ color: 'var(--text-primary)' }}>{profile?.subject_distribution?.length ?? '—'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Videos Watched</span>
                <strong style={{ color: 'var(--text-primary)' }}>{profile?.videos_watched ?? '—'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Average Quiz Score</span>
                <strong style={{ color: 'var(--text-primary)' }}>{profile?.quiz_score ?? '0%'}</strong>
              </div>
            </div>
          )}
        </CollapsiblePanel>
      </div>

      <CollapsiblePanel
        storageKey="edupilot_profile_activity_collapsed"
        className="glass-card"
        headerStyle={{ padding: '20px 24px' }}
        contentStyle={{ padding: '24px' }}
        title={
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Learning Activity</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 400 }}>A snapshot of your study progress and recent activity.</p>
          </div>
        }
        icon={<Clock size={18} color="var(--primary)" />}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px' }}>
          {[
            {
              icon: CalendarDays,
              label: 'Active Days This Month',
              value: profile?.activity?.active_days_this_month ?? '12 days'
            },
            {
              icon: Flame,
              label: 'Current Learning Streak',
              value: profile?.activity?.learning_streak ? `${profile.activity.learning_streak} days` : '5 days'
            },
            {
              icon: Clock3,
              label: 'Last Active',
              value: profile?.activity?.last_active ?? 'Today'
            },
            {
              icon: BookmarkCheck,
              label: 'Topics Completed',
              value: profile?.topics_completed ?? profile?.subject_distribution?.length ?? '4'
            },
            {
              icon: CheckCircle2,
              label: 'Quizzes Attempted',
              value: profile?.quizzes_attempted ?? profile?.quiz_attempts ?? '7'
            },
            {
              icon: Play,
              label: 'Videos Watched',
              value: profile?.videos_watched ?? '18'
            },
            {
              icon: Hourglass,
              label: 'Study Time',
              value: profile?.study_time ?? '7h 45m'
            }
          ].map((metric) => {
            const MetricIcon = metric.icon;
            return (
              <div key={metric.label} style={{ padding: '20px', borderRadius: '18px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '42px', height: '42px', borderRadius: '14px', background: 'rgba(139, 92, 246, 0.18)', color: 'var(--secondary)' }}>
                    <MetricIcon size={18} />
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{metric.label}</span>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>{metric.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CollapsiblePanel>
    </div>
  );
};

export default Profile;
