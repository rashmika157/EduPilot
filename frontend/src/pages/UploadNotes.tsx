import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  UploadCloud, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  Trash2,
  Bookmark,
  AlignLeft,
  ArrowRight
} from 'lucide-react';
import { API_BASE_URL } from '../api';

const SUBJECT_OPTIONS = [
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

export const UploadNotes: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form states
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState(SUBJECT_OPTIONS[0]);
  const [customSubject, setCustomSubject] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  // Interaction states
  const [isDragActive, setIsDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    setError('');
    
    // Check extension
    if (!selectedFile.name.toLowerCase().endsWith('.pdf') && selectedFile.type !== 'application/pdf') {
      setError('Only PDF documents are supported for flight log archives.');
      return;
    }
    
    // Check size limit (max 15MB for local testing)
    const maxBytes = 15 * 1024 * 1024;
    if (selectedFile.size > maxBytes) {
      setError('PDF file size exceeds the maximum limit (15 MB).');
      return;
    }

    setFile(selectedFile);
    
    // Auto-populate title if empty
    if (!title) {
      const cleanName = selectedFile.name.replace(/\.[^/.]+$/, ""); // Strip extension
      setTitle(cleanName);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const clearSelectedFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!file) {
      setError('Please attach a PDF document to upload.');
      return;
    }

    const finalSubject = subject === 'Other' && customSubject.trim() ? customSubject.trim() : subject;
    if (!finalSubject) {
      setError('Please select or specify a subject.');
      return;
    }

    setLoading(true);

    // Prepare FormData payload
    const formData = new FormData();
    formData.append('title', title);
    formData.append('subject', finalSubject);
    formData.append('description', description);
    formData.append('file', file);

    try {
      const token = localStorage.getItem('edupilot_token');
      
      const response = await fetch(`${API_BASE_URL}/api/notes/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.detail || 'Failed to complete upload handshake.');
      }

      setSuccess(true);
      
      // Clear form
      setTitle('');
      setSubject(SUBJECT_OPTIONS[0]);
      setCustomSubject('');
      setDescription('');
      setFile(null);
    } catch (err: any) {
      setError(err.message || 'Failed to upload notes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    return (bytes / 1024).toFixed(1) + ' KB';
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Upload Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h1 style={{ fontSize: '2rem', fontFamily: 'var(--font-display)', fontWeight: 800 }}>Upload Note Packages</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Catalog PDF summaries, textbooks, and exam questions into your private vault.</p>
      </div>

      {success && (
        <div className="glass-card" style={{
          padding: '24px',
          borderLeft: '4px solid var(--success)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <CheckCircle size={32} color="var(--success)" style={{ flexShrink: 0 }} />
            <div>
              <h4 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>Flight Package Cataloged Successfully!</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Your PDF notes have been encrypted and stored in your dashboard archive.</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-secondary" onClick={() => navigate('/library')}>
              View Library
              <ArrowRight size={14} />
            </button>
            <button className="btn btn-ghost" onClick={() => setSuccess(false)}>Upload More</button>
          </div>
        </div>
      )}

      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius-sm)',
          padding: '16px',
          color: '#fca5a5',
          fontSize: '0.9rem'
        }}>
          <AlertTriangle size={20} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Upload Form Box */}
      <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '36px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* PDF Drag & Drop Dropzone */}
        <div 
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={triggerFileSelect}
          style={{
            border: isDragActive ? '2px dashed var(--secondary)' : '2px dashed var(--border-color)',
            backgroundColor: isDragActive ? 'rgba(6, 182, 212, 0.05)' : 'rgba(11, 8, 27, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '40px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px'
          }}
          className="upload-dropzone"
        >
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,application/pdf"
            style={{ display: 'none' }}
          />

          {!file ? (
            <>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(139, 92, 246, 0.2)'
              }} className="dropzone-icon-box">
                <UploadCloud size={30} color="var(--primary)" />
              </div>
              <div>
                <p style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '4px' }}>
                  Drag & Drop PDF or <span style={{ color: 'var(--secondary)' }}>Browse Files</span>
                </p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Only PDF documents accepted (Max 15MB)</p>
              </div>
            </>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              maxWidth: '500px',
              padding: '16px',
              backgroundColor: 'rgba(19,15,46,0.6)',
              border: '1px solid rgba(139,92,246,0.25)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'default'
            }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f87171'
                }}>
                  <FileText size={20} />
                </div>
                <div style={{ textAlign: 'left', minWidth: 0 }}>
                  <p style={{
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>{file.name}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatSize(file.size)}</p>
                </div>
              </div>
              <button 
                onClick={clearSelectedFile}
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: 'none',
                  color: '#fca5a5',
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s'
                }}
                className="delete-file-btn"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Note Metadata Fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }} className="form-row">
          <div className="form-group">
            <label className="form-label">
              <FileText size={15} />
              Document Title
            </label>
            <input 
              type="text" 
              placeholder="e.g. Dynamic Programming Cheat Sheet"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <Bookmark size={15} />
              Subject Category
            </label>
            <select
              className="form-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={loading}
              style={{ appearance: 'none', cursor: 'pointer' }}
            >
              {SUBJECT_OPTIONS.map((sub) => (
                <option key={sub} value={sub} style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                  {sub}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom subject field conditionally rendered */}
        {subject === 'Other' && (
          <div className="form-group" style={{ marginTop: '-8px' }}>
            <label className="form-label">Custom Subject Name</label>
            <input 
              type="text" 
              placeholder="e.g. Cognitive Psychology" 
              className="form-input"
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              disabled={loading}
              required
            />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">
            <AlignLeft size={15} />
            Brief Description (Optional)
          </label>
          <textarea
            placeholder="Add context, class notes reference, or tags to help you search for this later..."
            className="form-input"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
            style={{ resize: 'vertical' }}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', padding: '14px', marginTop: '10px' }}
          disabled={loading}
        >
          {loading ? 'Transmitting PDF...' : 'Secure & Upload note set'}
        </button>

      </form>

      <style>{`
        .upload-dropzone:hover {
          border-color: var(--primary) !important;
          background-color: rgba(139, 92, 246, 0.03) !important;
        }
        .upload-dropzone:hover .dropzone-icon-box {
          background-color: rgba(139, 92, 246, 0.25) !important;
          transform: scale(1.05);
        }
        .delete-file-btn:hover {
          background-color: var(--danger) !important;
          color: white !important;
        }
        @media (max-width: 576px) {
          .form-row {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};
