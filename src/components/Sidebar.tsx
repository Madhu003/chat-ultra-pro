import React from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useChatSessions, useDeleteSession, useRenameSession } from '../hooks/useQueries'
import { Plus, MoreHorizontal, Trash2, Edit2, LogOut, Moon, Sun, Menu } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui'
import { cn } from '../lib/utils'
import { isToday, isYesterday, subDays, isAfter } from 'date-fns'

interface SidebarProps {
  open: boolean
  onToggle: () => void
  onSelectSession: (id: string | null) => void
  activeSessionId: string | null
  isDark: boolean
  onToggleDark: () => void
}

const GeminiStar = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
    <path
      d="M22 3L24.5 19.5L41 22L24.5 24.5L22 41L19.5 24.5L3 22L19.5 19.5Z"
      fill="url(#gemini-sidebar-grad)"
    />
    <defs>
      <linearGradient id="gemini-sidebar-grad" x1="3" y1="3" x2="41" y2="41" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4285f4" />
        <stop offset="0.5" stopColor="#9b72cb" />
        <stop offset="1" stopColor="#d96570" />
      </linearGradient>
    </defs>
  </svg>
)

export const Sidebar: React.FC<SidebarProps> = ({
  open, onToggle, onSelectSession, activeSessionId, isDark, onToggleDark
}) => {
  const { user, logout } = useAuth()
  const { data: sessions = [] } = useChatSessions(user?.uid)
  const deleteMutation = useDeleteSession(user?.uid || '')
  const renameMutation = useRenameSession(user?.uid || '')

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (confirm('Delete this chat?')) {
      deleteMutation.mutate(id)
      if (activeSessionId === id) onSelectSession(null)
    }
  }

  const handleRename = (e: React.MouseEvent, id: string, oldTitle: string) => {
    e.stopPropagation()
    const newTitle = prompt('Rename chat:', oldTitle)
    if (newTitle && newTitle.trim() && newTitle !== oldTitle) {
      renameMutation.mutate({ sessionId: id, title: newTitle.trim() })
    }
  }

  const groupSessions = () => {
    const groups: Record<string, typeof sessions> = {
      Today: [], Yesterday: [], 'Previous 7 days': [], Older: [],
    }
    const sevenDaysAgo = subDays(new Date(), 7)
    sessions.forEach(s => {
      const date = s.lastMessageAt?.toDate?.() || new Date()
      if (isToday(date)) groups.Today.push(s)
      else if (isYesterday(date)) groups.Yesterday.push(s)
      else if (isAfter(date, sevenDaysAgo)) groups['Previous 7 days'].push(s)
      else groups.Older.push(s)
    })
    return groups
  }

  const grouped = groupSessions()

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={onToggle}
        />
      )}

      <div
        className={cn(
          'flex flex-col h-full flex-shrink-0 bg-[#f0f4f9] dark:bg-[#1b1b1b] transition-[width] duration-300 overflow-hidden z-30',
          'relative',
          open ? 'w-[260px]' : 'w-[72px]'
        )}
      >
        {/* Top bar */}
        <div className={cn('flex items-center gap-2 px-3 pt-3 pb-2 flex-shrink-0', !open && 'justify-center')}>
          <button
            onClick={onToggle}
            className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex-shrink-0 transition-colors"
          >
            <Menu className="h-5 w-5 text-[#444746] dark:text-[#8e918f]" />
          </button>
          {open && (
            <div className="flex items-center gap-2 overflow-hidden">
              <GeminiStar />
              <span className="text-[16px] font-medium text-[#1f1f1f] dark:text-[#e3e3e3] whitespace-nowrap">
                Gemini
              </span>
            </div>
          )}
        </div>

        {/* New chat */}
        <div className={cn('px-3 pb-2', !open && 'flex justify-center')}>
          {open ? (
            <button
              onClick={() => onSelectSession(null)}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[#1f1f1f] dark:text-[#e3e3e3] text-sm font-medium transition-colors"
            >
              <div className="h-8 w-8 flex items-center justify-center bg-white dark:bg-[#282a2c] rounded-full shadow-sm flex-shrink-0">
                <Plus className="h-4 w-4 text-[#444746] dark:text-[#8e918f]" />
              </div>
              New chat
            </button>
          ) : (
            <button
              onClick={() => onSelectSession(null)}
              title="New chat"
              className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              <Plus className="h-5 w-5 text-[#444746] dark:text-[#8e918f]" />
            </button>
          )}
        </div>

        {/* Chat history — only when sidebar is open */}
        {open && (
          <div className="flex-1 overflow-y-auto px-2 py-1 space-y-4">
            {Object.entries(grouped).map(([label, grpSessions]) =>
              grpSessions.length > 0 ? (
                <div key={label}>
                  <h3 className="px-3 text-[11px] font-semibold text-[#80868b] dark:text-[#5f6368] mb-1 uppercase tracking-wide">
                    {label}
                  </h3>
                  <div className="space-y-0.5">
                    {grpSessions.map(s => (
                      <div
                        key={s.id}
                        onClick={() => onSelectSession(s.id)}
                        className={cn(
                          'group flex items-center justify-between px-3 py-2 rounded-full cursor-pointer text-sm transition-colors',
                          activeSessionId === s.id
                            ? 'bg-[#c2d3f8] dark:bg-[#1e3a6e] text-[#001d6e] dark:text-[#adc6ff]'
                            : 'hover:bg-black/5 dark:hover:bg-white/5 text-[#444746] dark:text-[#bdc1c6]'
                        )}
                      >
                        <span className="truncate flex-1 min-w-0">{s.title || 'New Chat'}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className={cn(
                                'ml-1 h-6 w-6 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-opacity flex-shrink-0',
                                activeSessionId === s.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                              )}
                              onClick={e => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-36 bg-white dark:bg-[#2f2f2f] border-[#dadce0] dark:border-[#3c4043] shadow-xl rounded-xl"
                          >
                            <DropdownMenuItem
                              onClick={e => handleRename(e as any, s.id, s.title)}
                              className="gap-2 cursor-pointer text-sm text-[#1f1f1f] dark:text-[#e3e3e3] focus:bg-[#f1f3f4] dark:focus:bg-white/10 rounded-lg"
                            >
                              <Edit2 className="h-3.5 w-3.5" /> Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={e => handleDelete(e as any, s.id)}
                              className="gap-2 cursor-pointer text-sm text-red-500 dark:text-red-400 focus:bg-[#f1f3f4] dark:focus:bg-white/10 rounded-lg"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null
            )}
          </div>
        )}

        {/* Spacer when collapsed */}
        {!open && <div className="flex-1" />}

        {/* Footer */}
        <div className={cn('border-t border-black/5 dark:border-white/5 p-3 space-y-1', !open && 'flex flex-col items-center gap-1 space-y-0')}>
          {/* Dark mode toggle */}
          {open ? (
            <button
              onClick={onToggleDark}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[#444746] dark:text-[#bdc1c6] text-sm transition-colors"
            >
              {isDark
                ? <Sun className="h-4 w-4 flex-shrink-0" />
                : <Moon className="h-4 w-4 flex-shrink-0" />}
              {isDark ? 'Light mode' : 'Dark mode'}
            </button>
          ) : (
            <button
              onClick={onToggleDark}
              title={isDark ? 'Light mode' : 'Dark mode'}
              className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              {isDark
                ? <Sun className="h-4 w-4 text-[#8e918f]" />
                : <Moon className="h-4 w-4 text-[#444746]" />}
            </button>
          )}

          {/* User profile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {open ? (
                <button className="flex items-center gap-3 w-full px-3 py-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-left transition-colors">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={user?.photoURL || ''} />
                    <AvatarFallback className="bg-[#1a73e8] text-white text-sm font-bold">
                      {user?.displayName?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col overflow-hidden flex-1 min-w-0">
                    <span className="text-sm font-medium truncate text-[#1f1f1f] dark:text-[#e3e3e3]">
                      {user?.displayName || 'User'}
                    </span>
                    <span className="text-[11px] text-[#80868b] dark:text-[#5f6368] truncate">
                      {user?.email}
                    </span>
                  </div>
                </button>
              ) : (
                <button
                  title={user?.displayName || 'Account'}
                  className="h-10 w-10 flex items-center justify-center"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.photoURL || ''} />
                    <AvatarFallback className="bg-[#1a73e8] text-white text-sm font-bold">
                      {user?.displayName?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </button>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align={open ? 'end' : 'start'}
              sideOffset={8}
              className="w-56 bg-white dark:bg-[#2f2f2f] border-[#dadce0] dark:border-[#3c4043] shadow-xl rounded-xl"
            >
              <div className="px-3 py-2 mb-1 border-b border-[#dadce0] dark:border-[#3c4043]">
                <p className="text-xs font-medium text-[#1f1f1f] dark:text-[#e3e3e3] truncate">
                  {user?.displayName}
                </p>
                <p className="text-[11px] text-[#80868b] dark:text-[#5f6368] truncate">{user?.email}</p>
              </div>
              <DropdownMenuItem
                onClick={logout}
                className="gap-2 cursor-pointer text-sm text-[#1f1f1f] dark:text-[#e3e3e3] focus:bg-[#f1f3f4] dark:focus:bg-white/10 rounded-lg"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </>
  )
}
