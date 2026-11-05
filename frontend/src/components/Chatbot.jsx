import { useEffect, useRef, useState } from 'react';

const suggestions = [
  'Help me find a gift',
  'Show me new arrivals',
  'What is in stock?',
];

const formatPrice = (price) =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(price || 0);

function SparkleIcon({ className = 'h-5 w-5' }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m12 3 1.65 5.35L19 10l-5.35 1.65L12 17l-1.65-5.35L5 10l5.35-1.65L12 3Z"
      />
      <path strokeLinecap="round" d="m19 15 .85 2.15L22 18l-2.15.85L19 21l-.85-2.15L16 18l2.15-.85L19 15Z" />
    </svg>
  );
}

function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, error]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  async function sendMessage(event) {
    event.preventDefault();

    const text = input.trim();
    if (!text || isLoading) return;

    const history = messages.map(({ role, content }) => ({ role, content }));

    setMessages((current) => [...current, { role: 'user', content: text }]);
    setInput('');
    setError('');
    setIsLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 65000);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
        signal: controller.signal,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message || 'Chat request failed.');
      }

      if (typeof data?.reply !== 'string') {
        throw new Error('Chat service returned an invalid response. Please try again.');
      }

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: data.reply,
          products: data.products ?? [],
        },
      ]);
    } catch (requestError) {
      setMessages((current) => current.slice(0, -1));
      setError(
        requestError.name === 'AbortError'
          ? 'The assistant is taking longer than expected. Please try again.'
          : requestError.message,
      );
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 sm:bottom-7 sm:right-7">
      {isOpen && (
        <section
          aria-label="Noshin Curated shopping assistant"
          className="mb-4 flex h-[min(620px,calc(100dvh-120px))] w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[26px] border border-[#eadedb] bg-[#fffdfc] shadow-[0_24px_80px_rgba(54,39,39,0.2)]"
        >
          <header className="relative overflow-hidden bg-gradient-to-br from-[#1e3a34] via-[#2a4d45] to-[#3a564d] px-5 pb-5 pt-5 text-white">
            <div aria-hidden="true" className="absolute -right-7 -top-12 h-36 w-36 rounded-full border border-white/10" />
            <div aria-hidden="true" className="absolute -right-1 -top-7 h-24 w-24 rounded-full border border-white/10" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[#f7e7e8]">
                  <SparkleIcon className="h-6 w-6" />
                </span>
                <div>
                  <p className="font-serif text-xl leading-tight">A little help?</p>
                  <p className="mt-1 text-xs tracking-wide text-white/75">YOUR PERSONAL SHOPPING ASSISTANT</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close chat"
                className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
              >
                <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <p className="relative mt-4 max-w-[290px] text-sm leading-relaxed text-white/85">
              Find something lovely, discover a favourite, or ask us anything about the collection.
            </p>
          </header>

          <div
            aria-live="polite"
            className="flex-1 space-y-4 overflow-y-auto bg-[radial-gradient(ellipse_at_top,#fff7f5_0%,#fffdfc_62%)] px-4 py-5"
          >
            {messages.length === 0 && (
              <div className="space-y-5">
                <div className="flex items-end gap-2">
                  <span className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f7e7e8] text-[#9d5a64]">
                    <SparkleIcon className="h-4 w-4" />
                  </span>
                  <p className="max-w-[285px] rounded-2xl rounded-bl-md border border-[#eee2df] bg-white px-4 py-3 text-sm leading-relaxed text-[#2d3934] shadow-[0_3px_12px_rgba(54,39,39,0.04)]">
                    Hello, lovely! I can help you find just the right thing. What are you looking for?
                  </p>
                </div>
                <div className="pl-9">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b7774]">
                    A few ideas to get started
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setInput(suggestion)}
                        className="rounded-full border border-[#e8d5d4] bg-white px-3 py-2 text-xs text-[#754e52] shadow-sm hover:border-[#c98893] hover:bg-[#fff5f4]"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((item, index) => (
              <div
                key={`${item.role}-${index}`}
                className={`flex items-end gap-2 ${item.role === 'user' ? 'justify-end' : ''}`}
              >
                {item.role === 'assistant' && (
                  <span className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f7e7e8] text-[#9d5a64]">
                    <SparkleIcon className="h-4 w-4" />
                  </span>
                )}
                <div className={`max-w-[84%] ${item.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <p
                    className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      item.role === 'user'
                        ? 'rounded-br-md bg-[#b96e7d] text-white shadow-[0_4px_12px_rgba(185,110,125,0.2)]'
                        : 'rounded-bl-md border border-[#eee2df] bg-white text-[#2d3934] shadow-[0_3px_12px_rgba(54,39,39,0.04)]'
                    }`}
                  >
                    {item.content}
                  </p>

                  {item.products?.map((product) => (
                    <a
                      key={product.id}
                      href={`/product/${product.id}`}
                      className="mt-2 flex gap-3 rounded-2xl border border-[#eadedb] bg-white p-2.5 text-left shadow-[0_4px_16px_rgba(54,39,39,0.06)] hover:-translate-y-0.5 hover:border-[#c98893]"
                    >
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.title}
                          className="h-[68px] w-[68px] shrink-0 rounded-xl bg-[#f8efe9] object-cover"
                        />
                      ) : (
                        <span className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-xl bg-[#f8efe9] text-[#b96e7d]">
                          <SparkleIcon className="h-6 w-6" />
                        </span>
                      )}
                      <span className="min-w-0 self-center">
                        <strong className="block truncate text-sm font-semibold text-[#2d3934]">{product.title}</strong>
                        <span className="mt-0.5 block truncate text-xs text-[#707a74]">{product.brand} · {product.category}</span>
                        <span className="mt-1.5 block text-sm font-semibold text-[#9d5a64]">{formatPrice(product.price)}</span>
                        <span className={`mt-0.5 block text-[11px] ${product.inStock ? 'text-[#3a705b]' : 'text-[#9d5a64]'}`}>
                          {product.inStock ? 'Lovely choice · In stock' : 'Currently out of stock'}
                        </span>
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-end gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f7e7e8] text-[#9d5a64]">
                  <SparkleIcon className="h-4 w-4" />
                </span>
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-[#eee2df] bg-white px-4 py-3 text-sm text-[#707a74]">
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#c98893] [animation-delay:-0.2s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#c98893] [animation-delay:-0.1s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#c98893]" />
                  </span>
                Noshin Curating something wonderful..
                </div>
              </div>
            )}

            {error && (
              <p role="alert" className="ml-9 rounded-xl border border-[#efd4d5] bg-[#fff5f4] px-3 py-2 text-xs leading-relaxed text-[#9d5a64]">
                {error}
              </p>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="border-t border-[#eee2df] bg-white px-4 pb-3 pt-3">
            <div className="flex items-center gap-2 rounded-2xl border border-[#e8ddda] bg-[#fffdfc] p-1.5 pl-4 transition focus-within:border-[#c98893] focus-within:ring-2 focus-within:ring-[#f7e7e8]">
              <input
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                maxLength={2000}
                aria-label="Message the shopping assistant"
                placeholder="Tell me what you're looking for..."
                className="min-w-0 flex-1 bg-transparent py-2 text-sm text-[#2d3934] outline-none placeholder:text-[#a99b97]"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                aria-label="Send message"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#b96e7d] text-white shadow-sm hover:bg-[#9d5a64] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 14-7-4.5 14-3-5.5L5 12Zm6.5 1.5L19 5" />
                </svg>
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] tracking-wide text-[#a99b97]">
              MADE WITH CARE · NOSHIN CURATED
            </p>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Close shopping assistant' : 'Open shopping assistant'}
        className="group flex items-center gap-2.5 rounded-full border border-white/70 bg-gradient-to-r from-[#b96e7d] to-[#c98893] py-3 pl-4 pr-5 text-white shadow-[0_8px_28px_rgba(157,90,100,0.35)] hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(157,90,100,0.42)]"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
          {isOpen ? (
            <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" />
            </svg>
          ) : (
            <SparkleIcon className="h-5 w-5" />
          )}
        </span>
        <span className="text-sm font-semibold tracking-wide">
          {isOpen ? 'Close' : 'Ask Noshi'}
        </span>
      </button>
    </div>
  );
}

export default Chatbot;
