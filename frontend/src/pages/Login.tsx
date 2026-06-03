import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Compass, Mail, Lock, ShieldAlert, ArrowRight } from 'lucide-react';
import { apiRequest } from '../api';

interface LoginProps {
  onLoginSuccess: (token: string, username: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all credentials.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Submit login payload
      const response = await apiRequest('/api/auth/login', {
        method: 'POST',
        requiresAuth: false,
        body: JSON.stringify({ email, password })
      });

      // 2. Fetch dashboard/user details to retrieve username
      // Since registration returns username, but login returns just the token,
      // we can fetch user profile details using the token we just received
      const token = response.access_token;
      
      // Save token temporarily so API client can use it for authentication immediately
      localStorage.setItem('edupilot_token', token);

      const statsResponse = await apiRequest('/api/dashboard/stats', {
        method: 'GET',
        requiresAuth: true
      });

      const username = statsResponse.user_profile.username;
      
      // Notify App component of successful login
      onLoginSuccess(token, username);
      navigate('/');
    } catch (err: any) {
      // Clear token if set in failed attempt
      localStorage.removeItem('edupilot_token');
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="glass-card auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <Compass size={40} color="var(--secondary)" className="floating" />
            <span>EduPilot</span>
          </div>
          <p className="auth-subtitle">Welcome back, Cadet! Power up your engines.</p>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 16px',
            color: '#fca5a5',
            fontSize: '0.9rem',
            marginBottom: '20px'
          }}>
            <ShieldAlert size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">
              <Mail size={16} />
              Email Address
            </label>
            <input
              type="email"
              placeholder="cadet@academy.edu"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '28px' }}>
            <label className="form-label">
              <Lock size={16} />
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px', borderRadius: 'var(--radius-sm)' }}
            disabled={loading}
          >
            {loading ? 'Initializing Core...' : (
              <>
                Ignition & Login
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          New to the crew?{' '}
          <Link to="/register" className="auth-link">
            Enlist Here &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
};
