import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  BookOpen, 
  Trash2, 
  Eye, 
  Download, 
  Filter, 
  X,
  HardDrive,
  Layers
} from 'lucide-react';
import { apiRequest, API_BASE_URL } from '../api';

const SUBJECT_CATEGORIES = [
  'All',
  'Computer Science',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Literature',
  'History',
  'Business',
  'Engineering',
  'Medicine',
  'Other'
];

export const NotesLibrary: React.FC = () => {
  const navigate = useNavigate();
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('All');
  
  // View Modal state
  const [activeViewNote, setActiveViewNote] = useState<any | null>(null);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Build query string
      let endpoint = '/api/notes';
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedSubject && selectedSubject !== 'All') params.append('subject', selectedSubject);
      
      const queryStr = params.toString();
      if (queryStr) endpoint += `?${queryStr}`;

      const data = await apiRequest(endpoint, {
        method: 'GET',
        requiresAuth: true
      });
      setNotes(data);
    } catch (err: any) {
      setError(err.message || 'Failed to sync note package archives.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch when filters change
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchNotes();
    }, 300); // 300ms debounce to avoid overwhelming backend on typing

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, selectedSubject]);

  const handleDelete = async (noteId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this study package?')) return;

    try {
      await apiRequest(`/api/notes/${noteId}`, {
        method: 'DELETE',
        requiresAuth: true
      });
      // Filter out deleted note
      setNotes(notes.filter(note => note.id !== noteId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete note');
    }
  };

  const handleDownload = (note: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const token = localStorage.getItem('edupilot_token');
    
    // Trigger download by opening direct API link with authorization token in a new tab
    // Wait, to download with authorization header cleanly, we can fetch, convert to blob, and trigger a click.
    // Or we can append the token as a query parameter if supported, but fetch is cleaner to prevent session issues.
    // Let's do secure fetch blob download:
    fetch(`${API_BASE_URL}/api/notes/${note.id}/file`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(resp => {
      if (!resp.ok) throw new Error('File download failed');
      return resp.blob();
    })
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = note.title.endsWith('.pdf') ? note.title : `${note.title}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    })
    .catch(err => {
      alert('Could not download file: ' + err.message);
    });
  };

  const openViewer = (note: any) => {
    const token = localStorage.getItem('edupilot_token');
    // For direct preview in iframe, we can convert PDF to object URL so headers are verified!
    // This is incredibly robust compared to raw links!
    fetch(`${API_BASE_URL}/api/notes/${note.id}/file`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(resp => {
      if (!resp.ok) throw new Error('Could not open preview');
      return resp.blob();
    })
    .then(blob => {
      const blobUrl = window.URL.createObjectURL(blob);
      setActiveViewNote({
        ...note,
        blobUrl
      });
    })
    .catch(err => {
      alert('Could not launch PDF viewer: ' + err.message);
    });
  };

  const closeViewer = () => {
    if (activeViewNote?.blobUrl) {
      window.URL.revokeObjectURL(activeViewNote.blobUrl);
    }
    setActiveViewNote(null);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Library Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h1 style={{ fontSize: '2rem', fontFamily: 'var(--font-display)', fontWeight: 800 }}>Notes Vault</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Review, search, and view your uploaded study libraries inline.</p>
        </div>
      </div>

      {/* Search & Subject Filters */}
      <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Search Input */}
        <div style={{ position: 'relative', width: '100%' }}>
          <Search size={18} color="var(--text-muted)" style={{
            position: 'absolute',
            left: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none'
          }} />
          <input 
            type="text"
            placeholder="Search notebook by title..."
            className="form-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '48px' }}
          />
        </div>

        {/* Categories Horizontal Scroll Pills */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{
            fontSize: '0.8rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Filter size={12} />
            Filter by Subject
          </p>
          <div style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '6px',
            scrollBehavior: 'smooth'
          }} className="category-scroll">
            {SUBJECT_CATEGORIES.map((subj) => {
              const isActive = selectedSubject === subj;
              return (
                <button
                  key={subj}
                  onClick={() => setSelectedSubject(subj)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-full)',
                    border: isActive ? '1px solid var(--secondary)' : '1px solid var(--border-color)',
                    background: isActive ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.25) 0%, rgba(139, 92, 246, 0.1) 100%)' : 'rgba(255, 255, 255, 0.02)',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontSize: '0.85rem',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s ease'
                  }}
                  className="subject-pill"
                >
                  {subj}
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* Notes Display Section */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
          <div style={{
            width: '24px',
            height: '24px',
            border: '3px solid var(--border-color)',
            borderTopColor: 'var(--secondary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 12px auto'
          }} />
          <p>Syncing catalog...</p>
        </div>
      ) : error ? (
        <div className="glass-card" style={{ padding: '24px', textAlign: 'center', color: 'var(--danger)' }}>
          <p>{error}</p>
        </div>
      ) : notes.length === 0 ? (
        <div className="glass-card" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <BookOpen size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px auto', display: 'block' }} className="floating" />
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>No Notes Found</h3>
          <p style={{ maxWidth: '400px', margin: '0 auto' }}>
            We couldn't locate any study files matching these filters. Try adjusting your query or upload a new notebook!
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '20px'
        }}>
          {notes.map((note) => (
            <div 
              key={note.id} 
              className="glass-card" 
              style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                height: '100%',
                position: 'relative'
              }}
            >
              {/* Top Row: Subject & Size */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge badge-subject">{note.subject}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <HardDrive size={12} />
                  {formatSize(note.file_size)}
                </span>
              </div>

              {/* Title & Desc */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h3 style={{
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  lineHeight: '1.3',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical'
                }} title={note.title}>{note.title}</h3>
                
                {note.description ? (
                  <p style={{
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.5',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical'
                  }}>{note.description}</p>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No description logs.</p>
                )}
              </div>

              {/* Bottom Row: Actions */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '16px',
                borderTop: '1px solid var(--border-color)',
                marginTop: 'auto'
              }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {new Date(note.created_at).toLocaleDateString()}
                </span>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => openViewer(note)}
                    className="btn btn-ghost" 
                    style={{ padding: '8px 12px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)' }}
                    title="View PDF Inline"
                  >
                    <Eye size={14} />
                    View
                  </button>
                  <button 
                    onClick={() => navigate(`/topics?noteId=${note.id}`)}
                    className="btn btn-ghost" 
                    style={{ padding: '8px 12px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)' }}
                    title="View Topics"
                  >
                    <Layers size={14} />
                    View Topics
                  </button>
                  <button 
                    onClick={(e) => handleDownload(note, e)}
                    className="btn btn-ghost" 
                    style={{ padding: '8px 12px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)' }}
                    title="Download PDF"
                  >
                    <Download size={14} />
                  </button>
                  <button 
                    onClick={(e) => handleDelete(note.id, e)}
                    className="btn btn-danger" 
                    style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}
                    title="Delete Note"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* PDF View Modal Overlay */}
      {activeViewNote && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(5, 3, 15, 0.85)',
          backdropFilter: 'blur(10px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '1000px',
            height: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'rgba(19, 15, 46, 0.9)'
            }}>
              <div style={{ minWidth: 0, flex: 1, marginRight: '16px' }}>
                <h3 style={{
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>{activeViewNote.title}</h3>
                <span className="badge badge-subject" style={{ marginTop: '4px' }}>{activeViewNote.subject}</span>
              </div>
              <button 
                onClick={closeViewer}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                className="close-modal-btn"
              >
                <X size={20} />
              </button>
            </div>

            {/* PDF Render Body */}
            <div style={{ flex: 1, backgroundColor: '#1e1e1e', position: 'relative' }}>
              <iframe 
                src={`${activeViewNote.blobUrl}#toolbar=1`}
                width="100%"
                height="100%"
                style={{ border: 'none' }}
                title={activeViewNote.title}
              />
            </div>
          </div>
        </div>
      )}

      <style>{`
        .subject-pill:hover {
          color: var(--text-primary) !important;
          border-color: var(--text-muted) !important;
        }
        .close-modal-btn:hover {
          background-color: rgba(239, 68, 68, 0.15) !important;
          color: #fca5a5 !important;
          border-color: rgba(239, 68, 68, 0.3) !important;
        }
        .category-scroll::-webkit-scrollbar {
          height: 4px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
