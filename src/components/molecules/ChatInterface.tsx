import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { useAuth } from '../../context/AuthContext';
import { getUserApiKey, saveUserApiKey, saveMessage, createChatSession, getMessages } from '../../services/chatService';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { ScrollArea } from '../atoms/ScrollArea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../atoms/Dialog';
import { Send, Settings, User, Bot, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../atoms/Avatar';

interface ChatInterfaceProps {
  initialSessionId?: string | null;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ initialSessionId }) => {
  const { user } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages } = useChat({
    api: 'https://api.openai.com/v1/chat/completions',
    initialMessages: [],
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: {
      model: 'gpt-3.5-turbo',
      stream: true,
    },
    onFinish: async (message) => {
      if (sessionId && user) {
        await saveMessage(sessionId, { role: 'assistant', content: message.content });
      }
    }
  });

  useEffect(() => {
    if (initialSessionId) {
      getMessages(initialSessionId).then(msgs => {
        setMessages(msgs.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content
        })));
      });
    }
  }, [initialSessionId, setMessages]);

  useEffect(() => {
    if (user) {
      getUserApiKey(user.uid, 'openai').then(key => {
        if (key) setApiKey(key);
      });
    }
  }, [user]);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const handleSaveSettings = async () => {
    if (user && apiKey) {
      await saveUserApiKey(user.uid, 'openai', apiKey);
      setShowSettings(false);
    }
  };

  const onSend = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || !apiKey) return;

    if (!sessionId && user) {
      const newSessionId = await createChatSession(user.uid, input.substring(0, 30));
      setSessionId(newSessionId);
      await saveMessage(newSessionId, { role: 'user', content: input });
    } else if (sessionId) {
      await saveMessage(sessionId, { role: 'user', content: input });
    }

    handleSubmit(e);
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground relative">
      <ScrollArea ref={scrollRef} className="flex-1 px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6 pb-24">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4 animate-in fade-in duration-700">
              <div className="p-4 bg-primary/10 rounded-full">
                <Sparkles className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight">How can I help you today?</h2>
              <p className="text-muted-foreground max-w-sm">
                Enter your OpenAI API key in settings to start a conversation with the world's most capable AI models.
              </p>
              {!apiKey && (
                <Button variant="outline" className="mt-4 gap-2" onClick={() => setShowSettings(true)}>
                  <Settings className="w-4 h-4" />
                  Set API Key to Start
                </Button>
              )}
            </div>
          )}
          
          {messages.map((m) => (
            <div key={m.id} className={cn(
              "flex gap-4 animate-in slide-in-from-bottom-2 duration-300",
              m.role === 'user' ? "flex-row-reverse" : "flex-row"
            )}>
              <Avatar className={cn(
                "h-9 w-9 border",
                m.role === 'user' ? "bg-primary" : "bg-muted"
              )}>
                {m.role === 'user' ? (
                  <>
                    <AvatarImage src={user?.photoURL || ''} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <User className="w-5 h-5" />
                    </AvatarFallback>
                  </>
                ) : (
                  <AvatarFallback className="bg-muted text-foreground">
                    <Bot className="w-5 h-5" />
                  </AvatarFallback>
                )}
              </Avatar>
              
              <div className={cn(
                "group relative flex flex-col gap-2 max-w-[80%] px-4 py-3 rounded-2xl shadow-sm",
                m.role === 'user' 
                  ? "bg-primary text-primary-foreground rounded-tr-none" 
                  : "bg-muted/50 border border-border rounded-tl-none"
              )}>
                <div className="text-sm whitespace-pre-wrap leading-relaxed">
                  {m.content}
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-4 animate-pulse">
              <Avatar className="h-9 w-9 bg-muted border">
                <AvatarFallback><Bot className="w-5 h-5" /></AvatarFallback>
              </Avatar>
              <div className="bg-muted/30 border border-border px-4 py-3 rounded-2xl rounded-tl-none max-w-[100px]">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce"></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent pt-10">
        <form onSubmit={onSend} className="max-w-3xl mx-auto relative group">
          <Input
            className="pr-24 py-6 shadow-lg border-primary/20 focus-visible:ring-primary/30 rounded-2xl bg-background/80 backdrop-blur-sm"
            value={input}
            placeholder={apiKey ? "Type your message..." : "Please set your API key first"}
            onChange={handleInputChange}
            disabled={!apiKey}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              type="button" 
              onClick={() => setShowSettings(true)}
              className="h-9 w-9 text-muted-foreground hover:text-primary transition-colors"
            >
              <Settings className="w-5 h-5" />
            </Button>
            <Button 
              type="submit" 
              size="icon"
              disabled={isLoading || !apiKey || !input.trim()}
              className="h-9 w-9 rounded-xl shadow-md"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </form>
        <p className="text-[10px] text-center text-muted-foreground mt-2">
          Chat Ultra Pro can make mistakes. Consider checking important information.
        </p>
      </div>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Configuration</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">OpenAI API Key</label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="bg-muted/50"
              />
              <p className="text-[11px] text-muted-foreground italic">
                Your key is stored locally in your private Firestore settings and never shared.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>Cancel</Button>
            <Button onClick={handleSaveSettings}>Save Configuration</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
