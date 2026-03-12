import { useState } from 'react'
import { Plus, Search, FileText, Zap, ChevronRight } from 'lucide-react'

export default function Sidebar({ notes, activeNoteId, onSelectNote, onNewNote, loading }) {
  const [query, setQuery] = useState('')

  const filtered = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(query.toLowerCase()) ||
      n.concepts?.some((c) => c.name.toLowerCase().includes(query.toLowerCase()))
  )

  const formatDate = (iso) => {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now - d
    const diffH = diffMs / 3600000
    if (diffH < 24) return `${Math.round(diffH)}h ago`
    if (diffH < 168) return `${Math.round(diffH / 24)}d ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="flex flex-col h-full bg-surface border-r border-border">
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-synapse-500 flex items-center justify-center">
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-white">
                <circle cx="4" cy="4" r="2"/>
                <circle cx="12" cy="4" r="2"/>
                <circle cx="8" cy="12" r="2"/>
                <line x1="4" y1="4" x2="12" y2="4" stroke="white" strokeWidth="1.5"/>
                <line x1="4" y1="4" x2="8" y2="12" stroke="white" strokeWidth="1.5"/>
                <line x1="12" y1="4" x2="8" y2="12" stroke="white" strokeWidth="1.5"/>
              </svg>
            </div>
            <span className="font-display font-700 text-sm text-white tracking-wide">SYNAPSE</span>
          </div>
          <button
            onClick={onNewNote}
            className="w-7 h-7 rounded-md bg-synapse-500 hover:bg-synapse-600 flex items-center justify-center transition-colors"
            title="New note"
          >
            <Plus className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
          <input
            type="text"
            placeholder="Search notes & concepts..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs bg-panel border border-border rounded-md text-gray-300 placeholder-gray-600 focus:outline-none focus:border-synapse-500 transition-colors"
          />
        </div>
      </div>

      {/* Note count */}
      <div className="px-4 pb-2">
        <span className="text-xs font-mono text-gray-600">
          {filtered.length} {filtered.length === 1 ? 'note' : 'notes'}
        </span>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center h-20">
            <div className="w-5 h-5 border-2 border-synapse-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center px-4">
            <FileText className="w-8 h-8 text-gray-700 mb-2" />
            <p className="text-xs text-gray-600">
              {query ? 'No notes match your search' : 'No notes yet. Create one!'}
            </p>
          </div>
        ) : (
          filtered.map((note) => (
            <button
              key={note.id}
              onClick={() => onSelectNote(note.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-all group relative ${
                activeNoteId === note.id
                  ? 'bg-synapse-500/10 border border-synapse-500/30'
                  : 'hover:bg-panel border border-transparent'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {note.analyzed && (
                      <Zap className="w-3 h-3 text-synapse-400 flex-shrink-0" />
                    )}
                    <span className={`text-sm font-medium truncate block ${
                      activeNoteId === note.id ? 'text-white' : 'text-gray-300'
                    }`}>
                      {note.title}
                    </span>
                  </div>
                  {note.summary && (
                    <p className="text-xs text-gray-600 mt-0.5 line-clamp-2 leading-relaxed">
                      {note.summary}
                    </p>
                  )}
                  {note.concepts && note.concepts.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {note.concepts.slice(0, 3).map((c) => (
                        <span
                          key={c.id}
                          className="text-xs px-1.5 py-0.5 rounded border font-mono cat-other"
                          style={{ fontSize: '0.65rem' }}
                        >
                          {c.name}
                        </span>
                      ))}
                      {note.concepts.length > 3 && (
                        <span className="text-xs text-gray-700" style={{ fontSize: '0.65rem' }}>
                          +{note.concepts.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-xs text-gray-700 font-mono">{formatDate(note.updated_at)}</span>
                  {note.link_count > 0 && (
                    <span className="text-xs text-neural font-mono opacity-70">
                      {note.link_count}↔
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
