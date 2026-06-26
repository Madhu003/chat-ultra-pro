import React, { useState, useEffect, useRef } from 'react'
import { streamText } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import TextareaAutosize from 'react-textarea-autosize'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

import { useAuth } from '../contexts/AuthContext'
import { useChatMessages, useSaveMessage, useCreateSession, useApiKeys, useSaveApiKey } from '../hooks/useQueries'
import {
  Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, Label,
} from './ui'
import { Send, Settings, Sparkles, Zap, Check, Copy, ThumbsUp, ThumbsDown, Menu } from 'lucide-react'
import { cn } from '../lib/utils'

type ModelID = 'gemini-1.5-flash' | 'gemini-1.5-pro' | 'gemini-2.0-flash' | 'gpt-4o' | 'gpt-4-turbo' | 'gpt-3.5-turbo'

interface LocalMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ChatAreaProps {
  sessionId: string | null
  onSessionCreated: (id: string) => void
  onToggleSidebar: () => void
  sidebarOpen: boolean
}

const SUGGESTIONS = [
  { emoji: '💡', title: 'Brainstorm ideas', subtitle: 'for a fun weekend project' },
  { emoji: '🐛', title: 'Help me debug', subtitle: 'code I\'m working on' },
  { emoji: '✍️', title: 'Write an email', subtitle: 'for a professional request' },
  { emoji: '🌍', title: 'Plan a trip', subtitle: 'to a dream destination' },
]

const GeminiStar = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
    <path
      d="M22 3L24.5 19.5L41 22L24.5 24.5L22 41L19.5 24.5L3 22L19.5 19.5Z"
      fill="url(#gemini-chat-grad)"
    />
    <defs>
      <linearGradient id="gemini-chat-grad" x1="3" y1="3" x2="41" y2="41" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4285f4" />
        <stop offset="0.5" stopColor="#9b72cb" />
        <stop offset="1" stopColor="#d96570" />
      </linearGradient>
    </defs>
  </svg>
)

export const ChatArea: React.FC<ChatAreaProps> = ({
  sessionId, onSessionCreated, onToggleSidebar, sidebarOpen,
}) => {
  const { user } = useAuth()
  const { data: apiKeys } = useApiKeys(user?.uid)
  const { data: historyMessages } = useChatMessages(sessionId)
  const saveMessageMutation = useSaveMessage()
  const createSessionMutation = useCreateSession()
  const saveApiKeyMutation = useSaveApiKey()

  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [selectedModel, setSelectedModel] = useState<ModelID>('gemini-1.5-flash')
  const [showSettings, setShowSettings] = useState(false)
  const [localGoogle, setLocalGoogle] = useState('')
  const [localOpenai, setLocalOpenai] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesRef = useRef<LocalMessage[]>(messages)

  const isGeminiModel = selectedModel.startsWith('gemini')
  const activeKey = isGeminiModel ? apiKeys?.google : apiKeys?.openai
  const hasKey = !!activeKey

  // Keep messagesRef in sync for use inside async handlers
  useEffect(() => { messagesRef.current = messages }, [messages])

  useEffect(() => {
    if (apiKeys) {
      setLocalGoogle(apiKeys.google || '')
      setLocalOpenai(apiKeys.openai || '')
    }
  }, [apiKeys])

  useEffect(() => {
    if (historyMessages) {
      setMessages(
        historyMessages.map(m => ({
          id: m.id || Math.random().toString(36).slice(2),
          role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
          content: m.content,
        }))
      )
    } else {
      setMessages([])
    }
  }, [historyMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (overrideText?: string) => {
    const val = (overrideText ?? input).trim()
    if (!val || isStreaming) return

    if (!hasKey) {
      setShowSettings(true)
      return
    }

    setInput('')
    const userMsg: LocalMessage = { id: 'u-' + Date.now(), role: 'user', content: val }
    setMessages(prev => [...prev, userMsg])

    let sid = sessionId
    try {
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

      setIsStreaming(true)
      const assistantId = 'a-' + Date.now()
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }])

      const provider = isGeminiModel
        ? createGoogleGenerativeAI({ apiKey: activeKey!, fetch: window.fetch.bind(window) })
        : createOpenAI({ apiKey: activeKey!, fetch: window.fetch.bind(window) })

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

      if (sid && fullContent) {
        saveMessageMutation.mutate({ sessionId: sid, message: { role: 'assistant', content: fullContent } })
      }
    } catch (err: any) {
      console.error(err)
      const errorText = err.message?.includes('API_KEY_INVALID') || err.message?.includes('API key not valid')
        ? 'Invalid API key. Please check your settings and try again.'
        : err.message?.includes('quota')
          ? 'API quota exceeded. Please check your usage limits.'
          : err.message || 'Something went wrong. Please try again.'
      setMessages(prev =>
        prev.map(m =>
          m.role === 'assistant' && m.content === ''
            ? { ...m, content: `**Error:** ${errorText}` }
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

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#131314]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
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
                <SelectLabel className="flex items-center gap-2 text-[11px] text-[#80868b] uppercase tracking-wide px-2">
                  <GeminiStar size={12} /> Gemini
                </SelectLabel>
                <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash</SelectItem>
              </SelectGroup>
              <SelectGroup>
                <SelectLabel className="flex items-center gap-2 text-[11px] text-[#80868b] uppercase tracking-wide px-2">
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
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          /* ── Home screen ── */
          <div className="flex flex-col min-h-full px-4 pb-40 pt-16">
            <div className="w-full max-w-2xl mx-auto">
              <h1 className="text-[40px] sm:text-[52px] font-medium tracking-tight leading-tight bg-gradient-to-r from-[#4285f4] via-[#9b72cb] to-[#d96570] text-transparent bg-clip-text mb-1">
                Hello, {user?.displayName?.split(' ')[0] || 'there'}
              </h1>
              <h2 className="text-[40px] sm:text-[52px] font-medium tracking-tight leading-tight text-[#c4c7c5] dark:text-[#444746] mb-10">
                How can I help you today?
              </h2>

              {/* API key nudge */}
              {!hasKey && (
                <div className="mb-8 flex items-start gap-3 p-4 rounded-2xl bg-[#fff8e1] dark:bg-[#2d2000] border border-[#f9d976] dark:border-[#4a3400]">
                  <span className="text-lg mt-0.5">🔑</span>
                  <div>
                    <p className="text-sm font-medium text-[#7c5200] dark:text-[#ffd54f]">
                      Add an API key to start chatting
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
                      setTimeout(() => textareaRef.current?.focus(), 0)
                    }}
                    className="flex items-start gap-4 p-4 rounded-2xl border border-[#dadce0] dark:border-[#3c4043] hover:bg-[#f8f9fa] dark:hover:bg-[#1e1f20] hover:border-[#c2d3f8] dark:hover:border-[#3a5c9e] text-left transition-all group"
                  >
                    <span className="text-2xl mt-0.5 flex-shrink-0">{s.emoji}</span>
                    <div>
                      <p className="text-sm font-medium text-[#1f1f1f] dark:text-[#e3e3e3]">{s.title}</p>
                      <p className="text-sm text-[#444746] dark:text-[#8e918f] mt-0.5">{s.subtitle}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ── Messages ── */
          <div className="max-w-3xl mx-auto px-4 py-8 pb-40 space-y-8">
            {messages.map(m => {
              const isUser = m.role === 'user'
              const isEmpty = !m.content

              return (
                <div key={m.id} className={cn('flex w-full group', isUser ? 'justify-end' : 'justify-start')}>
                  <div className={cn('flex gap-4', isUser ? 'flex-row-reverse max-w-[85%]' : 'flex-row w-full')}>
                    {/* AI avatar */}
                    {!isUser && (
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#4285f4] to-[#9b72cb] flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                    )}

                    <div className={cn('flex flex-col', isUser ? 'items-end' : 'items-start w-full')}>
                      {/* Bubble / content */}
                      <div className={cn(
                        'text-[15px] leading-relaxed',
                        isUser
                          ? 'bg-[#f0f4f9] dark:bg-[#282a2c] px-5 py-3 rounded-[24px] text-[#1f1f1f] dark:text-[#e3e3e3] shadow-sm'
                          : 'text-[#1f1f1f] dark:text-[#e3e3e3] w-full'
                      )}>
                        {isUser ? (
                          <span className="whitespace-pre-wrap">{m.content}</span>
                        ) : isEmpty ? (
                          /* Typing indicator */
                          <div className="flex items-center gap-1.5 h-8 py-2">
                            <div className="w-2 h-2 bg-[#4285f4]/60 rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:-0.3s]" />
                            <div className="w-2 h-2 bg-[#9b72cb]/60 rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:-0.15s]" />
                            <div className="w-2 h-2 bg-[#d96570]/60 rounded-full animate-bounce [animation-duration:0.8s]" />
                          </div>
                        ) : (
                          <div className="prose prose-slate dark:prose-invert max-w-none prose-p:leading-relaxed prose-p:my-3 prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0 prose-headings:text-[#1f1f1f] dark:prose-headings:text-[#e3e3e3] prose-li:my-1 prose-code:text-[#e06c75] prose-code:bg-[#f1f3f4] dark:prose-code:bg-[#282a2c] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-[13px] prose-code:font-mono prose-strong:text-[#1f1f1f] dark:prose-strong:text-[#e3e3e3]">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                code({ node, inline, className, children, ...props }: any) {
                                  const match = /language-(\w+)/.exec(className || '')
                                  const codeStr = String(children).replace(/\n$/, '')
                                  if (!inline && match) {
                                    return (
                                      <div className="relative rounded-2xl overflow-hidden my-4 border border-[#dadce0] dark:border-[#3c4043] shadow-md not-prose">
                                        <div className="flex items-center justify-between px-4 py-2 bg-[#f8f9fa] dark:bg-[#1e1e1e] border-b border-[#dadce0] dark:border-[#3c4043]">
                                          <span className="text-[11px] font-mono font-medium text-[#444746] dark:text-[#8e918f] uppercase tracking-widest">
                                            {match[1]}
                                          </span>
                                          <button
                                            onClick={() => navigator.clipboard.writeText(codeStr)}
                                            className="flex items-center gap-1.5 text-[11px] text-[#80868b] hover:text-[#1f1f1f] dark:hover:text-[#e3e3e3] transition-colors"
                                          >
                                            <Copy className="w-3 h-3" /> Copy
                                          </button>
                                        </div>
                                        <SyntaxHighlighter
                                          {...props}
                                          style={vscDarkPlus}
                                          language={match[1]}
                                          PreTag="div"
                                          customStyle={{
                                            margin: 0,
                                            padding: '16px 20px',
                                            background: '#1e1e1e',
                                            fontSize: '13px',
                                            lineHeight: '1.6',
                                          }}
                                        >
                                          {codeStr}
                                        </SyntaxHighlighter>
                                      </div>
                                    )
                                  }
                                  return (
                                    <code {...props} className={className}>
                                      {children}
                                    </code>
                                  )
                                },
                              }}
                            >
                              {m.content}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>

                      {/* AI message actions */}
                      {!isUser && m.content && (
                        <div className="flex items-center gap-0.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleCopy(m.content, m.id)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[#444746] dark:text-[#8e918f] hover:bg-[#f1f3f4] dark:hover:bg-[#282a2c] text-xs transition-colors"
                          >
                            {copiedId === m.id
                              ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                              : <Copy className="w-3.5 h-3.5" />}
                            {copiedId === m.id ? 'Copied' : 'Copy'}
                          </button>
                          <button className="p-1.5 rounded-full text-[#444746] dark:text-[#8e918f] hover:bg-[#f1f3f4] dark:hover:bg-[#282a2c] transition-colors">
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>
                          <button className="p-1.5 rounded-full text-[#444746] dark:text-[#8e918f] hover:bg-[#f1f3f4] dark:hover:bg-[#282a2c] transition-colors">
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Input area ── */}
      <div className="flex-shrink-0 px-4 pb-6 pt-0">
        <div className="max-w-3xl mx-auto">
          <div className={cn(
            'flex items-end gap-2 rounded-[28px] px-5 py-3 transition-all duration-200',
            'bg-[#f0f4f9] dark:bg-[#1e1f20]',
            'focus-within:bg-white dark:focus-within:bg-[#282a2c]',
            'focus-within:shadow-[0_2px_12px_rgba(32,33,36,.2)] dark:focus-within:shadow-[0_2px_12px_rgba(0,0,0,.4)]',
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
              className="flex-1 resize-none bg-transparent text-[15px] text-[#1f1f1f] dark:text-[#e3e3e3] placeholder:text-[#80868b] dark:placeholder:text-[#5f6368] focus:outline-none leading-relaxed py-0.5"
            />
            <button
              onClick={() => handleSend()}
              disabled={isStreaming || !input.trim()}
              className={cn(
                'h-9 w-9 flex items-center justify-center rounded-full flex-shrink-0 transition-all duration-200',
                input.trim() && !isStreaming
                  ? 'bg-[#1a73e8] hover:bg-[#1557b0] text-white shadow-sm scale-100'
                  : 'bg-transparent text-[#bdc1c6] dark:text-[#3c4043] cursor-default scale-90'
              )}
            >
              <Send className="w-4 h-4" />
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
            <DialogTitle className="text-lg font-medium">Settings</DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-[#444746] dark:text-[#9aa0a6]">
                Google Gemini API Key
              </Label>
              <Input
                type="password"
                value={localGoogle}
                onChange={e => setLocalGoogle(e.target.value)}
                placeholder="AIza…"
                className="rounded-xl border-[#dadce0] dark:border-[#3c4043] bg-[#f8f9fa] dark:bg-[#282a2c] h-10 text-sm focus-visible:ring-[#1a73e8]"
              />
              <p className="text-[11px] text-[#80868b] dark:text-[#5f6368]">
                Get your key at{' '}
                <span className="text-[#1a73e8] dark:text-[#8ab4f8]">aistudio.google.com</span>
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-[#444746] dark:text-[#9aa0a6]">
                OpenAI API Key
              </Label>
              <Input
                type="password"
                value={localOpenai}
                onChange={e => setLocalOpenai(e.target.value)}
                placeholder="sk-…"
                className="rounded-xl border-[#dadce0] dark:border-[#3c4043] bg-[#f8f9fa] dark:bg-[#282a2c] h-10 text-sm focus-visible:ring-[#1a73e8]"
              />
              <p className="text-[11px] text-[#80868b] dark:text-[#5f6368]">
                Get your key at{' '}
                <span className="text-[#1a73e8] dark:text-[#8ab4f8]">platform.openai.com</span>
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
              className="rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white text-sm px-6"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
