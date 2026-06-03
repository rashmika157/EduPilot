import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  UploadCloud, 
  BookOpen, 
  LogOut, 
  Compass, 
  User,
  X,
  Layers,
  Sparkles,
  Tv,
  ClipboardList,
  TrendingUp
} from 'lucide-react';


interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, username, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Upload Notes', path: '/upload', icon: UploadCloud },
    { name: 'Notes Library', path: '/library', icon: BookOpen },
    { name: 'Topic Viewer', path: '/topics', icon: Layers },
    { name: 'Learning Hub', path: '/learning-hub', icon: Tv },
    { name: 'AI Tutor', path: '/tutor', icon: Sparkles },
    { name: 'Quiz History', path: '/quiz-history', icon: ClipboardList },
    { name: 'Performance', path: '/performance', icon: TrendingUp },
  ];

  const handleLogout = () => {
    onLogout();
    navigate('/login');
    onClose();
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 40,
            transition: 'all 0.3s ease'
          }}
          className="md:hidden"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          width: 'var(--sidebar-width)',
          backgroundColor: 'rgba(19, 15, 46, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid var(--border-color)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)'
        }}
        className="md:translate-x-0"
      >
        {/* Sidebar Header */}
        <div style={{
          padding: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Compass size={28} color="var(--secondary)" className="floating" />
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.4rem',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #fff 30%, var(--primary) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>EduPilot</h1>
          </div>
          {/* Close button for mobile */}
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            className="md:hidden-btn"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Items */}
        <nav style={{ flex: 1, padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-sm)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500,
                  fontSize: '0.95rem',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  background: isActive ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(6, 182, 212, 0.05) 100%)' : 'transparent',
                  border: isActive ? '1px solid rgba(139, 92, 246, 0.25)' : '1px solid transparent',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                className={isActive ? 'sidebar-active' : 'sidebar-item'}
              >
                <Icon size={18} color={isActive ? 'var(--secondary)' : 'var(--text-secondary)'} />
                {item.name}
              </NavLink>
            );
          })}
        </nav>

        {/* User profile footer */}
        <div style={{
          padding: '20px 16px',
          borderTop: '1px solid var(--border-color)',
          background: 'rgba(11, 8, 27, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-full)',
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: '1rem',
              color: 'white',
              boxShadow: 'var(--shadow-sm)'
            }}>
              {username ? username.charAt(0).toUpperCase() : <User size={18} />}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{
                fontSize: '0.9rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>{username || 'Student Pilot'}</p>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Co-Pilot Class</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 'var(--radius-sm)',
              color: '#fca5a5',
              fontSize: '0.85rem',
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            className="sidebar-logout"
          >
            <LogOut size={16} />
            Eject Session
          </button>
        </div>
      </aside>

      {/* Styles for sidebar responsive display */}
      <style>{`
        @media (min-width: 769px) {
          aside {
            transform: translateX(0) !important;
          }
          .md\\:hidden {
            display: none !important;
          }
          .md\\:hidden-btn {
            display: none !important;
          }
        }
        .sidebar-item:hover {
          color: var(--text-primary) !important;
          background: rgba(255, 255, 255, 0.03) !important;
        }
        .sidebar-logout:hover {
          background: var(--danger) !important;
          color: white !important;
          border-color: var(--danger) !important;
        }
      `}</style>
    </>
  );
};
