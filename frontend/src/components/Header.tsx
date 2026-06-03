import React from 'react';
import { Menu, Calendar } from 'lucide-react';

interface HeaderProps {
  title: string;
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, onToggleSidebar }) => {
  // Format current date beautifully
  const getFormattedDate = () => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    };
    return new Date().toLocaleDateString('en-US', options);
  };

  return (
    <header style={{
      height: 'var(--header-height)',
      backgroundColor: 'rgba(11, 8, 27, 0.5)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border-color)',
      padding: '0 30px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 30
    }}>
      {/* Mobile Toggle & Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={onToggleSidebar}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px',
            borderRadius: 'var(--radius-sm)',
            transition: 'background-color 0.2s'
          }}
          className="mobile-toggle-btn md:hidden"
        >
          <Menu size={24} />
        </button>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-display)',
          letterSpacing: '-0.01em'
        }}>{title}</h2>
      </div>

      {/* Date badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 14px',
        backgroundColor: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-full)',
        fontSize: '0.85rem',
        color: 'var(--text-secondary)'
      }} className="header-date">
        <Calendar size={14} color="var(--secondary)" />
        <span>{getFormattedDate()}</span>
      </div>

      <style>{`
        @media (max-width: 768px) {
          header {
            padding: 0 16px;
          }
          .header-date {
            display: none !important;
          }
        }
        @media (min-width: 769px) {
          .mobile-toggle-btn {
            display: none !important;
          }
        }
      `}</style>
    </header>
  );
};
