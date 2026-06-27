import React, { useState, useEffect, useRef } from 'react'
import { streamText } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import TextareaAutosize from 'react-textarea-autosize'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { isToday, isYesterday, format } from 'date-fns'

import { useAuth } from '../contexts/AuthContext'
import { useChatMessages, useSaveMessage, useCreateSession, useApiKeys, useSaveApiKey } from '../hooks/useQueries'
import {
  Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, Label,
} from './ui'
import { Send, Settings, Sparkles, Zap, Check, Copy, ThumbsUp, ThumbsDown, Menu, RefreshCw, AlertCircle } from 'lucide-react'
import { cn } from '../lib/utils'

// ── Model IDs ─────────────────────────────────────────────────────────────────
// gemini-1.5-flash / gemini-1.5-pro were deprecated and removed from v1beta API.
// Use gemini-2.0-flash (GA) and later previews.
type ModelID =
  | 'gemini-2.0-flash'
  | 'gemini-2.0-flash-lite'
  | 'gemini-2.5-flash-preview-05-20'
  | 'gemini-2.5-pro-preview-06-05'
  | 'gpt-4o'
  | 'gpt-4-turbo'
  | 'gpt-3.5-turbo'

const MODEL_LABELS: Record<ModelID, string> = {
  'gemini-2.0-flash': 'Gemini 2.0 Flash',
  'gemini-2.0-flash-lite': 'Gemini 2.0 Flash Lite',
  'gemini-2.5-flash-preview-05-20': 'Gemini 2.5 Flash',
  'gemini-2.5-pro-preview-06-05': 'Gemini 2.5 Pro',
  'gpt-4o': 'GPT-4o',
  'gpt-4-turbo': 'GPT-4 Turbo',
  'gpt-3.5-turbo': 'GPT-3.5 Turbo',
}

interface LocalMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
  isError?: boolean
}

interface ChatAreaProps {
  sessionId: string | null
  onSessionCreated: (id: string) => void
  onToggleSidebar: () => void
  sidebarOpen: boolean
}

// ── Suggestion cards ───────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { emoji: '💡', title: 'Brainstorm ideas', subtitle: 'for a fun weekend project' },
  { emoji: '🐛', title: 'Help me debug', subtitle: 'code I\'m working on' },
  { emoji: '✍️', title: 'Write an email', subtitle: 'for a professional request' },
  { emoji: '🌍', title: 'Plan a trip', subtitle: 'to a dream destination' },
]

// ── Helpers ────────────────────────────────────────────────────────────────────
const formatMsgTime = (date: Date) =>
  format(date, 'h:mm a')

const formatDateLabel = (date: Date): string => {
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'MMMM d, yyyy')
}

// Returns true if two dates are on different calendar days
const isDifferentDay = (a: Date, b: Date) =>
  a.toDateString() !== b.toDateString()

// ── SVG logo (no hook needed — one per mounting) ───────────────────────────────
const GeminiStar = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
    <path d="M22 3L24.5 19.5L41 22L24.5 24.5L22 41L19.5 24.5L3 22L19.5 19.5Z" fill="url(#gs-c)" />
    <defs>
      <linearGradient id="gs-c" x1="3" y1="3" x2="41" y2="41" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4285f4" /><stop offset=".5" stopColor="#9b72cb" /><stop offset="1" stopColor="#d96570" />
      </linearGradient>
    </defs>
  </svg>
)

// ── Typing dots ────────────────────────────────────────────────────────────────
const TypingDots = () => (
  <div className="flex items-center gap-1.5 h-8 py-2">
    <span className="w-2 h-2 rounded-full bg-[#4285f4]/70 animate-bounce [animation-duration:0.8s] [animation-delay:-0.32s]" />
    <span className="w-2 h-2 rounded-full bg-[#9b72cb]/70 animate-bounce [animation-duration:0.8s] [animation-delay:-0.16s]" />
    <span className="w-2 h-2 rounded-full bg-[#d96570]/70 animate-bounce [animation-duration:0.8s]" />
  </div>
)

// ── Full-page spinner (session load) ──────────────────────────────────────────
const LoadingSpinner = () => (
  <div className="flex flex-1 items-center justify-center min-h-full">
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 rounded-full border-[3px] border-[#f0f4f9] dark:border-[#282a2c]" />
        <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#1a73e8] animate-spin" />
      </div>
      <p className="text-sm text-[#80868b] dark:text-[#5f6368]">Loading conversation…</p>
    </div>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
export const ChatArea: React.FC<ChatAreaProps> = ({
  sessionId, onSessionCreated, onToggleSidebar, sidebarOpen,
}) => {
  const { user } = useAuth()
  const { data: apiKeys } = useApiKeys(user?.uid)
  const { data: historyMessages, isLoading: isLoadingHistory } = useChatMessages(sessionId)
  const saveMessageMutation = useSaveMessage()
  const createSessionMutation = useCreateSession()
  const saveApiKeyMutation = useSaveApiKey()

  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [selectedModel, setSelectedModel] = useState<ModelID>('gemini-2.0-flash')
  const [showSettings, setShowSettings] = useState(false)
  const [localGoogle, setLocalGoogle] = useState('')
  const [localOpenai, setLocalOpenai] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesRef = useRef<LocalMessage[]>([])

  const isGeminiModel = selectedModel.startsWith('gemini')
  const activeKey = isGeminiModel ? apiKeys?.google : apiKeys?.openai
  const hasKey = !!activeKey

  // Keep ref current so async handler captures latest messages
  useEffect(() => { messagesRef.current = messages }, [messages])

  // Populate API-key inputs when loaded
  useEffect(() => {
    if (apiKeys) {
      setLocalGoogle(apiKeys.google || '')
      setLocalOpenai(apiKeys.openai || '')
    }
  }, [apiKeys])

  // Load history when session changes
  useEffect(() => {
    if (historyMessages) {
      setMessages(
        historyMessages.map(m => ({
          id: m.id || crypto.randomUUID(),
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
          createdAt:
            m.createdAt instanceof Date
              ? m.createdAt
              : (m.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
        }))
      )
    } else if (!sessionId) {
      setMessages([])
    }
  }, [historyMessages, sessionId])

  // Auto-scroll on new messages / streaming
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Send handler ─────────────────────────────────────────────────────────────
  const handleSend = async (overrideText?: string) => {
    const val = (overrideText ?? input).trim()
    if (!val || isStreaming) return

    if (!hasKey) {
      setShowSettings(true)
      return
    }

    setInput('')

    const now = new Date()
    const userMsg: LocalMessage = { id: 'u-' + Date.now(), role: 'user', content: val, createdAt: now }
    setMessages(prev => [...prev, userMsg])

    let sid = sessionId
    try {
      // Create Firestore session on first message
      if (!sid && user) {
        sid = await createSessionMutation.mutateAsync({
          userId: user.uid,
          title: val.length > 50 ? val.slice(0, 50) + '…' : val,
        })
        onSessionCreated(sid)
      }
      if (sid) {
        saveMessageMutation.mutate({ sessionId: sid, message: { role: 'user', content: val } })
      }

      // Insert placeholder for streaming response
      setIsStreaming(true)
      const assistantId = 'a-' + Date.now()
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', createdAt: new Date() }])

      const provider = isGeminiModel
        ? createGoogleGenerativeAI({ apiKey: activeKey!, fetch: window.fetch.bind(window) })
        : createOpenAI({ apiKey: activeKey!, fetch: window.fetch.bind(window) })

      // Build conversation history (exclude the empty assistant placeholder)
      const historyForAI = [...messagesRef.current.filter(m => m.content), userMsg].map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

      const result = await streamText({
        model: provider(selectedModel) as any,
        messages: historyForAI,
      })

      let fullContent = ''
      for await (const delta of result.textStream) {
        fullContent += delta
        setMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, content: fullContent } : m)
        )
      }

      // Persist final assistant message
      if (sid && fullContent) {
        saveMessageMutation.mutate({ sessionId: sid, message: { role: 'assistant', content: fullContent } })
      }
    } catch (err: any) {
      console.error('[ChatArea] stream error:', err)
      const raw = err?.message ?? ''
      const errorText =
        raw.includes('API_KEY_INVALID') || raw.includes('API key not valid') || raw.includes('INVALID_ARGUMENT')
          ? 'Invalid API key. Open Settings and check your key.'
          : raw.includes('RESOURCE_EXHAUSTED') || raw.includes('quota')
            ? 'API quota exceeded. Check your usage limits.'
            : raw.includes('not found') || raw.includes('404') || raw.includes('is not found')
              ? `Model "${MODEL_LABELS[selectedModel] ?? selectedModel}" is unavailable. Try a different model.`
              : raw.includes('PERMISSION_DENIED') || raw.includes('403')
                ? 'API key does not have permission for this model.'
                : raw || 'Something went wrong. Please try again.'

      // Replace the empty placeholder with an error message
      setMessages(prev =>
        prev.map(m =>
          m.role === 'assistant' && m.content === ''
            ? { ...m, content: errorText, isError: true }
            : m
        )
      )
    } finally {
      setIsStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const saveSettings = () => {
    if (user) {
      if (localGoogle.trim()) saveApiKeyMutation.mutate({ userId: user.uid, provider: 'google', key: localGoogle.trim() })
      if (localOpenai.trim()) saveApiKeyMutation.mutate({ userId: user.uid, provider: 'openai', key: localOpenai.trim() })
      setShowSettings(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#131314]">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b border-[#f0f4f9] dark:border-[#1e1f20]">
        <div className="flex items-center gap-1">
          {!sidebarOpen && (
            <button
              onClick={onToggleSidebar}
              className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#282a2c] transition-colors mr-1"
            >
              <Menu className="h-5 w-5 text-[#444746] dark:text-[#8e918f]" />
            </button>
          )}
          <Select value={selectedModel} onValueChange={v => setSelectedModel(v as ModelID)}>
            <SelectTrigger className="w-auto border-none bg-transparent hover:bg-[#f1f3f4] dark:hover:bg-[#282a2c] shadow-none text-[15px] font-medium gap-1 rounded-full h-9 px-3 text-[#1f1f1f] dark:text-[#e3e3e3]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-[#dadce0] dark:border-[#3c4043] bg-white dark:bg-[#2f2f2f] shadow-xl">
              <SelectGroup>
                <SelectLabel className="flex items-center gap-2 text-[11px] text-[#80868b] uppercase tracking-wide px-2 pb-1">
                  <GeminiStar size={12} /> Gemini
                </SelectLabel>
                <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash</SelectItem>
                <SelectItem value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite</SelectItem>
                <SelectItem value="gemini-2.5-flash-preview-05-20">Gemini 2.5 Flash</SelectItem>
                <SelectItem value="gemini-2.5-pro-preview-06-05">Gemini 2.5 Pro</SelectItem>
              </SelectGroup>
              <SelectGroup>
                <SelectLabel className="flex items-center gap-2 text-[11px] text-[#80868b] uppercase tracking-wide px-2 pb-1 pt-2">
                  <Zap className="w-3 h-3 text-orange-500" /> OpenAI
                </SelectLabel>
                <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <button
          onClick={() => setShowSettings(true)}
          className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#282a2c] transition-colors text-[#444746] dark:text-[#8e918f]"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* ── Main scroll area ── */}
      <div className="flex-1 overflow-y-auto flex flex-col">

        {/* Loading session history */}
        {sessionId && isLoadingHistory ? (
          <LoadingSpinner />
        ) : messages.length === 0 ? (

          /* ── Welcome / Home screen ── */
          <div className="flex-1 flex flex-col justify-center px-4 py-16">
            <div className="w-full max-w-2xl mx-auto">
              <h1 className="text-[40px] sm:text-[52px] font-medium tracking-tight leading-[1.1] bg-gradient-to-r from-[#4285f4] via-[#9b72cb] to-[#d96570] text-transparent bg-clip-text mb-1">
                Hello, {user?.displayName?.split(' ')[0] || 'there'}
              </h1>
              <h2 className="text-[40px] sm:text-[52px] font-medium tracking-tight leading-[1.1] text-[#c4c7c5] dark:text-[#444746] mb-12">
                How can I help you today?
              </h2>

              {/* No API key banner */}
              {!hasKey && (
                <div className="mb-8 flex items-start gap-3 p-4 rounded-2xl bg-[#fff8e1] dark:bg-[#2d2000] border border-[#f9d976] dark:border-[#4a3400]">
                  <span className="text-lg mt-0.5 flex-shrink-0">🔑</span>
                  <div>
                    <p className="text-sm font-medium text-[#7c5200] dark:text-[#ffd54f]">
                      Add a Google Gemini API key to start chatting
                    </p>
                    <button
                      onClick={() => setShowSettings(true)}
                      className="text-sm text-[#1a73e8] dark:text-[#8ab4f8] hover:underline mt-0.5"
                    >
                      Open Settings →
                    </button>
                  </div>
                </div>
              )}

              {/* Suggestion cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInput(`${s.title} ${s.subtitle}`)
                      setTimeout(() => textareaRef.current?.focus(), 50)
                    }}
                    className="flex items-start gap-4 p-4 rounded-2xl border border-[#dadce0] dark:border-[#3c4043] hover:bg-[#f8f9fa] dark:hover:bg-[#1e1f20] hover:border-[#c2d3f8] dark:hover:border-[#1a4fa8] text-left transition-all duration-150"
                  >
                    <span className="text-2xl leading-none mt-0.5 flex-shrink-0">{s.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1f1f1f] dark:text-[#e3e3e3] truncate">{s.title}</p>
                      <p className="text-sm text-[#444746] dark:text-[#8e918f] mt-0.5 truncate">{s.subtitle}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

        ) : (

          /* ── Message list ── */
          <div className="w-full max-w-3xl mx-auto px-4 py-6 pb-6 space-y-1">
            {messages.map((m, idx) => {
              const isUser = m.role === 'user'
              const isEmpty = !m.content && !m.isError
              const prevMsg = messages[idx - 1]
              const showDateDivider = !prevMsg || isDifferentDay(m.createdAt, prevMsg.createdAt)

              return (
                <React.Fragment key={m.id}>
                  {/* Date separator */}
                  {showDateDivider && (
                    <div className="flex items-center gap-3 py-4">
                      <div className="flex-1 h-px bg-[#f0f4f9] dark:bg-[#282a2c]" />
                      <span className="text-[11px] font-medium text-[#80868b] dark:text-[#5f6368] px-2 select-none">
                        {formatDateLabel(m.createdAt)}
                      </span>
                      <div className="flex-1 h-px bg-[#f0f4f9] dark:bg-[#282a2c]" />
                    </div>
                  )}

                  {/* Message row */}
                  <div className={cn('flex w-full group py-2', isUser ? 'justify-end' : 'justify-start')}>
                    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse max-w-[85%]' : 'flex-row w-full max-w-full')}>

                      {/* AI avatar */}
                      {!isUser && (
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#4285f4] to-[#9b72cb] flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                          <Sparkles className="w-4 h-4 text-white" />
                        </div>
                      )}

                      <div className={cn('flex flex-col gap-1', isUser ? 'items-end' : 'items-start w-full min-w-0')}>

                        {/* Bubble */}
                        <div className={cn(
                          'text-[15px] leading-relaxed break-words',
                          isUser
                            ? 'bg-[#f0f4f9] dark:bg-[#282a2c] px-5 py-3 rounded-[22px] text-[#1f1f1f] dark:text-[#e3e3e3] shadow-sm max-w-full'
                            : m.isError
                              ? 'flex items-start gap-2 px-4 py-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-sm w-full'
                              : 'text-[#1f1f1f] dark:text-[#e3e3e3] w-full'
                        )}>
                          {isUser ? (
                            <span className="whitespace-pre-wrap">{m.content}</span>
                          ) : m.isError ? (
                            <>
                              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                              <span>{m.content}</span>
                            </>
                          ) : isEmpty ? (
                            <TypingDots />
                          ) : (
                            <div className="prose prose-slate dark:prose-invert max-w-none
                              prose-p:my-2 prose-p:leading-[1.7]
                              prose-headings:text-[#1f1f1f] dark:prose-headings:text-[#e3e3e3] prose-headings:font-semibold prose-headings:mt-5 prose-headings:mb-2
                              prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5
                              prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0
                              prose-code:text-[#d93025] dark:prose-code:text-[#f28b82]
                              prose-code:bg-[#f1f3f4] dark:prose-code:bg-[#282a2c]
                              prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md
                              prose-code:text-[13px] prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
                              prose-strong:text-[#1f1f1f] dark:prose-strong:text-[#e3e3e3]
                              prose-blockquote:border-[#dadce0] dark:prose-blockquote:border-[#3c4043] prose-blockquote:text-[#444746] dark:prose-blockquote:text-[#8e918f]
                              prose-table:text-sm prose-th:text-[#1f1f1f] dark:prose-th:text-[#e3e3e3]">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  code({ inline, className, children, ...props }: React.HTMLAttributes<HTMLElement> & { inline?: boolean }) {
                                    const match = /language-(\w+)/.exec(className || '')
                                    const codeStr = String(children).replace(/\n$/, '')
                                    if (!inline && match) {
                                      return (
                                        <div className="relative rounded-xl overflow-hidden my-4 border border-[#dadce0] dark:border-[#3c4043] shadow-sm not-prose">
                                          {/* Code header */}
                                          <div className="flex items-center justify-between px-4 py-2 bg-[#f8f9fa] dark:bg-[#1e1e1e] border-b border-[#dadce0] dark:border-[#3c4043]">
                                            <span className="text-[11px] font-mono font-medium text-[#444746] dark:text-[#8e918f] uppercase tracking-widest">
                                              {match[1]}
                                            </span>
                                            <button
                                              onClick={() => navigator.clipboard.writeText(codeStr)}
                                              className="flex items-center gap-1.5 text-[11px] text-[#80868b] hover:text-[#1f1f1f] dark:hover:text-[#e3e3e3] transition-colors"
                                            >
                                              <Copy className="w-3 h-3" /> Copy code
                                            </button>
                                          </div>
                                          <SyntaxHighlighter
                                            {...props}
                                            style={vscDarkPlus}
                                            language={match[1]}
                                            PreTag="div"
                                            customStyle={{
                                              margin: 0,
                                              padding: '14px 18px',
                                              background: '#1e1e1e',
                                              fontSize: '13px',
                                              lineHeight: '1.65',
                                            }}
                                          >
                                            {codeStr}
                                          </SyntaxHighlighter>
                                        </div>
                                      )
                                    }
                                    return <code {...props} className={className}>{children}</code>
                                  },
                                }}
                              >
                                {m.content}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>

                        {/* Timestamp + actions row */}
                        <div className={cn(
                          'flex items-center gap-2 px-1',
                          isUser ? 'flex-row-reverse' : 'flex-row'
                        )}>
                          {/* Timestamp — always visible */}
                          <span className="text-[11px] text-[#80868b] dark:text-[#5f6368] select-none flex-shrink-0">
                            {formatMsgTime(m.createdAt)}
                          </span>

                          {/* Action buttons — visible on hover for AI messages */}
                          {!isUser && m.content && !m.isError && (
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                              <button
                                onClick={() => handleCopy(m.content, m.id)}
                                title="Copy response"
                                className="flex items-center gap-1 px-2 py-1 rounded-full text-[#444746] dark:text-[#8e918f] hover:bg-[#f1f3f4] dark:hover:bg-[#282a2c] text-xs transition-colors"
                              >
                                {copiedId === m.id
                                  ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                                  : <Copy className="w-3.5 h-3.5" />}
                                <span>{copiedId === m.id ? 'Copied' : 'Copy'}</span>
                              </button>
                              <button title="Good response" className="p-1.5 rounded-full text-[#444746] dark:text-[#8e918f] hover:bg-[#f1f3f4] dark:hover:bg-[#282a2c] transition-colors">
                                <ThumbsUp className="w-3.5 h-3.5" />
                              </button>
                              <button title="Bad response" className="p-1.5 rounded-full text-[#444746] dark:text-[#8e918f] hover:bg-[#f1f3f4] dark:hover:bg-[#282a2c] transition-colors">
                                <ThumbsDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          {/* Retry button on error */}
                          {!isUser && m.isError && (
                            <button
                              onClick={() => {
                                // Remove the error message and the user message before it, then re-send
                                const errIdx = messages.findIndex(x => x.id === m.id)
                                const prevUser = errIdx > 0 ? messages[errIdx - 1] : null
                                if (prevUser?.role === 'user') {
                                  setMessages(prev => prev.filter(x => x.id !== m.id))
                                  handleSend(prevUser.content)
                                }
                              }}
                              className="flex items-center gap-1 px-2 py-1 rounded-full text-[#1a73e8] dark:text-[#8ab4f8] hover:bg-[#e8f0fe] dark:hover:bg-[#1a3a6e] text-xs transition-colors"
                            >
                              <RefreshCw className="w-3.5 h-3.5" /> Retry
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              )
            })}
            <div ref={bottomRef} className="h-4" />
          </div>
        )}
      </div>

      {/* ── Input bar ── */}
      <div className="flex-shrink-0 px-4 pb-5 pt-2">
        <div className="max-w-3xl mx-auto">
          <div className={cn(
            'flex items-end gap-2 rounded-[28px] px-5 py-3 transition-all duration-200',
            'bg-[#f0f4f9] dark:bg-[#1e1f20]',
            'focus-within:bg-white dark:focus-within:bg-[#282a2c]',
            'focus-within:shadow-[0_2px_12px_rgba(32,33,36,.18)] dark:focus-within:shadow-[0_2px_12px_rgba(0,0,0,.45)]',
            'border border-transparent focus-within:border-[#dadce0] dark:focus-within:border-[#3c4043]'
          )}>
            <TextareaAutosize
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={hasKey ? 'Ask Gemini' : 'Add an API key in settings to start'}
              disabled={isStreaming}
              minRows={1}
              maxRows={8}
              className="flex-1 resize-none bg-transparent text-[15px] text-[#1f1f1f] dark:text-[#e3e3e3] placeholder:text-[#80868b] dark:placeholder:text-[#5f6368] focus:outline-none leading-relaxed py-0.5 disabled:opacity-60"
            />

            {/* Send / loading button */}
            <button
              onClick={() => handleSend()}
              disabled={isStreaming || !input.trim()}
              className={cn(
                'h-9 w-9 flex items-center justify-center rounded-full flex-shrink-0 transition-all duration-200',
                isStreaming
                  ? 'bg-[#1a73e8] text-white cursor-default'
                  : input.trim()
                    ? 'bg-[#1a73e8] hover:bg-[#1557b0] active:bg-[#1246a0] text-white shadow-sm'
                    : 'bg-transparent text-[#c4c7c5] dark:text-[#3c4043] cursor-default'
              )}
            >
              {isStreaming
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Send className="w-4 h-4" />}
            </button>
          </div>

          <p className="text-[11px] text-center text-[#80868b] dark:text-[#5f6368] mt-3 select-none">
            Gemini can make mistakes, so double-check its responses.
          </p>
        </div>
      </div>

      {/* ── Settings dialog ── */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl border-[#dadce0] dark:border-[#3c4043] bg-white dark:bg-[#1e1e1f] text-[#1f1f1f] dark:text-[#e3e3e3] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-medium">API Keys</DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-[#444746] dark:text-[#9aa0a6] flex items-center gap-1.5">
                <GeminiStar size={14} /> Google Gemini API Key
              </Label>
              <Input
                type="password"
                value={localGoogle}
                onChange={e => setLocalGoogle(e.target.value)}
                placeholder="AIza…"
                className="rounded-xl border-[#dadce0] dark:border-[#3c4043] bg-[#f8f9fa] dark:bg-[#282a2c] h-10 text-sm"
              />
              <p className="text-[11px] text-[#80868b] dark:text-[#5f6368]">
                Get your free key at{' '}
                <span className="text-[#1a73e8] dark:text-[#8ab4f8] font-medium">aistudio.google.com</span>
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-[#444746] dark:text-[#9aa0a6] flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-orange-500" /> OpenAI API Key
              </Label>
              <Input
                type="password"
                value={localOpenai}
                onChange={e => setLocalOpenai(e.target.value)}
                placeholder="sk-…"
                className="rounded-xl border-[#dadce0] dark:border-[#3c4043] bg-[#f8f9fa] dark:bg-[#282a2c] h-10 text-sm"
              />
              <p className="text-[11px] text-[#80868b] dark:text-[#5f6368]">
                Get your key at{' '}
                <span className="text-[#1a73e8] dark:text-[#8ab4f8] font-medium">platform.openai.com</span>
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[#f8f9fa] dark:bg-[#282a2c] border border-[#dadce0] dark:border-[#3c4043]">
              <p className="text-[11px] text-[#444746] dark:text-[#8e918f] leading-relaxed">
                🔒 Keys are stored securely in your Firebase account and only used to call AI APIs directly from your browser.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowSettings(false)}
              className="rounded-full text-sm text-[#444746] dark:text-[#8e918f]"
            >
              Cancel
            </Button>
            <Button
              onClick={saveSettings}
              className="rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white text-sm px-6 shadow-sm"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
