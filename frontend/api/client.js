import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8080/api',
  headers: { 'Content-Type': 'application/json' },
})

// Notes
export const getNotes = () => api.get('/notes/')
export const getNote = (id) => api.get(`/notes/${id}`)
export const createNote = (data) => api.post('/notes/', data)
export const updateNote = (id, data) => api.put(`/notes/${id}`, data)
export const deleteNote = (id) => api.delete(`/notes/${id}`)
export const getGraph = () => api.get('/notes/graph')

// AI
export const analyzeNote = (noteId) => api.post(`/ai/analyze/${noteId}`)

export async function* streamChat(message, history) {
  const response = await fetch('http://localhost:8080/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  })

  if (!response.ok) {
    throw new Error(`Chat failed: ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const text = decoder.decode(value)
    const lines = text.split('\n')

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim()
        if (data === '[DONE]') return
        try {
          const parsed = JSON.parse(data)
          if (parsed.delta) yield parsed.delta
        } catch { }
      }
    }
  }
}

export default api