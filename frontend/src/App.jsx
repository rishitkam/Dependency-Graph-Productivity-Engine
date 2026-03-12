import { useState, useEffect, useCallback } from 'react'
import { FileText, GitBranch, MessageSquare, Plus } from 'lucide-react'
import Sidebar from './components/Sidebar'
import NoteEditor from './components/NoteEditor'
import KnowledgeGraph from './components/KnowledgeGraph'
import ChatPanel from './components/ChatPanel'
import { getNotes, createNote } from './api/client'

const TABS = [
  { id: 'editor', label: 'Notes', icon: FileText },
  { id: 'graph', label: 'Graph', icon: GitBranch },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
]

export default function App() {
  const [notes, setNotes] = useState([])
  const [notesLoading, setNotesLoading] = useState(true)
  const [activeNoteId, setActiveNoteId] = useState(null)
  const [activeTab, setActiveTab] = useState('editor')
  const [graphRefresh, setGraphRefresh] = useState(0)

  const loadNotes = useCallback(async () => {
    try {
      const { data } = await getNotes()
      setNotes(data)
    } catch {}
    setNotesLoading(false)
  }, [])

  useEffect(() => { loadNotes() }, [])

  const handleNewNote = async () => {
    const { data } = await createNote({ title: 'Untitled Note', content: '' })
    setNotes((prev) => [data, ...prev])
    setActiveNoteId(data.id)
    setActiveTab('editor')
  }

  const handleSelectNote = (id) => {
    setActiveNoteId(id)
    setActiveTab('editor')
  }

  const handleNoteSaved = (updated) => {
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n)))
    setGraphRefresh((r) => r + 1)
  }

  const handleNoteDeleted = (deletedId) => {
    setNotes((prev) => prev.filter((n) => n.id !== deletedId))
    if (activeNoteId === deletedId) setActiveNoteId(null)
    setGraphRefresh((r) => r + 1)
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-void font-body">
      {/* Sidebar */}
      <div className="w-72 flex-shrink-0 h-full">
        <Sidebar
          notes={notes}
          activeNoteId={activeNoteId}
          onSelectNote={handleSelectNote}
          onNewNote={handleNewNote}
          loading={notesLoading}
        />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Tab bar */}
        <div className="flex items-center gap-1 px-4 py-2.5 border-b border-border bg-surface flex-shrink-0">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  active
                    ? 'bg-synapse-500/10 text-synapse-400 border border-synapse-500/20'
                    : 'text-gray-600 hover:text-gray-400'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="font-display">{tab.label}</span>
              </button>
            )
          })}

          <div className="flex-1" />

          {/* Quick new note from any tab */}
          {activeTab !== 'editor' && (
            <button
              onClick={handleNewNote}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Note
            </button>
          )}

          {/* Status indicator */}
          <div className="flex items-center gap-1.5 text-xs text-gray-700 font-mono">
            <div className="w-1.5 h-1.5 rounded-full bg-pulse animate-pulse-slow" />
            {notes.filter((n) => n.analyzed).length}/{notes.length} analyzed
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 relative">
          {/* Editor tab */}
          <div className={`absolute inset-0 ${activeTab === 'editor' ? 'block' : 'hidden'}`}>
            <NoteEditor
              noteId={activeNoteId}
              onSaved={handleNoteSaved}
              onDeleted={handleNoteDeleted}
              onNewNote={handleNewNote}
            />
          </div>

          {/* Graph tab */}
          <div className={`absolute inset-0 ${activeTab === 'graph' ? 'block' : 'hidden'}`}>
            <KnowledgeGraph
              onSelectNote={handleSelectNote}
              refreshTrigger={graphRefresh}
            />
          </div>

          {/* Chat tab */}
          <div className={`absolute inset-0 ${activeTab === 'chat' ? 'block' : 'hidden'}`}>
            <ChatPanel />
          </div>
        </div>
      </div>
    </div>
  )
}
