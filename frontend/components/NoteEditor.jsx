import { useState, useEffect, useCallback, useRef } from 'react'
import { Save, Zap, Trash2, X, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import { getNote, updateNote, deleteNote, analyzeNote } from '../api/client'

const CATEGORY_COLORS = {
  technology: 'cat-technology',
  idea: 'cat-idea',
  person: 'cat-person',
  method: 'cat-method',
  place: 'cat-place',
  event: 'cat-event',
  tool: 'cat-tool',
  other: 'cat-other',
}

export default function NoteEditor({ noteId, onSaved, onDeleted, onNewNote }) {
  const [note, setNote] = useState(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const autoSaveRef = useRef(null)
  const textareaRef = useRef(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    if (!noteId) {
      setNote(null); setTitle(''); setContent(''); setDirty(false); setAnalysisResult(null)
      return
    }
    setError(null)
    getNote(noteId)
      .then(({ data }) => {
        setNote(data)
        setTitle(data.title)
        setContent(data.content)
        setDirty(false)
        setAnalysisResult(null)
      })
      .catch(() => setError('Failed to load note'))
  }, [noteId])

  // Auto-save debounce
  useEffect(() => {
    if (!dirty || !noteId) return
    clearTimeout(autoSaveRef.current)
    autoSaveRef.current = setTimeout(() => save(false), 2000)
    return () => clearTimeout(autoSaveRef.current)
  }, [title, content, dirty])

  const save = useCallback(async (showMsg = true) => {
    if (!noteId) return
    setSaving(true)
    try {
      const { data } = await updateNote(noteId, { title, content })
      setNote(data)
      setDirty(false)
      if (showMsg) showToast('Saved')
      onSaved?.(data)
    } catch {
      showToast('Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }, [noteId, title, content, onSaved])

  const handleAnalyze = async () => {
    if (!noteId) return
    // Save first
    await save(false)
    setAnalyzing(true)
    setAnalysisResult(null)
    setError(null)
    try {
      const { data } = await analyzeNote(noteId)
      setAnalysisResult(data)
      setNote((prev) => ({ ...prev, analyzed: true, summary: data.summary, concepts: data.concepts }))
      onSaved?.({ ...note, analyzed: true })
      showToast(`Found ${data.concepts.length} concepts, ${data.link_count} connections`)
    } catch (err) {
      const msg = err.response?.data?.error || 'Analysis failed'
      showToast(msg, 'error')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleDelete = async () => {
    if (!noteId || !window.confirm('Delete this note?')) return
    await deleteNote(noteId)
    onDeleted?.(noteId)
  }

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      save(true)
    }
    // Tab indentation
    if (e.key === 'Tab') {
      e.preventDefault()
      const start = e.target.selectionStart
      const end = e.target.selectionEnd
      const newContent = content.substring(0, start) + '  ' + content.substring(end)
      setContent(newContent)
      setTimeout(() => {
        textareaRef.current.selectionStart = start + 2
        textareaRef.current.selectionEnd = start + 2
      }, 0)
    }
  }

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0

  if (!noteId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-synapse-500/10 border border-synapse-500/20 flex items-center justify-center">
            <svg viewBox="0 0 32 32" className="w-8 h-8">
              <circle cx="8" cy="8" r="3" fill="#6366f1" opacity="0.8"/>
              <circle cx="24" cy="8" r="3" fill="#22d3ee" opacity="0.8"/>
              <circle cx="16" cy="24" r="3" fill="#818cf8" opacity="0.8"/>
              <line x1="8" y1="8" x2="24" y2="8" stroke="#6366f1" strokeWidth="1.5" opacity="0.5"/>
              <line x1="8" y1="8" x2="16" y2="24" stroke="#6366f1" strokeWidth="1.5" opacity="0.5"/>
              <line x1="24" y1="8" x2="16" y2="24" stroke="#22d3ee" strokeWidth="1.5" opacity="0.5"/>
            </svg>
          </div>
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold text-gray-300 mb-1">Your second brain awaits</h2>
          <p className="text-sm text-gray-600 max-w-xs">Select a note to edit, or create a new one. AI will map the connections.</p>
        </div>
        <button
          onClick={onNewNote}
          className="mt-2 px-5 py-2.5 bg-synapse-500 hover:bg-synapse-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + New Note
        </button>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-full relative ${analyzing ? 'analyzing-border rounded-none' : ''}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          {dirty ? (
            <span className="text-xs text-gray-600 font-mono">unsaved</span>
          ) : saving ? (
            <span className="text-xs text-gray-600 font-mono flex items-center gap-1">
              <Loader className="w-3 h-3 animate-spin" /> saving...
            </span>
          ) : note?.analyzed ? (
            <span className="text-xs text-synapse-400 font-mono flex items-center gap-1">
              <Zap className="w-3 h-3" /> analyzed
            </span>
          ) : null}
          <span className="text-xs text-gray-700 font-mono">{wordCount}w</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAnalyze}
            disabled={analyzing || !content || content.length < 30}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-synapse-500/10 hover:bg-synapse-500/20 border border-synapse-500/30 text-synapse-400 text-xs font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {analyzing ? (
              <><Loader className="w-3.5 h-3.5 animate-spin" /> Analyzing...</>
            ) : (
              <><Zap className="w-3.5 h-3.5" /> Analyze</>
            )}
          </button>
          <button
            onClick={() => save(true)}
            disabled={saving || !dirty}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-panel hover:bg-border border border-border text-gray-400 text-xs font-medium rounded-md transition-colors disabled:opacity-40"
          >
            <Save className="w-3.5 h-3.5" />
            Save
          </button>
          <button
            onClick={handleDelete}
            className="w-7 h-7 flex items-center justify-center text-gray-700 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="px-6 pt-6 pb-3 flex-shrink-0">
        <input
          type="text"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setDirty(true) }}
          placeholder="Note title..."
          className="w-full bg-transparent text-2xl font-display font-semibold text-white placeholder-gray-700 outline-none border-none"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-4">
        <textarea
          ref={textareaRef}
          className="note-textarea"
          value={content}
          onChange={(e) => { setContent(e.target.value); setDirty(true) }}
          onKeyDown={handleKeyDown}
          placeholder="Start writing... your thoughts will find each other."
          style={{ minHeight: '300px' }}
        />
      </div>

      {/* Analysis results panel */}
      {analysisResult && (
        <div className="border-t border-border bg-panel px-6 py-4 flex-shrink-0 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-synapse-400" />
              <span className="text-sm font-display font-semibold text-white">Analysis Complete</span>
            </div>
            <button onClick={() => setAnalysisResult(null)} className="text-gray-600 hover:text-gray-400">
              <X className="w-4 h-4" />
            </button>
          </div>
          {analysisResult.summary && (
            <p className="text-sm text-gray-400 mb-3 leading-relaxed border-l-2 border-synapse-500/40 pl-3">
              {analysisResult.summary}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {analysisResult.concepts?.map((c) => (
              <span
                key={c.id}
                className={`text-xs px-2 py-0.5 rounded border font-mono ${CATEGORY_COLORS[c.category] || 'cat-other'}`}
                style={{ fontSize: '0.7rem' }}
              >
                {c.name}
              </span>
            ))}
          </div>
          {analysisResult.links?.length > 0 && (
            <div className="mt-2 space-y-1">
              {analysisResult.links.map((l) => (
                <div key={l.id} className="flex items-center gap-2 text-xs text-gray-600">
                  <div
                    className="w-1.5 h-1.5 rounded-full bg-neural flex-shrink-0"
                    style={{ opacity: l.strength }}
                  />
                  <span>{l.relationship}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`absolute bottom-4 right-4 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium animate-slide-up shadow-lg ${
          toast.type === 'error'
            ? 'bg-red-500/10 border border-red-500/30 text-red-400'
            : 'bg-pulse/10 border border-pulse/30 text-pulse'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
