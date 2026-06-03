import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';

// Component imports
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';

// Page imports
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { UploadNotes } from './pages/UploadNotes';
import { NotesLibrary } from './pages/NotesLibrary';
import { TopicViewer } from './pages/TopicViewer';
import { AITutor } from './pages/AITutor';
import { LearningHub } from './pages/LearningHub';
import { QuizHistory } from './pages/QuizHistory';
import { PerformanceDashboard } from './pages/PerformanceDashboard';

// Main App component wrapping router
const AppContent: React.FC = () => {
  const location = useLocation();
  
  // Authentication states loaded from local storage
  const [token, setToken] = useState<string | null>(localStorage.getItem('edupilot_token'));
  const [username, setUsername] = useState<string>(localStorage.getItem('edupilot_username') || '');
  
  // Responsive sidebar toggles
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Auto-listen to unauthorized event (token expirations)
  useEffect(() => {
    const handleUnauthorized = () => {
      setToken(null);
      setUsername('');
    };

    window.addEventListener('unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('unauthorized', handleUnauthorized);
    };
  }, []);

  const handleLoginSuccess = (userToken: string, name: string) => {
    localStorage.setItem('edupilot_token', userToken);
    localStorage.setItem('edupilot_username', name);
    setToken(userToken);
    setUsername(name);
  };

  const handleLogout = () => {
    localStorage.removeItem('edupilot_token');
    localStorage.removeItem('edupilot_username');
    setToken(null);
    setUsername('');
  };

  // Determine current page header title
  const getHeaderTitle = () => {
    switch (location.pathname) {
      case '/':
        return 'Dashboard Summary';
      case '/upload':
        return 'Upload Study Materials';
      case '/library':
        return 'Personal Study Vault';
      case '/topics':
        return 'Topic Analysis & Exploration';
      case '/learning-hub':
        return 'Learning Hub';
      case '/tutor':
        return 'AI Study Assistant';
      case '/quiz-history':
        return 'Quiz Assessment History';
      case '/performance':
        return 'Performance & Metrics';
      default:
        return 'EduPilot Cockpit';
    }
  };

  // Auth Guard
  const isAuthenticated = !!token;

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLoginSuccess={handleLoginSuccess} />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="app-container">
      
      {/* Sidebar navigation */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        username={username}
        onLogout={handleLogout}
      />
      
      {/* Main viewport panels */}
      <div className="app-content">
        
        {/* Dynamic header details */}
        <Header 
          title={getHeaderTitle()} 
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
        />
        
        {/* Main nested page grids */}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/upload" element={<UploadNotes />} />
            <Route path="/library" element={<NotesLibrary />} />
            <Route path="/topics" element={<TopicViewer />} />
            <Route path="/learning-hub" element={<LearningHub />} />
            <Route path="/tutor" element={<AITutor />} />
            <Route path="/quiz-history" element={<QuizHistory />} />
            <Route path="/performance" element={<PerformanceDashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        
      </div>
      
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};

export default App;
