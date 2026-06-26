import { useState, useEffect } from 'react'
import { ChatArea } from './components/ChatArea'
import { Sidebar } from './components/Sidebar'
import { useAuth } from './contexts/AuthContext'
import { Login } from './components/Login'

function App() {
  const { user } = useAuth()
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [chatKey, setChatKey] = useState<string | number>(Date.now())
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('gemini-theme')
    if (stored) return stored === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem('gemini-theme', isDark ? 'dark' : 'light')
  }, [isDark])

  const handleSelectSession = (id: string | null) => {
    if (id === null) {
      setSelectedSessionId(null)
      setChatKey(Date.now())
    } else {
      setSelectedSessionId(id)
      setChatKey(id)
    }
  }

  if (!user) return <Login />

  return (
    <div className="flex h-screen w-full bg-white dark:bg-[#131314] overflow-hidden">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
        onSelectSession={handleSelectSession}
        activeSessionId={selectedSessionId}
        isDark={isDark}
        onToggleDark={() => setIsDark(d => !d)}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <ChatArea
          key={chatKey}
          sessionId={selectedSessionId}
          onSessionCreated={setSelectedSessionId}
          onToggleSidebar={() => setSidebarOpen(o => !o)}
          sidebarOpen={sidebarOpen}
        />
      </div>
    </div>
  )
}

export default App
