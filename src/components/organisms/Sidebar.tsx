import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getUserSessions } from '../../services/chatService';
import type { ChatSession } from '../../services/chatService';
import { MessageSquare, Plus, PanelLeftClose } from 'lucide-react';
import { Button } from '../atoms/Button';
import { ScrollArea } from '../atoms/ScrollArea';
import { cn } from '../../lib/utils';

interface SidebarProps {
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  activeSessionId?: string | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ onSelectSession, onNewChat, activeSessionId }) => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  useEffect(() => {
    if (user) {
      getUserSessions(user.uid).then(setSessions);
    }
  }, [user]);

  return (
    <div className="w-72 bg-muted/30 flex flex-col h-full border-r border-border transition-all duration-300">
      <div className="p-4 flex items-center justify-between gap-2 border-b border-border bg-background/50">
        <Button className="flex-1 flex gap-2 shadow-sm" onClick={onNewChat} size="sm">
          <Plus className="w-4 h-4" />
          New Chat
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-1">
          <div className="px-2 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Recent Conversations
          </div>
          {sessions.length === 0 ? (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center italic">
              No recent chats
            </div>
          ) : (
            sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => onSelectSession(s.id)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-md flex items-center gap-3 transition-all group relative overflow-hidden",
                  activeSessionId === s.id 
                    ? "bg-primary/10 text-primary font-medium" 
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <MessageSquare className={cn(
                  "w-4 h-4 shrink-0",
                  activeSessionId === s.id ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )} />
                <span className="truncate text-sm flex-1">{s.title}</span>
                {activeSessionId === s.id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                )}
              </button>
            ))
          )}
        </div>
      </ScrollArea>
      
      <div className="p-4 border-t border-border bg-background/50 text-center">
        <p className="text-[10px] text-muted-foreground">Chat Ultra Pro v1.0</p>
      </div>
    </div>
  );
};
