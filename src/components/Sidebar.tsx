import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useChatSessions, useDeleteSession, useRenameSession } from '../hooks/useQueries';
import { Plus, MessageSquare, MoreHorizontal, Trash2, Edit2, LogOut } from 'lucide-react';
import { Button, ScrollArea, Avatar, AvatarFallback, AvatarImage, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui';
import { cn } from '../lib/utils';
import { isToday, isYesterday, subDays, isAfter } from 'date-fns';

interface SidebarProps {
  onSelectSession: (id: string | null) => void;
  activeSessionId: string | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ onSelectSession, activeSessionId }) => {
  const { user, logout } = useAuth();
  const { data: sessions = [] } = useChatSessions(user?.uid);
  const deleteMutation = useDeleteSession(user?.uid || '');
  const renameMutation = useRenameSession(user?.uid || '');

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Delete this chat?')) {
      deleteMutation.mutate(id);
      if (activeSessionId === id) onSelectSession(null);
    }
  };

  const handleRename = (e: React.MouseEvent, id: string, oldTitle: string) => {
    e.stopPropagation();
    const newTitle = prompt('Rename chat:', oldTitle);
    if (newTitle && newTitle !== oldTitle) {
      renameMutation.mutate({ sessionId: id, title: newTitle });
    }
  };

  const groupedSessions = () => {
    const groups: Record<string, typeof sessions> = {
      'Today': [], 'Yesterday': [], 'Previous 7 Days': [], 'Older': []
    };
    const now = new Date();
    const sevenDaysAgo = subDays(now, 7);

    sessions.forEach(s => {
      const date = s.lastMessageAt?.toDate() || new Date();
      if (isToday(date)) groups['Today'].push(s);
      else if (isYesterday(date)) groups['Yesterday'].push(s);
      else if (isAfter(date, sevenDaysAgo)) groups['Previous 7 Days'].push(s);
      else groups['Older'].push(s);
    });
    return groups;
  };

  const grouped = groupedSessions();

  return (
    <div className="w-[260px] bg-[#171717] text-white flex flex-col h-full flex-shrink-0">
      <div className="p-3">
        <Button 
          onClick={() => onSelectSession(null)}
          className="w-full justify-start gap-2 bg-transparent hover:bg-white/10 text-white border-none shadow-none h-10 px-3 font-medium"
        >
          <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0">
            <Plus className="h-4 w-4" />
          </div>
          New chat
        </Button>
      </div>

      <ScrollArea className="flex-1 px-3">
        <div className="space-y-6 py-2">
          {Object.entries(grouped).map(([label, grpSessions]) => (
            grpSessions.length > 0 && (
              <div key={label}>
                <h3 className="px-3 text-[11px] font-semibold text-zinc-500 mb-1">{label}</h3>
                <div className="space-y-0.5">
                  {grpSessions.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => onSelectSession(s.id)}
                      className={cn(
                        "group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors",
                        activeSessionId === s.id ? "bg-[#2f2f2f] text-white" : "hover:bg-[#202020] text-zinc-300"
                      )}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <MessageSquare className="h-4 w-4 shrink-0 text-zinc-400" />
                        <span className="truncate">{s.title || 'New Chat'}</span>
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className={cn(
                              "h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10 hover:text-white shrink-0",
                              activeSessionId === s.id && "opacity-100"
                            )}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36 bg-[#2f2f2f] border-white/10 text-zinc-200">
                          <DropdownMenuItem onClick={(e) => handleRename(e as any, s.id, s.title)} className="gap-2 focus:bg-white/10 focus:text-white cursor-pointer">
                            <Edit2 className="h-4 w-4" /> Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => handleDelete(e as any, s.id)} className="gap-2 text-red-400 focus:bg-white/10 focus:text-red-400 cursor-pointer">
                            <Trash2 className="h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      </ScrollArea>

      <div className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-3 h-auto p-2 hover:bg-white/10 rounded-xl">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={user?.photoURL || ''} />
                <AvatarFallback className="bg-primary text-white font-bold">{user?.displayName?.[0] || 'U'}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start overflow-hidden flex-1">
                <span className="text-sm font-medium truncate w-full text-left text-zinc-200">{user?.displayName || 'User'}</span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={10} className="w-56 bg-[#2f2f2f] border-white/10 text-zinc-200">
            <div className="px-2 py-2 mb-1 border-b border-white/10">
              <p className="text-xs font-medium truncate">{user?.email}</p>
            </div>
            <DropdownMenuItem onClick={logout} className="gap-2 cursor-pointer focus:bg-white/10 focus:text-white">
              <LogOut className="h-4 w-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
