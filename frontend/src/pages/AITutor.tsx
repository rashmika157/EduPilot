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
  ChevronLeft,
  MessageSquare
} from 'lucide-react';
import { useSessionPanelState } from '../components/CollapsiblePanel';

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
  source_references?: Array<{ section?: string; page?: number; snippet?: string }> | null;
  created_at: string;
}

const renderInlineMarkdown = (text: string): React.ReactNode[] => {
  const regex = /(\*\*.*?\*\*|`.*?`|\*.*?\*)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={index}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            padding: '2px 6px',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '0.9em'
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
};

const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  if (!content) return null;

  const blocks = content.split(/\n\n+/);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {blocks.map((block, blockIdx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // 1. Check if block is a table
        if (trimmed.includes('|') && trimmed.split('\n').length >= 2) {
          const lines = trimmed.split('\n');
          const headers = lines[0].split('|').map(s => s.trim()).filter(Boolean);
          const rows = lines.slice(2).map(line => 
            line.split('|').map(s => s.trim()).filter(Boolean)
          ).filter(row => row.length > 0);

          if (headers.length > 0) {
            return (
              <div key={blockIdx} style={{ overflowX: 'auto', margin: '8px 0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                      {headers.map((h, i) => (
                        <th key={i} style={{ padding: '8px 12px', fontWeight: 'bold' }}>{renderInlineMarkdown(h)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rIdx) => (
                      <tr key={rIdx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} style={{ padding: '8px 12px' }}>{renderInlineMarkdown(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
        }

        // 2. Check if block is a Heading
        if (trimmed.startsWith('#')) {
          const match = trimmed.match(/^(#{1,6})\s+(.*)$/);
          if (match) {
            const level = match[1].length;
            const text = match[2];
            const fontSize = level === 1 ? '1.5rem' : level === 2 ? '1.3rem' : level === 3 ? '1.1rem' : '0.95rem';
            return (
              <span
                key={blockIdx}
                style={{
                  fontSize,
                  fontWeight: 'bold',
                  display: 'block',
                  margin: '12px 0 6px 0',
                  color: 'var(--text-primary)'
                }}
              >
                {renderInlineMarkdown(text)}
              </span>
            );
          }
        }

        // 3. Check if block is a Bulleted List
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.match(/^\d+\.\s/)) {
          const lines = trimmed.split('\n');
          const isOrdered = trimmed.match(/^\d+\.\s/);
          const ListTag = isOrdered ? 'ol' : 'ul';
          return (
            <ListTag key={blockIdx} style={{ paddingLeft: '20px', margin: '6px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {lines.map((line, lineIdx) => {
                const cleanLine = line.replace(/^(?:-\s+|\*\s+|\d+\.\s+)/, '');
                return (
                  <li key={lineIdx} style={{ listStyleType: isOrdered ? 'decimal' : 'disc' }}>
                    {renderInlineMarkdown(cleanLine)}
                  </li>
                );
              })}
            </ListTag>
          );
        }

        // 4. Check if block is a code block
        if (trimmed.startsWith('```')) {
          const lines = trimmed.split('\n');
          const code = lines.slice(1, lines.length - (lines[lines.length - 1].startsWith('```') ? 1 : 0)).join('\n');
          return (
            <pre key={blockIdx} style={{
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              padding: '12px',
              borderRadius: '8px',
              overflowX: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              border: '1px solid var(--border-color)',
              margin: '8px 0'
            }}>
              <code>{code}</code>
            </pre>
          );
        }

        // 5. Default block: Paragraph
        return (
          <p key={blockIdx} style={{ margin: '0 0 10px 0', lineHeight: '1.6' }}>
            {renderInlineMarkdown(trimmed)}
          </p>
        );
      })}
    </div>
  );
};

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

  // Panel collapse state
  const [leftCollapsed, setLeftCollapsed] = useSessionPanelState('edupilot_at_left_collapsed', false);
  const [chatCollapsed, setChatCollapsed] = useSessionPanelState('edupilot_at_chat_collapsed', false);

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
              <BookOpen size={18} color="var(--primary)" />
              <ChevronRight size={18} />
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, overflow: 'hidden' }}>
                <BookOpen size={18} color="var(--primary)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, whiteSpace: 'nowrap' }}>Select Material</h3>
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
                <ChevronLeft size={18} />
              </button>
            </>
          )}
        </div>

        <div style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '12px',
          opacity: leftCollapsed ? 0 : 1,
          transition: 'opacity 200ms ease',
          pointerEvents: leftCollapsed ? 'none' : 'auto',
          minWidth: leftCollapsed ? '0px' : '320px'
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
        flex: chatCollapsed ? '0 0 60px' : '1 1 auto',
        minWidth: chatCollapsed ? '60px' : '0',
        backgroundColor: 'rgba(255,255,255,0.01)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'flex 300ms cubic-bezier(0.4, 0, 0.2, 1), min-width 300ms cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        <div 
          onClick={() => chatCollapsed && setChatCollapsed(false)}
          style={{
            padding: '16px 24px',
            borderBottom: chatCollapsed ? 'none' : '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: chatCollapsed ? 'center' : 'space-between',
            gap: '10px',
            cursor: chatCollapsed ? 'pointer' : 'default',
            userSelect: 'none',
            backgroundColor: 'rgba(255,255,255,0.01)'
          }}
        >
          {chatCollapsed ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <Sparkles size={18} color="var(--secondary)" />
              <ChevronLeft size={18} />
            </div>
          ) : (
            <>
              {selectedNote ? (
                <>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{selectedNote.title}</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>AI Grounded Knowledge Base Mode</p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setChatCollapsed(true);
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
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Bot size={18} color="var(--secondary)" />
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>AI Study Partner</h3>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setChatCollapsed(true);
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
                    <ChevronRight size={18} />
                  </button>
                </>
              )}
            </>
          )}
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          opacity: chatCollapsed ? 0 : 1,
          transition: 'opacity 200ms ease',
          overflow: 'hidden',
          pointerEvents: chatCollapsed ? 'none' : 'auto',
          minWidth: chatCollapsed ? '0px' : '400px'
        }}>
          {selectedNote ? (
            <>
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
                              <MarkdownRenderer content={msg.content} />
                            </div>

                            {/* Grounding source information tags (Only for AI tutor answers) */}
                            {!isUser && (msg.source_topic || (msg.source_references && msg.source_references.length > 0)) && (
                              <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px',
                                paddingLeft: '4px'
                              }}>
                                {msg.source_topic && (
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    flexWrap: 'wrap',
                                    fontSize: '0.72rem'
                                  }}>
                                    <span style={{
                                      backgroundColor: 'rgba(255,255,255,0.04)',
                                      border: '1px solid var(--border-color)',
                                      color: 'var(--text-muted)',
                                      padding: '2px 8px',
                                      borderRadius: '4px'
                                    }}>
                                      Source: <strong>{msg.source_topic}</strong>
                                    </span>
                                  </div>
                                )}

                                {msg.source_references && msg.source_references.length > 0 && (
                                  <div style={{
                                    backgroundColor: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '14px',
                                    padding: '12px',
                                    display: 'grid',
                                    gap: '10px'
                                  }}>
                                    <div style={{
                                      fontSize: '0.78rem',
                                      fontWeight: 600,
                                      color: 'var(--text-secondary)'
                                    }}>
                                      Source References
                                    </div>
                                    {msg.source_references.map((ref, index) => (
                                      <div key={index} style={{
                                        backgroundColor: 'rgba(255,255,255,0.02)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: '12px',
                                        padding: '10px'
                                      }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{ref.section || `Page ${ref.page ?? 'N/A'}`}</span>
                                          {ref.page !== undefined && ref.page !== null && (
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Page {ref.page}</span>
                                          )}
                                        </div>
                                        {ref.snippet && (
                                          <p style={{ margin: '8px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                                            {ref.snippet}
                                          </p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
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
    </div>
  );
};

export default AITutor;
