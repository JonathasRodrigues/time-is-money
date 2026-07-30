'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Mic, SendHorizontal } from 'lucide-react';
import { sendJarvisMessageAction } from '@/lib/api/mutations';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  options?: Array<{ id: string; label: string }>;
}

const DEFAULT_GREETING: ChatMessage = {
  role: 'assistant',
  content:
    'Oi! Sou o Jarvis. Pode digitar ou usar o mic — lançamentos, consultas e dúvidas do mês.',
};

export function JarvisChat({
  initialMessages,
  ttsEnabled = false,
  autoFocus = true,
  className,
}: {
  initialMessages?: ChatMessage[];
  ttsEnabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}): React.ReactElement {
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialMessages && initialMessages.length > 0 ? initialMessages : [DEFAULT_GREETING],
  );
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pending]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  function speak(text: string) {
    if (!ttsEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'pt-BR';
    window.speechSynthesis.speak(utter);
  }

  function submit(text: string, source: 'text' | 'voice' = 'text') {
    if (!text.trim() || pending) return;
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    startTransition(async () => {
      const result = await sendJarvisMessageAction({ content: text, source });
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: result.reply,
          options: result.options,
        },
      ]);
      speak(result.reply);
    });
  }

  function startVoice() {
    const SpeechRecognition =
      typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : undefined;
    if (!SpeechRecognition) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Seu navegador não suporta voz. Digite no chat.',
        },
      ]);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;
    setListening(true);
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      submit(transcript, 'voice');
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
  }

  const suggestions = [
    'Quanto gastei este mês?',
    'Adicione despesa de 80 reais de supermercado no PF',
    'O que falta pagar?',
  ];

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-muted/40', className)}>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {messages.map((msg, idx) => (
            <div
              key={`${msg.role}-${idx}`}
              className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm',
                  msg.role === 'user'
                    ? 'rounded-br-md bg-primary text-primary-foreground'
                    : 'rounded-bl-md border bg-card text-foreground',
                )}
              >
                {msg.role === 'assistant' ? (
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Jarvis
                  </p>
                ) : null}
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.options && msg.options.length > 0 ? (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {msg.options.map((opt) => (
                      <Button
                        key={opt.id}
                        size="sm"
                        variant="outline"
                        type="button"
                        className="h-7 bg-background"
                        onClick={() => submit(opt.label)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}

          {pending ? (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md border bg-card px-3.5 py-2.5 text-xs text-muted-foreground shadow-sm">
                digitando…
              </div>
            </div>
          ) : null}

          {messages.length <= 1 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="rounded-full border bg-card px-3 py-1.5 text-left text-xs text-muted-foreground shadow-sm transition hover:border-primary/35 hover:text-foreground"
                  onClick={() => submit(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t bg-card/95 px-3 py-3 backdrop-blur">
        <form
          className="mx-auto flex max-w-2xl items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            submit(input);
          }}
        >
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 shrink-0 rounded-full"
            onClick={startVoice}
            disabled={listening || pending}
            aria-label="Falar"
          >
            <Mic className={cn('size-4', listening && 'animate-pulse text-primary')} />
          </Button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit(input);
              }
            }}
            placeholder="Mensagem para o Jarvis…"
            disabled={pending}
            rows={1}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-input bg-background px-4 py-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <Button
            type="submit"
            size="icon"
            className="size-11 shrink-0 rounded-full"
            disabled={pending || !input.trim()}
            aria-label="Enviar"
          >
            <SendHorizontal className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
