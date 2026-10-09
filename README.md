# StudyOS — plataforma inteligente de estudos

Aplicação web completa (React + Vite + TypeScript) com backend seguro para IA gratuita.

| Módulo | O que faz |
| --- | --- |
| **Painel** | Tempo estudado, meta diária, sequência, tarefas pendentes, acerto em 30 dias, recomendações do dia, cronômetro de foco e gráficos de evolução (14 dias de estudo, acerto semanal). |
| **Tutor de IA** | Chat com modelo real (Gemini por padrão), adaptado ao nível (iniciante/intermediário/avançado) e à matéria/assunto. Modos: explicar, exemplos, resumo e exercício guiado. Conversas salvas e pesquisáveis, rascunho salvo, botão parar e "tentar de novo". |
| **Quiz inteligente** | Questões de múltipla escolha geradas pela IA **ou** banco offline com 40 questões revisadas (8 áreas). Correção automática, explicação, pontuação, histórico com filtros, refazer erros e transformar erros em flashcards. |
| **Plano de estudos** | CRUD de matérias, tarefas (prazo, prioridade, estimativa), provas e sessões (planejadas/concluídas). Plano do dia recomendado a partir do tempo disponível, provas próximas, acerto, pendências e flashcards vencidos. |
| **Revisão inteligente** | Flashcards com repetição espaçada (SM-2), registro de acertos/erros, cartões difíceis priorizados, criação manual ou com IA (com revisão antes de salvar). |
| **Diagnóstico** | Assuntos com baixo desempenho, tendência (últimos 14 dias × antes), acerto por matéria e por semana, recomendações e análise opcional com IA baseada apenas em dados agregados reais. |
| **Aparência** | Tema escuro, claro ou do sistema; cor de destaque (8 prontas ou qualquer cor livre) com contraste ajustado automaticamente; fonte dos títulos (futurista, geométrica, técnica, clássica); tamanho do texto; cantos; animações; fundo; faixas decorativas. Botão rápido de tema no topo. |
| **Ajustes** | Perfil, senha local (hash PBKDF2), exportar/importar backup JSON, apagar dados, status e limites da IA. |

Os dados ficam no `localStorage` do navegador com salvamento automático, cópia de segurança interna e sincronização entre abas. Nenhum dado é simulado: gráficos e estatísticas só mostram o que você registrou.

---

## 1. Requisitos

- Node.js **20.19+** ou **22.12+** (recomendado 22 — veja `.nvmrc`)
- Uma chave **gratuita** do Google AI Studio (não exige cartão de crédito)

## 2. Instalação

```bash
git clone https://github.com/gh9034517-hash/Study-OS.git
cd Study-OS
npm install
```

## 3. Variáveis de ambiente (somente no backend)

1. Crie a chave gratuita em <https://aistudio.google.com/apikey> (faça login com uma conta Google → **Create API key**).
   Use um projeto **sem faturamento ativado** para garantir que nada seja cobrado.
2. Copie o arquivo de exemplo e cole a chave:

```bash
cp .env.example .env
# edite .env e preencha: GEMINI_API_KEY=sua_chave
```

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `AI_PROVIDER` | `gemini` | `gemini` ou `groq` |
| `GEMINI_API_KEY` | — | Chave do Google AI Studio |
| `GROQ_API_KEY` | — | (Opcional) chave gratuita da GroqCloud, se `AI_PROVIDER=groq` |
| `AI_MODEL` | `gemini-flash-lite-latest` / `llama-3.3-70b-versatile` | Modelo principal |
| `AI_FALLBACK_MODELS` | `gemini-flash-latest` / `llama-3.1-8b-instant` | Reservas usadas automaticamente quando o principal está sobrecarregado, lento ou sem cota |
| `RATE_LIMIT_PER_MINUTE` | `12` | Requisições de IA por minuto por IP |
| `RATE_LIMIT_PER_DAY` | `200` | Requisições de IA por dia por IP |
| `PORT` | `8787` | Porta do servidor |

O arquivo `.env` está no `.gitignore`. A chave **nunca** vai para o navegador: o frontend chama `/api/*` e só o servidor fala com o provedor de IA.

## 4. Executar

```bash
npm run dev        # Vite em http://localhost:5173 + API em http://localhost:8787 (proxy /api)
```

Produção local:

```bash
npm run build      # typecheck + build do frontend + compilação do servidor
npm start          # serve frontend e API em http://localhost:8787
```

Testes automatizados (validação, limites de requisição, tradução de erros da IA, repetição espaçada, plano diário, diagnóstico, banco de questões):

```bash
npm test
```

Sem chave configurada o app funciona normalmente em modo offline (quiz com banco local, flashcards manuais, plano, diagnóstico) e mostra avisos claros nos recursos de IA.

## 5. Publicar gratuitamente

### Opção A — Render (um serviço único, mais simples)

1. Envie o repositório para o GitHub.
2. Em <https://dashboard.render.com> → **New → Blueprint** → selecione o repositório (o `render.yaml` já configura tudo no plano **Free**).
3. Quando solicitado, preencha `GEMINI_API_KEY`.
4. Aguarde o deploy e acesse a URL `https://studyos-xxxx.onrender.com`.

> O plano gratuito do Render "dorme" após ~15 min sem acesso; a primeira visita depois disso pode levar perto de 1 minuto.

### Opção B — Vercel (frontend estático + funções serverless em `/api`)

1. Em <https://vercel.com/new> importe o repositório (plano **Hobby**, gratuito). O `vercel.json` já define build e saída (`dist`).
2. Em **Settings → Environment Variables** adicione `GEMINI_API_KEY` (e opcionalmente as demais).
3. Faça o deploy. As rotas `api/chat`, `api/quiz`, `api/flashcards`, `api/insights` e `api/health` viram funções serverless.

> No Vercel o limitador de requisições é por instância (memória), portanto aproximado. A cota do provedor continua sendo o limite final.

## 6. Limites da IA gratuita

- A camada gratuita do Gemini tem limites de **requisições por minuto e por dia** por projeto, que o Google pode alterar. Consulte os valores atuais em <https://ai.google.dev/gemini-api/docs/rate-limits> e no painel do AI Studio.
- Na camada gratuita o Google às vezes recusa por "alta demanda" (erro 503). O StudyOS tenta automaticamente o modelo de reserva antes de mostrar erro.
- Ao atingir a cota, a API responde 429; o StudyOS tenta a reserva e, se também estiver sem cota, mostra "cota gratuita atingida" e oferece o modo offline.
- Pelos termos da camada gratuita, o Google pode usar os dados enviados para melhorar seus produtos. Não envie dados pessoais ao tutor.
- O modelo pode errar: o app avisa isso no tutor e na análise do diagnóstico.

## 7. Segurança

- Chaves só em variáveis de ambiente do servidor; nada de chave no código ou no bundle.
- Validação de todas as entradas com `zod` (tamanho de mensagens, quantidade de questões, histórico máximo), limite de corpo de 64 KB e JSON malformado tratado.
- Limite de requisições por IP (minuto e dia) com cabeçalho `Retry-After`.
- Saída da IA validada antes de chegar ao navegador; Markdown renderizado sem `innerHTML`.
- Senha local opcional armazenada como hash PBKDF2-SHA-256 (210 mil iterações + sal). Ela protege contra acesso casual; os dados do navegador não são criptografados.
- Cabeçalhos `X-Content-Type-Options`, `X-Frame-Options` e `Referrer-Policy`.

## 8. Estrutura

```
api/            Funções serverless do Vercel (adaptadores finos)
server/         Backend: config, provedores de IA, prompts, validação, rate limit, Express
shared/         Tipos da API compartilhados
src/lib/        Persistência, repetição espaçada, análises/recomendações, cronômetro, roteamento
src/pages/      Painel, Tutor, Quiz, Plano, Revisão, Diagnóstico, Ajustes
src/components/ Gráficos SVG, modal acessível, toasts, markdown seguro, decoração
src/data/       Banco de questões offline
tests/          Testes (node:test)
```
