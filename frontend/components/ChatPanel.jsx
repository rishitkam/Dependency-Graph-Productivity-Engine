import { useState, useRef, useEffect } from 'react'
import { Send, Trash2, Bot, User, Sparkles } from 'lucide-react'
import { streamChat } from '../api/client'

const STARTER_QUESTIONS = [
  'What are the main themes across my notes?',
  'Summarize what I know about machine learning',
  'What connections exist between my notes?',
  'What topics do I need to research more?',
]

export default function ChatPanel() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const abortRef = useRef(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text) => {
    const userText = (text || input).trim()
    if (!userText || streaming) return
    setInput('')

    const userMsg = { role: 'user', content: userText, id: Date.now() }
    const aiMsg = { role: 'assistant', content: '', id: Date.now() + 1, streaming: true }

    setMessages((prev) => [...prev, userMsg, aiMsg])
    setStreaming(true)
    abortRef.current = false

    // Build history for API (exclude current streaming msg)
    const history = [...messages, userMsg].map(({ role, content }) => ({ role, content }))

    try {
      let accumulated = ''
      for await (const delta of streamChat(userText, history.slice(0, -1))) {
        if (abortRef.current) break
        accumulated += delta
        setMessages((prev) =>
          prev.map((m) => m.id === aiMsg.id ? { ...m, content: accumulated } : m)
        )
      }
      setMessages((prev) =>
        prev.map((m) => m.id === aiMsg.id ? { ...m, streaming: false } : m)
      )
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsg.id
            ? { ...m, content: 'Something went wrong. Check your API key and try again.', streaming: false, error: true }
            : m
        )
      )
    } finally {
      setStreaming(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    abortRef.current = true
    setMessages([])
    setStreaming(false)
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-synapse-500/20 border border-synapse-500/30 flex items-center justify-center">
            <Bot className="w-3.5 h-3.5 text-synapse-400" />
          </div>
          <span className="font-display font-semibold text-sm text-white">Synapse Chat</span>
          <span className="text-xs text-gray-600 font-mono">· RAG-powered</span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-synapse-500/10 border border-synapse-500/20 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-synapse-400" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-gray-300 mb-1">Ask anything about your notes</h3>
              <p className="text-xs text-gray-600 max-w-xs">
                Synapse reads all your notes and answers based on what you've written. The more notes, the smarter it gets.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 w-full max-w-sm">
              {STARTER_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-left px-3 py-2 text-xs text-gray-400 bg-panel border border-border hover:border-synapse-500/40 rounded-lg transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 animate-fade-in ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  msg.role === 'user'
                    ? 'bg-synapse-500/20 border border-synapse-500/30'
                    : 'bg-panel border border-border'
                }`}>
                  {msg.role === 'user'
                    ? <User className="w-3.5 h-3.5 text-synapse-400" />
                    : <Bot className="w-3.5 h-3.5 text-gray-500" />
                  }
                </div>

                {/* Bubble */}
                <div className={`max-w-[75%] px-4 py-2.5 rounded-xl text-sm leading-relaxed chat-message ${
                  msg.role === 'user'
                    ? 'bg-synapse-500/10 border border-synapse-500/20 text-gray-200'
                    : msg.error
                      ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                      : 'bg-panel border border-border text-gray-300'
                }`}>
                  {msg.content || (msg.streaming && (
                    <span className="text-gray-600 text-xs font-mono">thinking</span>
                  ))}
                  {msg.streaming && msg.content && <span className="cursor-blink" />}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="px-5 py-4 border-t border-border flex-shrink-0">
        <div className="flex items-end gap-3 bg-panel border border-border rounded-xl px-4 py-3 focus-within:border-synapse-500/50 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your knowledge base..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-gray-300 placeholder-gray-700 outline-none resize-none max-h-32 leading-relaxed"
            style={{ minHeight: '22px' }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || streaming}
            className="w-8 h-8 flex items-center justify-center bg-synapse-500 hover:bg-synapse-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors flex-shrink-0"
          >
            {streaming
              ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Send className="w-3.5 h-3.5 text-white" />
            }
          </button>
        </div>
        <p className="text-xs text-gray-700 mt-2 text-center">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
