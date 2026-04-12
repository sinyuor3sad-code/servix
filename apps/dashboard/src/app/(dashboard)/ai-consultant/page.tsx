'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Mic, MicOff, Volume2, VolumeX, Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

// ─── Types ───

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// ─── Quick Suggestions ───

const QUICK_SUGGESTIONS = [
  { emoji: '📊', text: 'كم إيرادات اليوم؟' },
  { emoji: '👥', text: 'مين أحسن موظف هالشهر؟' },
  { emoji: '💡', text: 'أعطيني أفكار تسويقية' },
  { emoji: '💰', text: 'هل أسعاري مناسبة؟' },
  { emoji: '📋', text: 'ملخص اليوم' },
  { emoji: '🔄', text: 'العملاء اللي ما رجعوا' },
];

// ─── Component ───

export default function AiConsultantPage(): React.ReactElement {
  const { accessToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Check Speech API support
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    setSpeechSupported(!!SpeechRecognition);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content:
            'أهلاً بك! 👋\n\nأنا مستشارك الذكي. أقدر أساعدك في:\n\n• 📊 تحليل الإيرادات والأداء\n• 👥 تقييم أداء الموظفين\n• 💡 أفكار تسويقية وعروض\n• 💰 تحليل الأسعار\n• 📋 ملخصات يومية\n\nاسألني أي سؤال عن صالونك!',
          timestamp: new Date(),
        },
      ]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Send Message ───

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading || !accessToken) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setIsLoading(true);

      try {
        const result = await api.post<{ answer: string }>(
          '/salon/ai-consultant/ask',
          { question: text.trim() },
          accessToken,
        );

        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: result?.answer || 'عذراً، لم أتمكن من الإجابة. حاول مرة ثانية.',
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, aiMsg]);
      } catch (err) {
        const aiMsg: ChatMessage = {
          id: `ai-error-${Date.now()}`,
          role: 'assistant',
          content: 'عذراً، حدث خطأ. حاول مرة ثانية. 🙏',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, accessToken],
  );

  // ─── Speech-to-Text ───

  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'ar-SA';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        sendMessage(transcript);
      }
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, sendMessage]);

  // ─── Text-to-Speech ───

  const speakText = useCallback(
    (text: string) => {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        return;
      }

      const cleaned = text
        .replace(/[•📊👥💡💰📋🔄✨🙏👋\n]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const utterance = new SpeechSynthesisUtterance(cleaned);
      utterance.lang = 'ar-SA';
      utterance.rate = 0.9;

      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    },
    [isSpeaking],
  );

  // ─── Handle Enter Key ───

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-var(--header-height)-3rem)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">المستشار الذكي</h1>
          <p className="text-xs text-[var(--muted-foreground)]">مدعوم بالذكاء الاصطناعي — يحلل بياناتك ويعطيك نصائح</p>
        </div>
      </div>

      {/* Quick Suggestions */}
      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {QUICK_SUGGESTIONS.map((s) => (
            <button
              key={s.text}
              onClick={() => sendMessage(s.text)}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3.5 py-2 text-sm font-medium text-[var(--foreground)] shadow-sm transition-all hover:border-violet-400/50 hover:bg-violet-500/10 hover:shadow-md disabled:opacity-50"
            >
              <span>{s.emoji}</span>
              <span>{s.text}</span>
            </button>
          ))}
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-[var(--border)]/60 bg-[var(--card)]/50 backdrop-blur-sm p-4 space-y-4 mb-4 scroll-smooth">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`relative max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20'
                  : 'bg-[var(--muted)]/80 text-[var(--foreground)] border border-[var(--border)]/40'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>

              {/* TTS Button for AI messages */}
              {msg.role === 'assistant' && msg.id !== 'welcome' && (
                <button
                  onClick={() => speakText(msg.content)}
                  className="absolute -bottom-2 -start-2 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--card)] border border-[var(--border)] shadow-sm text-[var(--muted-foreground)] hover:text-violet-500 hover:border-violet-400/50 transition-colors"
                  title={isSpeaking ? 'إيقاف القراءة' : 'قراءة الرد بصوت'}
                >
                  {isSpeaking ? (
                    <VolumeX className="h-3.5 w-3.5" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl bg-[var(--muted)]/80 border border-[var(--border)]/40 px-4 py-3">
              <div className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-2 w-2 rounded-full bg-violet-300 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-[var(--muted-foreground)]">المستشار يفكر...</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex items-end gap-2">
        {/* Microphone Button */}
        {speechSupported && (
          <button
            onClick={toggleListening}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-all ${
              isListening
                ? 'border-red-400 bg-red-500/10 text-red-500 shadow-lg shadow-red-500/20 animate-pulse'
                : 'border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-violet-500 hover:border-violet-400/50'
            }`}
            title={isListening ? 'إيقاف الاستماع' : 'تحدث بصوتك'}
          >
            {isListening ? (
              <MicOff className="h-5 w-5" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </button>
        )}

        {/* Text Input */}
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="اكتب سؤالك هنا..."
            rows={1}
            disabled={isLoading}
            className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 pe-12 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/20 transition-all disabled:opacity-50"
            style={{ maxHeight: '120px' }}
          />
        </div>

        {/* Send Button */}
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isLoading}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-xl hover:shadow-violet-500/30 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 disabled:shadow-none"
          title="إرسال"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5 rotate-180" />
          )}
        </button>
      </div>
    </div>
  );
}
