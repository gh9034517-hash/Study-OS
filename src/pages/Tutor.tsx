import { useEffect, useMemo, useRef, useState } from 'react';
import { drafts, setData, useData } from '../lib/store';
import { useRoute } from '../lib/router';
import { api, AIRequestError } from '../lib/api';
import { uid } from '../lib/id';
import { fmt } from '../lib/date';
import type { ChatMessage, ChatThread, Level, TutorMode } from '../lib/types';
import { PageHero } from '../components/Decor';
import { Markdown } from '../components/Markdown';
import { Icon } from '../components/Icon';
import { AIStatusBanner } from '../components/AIStatus';
import { useFeedback } from '../components/Feedback';

const MODES: { id: TutorMode; label: string; hint: string }[] = [
  { id: 'explicar', label: 'Explicar', hint: 'Explicação estruturada do conceito' },
  { id: 'exemplos', label: 'Exemplos', hint: 'Exemplos graduais e comentados' },
  { id: 'resumo', label: 'Resumo', hint: 'Resumo para revisão' },
  { id: 'exercicio', label: 'Exercício guiado', hint: 'Resolução passo a passo, com perguntas' },
];

const STARTERS: Record<TutorMode, string[]> = {
  explicar: ['Explique o que é uma função afim', 'Como funciona a fotossíntese?', 'O que foi o Iluminismo?'],
  exemplos: ['Dê exemplos de orações subordinadas', 'Exemplos de aplicação da 2ª Lei de Newton'],
  resumo: ['Resuma a Revolução Industrial', 'Resumo de ligações químicas para prova'],
  exercicio: ['Me ajude a resolver: 2x² − 8x + 6 = 0', 'Quero resolver um problema de porcentagem passo a passo'],
};

const MAX_CONTEXT = 12;
const MAX_LEN = 4000;

export default function Tutor() {
  const data = useData();
  const { params } = useRoute();
  const { toast, confirm } = useFeedback();
  const presetSubject = data.subjects.find((s) => s.name.toLowerCase() === (params.get('materia') ?? '').toLowerCase());

  const [threadId, setThreadId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string>(presetSubject?.id ?? '');
  const [topic, setTopic] = useState(params.get('assunto') ?? '');
  const [mode, setMode] = useState<TutorMode>('explicar');
  const [level, setLevel] = useState<Level>(data.profile.level);
  const [input, setInput] = useState(() => drafts.get('tutor'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AIRequestError | null>(null);
  const [search, setSearch] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const thread = data.chats.find((c) => c.id === threadId) ?? null;
  const messages = thread?.messages ?? [];
  const subject = data.subjects.find((s) => s.id === subjectId);

  useEffect(() => drafts.set('tutor', input), [input]);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), [messages.length, loading]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const threads = useMemo(
    () =>
      [...data.chats]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .filter((c) => !search || `${c.title} ${c.messages.map((m) => m.content).join(' ')}`.toLowerCase().includes(search.toLowerCase())),
    [data.chats, search],
  );

  const openThread = (t: ChatThread) => {
    setThreadId(t.id);
    setSubjectId(t.subjectId ?? '');
    setTopic(t.topic ?? '');
    setMode(t.mode);
    setError(null);
  };

  const newThread = () => {
    abortRef.current?.abort();
    setThreadId(null);
    setError(null);
    inputRef.current?.focus();
  };

  const send = async (textOverride?: string, retry = false) => {
    const text = (textOverride ?? input).trim();
    if ((!text && !retry) || loading) return;
    if (text.length > MAX_LEN) {
      setError(new AIRequestError('invalid_input', `A mensagem tem ${text.length} caracteres; o limite é ${MAX_LEN}.`));
      return;
    }
    setError(null);

    let id = threadId;
    let history: ChatMessage[] = messages;
    if (!retry) {
      const userMsg: ChatMessage = { role: 'user', content: text };
      history = [...messages, userMsg];
      const now = new Date().toISOString();
      if (!id) {
        id = uid();
        const created: ChatThread = { id, title: text.slice(0, 70), subjectId: subjectId || undefined, topic: topic || undefined, mode, messages: history, updatedAt: now };
        setData((d) => ({ ...d, chats: [created, ...d.chats].slice(0, 40) }));
        setThreadId(id);
      } else {
        setData((d) => ({ ...d, chats: d.chats.map((c) => (c.id === id ? { ...c, messages: history, mode, subjectId: subjectId || undefined, topic: topic || undefined, updatedAt: now } : c)) }));
      }
      if (!textOverride) setInput('');
    }

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const res = await api.chat(
        {
          subject: subject?.name,
          topic: topic.trim() || undefined,
          level,
          mode,
          messages: history.slice(-MAX_CONTEXT).map((m) => ({ role: m.role, content: m.content.slice(0, MAX_LEN) })),
        },
        ctrl.signal,
      );
      const reply: ChatMessage = { role: 'assistant', content: res.reply };
      setData((d) => ({
        ...d,
        chats: d.chats.map((c) => (c.id === id ? { ...c, messages: [...c.messages, reply].slice(-80), updatedAt: new Date().toISOString() } : c)),
      }));
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setError(new AIRequestError('network', 'Resposta interrompida.'));
        return;
      }
      setError(err instanceof AIRequestError ? err : new AIRequestError('network', 'Falha inesperada ao contatar a IA.'));
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const lastIsUser = messages.length > 0 && messages[messages.length - 1].role === 'user';

  return (
    <div className="page tutor-page">
      <div className="wrap">
        <PageHero
          num="02"
          label="Tutor de IA"
          ghost="TUTOR"
          title={
            <>
              Pergunte. <em>Entenda.</em> Avance.
            </>
          }
          lead="Um tutor com IA real que adapta a explicação ao seu nível e à matéria selecionada. Ele pode errar: confira fatos importantes no seu material."
        />
        <AIStatusBanner feature="o tutor" />

        <div className="tutor-layout">
          <aside className="tutor-side" aria-label="Contexto e conversas">
            <div className="panel tutor-context">
              <label className="field">
                <span>Matéria</span>
                <select className="select" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                  <option value="">Geral (sem matéria)</option>
                  {data.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Assunto (opcional)</span>
                <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={120} placeholder="Ex.: Equações do 2º grau" />
              </label>
              <label className="field">
                <span>Nível</span>
                <select className="select" value={level} onChange={(e) => setLevel(e.target.value as Level)}>
                  <option value="iniciante">Iniciante</option>
                  <option value="intermediario">Intermediário</option>
                  <option value="avancado">Avançado</option>
                </select>
              </label>
            </div>

            <div className="panel thread-panel">
              <div className="thread-head">
                <h2 className="field-label">Conversas</h2>
                <button type="button" className="btn btn-sm" onClick={newThread}>
                  <Icon name="plus" size={14} /> Nova
                </button>
              </div>
              <label className="search">
                <Icon name="search" size={16} />
                <span className="sr-only">Buscar conversas</span>
                <input className="input" type="search" placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </label>
              {threads.length ? (
                <ul className="thread-list">
                  {threads.map((t) => (
                    <li key={t.id}>
                      <button type="button" className="thread-item" aria-current={t.id === threadId ? 'true' : undefined} onClick={() => openThread(t)}>
                        <span className="thread-title">{t.title}</span>
                        <span className="thread-meta">
                          {fmt.full(t.updatedAt)} · {t.messages.length} msgs
                        </span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-icon btn-sm"
                        aria-label={`Excluir conversa ${t.title}`}
                        onClick={async () => {
                          if (await confirm({ title: 'Excluir conversa?', message: `"${t.title}" será removida deste navegador.`, confirmLabel: 'Excluir', danger: true })) {
                            setData((d) => ({ ...d, chats: d.chats.filter((c) => c.id !== t.id) }));
                            if (t.id === threadId) newThread();
                            toast('Conversa excluída.');
                          }
                        }}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted-text">{search ? 'Nenhuma conversa encontrada.' : 'Suas conversas ficam salvas aqui.'}</p>
              )}
            </div>
          </aside>

          <section className="chat" aria-label="Conversa com o tutor">
            <div className="tabs" role="tablist" aria-label="Modo do tutor">
              {MODES.map((m) => (
                <button key={m.id} type="button" role="tab" className="tab" aria-selected={mode === m.id} title={m.hint} onClick={() => setMode(m.id)}>
                  {m.label}
                </button>
              ))}
            </div>

            <div className="chat-log" role="log" aria-live="polite" aria-busy={loading}>
              {messages.length === 0 && (
                <div className="chat-empty">
                  <p className="chat-empty-title">
                    {subject ? `Tutor de ${subject.name}` : 'Por onde começamos?'}
                    {topic && <span> · {topic}</span>}
                  </p>
                  <p className="muted-text">{MODES.find((m) => m.id === mode)?.hint}. Experimente:</p>
                  <div className="starter-list">
                    {STARTERS[mode].map((s) => (
                      <button key={s} type="button" className="starter" onClick={() => send(s)}>
                        {s} <Icon name="arrow" size={14} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`bubble ${m.role}`}>
                  <span className="bubble-who">{m.role === 'user' ? 'Você' : 'Tutor'}</span>
                  {m.role === 'assistant' ? <Markdown text={m.content} /> : <p className="bubble-text">{m.content}</p>}
                </div>
              ))}
              {loading && (
                <div className="bubble assistant typing" aria-label="O tutor está escrevendo">
                  <span className="bubble-who">Tutor</span>
                  <span className="dots" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
              )}
              {error && (
                <div className="alert error" role="alert">
                  <span aria-hidden="true">⚠</span>
                  <div className="alert-body">
                    <strong>{error.message}</strong>
                    {error.retryAfterSeconds ? <span>Tente novamente em cerca de {error.retryAfterSeconds}s.</span> : null}
                    <div className="alert-actions">
                      {lastIsUser && (
                        <button type="button" className="btn btn-sm" onClick={() => send(undefined, true)}>
                          <Icon name="refresh" size={14} /> Tentar de novo
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            <form
              className="composer"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <label className="sr-only" htmlFor="tutor-input">
                Mensagem para o tutor
              </label>
              <textarea
                id="tutor-input"
                ref={inputRef}
                className="textarea"
                rows={2}
                value={input}
                maxLength={MAX_LEN}
                placeholder={mode === 'exercicio' ? 'Cole o enunciado do exercício…' : 'Escreva sua dúvida… (Enter envia, Shift+Enter quebra linha)'}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <div className="composer-actions">
                <span className="char-count">
                  {input.length}/{MAX_LEN}
                </span>
                {loading ? (
                  <button type="button" className="btn" onClick={() => abortRef.current?.abort()}>
                    <Icon name="stop" size={14} /> Parar
                  </button>
                ) : (
                  <button type="submit" className="btn btn-primary" disabled={!input.trim()}>
                    <Icon name="send" size={16} /> Enviar
                  </button>
                )}
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
