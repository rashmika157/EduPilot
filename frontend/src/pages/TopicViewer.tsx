import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  ChevronDown, 
  ChevronRight, 
  RefreshCw, 
  AlertTriangle, 
  Layers, 
  Search, 
  FileText, 
  HelpCircle,
  FolderOpen,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { apiRequest } from '../api';
import { QuizPanel } from '../components/QuizPanel';
import { CollapsiblePanel, useSessionPanelState } from '../components/CollapsiblePanel';

interface Subtopic {
  id: number;
  topic_id: number;
  parent_id?: number | null;
  title: string;
  created_at: string;
  children?: Subtopic[];
}

interface Topic {
  id: number;
  note_id: number;
  title: string;
  created_at: string;
  subtopics: Subtopic[];
}

interface Note {
  id: number;
  title: string;
  subject: string;
  description: string | null;
  file_size: number;
  owner_id: number;
  topic_extraction_status: 'pending' | 'processing' | 'completed' | 'failed';
  extraction_confidence: number | null;
  created_at: string;
  topics: Topic[];
}

export const TopicViewer: React.FC = () => {
  const [searchParams] = useSearchParams();
  const noteIdParam = searchParams.get('noteId');

  // State
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTopics, setExpandedTopics] = useState<Record<number, boolean>>({});
  const [actionLoading, setActionLoading] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useSessionPanelState('edupilot_tv_left_collapsed', false);

  // Polling ref to avoid effect closure stale state
  const pollTimerRef = useRef<any>(null);

  // Quiz states
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [quizTopic, setQuizTopic] = useState<string>('');
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState(false);

  const handleTriggerQuiz = async (topicTitle: string) => {
    if (!selectedNote) return;
    setLoadingQuiz(true);
    setQuizTopic(topicTitle);
    try {
      const token = localStorage.getItem('edupilot_token');
      const response = await fetch('http://127.0.0.1:8000/api/quiz/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          note_id: selectedNote.id,
          topic_title: topicTitle
        })
      });
      if (response.ok) {
        const data = await response.json();
        setQuizQuestions(data);
        setShowQuizModal(true);
      } else {
        alert("Failed to generate quiz for this topic.");
      }
    } catch (err) {
      console.error("Failed to generate quiz:", err);
      alert("Error contacting quiz generator service.");
    } finally {
      setLoadingQuiz(false);
    }
  };

  // Suppress unused error warning
  if (error) {
    console.warn("TopicViewer error state:", error);
  }

  // Fetch all notes on load
  const fetchNotes = async (selectId?: number, silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError('');
      
      const data = await apiRequest('/api/notes/with-topics', {
        method: 'GET',
        requiresAuth: true
      });
      
      setNotes(data);

      // Determine which note to select
      let targetNote = null;
      if (selectId) {
        targetNote = data.find((n: Note) => n.id === selectId);
      } else if (noteIdParam) {
        targetNote = data.find((n: Note) => n.id === parseInt(noteIdParam));
      } else if (selectedNote) {
        targetNote = data.find((n: Note) => n.id === selectedNote.id);
      }
      
      if (!targetNote && data.length > 0) {
        targetNote = data[0];
      }
      
      setSelectedNote(targetNote || null);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve note archives.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
    return () => {
      stopPolling();
    };
  }, []);

  const hasActiveExtraction = notes.some((note) =>
    note.topic_extraction_status === 'pending' ||
    note.topic_extraction_status === 'processing'
  );

  const startPolling = () => {
    stopPolling();
    pollTimerRef.current = setInterval(async () => {
      await fetchNotes(selectedNote?.id, true);
    }, 2500);
  };

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (hasActiveExtraction) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [hasActiveExtraction, selectedNote?.id]);

  // Trigger or retry topic extraction
  const handleExtract = async () => {
    if (!selectedNote) return;
    try {
      setActionLoading(true);
      await apiRequest(`/api/notes/${selectedNote.id}/topics/extract`, {
        method: 'POST',
        requiresAuth: true
      });
      
      // Update local state to pending so polling kicks off
      const pendingNote = {
        ...selectedNote,
        topic_extraction_status: 'pending' as const,
        topics: []
      };
      
      setNotes(prev => prev.map(n => n.id === selectedNote.id ? pendingNote : n));
      setSelectedNote(pendingNote);
    } catch (err: any) {
      alert('Could not trigger extraction: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const toggleTopic = (id: number) => {
    setExpandedTopics(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const expandAll = () => {
    if (!selectedNote?.topics) return;
    const allExpanded: Record<number, boolean> = {};
    selectedNote.topics.forEach(t => {
      allExpanded[t.id] = true;
    });
    setExpandedTopics(allExpanded);
  };

  const collapseAll = () => {
    setExpandedTopics({});
  };

  // Filter notes list by search box
  const filteredNotes = notes.filter(n => 
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="topic-container" style={{ 
      display: 'flex', 
      gap: '30px', 
      minHeight: 'calc(100vh - 160px)',
      overflow: 'hidden'
    }}>
      
      {/* Left Column: Study Materials Sidebar */}
      <div style={{
        width: leftCollapsed ? '60px' : '320px',
        minWidth: leftCollapsed ? '60px' : '320px',
        backgroundColor: 'rgba(255,255,255,0.01)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1), min-width 300ms cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        <div 
          onClick={() => leftCollapsed && setLeftCollapsed(false)}
          style={{
            padding: '16px 20px',
            borderBottom: leftCollapsed ? 'none' : '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: leftCollapsed ? 'center' : 'space-between',
            gap: '10px',
            cursor: leftCollapsed ? 'pointer' : 'default',
            userSelect: 'none'
          }}
        >
          {leftCollapsed ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <FolderOpen size={18} color="var(--primary)" />
              <ChevronRight size={18} />
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, overflow: 'hidden' }}>
                <FolderOpen size={18} color="var(--primary)" />
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                  Study Materials
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLeftCollapsed(true);
                }}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '999px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  flexShrink: 0
                }}
              >
                <ChevronDown size={18} />
              </button>
            </>
          )}
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          opacity: leftCollapsed ? 0 : 1,
          transition: 'opacity 200ms ease',
          overflow: 'hidden',
          pointerEvents: leftCollapsed ? 'none' : 'auto',
          minWidth: '320px',
          gap: '20px',
          padding: '20px'
        }}>
          {/* Search box */}
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={16} color="var(--text-muted)" style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none'
            }} />
            <input 
              type="text"
              placeholder="Filter books..."
              className="form-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '38px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px', fontSize: '0.85rem' }}
            />
          </div>

          {/* Notebooks List */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  border: '2px solid var(--border-color)',
                  borderTopColor: 'var(--secondary)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 8px auto'
                }} />
                <p style={{ fontSize: '0.8rem' }}>Loading archive...</p>
              </div>
            ) : filteredNotes.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No notebooks found.</p>
            ) : (
              filteredNotes.map((note) => {
                const isSelected = selectedNote?.id === note.id;
                const hasFailed = note.topic_extraction_status === 'failed';
                const isProcessing = note.topic_extraction_status === 'pending' || note.topic_extraction_status === 'processing';
                
                return (
                  <button
                    key={note.id}
                    onClick={() => setSelectedNote(note)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: 'var(--radius-sm)',
                      border: isSelected ? '1px solid var(--secondary)' : '1px solid transparent',
                      background: isSelected 
                        ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(139, 92, 246, 0.05) 100%)' 
                        : 'rgba(255, 255, 255, 0.02)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                    className={`notebook-btn ${isSelected ? 'active' : ''}`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <span className="badge badge-subject" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                        {note.subject}
                      </span>
                      
                      {/* Status Dot */}
                      {isProcessing && (
                        <span className="pulse-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--warning)' }} title="Extracting topics..." />
                      )}
                      {hasFailed && (
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--danger)' }} title="Extraction failed" />
                      )}
                      {note.topic_extraction_status === 'completed' && (
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)' }} title="Topics generated" />
                      )}
                    </div>
                    
                    <p style={{
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      width: '100%'
                    }}>{note.title}</p>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Topics tree renderer */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, minWidth: 0 }}>
        
        {selectedNote ? (
          <CollapsiblePanel
            storageKey="edupilot_tv_topics_collapsed"
            className="glass-card"
            headerStyle={{ padding: '24px 30px' }}
            contentStyle={{ padding: '0 30px 30px 30px', display: 'flex', flexDirection: 'column', gap: '24px' }}
            title={selectedNote.title}
            icon={<FileText size={20} color="var(--secondary)" />}
            actionButtons={
              selectedNote.topic_extraction_status === 'completed' && selectedNote.topics && selectedNote.topics.length > 0 ? (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={expandAll} className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Expand All</button>
                  <button onClick={collapseAll} className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Collapse All</button>
                  <button 
                    onClick={handleExtract} 
                    className="btn btn-ghost" 
                    style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    disabled={actionLoading}
                    title="Run PyMuPDF scan again"
                  >
                    <RefreshCw size={12} className={actionLoading ? 'spin-icon' : ''} />
                    Re-extract
                  </button>
                </div>
              ) : undefined
            }
          >
            
            {/* Header Info / Meta bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px', paddingTop: '10px' }}>
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Subject: <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{selectedNote.subject}</span>
                  {selectedNote.description && ` • ${selectedNote.description}`}
                </p>
              </div>
            </div>

            {/* Tree Rendering Area */}
            <div style={{ flex: 1 }}>
              
              {/* PENDING / PROCESSING LOADERS */}
              {(selectedNote.topic_extraction_status === 'pending' || selectedNote.topic_extraction_status === 'processing') && (
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  padding: '60px 20px', 
                  textAlign: 'center',
                  background: 'rgba(11, 8, 27, 0.25)',
                  border: '1px dashed var(--border-color)',
                  borderRadius: 'var(--radius-md)'
                }}>
                  {/* Radar Scanning animation mockup */}
                  <div style={{ 
                    position: 'relative', 
                    width: '80px', 
                    height: '80px', 
                    borderRadius: '50%', 
                    border: '1px solid rgba(6, 182, 212, 0.25)', 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '20px'
                  }} className="glow-pulse">
                    <Layers size={32} color="var(--secondary)" className="floating" />
                    <div style={{
                      position: 'absolute',
                      inset: '-10px',
                      border: '1px solid rgba(139, 92, 246, 0.15)',
                      borderRadius: '50%',
                      animation: 'spin 4s linear infinite'
                    }} />
                  </div>
                  
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Analyzing Study Material...</h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '400px', marginBottom: '16px' }}>
                    We are scanning your note structure, extracting outlines, and identifying key topics.
                  </p>
                  
                  {/* Status Indicator */}
                  <span className="badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#fcd34d' }}>
                    Status: {selectedNote.topic_extraction_status === 'pending' ? 'Queued' : 'Scanning Pages...'}
                  </span>

                  <button 
                    onClick={handleExtract}
                    className="btn btn-secondary"
                    style={{ marginTop: '20px', fontSize: '0.85rem' }}
                    disabled={actionLoading}
                  >
                    <RefreshCw size={14} className={actionLoading ? 'spin-icon' : ''} style={{ marginRight: '6px' }} />
                    Force Start Extraction
                  </button>

                  {/* Skeletons */}
                  <div style={{ width: '100%', maxWidth: '450px', marginTop: '30px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ height: '14px', width: '70%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', animation: 'skeleton-pulse 1.5s infinite' }} />
                    <div style={{ height: '14px', width: '90%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', animation: 'skeleton-pulse 1.5s infinite', animationDelay: '0.3s' }} />
                    <div style={{ height: '14px', width: '50%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', animation: 'skeleton-pulse 1.5s infinite', animationDelay: '0.6s' }} />
                  </div>
                </div>
              )}

              {/* FAILED STATE */}
              {selectedNote.topic_extraction_status === 'failed' && (
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  padding: '50px 20px', 
                  textAlign: 'center',
                  background: 'rgba(239, 68, 68, 0.05)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: 'var(--radius-md)'
                }}>
                  <AlertTriangle size={48} color="var(--danger)" style={{ marginBottom: '16px' }} />
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: '#fca5a5' }}>Topic Extraction Crashed</h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '450px', marginBottom: '24px' }}>
                    An error occurred during note processing. This might be due to a corrupted file, formatting, or database sync issue.
                  </p>
                  <button onClick={handleExtract} className="btn btn-secondary" disabled={actionLoading}>
                    <RefreshCw size={14} className={actionLoading ? 'spin-icon' : ''} />
                    Force Re-extraction
                  </button>
                </div>
              )}

              {/* COMPLETED EMPTY STATE */}
              {selectedNote.topic_extraction_status === 'completed' && (!selectedNote.topics || selectedNote.topics.length === 0) && (
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  padding: '50px 20px', 
                  textAlign: 'center',
                  background: 'rgba(11, 8, 27, 0.25)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)'
                }}>
                  <HelpCircle size={44} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>No Topics Identified</h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '400px', marginBottom: '20px' }}>
                    We scanned the PDF but could not find distinct structural sections or outline tags.
                  </p>
                  <button onClick={handleExtract} className="btn btn-ghost" style={{ fontSize: '0.9rem' }}>
                    <RefreshCw size={14} />
                    Try Extraction Heuristics Again
                  </button>
                </div>
              )}

              {/* COMPLETED TREE STRUCTURE */}
              {selectedNote.topic_extraction_status === 'completed' && selectedNote.topics && selectedNote.topics.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {selectedNote.topics.map((topic) => {
                    const isOpen = !!expandedTopics[topic.id];
                    return (
                      <div 
                        key={topic.id} 
                        style={{
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'rgba(255, 255, 255, 0.01)',
                          overflow: 'hidden',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                      >
                        {/* Topic Header Node */}
                        <div 
                          onClick={() => toggleTopic(topic.id)}
                          style={{
                            padding: '16px 20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            backgroundColor: isOpen ? 'rgba(139, 92, 246, 0.03)' : 'transparent',
                            transition: 'background-color 0.2s',
                            userSelect: 'none'
                          }}
                          className="tree-node-topic"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ 
                              width: '28px', 
                              height: '28px', 
                              borderRadius: '6px', 
                              backgroundColor: isOpen ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255,255,255,0.03)',
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              color: isOpen ? 'var(--primary)' : 'var(--text-secondary)',
                              transition: 'all 0.25s'
                            }}>
                              <Layers size={14} />
                            </div>
                            <span style={{ 
                              fontWeight: 600, 
                              fontSize: '0.95rem',
                              color: isOpen ? 'var(--text-primary)' : 'var(--text-secondary)'
                            }}>{topic.title}</span>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {topic.subtopics.length} subtopics
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTriggerQuiz(topic.title);
                              }}
                              style={{
                                padding: '4px 10px',
                                fontSize: '0.72rem',
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
                            >
                              <HelpCircle size={11} />
                              Generate Quiz
                            </button>
                            {isOpen ? (
                              <ChevronDown size={18} color="var(--text-muted)" />
                            ) : (
                              <ChevronRight size={18} color="var(--text-muted)" />
                            )}
                          </div>
                        </div>

                        {/* Subtopics Nested Leaf Nodes */}
                        {isOpen && (
                          <div style={{
                            padding: '8px 20px 20px 52px',
                            borderTop: '1px solid var(--border-color)',
                            backgroundColor: 'rgba(11, 8, 27, 0.2)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            position: 'relative'
                          }}>
                            {/* Vertical connector line */}
                            <div style={{
                              position: 'absolute',
                              left: '33px',
                              top: 0,
                              bottom: '26px',
                              width: '1px',
                              backgroundColor: 'rgba(139, 92, 246, 0.2)'
                            }} />

                            {topic.subtopics.map((sub) => (
                              <div 
                                key={sub.id} 
                                style={{ 
                                  display: 'flex', 
                                  flexDirection: 'column',
                                  gap: '8px',
                                  position: 'relative',
                                  padding: '4px 0',
                                  width: '100%'
                                }}
                              >
                                {/* Horizontal connector branch */}
                                <div style={{
                                  position: 'absolute',
                                  left: '-20px',
                                  top: '16px',
                                  width: '12px',
                                  height: '1px',
                                  backgroundColor: 'rgba(139, 92, 246, 0.2)'
                                }} />
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div style={{ 
                                    width: '6px', 
                                    height: '6px', 
                                    borderRadius: '50%', 
                                    backgroundColor: 'var(--secondary)',
                                    boxShadow: '0 0 8px var(--secondary)'
                                  }} />
                                  
                                  <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                    {sub.title}
                                  </span>
                                </div>

                                {/* Render Children (Sub-subtopics) if any */}
                                {sub.children && sub.children.length > 0 && (
                                  <div style={{ 
                                    paddingLeft: '24px', 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: '10px', 
                                    borderLeft: '1px dashed rgba(255, 255, 255, 0.08)', 
                                    marginLeft: '3px', 
                                    marginTop: '4px',
                                    marginBottom: '6px',
                                    position: 'relative'
                                  }}>
                                    {sub.children.map((child) => (
                                      <div key={child.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
                                        {/* Child Horizontal Branch */}
                                        <div style={{
                                          position: 'absolute',
                                          left: '-24px',
                                          top: '50%',
                                          width: '16px',
                                          height: '1px',
                                          backgroundColor: 'rgba(255, 255, 255, 0.05)'
                                        }} />
                                        <div style={{ 
                                          width: '4px', 
                                          height: '4px', 
                                          borderRadius: '50%', 
                                          backgroundColor: '#c084fc',
                                          boxShadow: '0 0 4px #c084fc'
                                        }} />
                                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                          {child.title}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

            </div>

          </CollapsiblePanel>
        ) : (
          /* Initial selection guidance empty state */
          <div className="glass-card" style={{ padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: '100%', color: 'var(--text-secondary)', flex: 1 }}>
            <FolderOpen size={48} color="var(--text-muted)" style={{ marginBottom: '16px' }} className="floating" />
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>Select Study Material</h3>
            <p style={{ maxWidth: '360px', fontSize: '0.9rem', marginBottom: '20px' }}>
              Choose an uploaded PDF document to inspect automatically cataloged topics.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
              <span>Click a notebook to begin</span>
              <ArrowRight size={14} />
            </div>
          </div>
        )}

      </div>

      {/* Quiz Loading Overlay */}
      {loadingQuiz && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(10, 8, 28, 0.7)',
          backdropFilter: 'blur(8px)',
          zIndex: 99,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px'
        }}>
          <Loader2 size={36} className="spin-icon" color="var(--primary)" />
          <span style={{ color: 'white', fontSize: '0.9rem', fontWeight: 600 }}>Generating 10-Question MCQ Practice Quiz with AI...</span>
        </div>
      )}

      {/* Quiz Assessment Overlay */}
      {showQuizModal && selectedNote && (
        <QuizPanel
          noteId={selectedNote.id}
          topicTitle={quizTopic}
          questions={quizQuestions}
          onClose={() => {
            setShowQuizModal(false);
            setQuizQuestions([]);
          }}
        />
      )}

      <style>{`
        .notebook-btn:hover {
          background-color: rgba(255, 255, 255, 0.05) !important;
          border-color: rgba(255, 255, 255, 0.1) !important;
        }
        .notebook-btn.active {
          box-shadow: var(--shadow-sm), 0 0 10px rgba(6, 182, 212, 0.15) !important;
        }
        .tree-node-topic:hover {
          background-color: rgba(255, 255, 255, 0.03) !important;
        }
        .tree-node-topic:hover div span {
          color: var(--text-primary) !important;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spin-icon {
          animation: spin 1.2s linear infinite;
        }
        
        @keyframes skeleton-pulse {
          0% { opacity: 0.35; }
          50% { opacity: 0.7; }
          100% { opacity: 0.35; }
        }
        
        .pulse-dot {
          animation: pulse-dot-anim 1.5s infinite;
        }
        @keyframes pulse-dot-anim {
          0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.5); }
          70% { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0); }
          100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
        }

        @media (max-width: 768px) {
          .topic-container {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

export default TopicViewer;
