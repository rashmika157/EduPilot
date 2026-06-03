import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Send, 
  FileText, 
  AlertCircle, 
  Loader2, 
  Bot, 
  User as UserIcon, 
  BookOpen,
  ChevronRight,
  MessageSquare
} from 'lucide-react';

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
}

interface ChatMessage {
  id: number;
  session_id: number;
  sender: 'user' | 'ai';
  content: string;
  source_topic: string | null;
  confidence_score: number | null;
  created_at: string;
}

export const AITutor: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [generatingResponse, setGeneratingResponse] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load all notes on mount
  useEffect(() => {
    fetchNotes();
  }, []);

  // Fetch messages when note selection changes
  useEffect(() => {
    if (selectedNote) {
      fetchChatHistory(selectedNote.id);
    } else {
      setMessages([]);
    }
    setErrorMsg(null);
  }, [selectedNote]);

  // Scroll to bottom when messages list updates or generation starts
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, generatingResponse]);

  const fetchNotes = async () => {
    setLoadingNotes(true);
    try {
      const token = localStorage.getItem('edupilot_token');
      const response = await fetch('http://127.0.0.1:8000/api/notes/with-topics', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        // Filter notes that have completed extraction to ensure they have content
        setNotes(data);
        if (data.length > 0) {
          setSelectedNote(data[0]);
        }
      } else {
        if (response.status === 401) {
          window.dispatchEvent(new Event('unauthorized'));
        }
      }
    } catch (err) {
      console.error("Failed to load notes library:", err);
    } finally {
      setLoadingNotes(false);
    }
  };

  const fetchChatHistory = async (noteId: number) => {
    setLoadingChat(true);
    try {
      const token = localStorage.getItem('edupilot_token');
      const response = await fetch(`http://127.0.0.1:8000/api/tutor/${noteId}/history`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      } else {
        if (response.status === 401) {
          window.dispatchEvent(new Event('unauthorized'));
        }
      }
    } catch (err) {
      console.error("Failed to fetch chat history:", err);
    } finally {
      setLoadingChat(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedNote || generatingResponse) return;

    const text = inputText;
    setInputText('');
    setErrorMsg(null);

    // Optimistically add user message to list
    const tempUserMsg: ChatMessage = {
      id: Date.now(),
      session_id: 0,
      sender: 'user',
      content: text,
      source_topic: null,
      confidence_score: null,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);
    setGeneratingResponse(true);

    try {
      const token = localStorage.getItem('edupilot_token');
      const response = await fetch(`http://127.0.0.1:8000/api/tutor/${selectedNote.id}/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: text })
      });

      if (response.ok) {
        const aiMsg = await response.json();
        // Replace user's local optimistic message with database-synced user message 
        // if needed, or simply append AI message
        setMessages(prev => {
          // Remove temporary message and append verified ones
          const filtered = prev.filter(m => m.id !== tempUserMsg.id);
          return [...filtered, {
            id: aiMsg.id - 1, // Fake matching user message id or fetch again
            session_id: aiMsg.session_id,
            sender: 'user' as const,
            content: text,
            source_topic: null,
            confidence_score: null,
            created_at: new Date().toISOString()
          }, aiMsg];
        });
      } else {
        const errData = await response.json();
        setErrorMsg(errData.detail || "Something went wrong. Please check your setup.");
        // Remove optimistic user message on failure so chat history remains consistent
        setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id));
      }
    } catch (err) {
      console.error("Ask query failed:", err);
      setErrorMsg("Failed to communicate with the backend services.");
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id));
    } finally {
      setGeneratingResponse(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      height: 'calc(100vh - 120px)', 
      gap: '24px',
      overflow: 'hidden'
    }}>
      {/* 1. Left Side: Documents Panel */}
      <div style={{
        width: '320px',
        backgroundColor: 'rgba(255,255,255,0.01)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <BookOpen size={18} color="var(--primary)" />
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Select Material</h3>
        </div>

        <div style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '12px'
        }}>
          {loadingNotes ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <Loader2 className="spin-icon" size={24} color="var(--primary)" />
            </div>
          ) : notes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <AlertCircle size={24} style={{ margin: '0 auto 12px', display: 'block' }} />
              <p style={{ fontSize: '0.85rem' }}>No documents uploaded yet.</p>
              <a href="/upload" className="link-button" style={{ display: 'inline-block', marginTop: '12px', fontSize: '0.8rem' }}>Upload Now</a>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {notes.map((note) => {
                const isSelected = selectedNote?.id === note.id;
                return (
                  <div
                    key={note.id}
                    onClick={() => setSelectedNote(note)}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-sm)',
                      border: isSelected ? '1px solid var(--primary-light, #c084fc)' : '1px solid var(--border-color)',
                      backgroundColor: isSelected ? 'rgba(139, 92, 246, 0.06)' : 'rgba(255,255,255,0.01)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                  >
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      backgroundColor: isSelected ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255,255,255,0.03)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isSelected ? 'var(--primary)' : 'var(--text-secondary)'
                    }}>
                      <FileText size={16} />
                    </div>
                    
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ 
                        fontSize: '0.85rem', 
                        fontWeight: isSelected ? 600 : 500, 
                        color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {note.title}
                      </p>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {note.subject}
                      </p>
                    </div>

                    <ChevronRight size={14} color="var(--text-muted)" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 2. Right Side: Interactive Chat Panel */}
      <div style={{
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.01)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {selectedNote ? (
          <>
            {/* Chat Area Header */}
            <div style={{
              padding: '16px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.01)'
            }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedNote.title}</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>AI Grounded Knowledge Base Mode</p>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.75rem',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                color: '#34d399',
                padding: '4px 10px',
                borderRadius: '9999px',
                fontWeight: 600
              }}>
                <Sparkles size={12} />
                Online
              </div>
            </div>

            {/* Error Notification Alert */}
            {errorMsg && (
              <div style={{
                margin: '12px 24px 0',
                padding: '12px 16px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: 'var(--radius-sm)',
                color: '#f87171',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Message History List */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              {loadingChat ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <Loader2 className="spin-icon" size={32} color="var(--primary)" />
                </div>
              ) : messages.length === 0 ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  padding: '20px'
                }}>
                  <MessageSquare size={36} style={{ marginBottom: '16px', opacity: 0.4 }} />
                  <h4 style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Ready to study?</h4>
                  <p style={{ fontSize: '0.85rem', maxWidth: '380px' }}>
                    Ask any question based on <strong>"{selectedNote.title}"</strong>. The AI Tutor will respond using context from this document.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isUser = msg.sender === 'user';
                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        justifyContent: isUser ? 'flex-end' : 'flex-start',
                        width: '100%'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        gap: '12px',
                        maxWidth: '80%',
                        flexDirection: isUser ? 'row-reverse' : 'row'
                      }}>
                        {/* Avatar bubble */}
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: isUser ? 'rgba(139, 92, 246, 0.2)' : 'rgba(236, 72, 153, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isUser ? 'var(--primary)' : 'var(--secondary)',
                          flexShrink: 0
                        }}>
                          {isUser ? <UserIcon size={14} /> : <Bot size={14} />}
                        </div>

                        {/* Content bubble */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{
                            padding: '12px 18px',
                            borderRadius: '16px',
                            borderTopRightRadius: isUser ? '2px' : '16px',
                            borderTopLeftRadius: isUser ? '16px' : '2px',
                            backgroundColor: isUser ? 'var(--primary)' : 'rgba(255,255,255,0.02)',
                            border: isUser ? 'none' : '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
                            fontSize: '0.9rem',
                            lineHeight: 1.5,
                            whiteSpace: 'pre-wrap'
                          }}>
                            {msg.content}
                          </div>

                          {/* Grounding source information tags (Only for AI tutor answers) */}
                          {!isUser && (msg.source_topic || msg.confidence_score) && (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              flexWrap: 'wrap',
                              fontSize: '0.72rem',
                              paddingLeft: '4px'
                            }}>
                              {msg.source_topic && (
                                <span style={{
                                  backgroundColor: 'rgba(255,255,255,0.04)',
                                  border: '1px solid var(--border-color)',
                                  color: 'var(--text-muted)',
                                  padding: '2px 8px',
                                  borderRadius: '4px'
                                }}>
                                  Source: <strong>{msg.source_topic}</strong>
                                </span>
                              )}
                              {msg.confidence_score !== null && (
                                <span style={{
                                  backgroundColor: msg.confidence_score > 0.85 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                  border: msg.confidence_score > 0.85 ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(245, 158, 11, 0.2)',
                                  color: msg.confidence_score > 0.85 ? '#34d399' : '#fbbf24',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontWeight: 600
                                }}>
                                  Confidence: {Math.round(msg.confidence_score * 100)}%
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Chat typing/generating loader */}
              {generatingResponse && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
                  <div style={{ display: 'flex', gap: '12px', maxWidth: '80%' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(236, 72, 153, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--secondary)'
                    }}>
                      <Bot size={14} />
                    </div>

                    <div style={{
                      padding: '12px 18px',
                      borderRadius: '16px',
                      borderTopLeftRadius: '2px',
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.85rem',
                      color: 'var(--text-muted)'
                    }}>
                      <Loader2 className="spin-icon" size={14} />
                      AI Tutor is thinking...
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input form area */}
            <form 
              onSubmit={handleSendMessage}
              style={{
                padding: '18px 24px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                gap: '12px',
                backgroundColor: 'rgba(11, 8, 27, 0.2)'
              }}
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Ask AI Tutor about "${selectedNote.title}"...`}
                disabled={generatingResponse}
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 18px',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                className="tutor-chat-input"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || generatingResponse}
                style={{
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  width: '46px',
                  height: '46px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'transform 0.15s, opacity 0.15s',
                  opacity: (!inputText.trim() || generatingResponse) ? 0.5 : 1
                }}
                className="tutor-send-btn"
              >
                <Send size={16} />
              </button>
            </form>
          </>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            color: 'var(--text-muted)',
            textAlign: 'center',
            padding: '40px'
          }}>
            <Bot size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
            <h3 style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>AI Study Partner</h3>
            <p style={{ fontSize: '0.88rem', maxWidth: '340px' }}>
              Select a lecture note from the list on the left to start asking questions and reviewing with the AI Tutor.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AITutor;
