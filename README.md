# SquadBot

> A memória compartilhada do seu squad, dentro do Discord — e um dashboard web para ver tudo de cima.

O SquadBot resolve um problema específico de times pequenos: informação espalhada entre papel, mensagens antigas do Discord, apps de notas, planilhas, gerenciadores de tarefas e calendários diferentes.

Com ele, **o Discord vira o ponto central**. Tarefas, anotações, ideias, decisões, links e lembretes ficam todos no mesmo lugar — organizados, pesquisáveis e persistidos. E quando você quer uma visão panorâmica em vez de uma conversa, o dashboard mostra o mesmo conteúdo no navegador.

> O squad não deveria precisar lembrar onde guardou uma informação. O SquadBot guarda, organiza e encontra essa informação quando necessário.

---

## Índice

- [Como o projeto está organizado](#como-o-projeto-está-organizado)
- [Requisitos](#requisitos)
- [Stack](#stack)
- [Instalação](#instalação)
- [Configuração do Discord Developer Portal](#configuração-do-discord-developer-portal)
- [Configuração do ambiente](#configuração-do-ambiente)
- [Execução em desenvolvimento](#execução-em-desenvolvimento)
- [Build e execução em produção](#build-e-execução-em-produção)
- [Docker](#docker)
- [Docker Compose](#docker-compose)
- [Deploy (Railway e similares)](#deploy-railway-e-similares)
- [Banco de dados (SQLite)](#banco-de-dados-sqlite)
- [Backup do banco](#backup-do-banco)
- [Timezone](#timezone)
- [Lista de comandos](#lista-de-comandos)
- [Dashboard web](#dashboard-web)
- [API REST](#api-rest)
- [Permissões](#permissões)
- [Arquitetura](#arquitetura)
- [Testes](#testes)
- [Scripts npm](#scripts-npm)
- [Logs](#logs)
- [Roadmap](#roadmap)

---

## Como o projeto está organizado

Monorepo com npm workspaces e **dois apps deployáveis de forma independente**:

```text
squadbot/
├── apps/
│   ├── bot/     Bot do Discord + worker de lembretes + API REST  (dono do SQLite)
│   └── web/     Dashboard Next.js                                (cliente da API)
├── package.json          workspaces + scripts agregadores
├── package-lock.json     lockfile único
└── docker-compose.yml    sobe os dois juntos
```

O **bot é o dono do banco**. O dashboard nunca abre o SQLite: ele fala HTTP com a API do bot. Isso não é preciosismo — é o que torna possível rodar os dois como serviços separados, já que um volume persistente só pode estar montado em um serviço por vez.

---

## Requisitos

| Requisito | Versão |
| --- | --- |
| Node.js | **24 LTS** ou superior |
| npm | 10 ou superior |
| Docker _(opcional)_ | 24 ou superior |

Confira a sua versão:

```bash
node -v
```

Não há nenhuma dependência de Python: o projeto é 100% TypeScript/JavaScript.

## Stack

**Bot** (`apps/bot`)

- **Node.js 24** — runtime
- **TypeScript** (modo `strict`) — todo o código-fonte
- **discord.js v14** — integração com o Discord
- **SQLite** via **better-sqlite3** — persistência
- **Fastify** — API REST consumida pelo dashboard
- **dotenv** — configuração
- **Vitest** — testes

**Dashboard** (`apps/web`)

- **Next.js 16** — App Router e Server Components
- **React 19**
- **Tailwind CSS v4** + **shadcn/ui** — design system
- **Auth.js v5** (`next-auth`) — login com Discord

O TypeScript de `apps/bot/src` é compilado para `apps/bot/dist`; o Next gera um bundle `standalone`. Em produção roda sempre o JavaScript compilado.

---

## Instalação

```bash
git clone <url-do-repositorio> squadbot
```

```bash
cd squadbot && npm install
```

Um único `npm install` na raiz instala os dois workspaces.

---

## Configuração do Discord Developer Portal

### 1. Criar a aplicação

1. Acesse <https://discord.com/developers/applications>.
2. Clique em **New Application**, dê o nome `SquadBot` e confirme.
3. Em **General Information**, copie o **Application ID** — ele vai em `DISCORD_CLIENT_ID` (bot) e `AUTH_DISCORD_ID` (dashboard).

### 2. Criar o bot e pegar o token

1. Vá em **Bot** no menu lateral.
2. Clique em **Reset Token** e copie o valor — ele vai em `DISCORD_TOKEN`.
3. **Nunca** versione esse token. Se ele vazar, use **Reset Token** novamente.

O SquadBot **não precisa de nenhum Privileged Gateway Intent** (Presence, Server Members ou Message Content). Ele não lê o conteúdo das mensagens do chat — responde apenas a slash commands.

### 3. Convidar o bot para o servidor

1. Vá em **OAuth2 → URL Generator**.
2. Em **Scopes**, marque `bot` e `applications.commands`.
3. Em **Bot Permissions**, marque:
   - `Send Messages`
   - `Embed Links`
   - `Read Message History`
   - `Use Slash Commands`
4. Copie a URL gerada, abra no navegador e escolha o servidor do squad.

### 4. Habilitar o login do dashboard

O dashboard usa OAuth2 para identificar quem está acessando.

1. Em **OAuth2 → General**, copie o **Client Secret** — ele vai em `AUTH_DISCORD_SECRET`.
2. Em **Redirects**, adicione as URLs de callback que você for usar:

   ```text
   http://localhost:3000/api/auth/callback/discord
   https://seu-dashboard.up.railway.app/api/auth/callback/discord
   ```

3. Salve. O dashboard pede apenas o escopo `identify` — quem confere se você é membro do servidor é a API do bot, não o OAuth.

### 5. Permitir mensagens diretas

Os lembretes chegam por **DM**. Cada membro precisa ter, em **Configurações do Servidor → Privacidade**, a opção de receber mensagens diretas de membros do servidor **ativada** — caso contrário o bot não consegue entregar o lembrete (a falha aparece nos logs).

---

## Configuração do ambiente

São dois arquivos `.env`, um por app.

### Bot — `apps/bot/.env`

```bash
cp apps/bot/.env.example apps/bot/.env
```

```env
DISCORD_TOKEN=seu-token-aqui
DISCORD_CLIENT_ID=id-da-aplicacao
DISCORD_GUILD_ID=          # opcional: registro instantâneo em um servidor de testes
DATABASE_PATH=./data/squadbot.db
DEFAULT_TIMEZONE=America/Sao_Paulo
NODE_ENV=development
REMINDER_INTERVAL_MS=30000
LOG_LEVEL=info

API_TOKEN=                 # obrigatório para o dashboard funcionar
API_PORT=3001
API_HOST=0.0.0.0
```

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `DISCORD_TOKEN` | sim | Token do bot. Nunca versione. |
| `DISCORD_CLIENT_ID` | sim | Application ID, usado no registro dos comandos. |
| `DISCORD_GUILD_ID` | não | Com valor, os comandos são registrados só nesse servidor e propagam na hora. Em branco, o registro é global (o Discord leva até ~1h para propagar). |
| `DATABASE_PATH` | não | Caminho do arquivo SQLite. Padrão: `./data/squadbot.db`. |
| `DEFAULT_TIMEZONE` | não | Fuso padrão de novos usuários. Padrão: `America/Sao_Paulo`. |
| `NODE_ENV` | não | `development`, `production` ou `test`. |
| `REMINDER_INTERVAL_MS` | não | Intervalo do worker de lembretes. Padrão: `30000` (30s). |
| `LOG_LEVEL` | não | `debug`, `info`, `warn` ou `error`. |
| `API_TOKEN` | para o dashboard | Token de serviço. **Sem ele a API não sobe** e o dashboard não funciona. |
| `API_PORT` | não | Porta da API. Tem precedência sobre o `PORT` injetado pela plataforma. Padrão: `3001`. |
| `API_HOST` | não | Interface de escuta. Padrão `0.0.0.0`; no Railway veja a [nota sobre IPv6](#deploy-railway-e-similares). |

Gere o token de serviço com:

```bash
openssl rand -hex 32
```

### Dashboard — `apps/web/.env`

```bash
cp apps/web/.env.example apps/web/.env
```

```env
AUTH_SECRET=
AUTH_DISCORD_ID=
AUTH_DISCORD_SECRET=
AUTH_URL=http://localhost:3000
SQUADBOT_API_URL=http://localhost:3001
SQUADBOT_API_TOKEN=
```

| Variável | Descrição |
| --- | --- |
| `AUTH_SECRET` | Segredo de assinatura da sessão. Gere com `npx auth secret`. |
| `AUTH_DISCORD_ID` | Application ID (o mesmo do bot). |
| `AUTH_DISCORD_SECRET` | Client Secret do OAuth2. |
| `AUTH_URL` | URL pública do dashboard, usada no callback do OAuth. |
| `SQUADBOT_API_URL` | Endereço da API do bot, sem barra no final. |
| `SQUADBOT_API_TOKEN` | **O mesmo valor** de `API_TOKEN` no bot. |

> `SQUADBOT_API_TOKEN` não tem o prefixo `NEXT_PUBLIC_` de propósito: ele só existe no servidor do Next e nunca é enviado ao navegador. Se os dois valores divergirem, toda chamada volta `401`.

> Os `.env` estão no `.gitignore`. Só os `.env.example` são versionados.

---

## Execução em desenvolvimento

Em dois terminais:

```bash
npm run dev:bot
```

```bash
npm run dev:web
```

O bot roda com `tsx watch` (reinicia a cada alteração) e sobe a API em `http://localhost:3001`. O dashboard fica em `http://localhost:3000`.

Para registrar os slash commands sem subir o bot:

```bash
npm run deploy:commands:dev --workspace @squadbot/bot
```

Durante o desenvolvimento, defina `DISCORD_GUILD_ID` com o ID do seu servidor de testes: o registro passa a ser instantâneo em vez de esperar a propagação global.

---

## Build e execução em produção

```bash
npm run build
```

```bash
npm run start:bot
```

```bash
npm run start:web
```

O `build` compila os dois workspaces. Em produção **nunca** se executa TypeScript direto.

---

## Docker

São duas imagens, ambas construídas **a partir da raiz do repositório** (o lockfile é compartilhado):

```bash
docker build -f apps/bot/Dockerfile -t squadbot-bot .
```

```bash
docker build -f apps/web/Dockerfile -t squadbot-web .
```

Executando o bot com volume persistente:

```bash
docker run -d --name squadbot-bot --restart unless-stopped --env-file apps/bot/.env -v "$(pwd)/apps/bot/data:/app/data" squadbot-bot
```

As duas imagens são multi-stage e rodam como usuário `node` (não-root). A do bot leva só as dependências de produção e o `dist/`; a do dashboard usa o `output: standalone` do Next, que dispensa `npm install` na imagem final.

> Os Dockerfiles **não** declaram `VOLUME`: o Railway rejeita essa instrução, e ela não é necessária — o mount de `/app/data` é feito em runtime (`-v`, Compose ou Railway Volumes).

---

## Docker Compose

Sobe bot e dashboard juntos, já conectados:

```bash
docker compose up -d --build
```

Ver os logs:

```bash
docker compose logs -f
```

Parar:

```bash
docker compose down
```

O dashboard fica em <http://localhost:3000>. A API do bot **não é publicada para fora**: só o serviço `web` a alcança, pela rede interna, em `http://bot:3001`. O banco vive em `./apps/bot/data`, então sobrevive a `down`, `up` e rebuilds.

---

## Deploy (Railway e similares)

São **dois serviços** no mesmo projeto, a partir do mesmo repositório.

> **O Root Directory dos dois serviços precisa ser a raiz do repositório (`/`).** Os Dockerfiles usam o `package-lock.json` da raiz como contexto de build. Apontar o Root Directory para `apps` (ou `apps/bot`) faz o Railway não encontrar Dockerfile nenhum e cair no autodetector, com o erro `Railpack could not determine how to build the app`.

Com o Root Directory correto, falta dizer ao Railway **qual** Dockerfile usar — ele só autodetecta um `Dockerfile` na raiz, e os nossos estão em `apps/*/`. Sem isso o build cai no Railpack e falha com `No start command detected`.

A forma mais confiável é uma variável de ambiente do serviço:

```env
RAILWAY_DOCKERFILE_PATH=apps/bot/Dockerfile
```

No serviço do dashboard, `apps/web/Dockerfile`. O caminho é relativo ao Root Directory.

Alternativa equivalente: o repositório traz `apps/bot/railway.json` e `apps/web/railway.json`, que já fixam builder e caminho. Para usá-los, aponte o arquivo em **Settings → Build → Railway Config File**.

### Serviço 1 — bot

| Configuração | Valor |
| --- | --- |
| Root Directory | `/` (vazio) |
| Variável `RAILWAY_DOCKERFILE_PATH` | `apps/bot/Dockerfile` |
| _ou_ Railway Config File | `apps/bot/railway.json` |
| Volume | mount path `/app/data` |

Variáveis:

```env
RAILWAY_DOCKERFILE_PATH=apps/bot/Dockerfile
DISCORD_TOKEN=...
DISCORD_CLIENT_ID=...
NODE_ENV=production
DATABASE_PATH=/app/data/squadbot.db
API_TOKEN=<mesmo valor dos dois serviços>
API_HOST=::
```

### Serviço 2 — dashboard

| Configuração | Valor |
| --- | --- |
| Root Directory | `/` (vazio) |
| Variável `RAILWAY_DOCKERFILE_PATH` | `apps/web/Dockerfile` |
| _ou_ Railway Config File | `apps/web/railway.json` |
| Domínio público | gere um em Settings → Networking |

Variáveis:

```env
RAILWAY_DOCKERFILE_PATH=apps/web/Dockerfile
NODE_ENV=production
AUTH_SECRET=...
AUTH_DISCORD_ID=...
AUTH_DISCORD_SECRET=...
AUTH_URL=https://<seu-dominio>.up.railway.app
SQUADBOT_API_URL=http://<nome-do-servico-do-bot>.railway.internal:3001
SQUADBOT_API_TOKEN=<mesmo valor dos dois serviços>
```

E lembre de adicionar `https://<seu-dominio>.up.railway.app/api/auth/callback/discord` nos **Redirects** do OAuth2 no Developer Portal.

### Dois detalhes que costumam morder

**1. `API_HOST=::` no bot.** A rede privada do Railway (`*.railway.internal`) é IPv6-only. Escutando em `0.0.0.0` o processo só aceita IPv4 e o dashboard recebe `ECONNREFUSED` — mesmo com tudo o mais correto.

**2. O volume é obrigatório.** O filesystem das plataformas de hospedagem é **efêmero**: a cada deploy, restart ou reciclagem do container, tudo que não estiver num volume é perdido — inclusive o `squadbot.db` com todas as tarefas, notas, decisões e lembretes do squad. **Sem volume persistente, o squad perde a memória a cada deploy.**

Só o bot recebe volume. O dashboard não guarda estado nenhum — se ele cair e voltar, nada se perde.

### Checklist de produção

- [ ] Root Directory `/` nos dois serviços (não `apps`)
- [ ] `RAILWAY_DOCKERFILE_PATH` apontando para o Dockerfile de cada serviço
- [ ] Volume montado em `/app/data` **no serviço do bot**
- [ ] `DATABASE_PATH=/app/data/squadbot.db`
- [ ] `API_HOST=::` no bot (rede privada IPv6)
- [ ] `API_TOKEN` e `SQUADBOT_API_TOKEN` com **o mesmo valor**
- [ ] `SQUADBOT_API_URL` apontando para o host interno do bot
- [ ] URL de callback do OAuth cadastrada no Developer Portal
- [ ] `AUTH_URL` igual ao domínio público do dashboard
- [ ] `NODE_ENV=production` nos dois serviços
- [ ] `DISCORD_GUILD_ID` **vazio** (registro global dos comandos)
- [ ] Rotina de backup do banco definida

---

## Banco de dados (SQLite)

Um único arquivo, sem servidor, sem custo de infraestrutura — o suficiente e o adequado para um squad de ~3 pessoas.

O schema é criado e evoluído por **migrations** aplicadas automaticamente no boot, controladas pelo `PRAGMA user_version`. Rodar o bot num banco vazio já o deixa pronto.

### Tabelas

| Tabela | Papel |
| --- | --- |
| `users` | Membros por servidor (`discord_id` + `server_id`), com timezone individual |
| `server_settings` | Configuração do servidor (timezone padrão) |
| `projects` | Projetos (`active` / `archived`) |
| `project_members` | Vínculo entre projetos e membros |
| `items` | Tabela central: `task`, `note`, `idea`, `decision`, `link` |
| `reminders` | Lembretes, com `created_by` e `recipient_id` separados |

Todo acesso usa **prepared statements**; nenhum valor vindo do usuário é concatenado em SQL. Todas as consultas são escopadas por `server_id` — dados de um servidor nunca aparecem em outro.

---

## Backup do banco

Com o bot **rodando**, a forma correta é o backup online do SQLite (o `.db` sozinho pode estar incompleto por causa do WAL):

```bash
sqlite3 apps/bot/data/squadbot.db ".backup 'apps/bot/data/backup-$(date +%F).db'"
```

Dentro do Docker:

```bash
docker compose exec bot sh -c "node -e \"const D=require('better-sqlite3');new D('/app/data/squadbot.db').backup('/app/data/backup.db')\""
```

Copiando o backup para a sua máquina:

```bash
docker compose cp bot:/app/data/backup.db ./backup.db
```

Com o bot **parado**, basta copiar `squadbot.db` junto com `-wal` e `-shm`, se existirem.

Para restaurar: pare o bot, substitua o arquivo e suba de novo.

---

## Timezone

- **Tudo é gravado em UTC** (ISO 8601) no banco.
- A conversão acontece só na leitura da entrada e na exibição — vale igual para os embeds do Discord e para o dashboard.
- Cada usuário tem o seu fuso; o padrão é o do servidor, que por sua vez cai em `DEFAULT_TIMEZONE`.

Configurar o seu fuso:

```text
/config timezone valor:America/Sao_Paulo
```

Configurar o padrão do servidor (apenas administradores):

```text
/config timezone valor:Europe/Lisbon escopo:Padrão do servidor (admin)
```

Ao criar um lembrete, a data é interpretada **no fuso de quem cria** e exibida a cada pessoa no fuso dela. Quando os fusos diferem, o bot mostra explicitamente as duas leituras na confirmação.

### Formatos de data aceitos

| Formato | Exemplo |
| --- | --- |
| Palavras-chave | `hoje 18:00`, `amanha 09:00`, `depois de amanha 10:00` |
| Dia da semana | `segunda 14:00`, `sexta` |
| ISO | `2026-08-28`, `2026-08-28 09:00` |
| Brasileiro | `28/08`, `28/08 18:00`, `28/08/2026 09:00` |
| Só hora | `18:00` _(hoje; se já passou, amanhã)_ |
| Relativo | `30m`, `2h`, `3d`, `em 45 minutos`, `em 2 semanas` |

Prazos de tarefa sem hora assumem **23:59** do dia informado.

---

## Lista de comandos

### 📂 Projetos

| Comando | O que faz |
| --- | --- |
| `/projeto criar nome descricao` | Cria um projeto |
| `/projeto listar [status]` | Lista os projetos |
| `/projeto info projeto` | Detalhes, membros e contagem de tarefas |
| `/projeto adicionar projeto membro` | Adiciona um membro |
| `/projeto remover projeto membro` | Remove um membro |
| `/projeto arquivar projeto` | Arquiva (mantém o histórico) |
| `/projeto reativar projeto` | Reativa um projeto arquivado |

```text
/projeto criar nome:Backend descricao:"API principal do produto"
```

### 📋 Tarefas

| Comando | O que faz |
| --- | --- |
| `/tarefa criar titulo [projeto] [responsavel] [prioridade] [prazo] [descricao]` | Cria uma tarefa |
| `/tarefa listar [projeto] [responsavel] [status]` | Lista tarefas |
| `/tarefa minhas` | Suas tarefas em aberto |
| `/tarefa concluir tarefa` | Marca como concluída |
| `/tarefa cancelar tarefa` | Cancela |
| `/tarefa excluir tarefa` | Exclui definitivamente |
| `/tarefa editar tarefa [campos]` | Edita título, descrição, prioridade, status, prazo, responsável ou projeto |

```text
/tarefa criar projeto:Backend titulo:"Implementar autenticação" responsavel:@Maria prioridade:high prazo:2026-08-28
```

Prioridades: 🔴 `urgent` · 🟠 `high` · 🟡 `medium` · 🟢 `low`
Status: `pending` · `in_progress` · `done` · `cancelled`

### 📝 Notas

| Comando | O que faz |
| --- | --- |
| `/nota criar titulo conteudo [projeto]` | Cria uma anotação |
| `/nota listar [projeto]` | Lista as anotações |
| `/nota visualizar nota` | Mostra o conteúdo completo |
| `/nota excluir nota` | Exclui |

```text
/nota criar projeto:Backend titulo:Produção conteudo:"O servidor de produção utiliza a porta 8080."
```

### 💡 Ideias

| Comando | O que faz |
| --- | --- |
| `/ideia criar titulo [conteudo] [projeto]` | Registra uma ideia |
| `/ideia listar [projeto] [status]` | Lista ideias |
| `/ideia visualizar ideia` | Mostra a ideia completa |
| `/ideia implementar ideia` | Marca como implementada |
| `/ideia rejeitar ideia` | Marca como rejeitada |
| `/ideia status ideia novo` | Move para qualquer status |

Ciclo de vida: `new` → `considering` → `accepted` → `implemented` (ou `rejected`).

### ⚖️ Decisões

| Comando | O que faz |
| --- | --- |
| `/decisao criar titulo conteudo [projeto]` | Registra uma decisão |
| `/decisao listar [projeto]` | Lista as decisões |
| `/decisao visualizar decisao` | Mostra a decisão completa |

```text
/decisao criar projeto:Backend titulo:"Banco de produção" conteudo:"Vamos utilizar PostgreSQL em produção."
```

Decisões funcionam como memória histórica: registram **o que** foi decidido e **por quê**. Por isso não são editáveis.

### 🔗 Links

| Comando | O que faz |
| --- | --- |
| `/link criar nome url [projeto]` | Guarda um link |
| `/link listar [projeto]` | Lista os links |
| `/link excluir link` | Exclui |

```text
/link criar projeto:Backend nome:"Documentação da API" url:https://example.com/docs
```

URLs são validadas; só `http://` e `https://` são aceitos.

### ⏰ Lembretes

| Comando | O que faz |
| --- | --- |
| `/lembrete criar quando mensagem [para] [tarefa]` | Agenda um lembrete |
| `/lembrete listar [de]` | Próximos lembretes |
| `/lembrete cancelar lembrete` | Cancela um lembrete pendente |

**Quem cria não precisa ser quem recebe.**

Para outra pessoa:

```text
/lembrete criar quando:"amanha 09:00" mensagem:"Revisar o PR do backend" para:@Maria
```

→ `created_by = João`, `recipient_id = Maria`. A DM chega para a Maria.

Para você mesmo (basta omitir `para`):

```text
/lembrete criar quando:"amanha 10:00" mensagem:"Fazer deploy"
```

→ `created_by = João`, `recipient_id = João`.

O destinatário **precisa ser membro do servidor**. Não é possível criar lembretes para usuários externos.

### 🔍 Visões e configuração

| Comando | O que faz |
| --- | --- |
| `/buscar termo [tipo]` | Procura em tarefas, notas, ideias, decisões e links |
| `/minhas` | Sua visão pessoal: tarefas por prioridade, próximos lembretes e ideias recentes |
| `/resumo` | Visão geral do squad por projeto |
| `/config timezone valor [escopo]` | Define o fuso horário |
| `/config ver` | Mostra a configuração atual |
| `/ajuda` | Lista os comandos |

```text
/buscar termo:autenticação
```

A busca **sempre respeita o `server_id`** — nunca retorna informação de outro servidor.

---

## Dashboard web

O dashboard é uma **visão panorâmica com ações rápidas**. Criar continua sendo melhor no Discord, onde o autocomplete e o parser de datas em português já resolvem tudo em uma linha.

### Páginas

| Rota | O que mostra |
| --- | --- |
| `/entrar` | Login com Discord |
| `/servidores` | Servidores em que você e o bot estão juntos (pula direto se houver só um) |
| `/g/[id]` | Resumo do squad: tarefas por projeto, lembretes e ideias novas |
| `/g/[id]/minhas` | Suas tarefas agrupadas por prioridade, seus lembretes e ideias recentes |
| `/g/[id]/tarefas` | Todas as tarefas, com filtros de projeto, responsável e status |
| `/g/[id]/projetos` | Projetos com progresso; o detalhe traz membros e tarefas abertas |
| `/g/[id]/notas` · `/ideias` · `/decisoes` · `/links` | Listagens por tipo |
| `/g/[id]/lembretes` | Pendentes, seus e do squad |
| `/g/[id]/buscar` | Mesma busca do `/buscar`, com filtro por tipo |

### O que dá para fazer pela web

- Concluir, cancelar e iniciar (mover para "em andamento") uma tarefa
- Mudar o status de uma ideia pelo ciclo de vida
- Filtrar e buscar

Os filtros ficam na URL, então um recorte é compartilhável por link e sobrevive ao refresh.

### Como o acesso é decidido

O login diz **quem você é**; ele não diz o que você pode ver. A cada requisição o dashboard pergunta à API do bot se você é membro daquela guild, e o bot confere isso no Discord de verdade. Consequências práticas:

- sair do servidor tira o acesso na navegação seguinte, sem precisar deslogar;
- as ações usam exatamente as mesmas regras dos slash commands — se você não pode concluir uma tarefa pelo `/tarefa concluir`, também não pode pelo botão;
- ser admin no Discord (`Administrator` ou `Gerenciar servidor`) vale no dashboard também.

O tema acompanha o do sistema e pode ser trocado no menu do avatar.

---

## API REST

O bot expõe uma API somente-leitura (mais um punhado de ações rápidas) em `API_PORT`. Ela existe para o dashboard, mas é um contrato estável — dá para escrever outros clientes.

**Sem `API_TOKEN` configurado, a API não sobe.** É preferível não ter endpoint nenhum a ter um sem autenticação.

Toda rota sob `/api` exige dois cabeçalhos:

```http
Authorization: Bearer <API_TOKEN>
X-Actor-Id: <id do usuário no Discord>
```

O primeiro prova que quem chama é um backend confiável. O segundo diz em nome de quem a chamada é feita — e é resolvido contra a guild real antes de qualquer consulta ao banco.

| Método | Rota | Retorna |
| --- | --- | --- |
| `GET` | `/health` | Estado do processo (sem autenticação) |
| `GET` | `/api/guilds` | Servidores visíveis para o ator |
| `GET` | `/api/guilds/:id/me` | Usuário, se é admin, fuso e dados da guild |
| `GET` | `/api/guilds/:id/members` | Membros conhecidos do servidor |
| `GET` | `/api/guilds/:id/projects` | Projetos com contagem de tarefas |
| `GET` | `/api/guilds/:id/projects/:projectId` | Projeto com membros |
| `GET` | `/api/guilds/:id/tasks` | Tarefas (`projectId`, `assignedTo`, `status`, `includeClosed`) |
| `GET` | `/api/guilds/:id/tasks/:taskId` | Uma tarefa |
| `GET` | `/api/guilds/:id/items?type=` | Notas, ideias, decisões ou links |
| `GET` | `/api/guilds/:id/items/:itemId` | Um registro |
| `GET` | `/api/guilds/:id/reminders?scope=` | Lembretes pendentes (`me` ou `server`) |
| `GET` | `/api/guilds/:id/search?q=` | Busca unificada |
| `GET` | `/api/guilds/:id/overview` | Dados do `/minhas` |
| `GET` | `/api/guilds/:id/summary` | Dados do `/resumo` |
| `POST` | `/api/guilds/:id/tasks/:taskId/complete` | Conclui |
| `POST` | `/api/guilds/:id/tasks/:taskId/cancel` | Cancela |
| `POST` | `/api/guilds/:id/tasks/:taskId/status` | Muda o status |
| `POST` | `/api/guilds/:id/ideas/:ideaId/status` | Muda o status da ideia |

Erros seguem o formato `{ "error": { "code": "...", "message": "..." } }`, com `400` para validação, `403` para permissão, `404` para inexistente e `500` genérico — detalhe técnico só no log.

---

## Permissões

### Administrador

Membro com `Administrator` ou `Manage Server` no Discord. Pode:

- Gerenciar qualquer projeto e seus membros
- Excluir qualquer registro
- Configurar o bot e o timezone padrão do servidor

### Membro

Qualquer pessoa do servidor. Pode:

- Criar tarefas, notas, ideias, decisões, links e lembretes
- Editar e excluir os **próprios** registros
- Gerenciar as tarefas **atribuídas a ele**
- Cancelar lembretes que criou ou que receberia

Todo comando verifica `guildId`, `userId` e permissões antes de qualquer escrita. A API aplica exatamente as mesmas regras — a interface web não é uma porta dos fundos.

---

## Arquitetura

```text
Discord Commands ─┐
                  ├─→  Services  →  Repositories  →  SQLite
REST API ─────────┘     (regras)      (SQL)
     ↑
Dashboard (Next.js, Server Components + Server Actions)
```

A camada de `services` é a única dona das regras de negócio. Slash commands e API são apenas duas portas de entrada para ela — por isso a permissão de concluir uma tarefa é idêntica nos dois caminhos, sem código duplicado.

```text
apps/bot/src/
├── index.ts                  bootstrap
├── config.ts                 leitura e validação do ambiente
├── api/
│   ├── server.ts             rotas Fastify
│   ├── auth.ts               token de serviço + resolução do ator
│   └── dto.ts                contrato público (snake_case → camelCase)
├── bot/
│   ├── client.ts             criação do client discord.js
│   ├── events.ts             roteamento de interações e tratamento de erros
│   └── commands.ts           registro dos slash commands na API
├── commands/                 um diretório por domínio
├── services/                 regras de negócio
├── database/
│   ├── Database.ts           conexão, WAL, prepared statements em cache
│   ├── migrations.ts         schema versionado
│   └── repositories/         acesso aos dados
├── workers/
│   └── ReminderWorker.ts     entrega dos lembretes
├── utils/                    dates, permissions, formatting, logger, errors
└── types/                    tipos compartilhados

apps/web/src/
├── auth.ts                   Auth.js (provider Discord)
├── app/
│   ├── entrar/               login
│   ├── servidores/           escolha de servidor
│   └── g/[guildId]/          dashboard, com actions.ts (Server Actions)
├── components/               UI do dashboard + components/ui (shadcn)
└── lib/
    ├── api/                  cliente da API do bot (server-only) e tipos
    ├── format.ts             rótulos e datas no fuso do usuário
    └── utils.ts              cn()
```

### Worker de lembretes

A cada 30 segundos (configurável) o worker procura lembretes com `sent = 0` e `remind_at <= agora (UTC)`, entrega por DM, marca como enviado e grava `sent_at`.

Nada fica só em memória: **todo lembrete está no SQLite**. Se o bot cair ou for redeployado, os lembretes vencidos nesse intervalo são entregues assim que ele volta. Se a entrega falhar (DM bloqueada, por exemplo), o worker tenta novamente e desiste depois de 5 tentativas, registrando o motivo no log.

---

## Testes

```bash
npm test
```

Os testes rodam sobre SQLite **em memória** — rápidos e isolados, sem tocar no banco real. A suíte cobre criação de projeto, criação/conclusão de tarefa, notas, ideias, decisões, links, lembretes (para si e para outra pessoa), processamento de lembrete vencido, reentrega após restart, busca, isolamento entre servidores, permissões e conversão de timezone.

A API tem testes próprios via `fastify.inject` com um client do Discord falso: token ausente ou incorreto, ator não informado, quem não é membro da guild, isolamento entre servidores e as permissões de cada ação.

---

## Scripts npm

Todos rodam a partir da raiz.

| Script | O que faz |
| --- | --- |
| `npm run dev:bot` | Bot em modo watch com `tsx` |
| `npm run dev:web` | Dashboard em modo dev |
| `npm run build` | Compila os dois workspaces |
| `npm run build:bot` / `build:web` | Compila um só |
| `npm run start:bot` / `start:web` | Executa o build de produção |
| `npm run start:standalone --workspace @squadbot/web` | Roda o bundle `standalone` (o que a imagem Docker usa) |
| `npm run build:turbopack --workspace @squadbot/web` | Build do dashboard com Turbopack (mais rapido, porem instavel em container) |
| `npm test` | Suíte de testes |
| `npm run typecheck` | Verificação de tipos nos dois apps |
| `npm run lint` | ESLint nos dois apps |

---

## Logs

Logs estruturados, sem dependência externa: JSON em produção, texto legível em desenvolvimento.

Eventos registrados: `Bot iniciado`, `Banco conectado`, `Comandos registrados`, `Discord conectado`, `Reminder worker iniciado`, `API REST iniciada`, `Comando executado`, `Comando rejeitado`, `Erro de comando`, `Lembrete enviado`, `Erro ao enviar lembrete`, além das ações feitas pela web.

Tokens e campos sensíveis são substituídos por `[REDACTED]` antes de qualquer escrita. Erros técnicos ficam **apenas** no log — o usuário recebe uma mensagem amigável no Discord ou no dashboard.

---

## Roadmap

A arquitetura está preparada para, no futuro:

- Criação e edição completas pelo dashboard
- IA para interpretar mensagens em linguagem natural
- Resumo automático e relatórios semanais
- Lembretes recorrentes
- Integrações com GitHub e Google Calendar
- Estatísticas do squad, busca semântica e memória de longo prazo

---

## Licença

MIT
