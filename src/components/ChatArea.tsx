import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import TextareaAutosize from 'react-textarea-autosize';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

import { useAuth } from '../contexts/AuthContext';
import { useChatMessages, useSaveMessage, useCreateSession, useApiKeys, useSaveApiKey } from '../hooks/useQueries';
import { 
  Button, 
  Input, 
  ScrollArea, 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter, 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue, 
  SelectGroup, 
  SelectLabel, 
  Avatar, 
  AvatarFallback,
  Label
} from './ui';
import { Send, Settings, Sparkles, Zap, Check, Copy } from 'lucide-react';
import { cn } from '../lib/utils';

type ModelID = 'gpt-4o' | 'gpt-4-turbo' | 'gpt-3.5-turbo' | 'gemini-1.5-pro' | 'gemini-1.5-flash';

export const ChatArea: React.FC<{ sessionId: string | null, onSessionCreated: (id: string) => void }> = ({ sessionId, onSessionCreated }) => {
  const { user } = useAuth();
  
  // Data Queries
  const { data: apiKeys } = useApiKeys(user?.uid);
  const { data: historyMessages } = useChatMessages(sessionId);
  const saveMessageMutation = useSaveMessage();
  const createSessionMutation = useCreateSession();
  const saveApiKeyMutation = useSaveApiKey();

  // Local State
  const [selectedModel, setSelectedModel] = useState<ModelID>('gemini-1.5-flash');
  const [showSettings, setShowSettings] = useState(false);
  const [localOpenai, setLocalOpenai] = useState('');
  const [localGoogle, setLocalGoogle] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [input, setInput] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const isGoogle = selectedModel.startsWith('gemini');
  const activeKey = isGoogle ? apiKeys?.google : apiKeys?.openai;

  useEffect(() => {
    if (apiKeys) {
      setLocalOpenai(apiKeys.openai || '');
      setLocalGoogle(apiKeys.google || '');
    }
  }, [apiKeys]);

  // Vercel AI SDK useChat - using manual input handling for maximum compatibility with AI SDK 4
  const { messages, setMessages, status } = useChat({
    // @ts-ignore
    initialMessages: [],
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  // Sync historical messages
  useEffect(() => {
    if (historyMessages) {
      setMessages(historyMessages.map(m => ({ 
        id: m.id || Math.random().toString(), 
        role: m.role as any, 
        content: m.content,
        parts: [{ type: 'text', text: m.content }]
      })));
    } else {
      setMessages([]);
    }
  }, [historyMessages, setMessages]);

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      const container = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (container) container.scrollTop = container.scrollHeight;
    }
  }, [messages, isLoading]);

  const onSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    if (!activeKey) {
      setShowSettings(true);
      return;
    }

    const val = input;
    setInput('');
    
    let sid = sessionId;
    if (!sid && user) {
      sid = await createSessionMutation.mutateAsync({ userId: user.uid, title: val.substring(0, 30) });
      onSessionCreated(sid);
    }

    if (sid) {
      saveMessageMutation.mutate({ sessionId: sid, message: { role: 'user', content: val } });
    }

    // Manual streaming using streamText for reliable client-side execution in AI SDK 4
    try {
      const model = isGoogle 
        ? createGoogleGenerativeAI({ apiKey: activeKey, fetch: window.fetch.bind(window) })(selectedModel)
        : createOpenAI({ apiKey: activeKey, fetch: window.fetch.bind(window) })(selectedModel);

      const userMsg: any = { id: Math.random().toString(), role: 'user', content: val, parts: [{ type: 'text', text: val }] };
      setMessages(prev => [...prev, userMsg]);

      const result = await streamText({
        model: model as any,
        messages: [...messages, userMsg].map((m: any) => ({ 
          role: m.role as any, 
          content: m.content || m.parts?.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('') || ''
        })),
      });

      let fullContent = '';
      const assistantId = Math.random().toString();
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', parts: [] } as any]);

      for await (const delta of result.textStream) {
        fullContent += delta;
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullContent, parts: [{ type: 'text', text: fullContent }] } : m));
      }

      if (sid) {
        saveMessageMutation.mutate({ sessionId: sid, message: { role: 'assistant', content: fullContent } });
      }
    } catch (err: any) {
      console.error(err);
      alert("Failed to get response. Please check your API key in Config.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const saveSettings = () => {
    if (user) {
      saveApiKeyMutation.mutate({ userId: user.uid, provider: 'openai', key: localOpenai });
      saveApiKeyMutation.mutate({ userId: user.uid, provider: 'google', key: localGoogle });
      setShowSettings(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#131314] text-[#1f1f1f] dark:text-[#e3e3e3] relative">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-transparent">
        <Select value={selectedModel} onValueChange={(v) => setSelectedModel(v as ModelID)}>
          <SelectTrigger className="w-auto border-none bg-transparent hover:bg-slate-100 dark:hover:bg-zinc-800 shadow-none text-lg font-medium gap-2 rounded-xl transition-colors h-10 px-3">
            <SelectValue placeholder="Gemini" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <SelectGroup>
              <SelectLabel className="flex items-center gap-2 text-xs text-slate-400">
                <Sparkles className="w-3 h-3 text-blue-500" /> Gemini
              </SelectLabel>
              <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
              <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel className="flex items-center gap-2 text-xs text-slate-400">
                <Zap className="w-3 h-3 text-orange-500" /> OpenAI
              </SelectLabel>
              <SelectItem value="gpt-4o">GPT-4o</SelectItem>
              <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
              <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)} className="rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-zinc-800 h-10 w-10 p-0">
          <Settings className="w-5 h-5" />
        </Button>
      </div>

      <ScrollArea ref={scrollRef} className="flex-1">
        <div className="max-w-3xl mx-auto py-12 px-6 pb-40">
          {messages.length === 0 && (
            <div className="flex flex-col items-start justify-center min-h-[40vh] animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <h1 className="text-[56px] font-medium tracking-tight mb-2 leading-tight bg-gradient-to-r from-[#4285f4] via-[#9b72cb] to-[#d96570] text-transparent bg-clip-text">
                Hello, {user?.displayName?.split(' ')[0] || 'User'}
              </h1>
              <h2 className="text-[56px] font-medium tracking-tight text-[#444746] dark:text-[#8e918f] leading-tight mb-12">
                How can I help you today?
              </h2>
            </div>
          )}
          
          <div className="space-y-12">
            {messages.map((m: any) => {
              const content = m.content || m.parts?.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('') || '';
              const isUser = m.role === 'user';
              
              return (
                <div key={m.id} className={cn("flex w-full group", isUser ? "justify-end" : "justify-start")}>
                  <div className={cn("flex max-w-[90%] gap-4", isUser ? "flex-row-reverse" : "flex-row")}>
                    
                    <Avatar className={cn(
                      "h-8 w-8 shrink-0 mt-1",
                      isUser ? "hidden" : "bg-gradient-to-br from-blue-500 to-purple-600 p-0.5"
                    )}>
                      {!isUser && (
                        <AvatarFallback className="bg-white dark:bg-zinc-900 text-blue-600"><Sparkles className="w-4 h-4" /></AvatarFallback>
                      )}
                    </Avatar>

                    <div className={cn(
                      "flex flex-col gap-1 w-full min-w-0",
                      isUser ? "items-end" : "items-start"
                    )}>
                      <div className={cn(
                        "relative text-[16px] leading-relaxed",
                        isUser 
                          ? "bg-[#f0f4f9] dark:bg-[#282a2c] text-[#1f1f1f] dark:text-[#e3e3e3] px-5 py-3 rounded-[24px]" 
                          : "text-[#1f1f1f] dark:text-[#e3e3e3] w-full"
                      )}>
                        {isUser ? (
                          <div className="whitespace-pre-wrap">{content}</div>
                        ) : (
                          <div className="prose prose-slate dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-[#1e1e1e] prose-pre:border-none prose-code:text-blue-400">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                code({ node, inline, className, children, ...props }: any) {
                                  const match = /language-(\w+)/.exec(className || '');
                                  const codeStr = String(children).replace(/\n$/, '');
                                  if (!inline && match) {
                                    return (
                                      <div className="relative rounded-2xl overflow-hidden my-6 border border-slate-200 dark:border-zinc-800 bg-[#1e1e1e] shadow-lg">
                                        <div className="flex items-center justify-between px-4 py-2.5 bg-[#2b2b2b] text-xs text-zinc-400 font-medium border-b border-zinc-800">
                                          <span className="uppercase tracking-widest text-[10px]">{match[1]}</span>
                                          <button 
                                            onClick={() => { navigator.clipboard.writeText(codeStr); setCopiedCode(codeStr); setTimeout(() => setCopiedCode(null), 2000); }} 
                                            className="flex items-center gap-1.5 hover:text-zinc-100 transition-colors"
                                          >
                                            {copiedCode === codeStr ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />} 
                                            {copiedCode === codeStr ? 'Copied' : 'Copy'}
                                          </button>
                                        </div>
                                        <SyntaxHighlighter 
                                          {...props} 
                                          style={vscDarkPlus} 
                                          language={match[1]} 
                                          PreTag="div" 
                                          customStyle={{ margin: 0, padding: '20px', background: 'transparent', fontSize: '14px', lineHeight: '1.6' }}
                                        >
                                          {codeStr}
                                        </SyntaxHighlighter>
                                      </div>
                                    );
                                  }
                                  return <code {...props} className={cn("bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md font-mono text-[13px] text-blue-600 dark:text-blue-400", className)}>{children}</code>;
                                }
                              }}
                            >
                              {content}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {isLoading && (
              <div className="flex gap-4 animate-in fade-in duration-300">
                <Avatar className="h-8 w-8 shrink-0 bg-gradient-to-br from-blue-500 to-purple-600 p-0.5">
                  <AvatarFallback className="bg-white dark:bg-zinc-900 text-blue-600"><Sparkles className="w-4 h-4" /></AvatarFallback>
                </Avatar>
                <div className="flex items-center h-8 gap-1.5">
                  <div className="w-2 h-2 bg-blue-500/60 rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:-0.3s]" />
                  <div className="w-2 h-2 bg-purple-500/60 rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:-0.15s]" />
                  <div className="w-2 h-2 bg-red-500/60 rounded-full animate-bounce [animation-duration:0.8s]" />
                </div>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Gemini Style Pill Input */}
      <div className="absolute bottom-0 left-0 right-0 px-6 pb-8 pt-10 bg-gradient-to-t from-white dark:from-[#131314] via-white/95 dark:via-[#131314]/95 to-transparent">
        <div className="max-w-3xl mx-auto">
          <form 
            onSubmit={(e) => { e.preventDefault(); onSend(); }}
            className="relative flex items-end w-full rounded-[32px] bg-[#f0f4f9] dark:bg-[#1e1f20] border border-transparent focus-within:bg-white dark:focus-within:bg-[#282a2c] focus-within:border-slate-200 dark:focus-within:border-zinc-700 focus-within:shadow-md transition-all px-4 py-3"
          >
            <TextareaAutosize
              className="flex-1 max-h-[300px] min-h-[24px] w-full resize-none bg-transparent px-2 py-1 text-[16px] focus:outline-none placeholder:text-[#444746] dark:placeholder:text-[#8e918f] text-slate-900 dark:text-slate-100"
              value={input}
              placeholder={activeKey ? "Enter a prompt here" : "Configure API Key to start"}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!activeKey}
              rows={1}
            />
            <div className="flex items-center gap-1">
              <Button 
                type="submit" 
                size="icon" 
                disabled={isLoading || !activeKey || !input.trim()} 
                className={cn(
                  "h-10 w-10 shrink-0 rounded-full transition-all duration-200 shadow-none border-none",
                  input.trim() ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-transparent text-slate-400 dark:text-zinc-600 cursor-default"
                )}
              >
                <Send className="w-5 h-5 ml-0.5" />
              </Button>
            </div>
          </form>
          <p className="text-[11px] text-center text-slate-500 dark:text-[#8e918f] mt-4 font-normal">
            Gemini may display inaccurate info, including about people, so double-check its responses. 
            <span className="underline ml-1 cursor-pointer">Your privacy and Gemini Apps</span>
          </p>
        </div>
      </div>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-md rounded-2xl border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-xl">Settings</DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">OpenAI API Key</Label>
              <Input 
                type="password" 
                value={localOpenai} 
                onChange={(e) => setLocalOpenai(e.target.value)} 
                placeholder="sk-..."
                className="rounded-xl border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Google Gemini API Key</Label>
              <Input 
                type="password" 
                value={localGoogle} 
                onChange={(e) => setLocalGoogle(e.target.value)} 
                placeholder="AIza..."
                className="rounded-xl border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl">
              <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
                Your keys are stored securely in your private Firestore instance. They are only used to authenticate your requests from this browser.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)} className="rounded-full px-6">Cancel</Button>
            <Button onClick={saveSettings} className="rounded-full px-8 bg-blue-600 hover:bg-blue-700 text-white">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
