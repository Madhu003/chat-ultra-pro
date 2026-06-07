import { useState } from 'react'
import { Navbar } from './components/organisms/Navbar'
import { ChatInterface } from './components/molecules/ChatInterface'
import { Sidebar } from './components/organisms/Sidebar'
import { useAuth } from './context/AuthContext'
import { LoginPage } from './pages/Login'

function App() {
  const { user } = useAuth()
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  const handleNewChat = () => {
    setSelectedSessionId(null)
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar 
          onSelectSession={setSelectedSessionId} 
          onNewChat={handleNewChat}
          activeSessionId={selectedSessionId}
        />
        <main className="flex-1 flex flex-col relative overflow-hidden">
          <ChatInterface key={selectedSessionId} initialSessionId={selectedSessionId} />
        </main>
      </div>
    </div>
  )
}

export default App
