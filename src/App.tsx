import { useState } from 'react'
import { ChatArea } from './components/ChatArea'
import { Sidebar } from './components/Sidebar'
import { useAuth } from './contexts/AuthContext'
import { Login } from './components/Login'

function App() {
  const { user } = useAuth()
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [chatKey, setChatKey] = useState(0)

  const handleSelectSession = (id: string | null) => {
    if (id === null) {
      setChatKey(prev => prev + 1);
    }
    setSelectedSessionId(id)
  }

  if (!user) {
    return <Login />
  }

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <Sidebar 
        onSelectSession={handleSelectSession} 
        activeSessionId={selectedSessionId}
      />
      
      <div className="flex-1 flex flex-col min-w-0 relative">
        <main className="flex-1 overflow-hidden relative">
          <ChatArea 
            key={selectedSessionId ? selectedSessionId : `new-${chatKey}`} 
            sessionId={selectedSessionId}
            onSessionCreated={(id) => handleSelectSession(id)}
          />
        </main>
      </div>
    </div>
  )
}

export default App
