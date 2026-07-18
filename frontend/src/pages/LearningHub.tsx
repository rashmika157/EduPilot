import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSessionPanelState } from '../components/CollapsiblePanel';
import { 
  Tv, 
  CheckCircle, 
  Circle, 
  Play, 
  Loader2, 
  AlertCircle, 
  ChevronRight, 
  ChevronDown, 
  Clock, 
  Eye, 
  BookMarked,
  HelpCircle
} from 'lucide-react';
import { QuizPanel } from '../components/QuizPanel';

const YoutubeIcon: React.FC<{ size?: number; color?: string; style?: React.CSSProperties }> = ({ size = 16, color = '#ef4444', style }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke={color} 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    style={style}
  >
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
  </svg>
);

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
  topics?: Topic[];
}

interface Subtopic {
  id: number;
  topic_id: number;
  parent_id: number | null;
  title: string;
  children?: Subtopic[];
}

interface Topic {
  id: number;
  note_id: number;
  title: string;
  subtopics: Subtopic[];
}

interface YouTubeVideo {
  id: string;
  title: string;
  thumbnail_url: string;
  channel_name: string;
  views: string;
  duration: string;
}

const normalizeTitle = (title: string): string => title.trim().toLowerCase();

const dedupeSubtopics = (subtopics?: Subtopic[]): Subtopic[] => {
  if (!subtopics || subtopics.length === 0) return [];
  const seenIds = new Set<number>();
  const seenTitles = new Set<string>();
  return subtopics.reduce<Subtopic[]>((acc, sub) => {
    const normalizedTitle = normalizeTitle(sub.title);
    if (seenIds.has(sub.id) || seenTitles.has(normalizedTitle)) return acc;
    seenIds.add(sub.id);
    seenTitles.add(normalizedTitle);
    acc.push({
      ...sub,
      children: dedupeSubtopics(sub.children)
    });
    return acc;
  }, []);
};

const dedupeTopics = (topics?: Topic[]): Topic[] => {
  if (!topics || topics.length === 0) return [];
  const seenIds = new Set<number>();
  const seenTitles = new Set<string>();
  return topics.reduce<Topic[]>((acc, topic) => {
    const normalizedTitle = normalizeTitle(topic.title);
    if (seenIds.has(topic.id) || seenTitles.has(normalizedTitle)) return acc;
    seenIds.add(topic.id);
    seenTitles.add(normalizedTitle);
    acc.push({
      ...topic,
      subtopics: dedupeSubtopics(topic.subtopics)
    });
    return acc;
  }, []);
};

const dedupeNoteTopics = (note: Note): Note => ({
  ...note,
  topics: dedupeTopics(note.topics)
});

export const LearningHub: React.FC = () => {
  const location = useLocation();
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  
  // Panel collapse state
  const [leftCollapsed, setLeftCollapsed] = useSessionPanelState('edupilot_lh_left_collapsed', false);
  const [centerCollapsed, setCenterCollapsed] = useSessionPanelState('edupilot_lh_center_collapsed', false);
  const [rightCollapsed, setRightCollapsed] = useSessionPanelState('edupilot_lh_right_collapsed', false);

  // Selection states
  const [activeTopicId, setActiveTopicId] = useState<number | null>(null);
  const [activeSubtopicId, setActiveSubtopicId] = useState<number | null>(null);
  const [activeTitle, setActiveTitle] = useState<string>('');
  
  // Video and progress states
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [currentVideo, setCurrentVideo] = useState<YouTubeVideo | null>(null);
  const [failedVideoIds, setFailedVideoIds] = useState<string[]>([]);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const isValidVideoId = (id: string): boolean => {
    if (!id) return false;
    return /^[a-zA-Z0-9_-]{11}$/.test(id);
  };

  const pickNextAvailableVideo = (excludeIds: string[] = []): YouTubeVideo | null => {
    const nextVideo = videos.find(v => isValidVideoId(v.id) && !excludeIds.includes(v.id));
    return nextVideo || null;
  };

  const buildVideoSearchQuery = (topicTitle: string, subtopicTitle?: string) => {
    const parts: string[] = [];
    if (selectedNote?.subject) {
      parts.push(selectedNote.subject);
    }
    if (selectedNote?.title && selectedNote.title !== selectedNote?.subject) {
      parts.push(selectedNote.title);
    }
    parts.push(topicTitle);
    if (subtopicTitle) {
      parts.push(subtopicTitle);
    }
    parts.push('lecture');
    parts.push('tutorial');
    return parts.filter(Boolean).join(' ').trim();
  };

  const handleVideoError = (videoId: string) => {
    console.log(`[YouTube Player] Video ${videoId} failed to play or embed. Trying next video...`);
    setFailedVideoIds(prev => {
      const nextFailed = [...prev, videoId];
      const nextVid = videos.find(v => !nextFailed.includes(v.id) && isValidVideoId(v.id));
      if (nextVid) {
        setCurrentVideo(nextVid);
      } else {
        setCurrentVideo(null);
      }
      return nextFailed;
    });
  };

  // Reset failed list when search topic/subtopic changes
  useEffect(() => {
    setFailedVideoIds([]);
  }, [activeTopicId, activeSubtopicId]);

  // Monitor iframe error states using a simpler embed fallback
  useEffect(() => {
    if (!currentVideo) return;

    if (!isValidVideoId(currentVideo.id)) {
      console.warn(`[YT Player] Invalid video ID: '${currentVideo.id}'. Skipping...`);
      handleVideoError(currentVideo.id);
      return;
    }

    if (containerRef.current) {
      containerRef.current.innerHTML = `<iframe src="https://www.youtube.com/embed/${currentVideo.id}?autoplay=1&rel=0&modestbranding=1" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width:100%; height:100%;"></iframe>`;
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [currentVideo]);
  const [progressPercentage, setProgressPercentage] = useState<number>(0);
  const [progressMap, setProgressMap] = useState<Record<string, string>>({});
  const [lastWatchedMap, setLastWatchedMap] = useState<Record<string, string>>({});
  
  // Loading states
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Expand states for tree
  const [expandedTopics, setExpandedTopics] = useState<Record<number, boolean>>({});
  const [activeNotesExpanded, setActiveNotesExpanded] = useState(true);

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
        const completedNotes = data
          .filter((n: Note) => n.topic_extraction_status === 'completed')
          .map(dedupeNoteTopics);
        setNotes(completedNotes);

        const queryParams = new URLSearchParams(location.search);
        const noteIdParam = queryParams.get('noteId');
        const requestedNoteId = noteIdParam ? parseInt(noteIdParam, 10) : null;
        if (requestedNoteId) {
          const requestedNote = completedNotes.find((note: Note) => note.id === requestedNoteId);
          if (requestedNote) {
            setSelectedNote(requestedNote);
          } else if (completedNotes.length > 0) {
            setSelectedNote(completedNotes[0]);
          }
        } else if (completedNotes.length > 0) {
          setSelectedNote(completedNotes[0]);
        }
      } else if (response.status === 401) {
        window.dispatchEvent(new Event('unauthorized'));
      }
    } catch (err) {
      console.error('Failed to fetch notes library:', err);
    } finally {
      setLoadingNotes(false);
    }
  };

  const fetchProgress = async (noteId: number) => {
    try {
      const token = localStorage.getItem('edupilot_token');
      const response = await fetch(`http://127.0.0.1:8000/api/learning-hub/${noteId}/progress`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setProgressPercentage(data.progress_percentage);
        setProgressMap(data.progress_map || {});
        setLastWatchedMap(data.last_watched_map || {});

        if (data.last_active_subtopic_id || data.last_active_topic_id) {
          setActiveTopicId(data.last_active_topic_id || null);
          setActiveSubtopicId(data.last_active_subtopic_id || null);
          if (data.last_active_title) {
            setActiveTitle(data.last_active_title);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load progress:", err);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  useEffect(() => {
    if (!selectedNote) return;

    fetchProgress(selectedNote.id);

    // Auto-expand all topics of selected note by default
    if (selectedNote.topics) {
      const expandMap: Record<number, boolean> = {};
      selectedNote.topics.forEach(t => {
        expandMap[t.id] = true;
      });
      setExpandedTopics(expandMap);
    }

    // Auto-select first topic or subtopic if available
    if (selectedNote.topics && selectedNote.topics.length > 0) {
      const firstTopic = selectedNote.topics[0];
      if (firstTopic.subtopics && firstTopic.subtopics.length > 0) {
        handleSelectSubtopic(firstTopic.subtopics[0]);
      } else {
        handleSelectTopic(firstTopic);
      }
    } else {
      setActiveTopicId(null);
      setActiveSubtopicId(null);
      setActiveTitle(selectedNote.title);
    }
  }, [selectedNote]);

  const fetchVideos = async (
    searchQuery: string,
    noteId?: number,
    topicId?: number | null,
    subtopicId?: number | null,
    fallbackVideoId?: string
  ) => {
    setLoadingVideos(true);
    setErrorMsg(null);
    try {
      const token = localStorage.getItem('edupilot_token');
      const queryParams = new URLSearchParams();
      queryParams.set('query', searchQuery);
      if (noteId !== undefined && noteId !== null) queryParams.set('note_id', noteId.toString());
      if (topicId !== undefined && topicId !== null) queryParams.set('topic_id', topicId.toString());
      if (subtopicId !== undefined && subtopicId !== null) queryParams.set('subtopic_id', subtopicId.toString());
      const response = await fetch(`http://127.0.0.1:8000/api/learning-hub/videos?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setVideos(data);
        const validVideos = data.filter((v: YouTubeVideo) => isValidVideoId(v.id) && !failedVideoIds.includes(v.id));
        if (validVideos.length > 0) {
          const matchingVideo = fallbackVideoId ? validVideos.find((v: YouTubeVideo) => v.id === fallbackVideoId) : null;
          setCurrentVideo(matchingVideo || validVideos[0]);
        } else if (data.length > 0) {
          setCurrentVideo(null);
          setErrorMsg('No playable videos returned for this topic.');
        } else {
          setCurrentVideo(null);
          setErrorMsg('No recommended videos were found for this topic.');
        }
      } else {
        setErrorMsg('Failed to retrieve recommended videos.');
      }
    } catch (err) {
      console.error('Failed to search videos:', err);
      setErrorMsg('Unable to communicate with YouTube service.');
    } finally {
      setLoadingVideos(false);
    }
  };

  const toggleTopicExpand = (topicId: number) => {
    setExpandedTopics(prev => ({
      ...prev,
      [topicId]: !prev[topicId]
    }));
  };

  useEffect(() => {
    if (!currentVideo && videos.length > 0) {
      const nextVideo = pickNextAvailableVideo(failedVideoIds);
      if (nextVideo) {
        setCurrentVideo(nextVideo);
      }
    }
  }, [videos, failedVideoIds, currentVideo]);

  const handleSelectTopic = (topic: Topic) => {
    setActiveTopicId(topic.id);
    setActiveSubtopicId(null);
    setActiveTitle(topic.title);
    
    const key = `topic_${topic.id}`;
    const previousWatchedVideo = lastWatchedMap[key];
    
    // Construct search query: Subject + Chapter/Topic
    const query = buildVideoSearchQuery(topic.title);
    fetchVideos(query, selectedNote?.id, topic.id, null, previousWatchedVideo);
  };

  const handleSelectSubtopic = (subtopic: Subtopic) => {
    setActiveTopicId(subtopic.topic_id);
    setActiveSubtopicId(subtopic.id);
    setActiveTitle(subtopic.title);
    
    const key = `subtopic_${subtopic.id}`;
    const previousWatchedVideo = lastWatchedMap[key];
    
    // Construct search query: Subject + Chapter (parent topic) + Selected Topic (subtopic)
    const parentTopic = selectedNote?.topics?.find(t => t.id === subtopic.topic_id);
    const query = buildVideoSearchQuery(parentTopic?.title || '', subtopic.title);
    fetchVideos(query, selectedNote?.id, parentTopic?.id || null, subtopic.id, previousWatchedVideo);
  };

  const handleSelectVideo = async (video: YouTubeVideo) => {
    setCurrentVideo(video);
    if (!selectedNote) return;

    const key = activeSubtopicId ? `subtopic_${activeSubtopicId}` : `topic_${activeTopicId}`;
    const status = progressMap[key] || 'not_started';
    
    // Optimistically update last watched map
    setLastWatchedMap(prev => ({
      ...prev,
      [key]: video.id
    }));

    try {
      const token = localStorage.getItem('edupilot_token');
      await fetch('http://127.0.0.1:8000/api/learning-hub/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          note_id: selectedNote.id,
          topic_id: activeSubtopicId ? null : activeTopicId,
          subtopic_id: activeSubtopicId,
          status: status,
          last_watched_video_id: video.id
        })
      });
    } catch (err) {
      console.error("Failed to save last watched video progress:", err);
    }
  };

  const handleUpdateStatus = async (status: 'not_started' | 'in_progress' | 'completed') => {
    if (!selectedNote) return;
    
    const key = activeSubtopicId ? `subtopic_${activeSubtopicId}` : `topic_${activeTopicId}`;
    
    // Optimistic progress update
    setProgressMap(prev => ({
      ...prev,
      [key]: status
    }));

    try {
      const token = localStorage.getItem('edupilot_token');
      const response = await fetch('http://127.0.0.1:8000/api/learning-hub/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          note_id: selectedNote.id,
          topic_id: activeSubtopicId ? null : activeTopicId,
          subtopic_id: activeSubtopicId,
          status: status,
          last_watched_video_id: currentVideo?.id || null
        })
      });
      if (response.ok) {
        // Refresh overall progress percentage
        fetchProgress(selectedNote.id);
      }
    } catch (err) {
      console.error("Failed to update topic status:", err);
    }
  };

  // Helper to get active node status
  const getActiveStatus = (): string => {
    const key = activeSubtopicId ? `subtopic_${activeSubtopicId}` : `topic_${activeTopicId}`;
    return progressMap[key] || 'not_started';
  };

  // Helper to render tree status icons
  const renderStatusIcon = (key: string) => {
    const status = progressMap[key] || 'not_started';
    if (status === 'completed') {
      return <CheckCircle size={16} color="#10b981" style={{ flexShrink: 0 }} />;
    } else if (status === 'in_progress') {
      return (
        <span style={{
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          border: '2px solid var(--primary)',
          backgroundColor: 'rgba(139, 92, 246, 0.2)',
          display: 'inline-block',
          flexShrink: 0
        }} />
      );
    }
    return <Circle size={16} color="var(--border-color)" style={{ flexShrink: 0 }} />;
  };

  // Recursive formatter for subtopics
  const renderSubtopicNode = (subtopic: Subtopic, depth = 0) => {
    const isSelected = activeSubtopicId === subtopic.id;
    const key = `subtopic_${subtopic.id}`;
    
    return (
      <div key={subtopic.id} style={{ display: 'flex', flexDirection: 'column' }}>
        <div 
          onClick={() => handleSelectSubtopic(subtopic)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 12px 8px ' + (24 + depth * 12) + 'px',
            cursor: 'pointer',
            backgroundColor: isSelected ? 'rgba(139, 92, 246, 0.08)' : 'transparent',
            borderLeft: isSelected ? '2px solid var(--primary)' : '2px solid transparent',
            color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontSize: '0.85rem',
            transition: 'all 0.15s ease'
          }}
          className="tree-node"
        >
          {renderStatusIcon(key)}
          <span style={{ 
            textOverflow: 'ellipsis', 
            overflow: 'hidden', 
            whiteSpace: 'nowrap',
            fontWeight: isSelected ? 600 : 400
          }}>
            {subtopic.title}
          </span>
        </div>
        {subtopic.children && subtopic.children.map(child => renderSubtopicNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div style={{
      display: 'flex',
      height: 'calc(100vh - 120px)',
      gap: '24px',
      overflow: 'hidden'
    }}>
      {/* 1. LEFT PANEL: Lecture Topics Tree & Progress */}
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
              <BookMarked size={18} color="var(--primary)" />
              <ChevronRight size={18} />
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, overflow: 'hidden' }}>
                <BookMarked size={18} color="var(--primary)" />
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                  Active Note Package
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
          minWidth: '320px'
        }}>
          {/* Note Selector Dropdown */}
          <div style={{
            padding: '16px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div 
              onClick={() => setActiveNotesExpanded(!activeNotesExpanded)}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                cursor: 'pointer',
                userSelect: 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookMarked size={16} color="var(--primary)" />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Note Package</span>
              </div>
              <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                {activeNotesExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            </div>
            
            {activeNotesExpanded && (
              <>
                {loadingNotes ? (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Loader2 className="spin-icon" size={16} />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading library...</span>
                  </div>
                ) : notes.length === 0 ? (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No completed extraction notes found.</span>
                ) : (
                  <select
                    value={selectedNote?.id || ''}
                    onChange={(e) => {
                      const note = notes.find(n => n.id === Number(e.target.value));
                      if (note) setSelectedNote(dedupeNoteTopics(note));
                    }}
                    style={{
                      width: '100%',
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 14px',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {notes.map(n => (
                      <option key={n.id} value={n.id} style={{ backgroundColor: '#130f2e', color: 'white' }}>
                        {n.title}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}
          </div>

          {/* Note Learning Progress Bar */}
          {selectedNote && (
            <div style={{
              padding: '16px',
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: 'rgba(255,255,255,0.01)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Note Learning Progress</span>
                <strong style={{ color: progressPercentage === 100 ? '#10b981' : 'var(--primary-light, #c084fc)' }}>
                  {progressPercentage}%
                </strong>
              </div>
              <div style={{
                height: '8px',
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderRadius: '99px',
                overflow: 'hidden',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{
                  height: '100%',
                  width: `${progressPercentage}%`,
                  background: 'linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%)',
                  borderRadius: '99px',
                  transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                }} />
              </div>
            </div>
          )}

          {/* Scrollable Topics Tree */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
            {selectedNote?.topics && selectedNote.topics.map((topic) => {
              const isSelected = activeTopicId === topic.id && activeSubtopicId === null;
              const isExpanded = !!expandedTopics[topic.id];
              const hasSubtopics = topic.subtopics && topic.subtopics.length > 0;
              const key = `topic_${topic.id}`;
              
              return (
                <div key={topic.id} style={{ display: 'flex', flexDirection: 'column', marginBottom: '4px' }}>
                  <div 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'rgba(139, 92, 246, 0.08)' : 'transparent',
                      borderLeft: isSelected ? '2px solid var(--primary)' : '2px solid transparent',
                      transition: 'all 0.15s ease'
                    }}
                    className="tree-node"
                  >
                    <div 
                      onClick={() => handleSelectTopic(topic)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        flex: 1,
                        minWidth: 0
                      }}
                    >
                      {renderStatusIcon(key)}
                      <span style={{ 
                        fontSize: '0.9rem', 
                        fontWeight: 600, 
                        color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap'
                      }}>
                        {topic.title}
                      </span>
                    </div>
                    
                    {hasSubtopics && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTopicExpand(topic.id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '4px'
                        }}
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    )}
                  </div>

                  {/* Subtopics sublist */}
                  {hasSubtopics && isExpanded && (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {topic.subtopics.map(sub => renderSubtopicNode(sub))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. CENTER PANEL: Video Playback & Actions */}
      <div style={{
        flex: centerCollapsed ? '0 0 60px' : '1 1 auto',
        minWidth: centerCollapsed ? '60px' : '0',
        backgroundColor: 'rgba(255,255,255,0.01)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'flex 300ms cubic-bezier(0.4, 0, 0.2, 1), min-width 300ms cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        <div 
          onClick={() => centerCollapsed && setCenterCollapsed(false)}
          style={{
            padding: '16px 24px',
            borderBottom: centerCollapsed ? 'none' : '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: centerCollapsed ? 'center' : 'space-between',
            gap: '10px',
            cursor: centerCollapsed ? 'pointer' : 'default',
            userSelect: 'none',
            backgroundColor: 'rgba(255,255,255,0.01)'
          }}
        >
          {centerCollapsed ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <Tv size={18} color="var(--secondary)" />
              <ChevronRight size={18} />
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0, overflow: 'hidden' }}>
                <Tv size={18} color="var(--secondary)" />
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
                    Studying Concept
                  </span>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {activeTitle}
                  </h3>
                </div>
                <button
                  onClick={() => handleTriggerQuiz(activeTitle)}
                  style={{
                    padding: '5px 12px',
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
                    transition: 'all 0.2s',
                    flexShrink: 0
                  }}
                >
                  <HelpCircle size={12} />
                  Test with Quiz
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <YoutubeIcon size={14} color="#ef4444" />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>YouTube Embed grounded</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCenterCollapsed(true);
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
              </div>
            </>
          )}
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          opacity: centerCollapsed ? 0 : 1,
          transition: 'opacity 200ms ease',
          overflow: 'hidden',
          pointerEvents: centerCollapsed ? 'none' : 'auto',
          minWidth: '400px'
        }}>
          {selectedNote && (activeTopicId || activeSubtopicId) ? (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              {/* Video Area */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '24px' }}>
                {loadingVideos ? (
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '300px', gap: '12px' }}>
                    <Loader2 className="spin-icon" size={32} color="var(--primary)" />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Fetching recommended lectures...</span>
                  </div>
                ) : errorMsg ? (
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '300px', color: '#f87171', gap: '10px' }}>
                    <AlertCircle size={32} />
                    <span style={{ fontSize: '0.85rem' }}>{errorMsg}</span>
                  </div>
                ) : currentVideo ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
                    {/* Embedded Iframe Player container */}
                    <div style={{
                      position: 'relative',
                      width: '100%',
                      paddingTop: '56.25%', // 16:9 Aspect Ratio
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      border: '1px solid var(--border-color)',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                      backgroundColor: '#000'
                    }}>
                      <div 
                        ref={containerRef}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%'
                        }}
                      />
                    </div>

                    {/* Title and stats below player */}
                    <div>
                      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px', lineHeight: 1.4 }}>
                        {currentVideo.title}
                      </h2>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{currentVideo.channel_name}</span>
                        <span>•</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Eye size={12} /> {currentVideo.views}
                        </span>
                        <span>•</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} /> {currentVideo.duration}
                        </span>
                      </div>
                    </div>

                    {/* Learning Status Actions */}
                    <div style={{
                      padding: '20px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Topic Learning Status</span>
                      
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => handleUpdateStatus('not_started')}
                          style={{
                            flex: 1,
                            minWidth: '120px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '10px 14px',
                            backgroundColor: getActiveStatus() === 'not_started' ? 'rgba(255,255,255,0.1)' : 'transparent',
                            border: getActiveStatus() === 'not_started' ? '1px solid var(--text-primary)' : '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            color: getActiveStatus() === 'not_started' ? 'var(--text-primary)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <Circle size={14} />
                          Not Started
                        </button>

                        <button
                          onClick={() => handleUpdateStatus('in_progress')}
                          style={{
                            flex: 1,
                            minWidth: '120px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '10px 14px',
                            backgroundColor: getActiveStatus() === 'in_progress' ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                            border: getActiveStatus() === 'in_progress' ? '1px solid var(--primary-light, #c084fc)' : '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            color: getActiveStatus() === 'in_progress' ? '#c084fc' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary)' }} />
                          In Progress
                        </button>

                        <button
                          onClick={() => handleUpdateStatus('completed')}
                          style={{
                            flex: 1,
                            minWidth: '120px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '10px 14px',
                            backgroundColor: getActiveStatus() === 'completed' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                            border: getActiveStatus() === 'completed' ? '1px solid #34d399' : '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            color: getActiveStatus() === 'completed' ? '#34d399' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <CheckCircle size={14} color={getActiveStatus() === 'completed' ? '#34d399' : 'var(--text-secondary)'} />
                          Completed
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '300px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                    <Tv size={36} style={{ marginBottom: '12px', opacity: 0.5 }} />
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>No public or embeddable educational videos found for this topic.</span>
                    <span style={{ fontSize: '0.75rem', marginTop: '6px', opacity: 0.8 }}>Please try selecting another concept or subtopic from the syllabus.</span>
                  </div>
                )}
              </div>
            </div>
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
              <Tv size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
              <h3 style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>Learning Hub Dashboard</h3>
              <p style={{ fontSize: '0.88rem', maxWidth: '340px' }}>
                Select a lecture topic or subtopic from the hierarchy tree on the left to load recommended study videos and trace your progress.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 3. RIGHT PANEL: Recommended Playlist */}
      <div style={{
        width: rightCollapsed ? '60px' : '300px',
        minWidth: rightCollapsed ? '60px' : '300px',
        backgroundColor: 'rgba(255,255,255,0.01)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1), min-width 300ms cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        <div 
          onClick={() => setRightCollapsed(prev => !prev)}
          style={{
            padding: '16px 20px',
            borderBottom: rightCollapsed ? 'none' : '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: rightCollapsed ? 'center' : 'space-between',
            gap: '10px',
            backgroundColor: 'rgba(255,255,255,0.01)',
            cursor: 'pointer',
            userSelect: 'none'
          }}
        >
          {rightCollapsed ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <YoutubeIcon size={18} color="var(--primary)" />
              <ChevronRight size={18} />
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
                <YoutubeIcon size={18} color="var(--primary)" />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, whiteSpace: 'nowrap' }}>Recommended Videos</h3>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setRightCollapsed(true);
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
          opacity: rightCollapsed ? 0 : 1,
          transition: 'opacity 200ms ease',
          overflow: 'hidden',
          pointerEvents: rightCollapsed ? 'none' : 'auto',
          minWidth: '300px'
        }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {loadingVideos ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                <Loader2 className="spin-icon" size={24} color="var(--primary)" />
              </div>
            ) : videos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '0.8rem' }}>No recommended playlist loaded yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {videos.map((vid) => {
                  const isPlaying = currentVideo?.id === vid.id;
                  return (
                    <div
                      key={vid.id}
                      onClick={() => handleSelectVideo(vid)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        borderRadius: 'var(--radius-sm)',
                        overflow: 'hidden',
                        border: isPlaying ? '1px solid var(--primary-light, #c084fc)' : '1px solid var(--border-color)',
                        backgroundColor: isPlaying ? 'rgba(139, 92, 246, 0.04)' : 'rgba(255,255,255,0.01)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        position: 'relative'
                      }}
                      className="playlist-item"
                    >
                      {/* Video Thumbnail with duration badge */}
                      <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%' }}>
                        <img 
                          src={vid.thumbnail_url} 
                          alt={vid.title} 
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                        <span style={{
                          position: 'absolute',
                          bottom: '6px',
                          right: '6px',
                          backgroundColor: 'rgba(0,0,0,0.8)',
                          color: 'white',
                          fontSize: '0.65rem',
                          padding: '2px 6px',
                          borderRadius: '3px',
                          fontWeight: 600
                        }}>
                          {vid.duration}
                        </span>
                        {isPlaying && (
                          <div style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundColor: 'rgba(139, 92, 246, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white'
                          }}>
                            <Play size={20} style={{ fill: 'currentColor' }} />
                          </div>
                        )}
                      </div>

                      {/* Title and Channel */}
                      <div style={{ padding: '8px' }}>
                        <h4 style={{
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: isPlaying ? 'var(--primary-light, #c084fc)' : 'var(--text-primary)',
                          marginBottom: '4px',
                          lineHeight: 1.3,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}>
                          {vid.title}
                        </h4>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          <span>{vid.channel_name}</span>
                          <span>{vid.views}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
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
    </div>
  );
};

export default LearningHub;
