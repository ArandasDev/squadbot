# SquadBot

> A memória compartilhada do seu squad, dentro do Discord.

O SquadBot resolve um problema específico de times pequenos: informação espalhada entre papel, mensagens antigas do Discord, apps de notas, planilhas, gerenciadores de tarefas e calendários diferentes.

Com ele, **o Discord vira o ponto central**. Tarefas, anotações, ideias, decisões, links e lembretes ficam todos no mesmo lugar — organizados, pesquisáveis e persistidos.

> O squad não deveria precisar lembrar onde guardou uma informação. O SquadBot guarda, organiza e encontra essa informação quando necessário.

---

## Índice

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
- [Permissões](#permissões)
- [Arquitetura](#arquitetura)
- [Testes](#testes)
- [Scripts npm](#scripts-npm)
- [Logs](#logs)
- [Roadmap](#roadmap)

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

- **Node.js 24** — runtime
- **TypeScript** (modo `strict`) — todo o código-fonte
- **discord.js v14** — integração com o Discord
- **SQLite** via **better-sqlite3** — persistência
- **dotenv** — configuração
- **Vitest** — testes
- **ESLint** — lint
- **Docker** — empacotamento e deploy

O TypeScript em `src/` é compilado para JavaScript em `dist/`, e é o `dist/` que roda em produção.

---

## Instalação

```bash
git clone <url-do-repositorio> squadbot
```

```bash
cd squadbot && npm install
```

---

## Configuração do Discord Developer Portal

### 1. Criar a aplicação

1. Acesse <https://discord.com/developers/applications>.
2. Clique em **New Application**, dê o nome `SquadBot` e confirme.
3. Em **General Information**, copie o **Application ID** — ele vai em `DISCORD_CLIENT_ID`.

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

### 4. Permitir mensagens diretas

Os lembretes chegam por **DM**. Cada membro precisa ter, em **Configurações do Servidor → Privacidade**, a opção de receber mensagens diretas de membros do servidor **ativada** — caso contrário o bot não consegue entregar o lembrete (a falha aparece nos logs).

---

## Configuração do ambiente

Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

E preencha:

```env
DISCORD_TOKEN=seu-token-aqui
DISCORD_CLIENT_ID=id-da-aplicacao
DISCORD_GUILD_ID=          # opcional: registro instantâneo em um servidor de testes
DATABASE_PATH=./data/squadbot.db
DEFAULT_TIMEZONE=America/Sao_Paulo
NODE_ENV=development
REMINDER_INTERVAL_MS=30000
LOG_LEVEL=info
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

> O `.env` está no `.gitignore`. Só o `.env.example` é versionado.

---

## Execução em desenvolvimento

```bash
npm run dev
```

Roda o TypeScript direto com `tsx watch` — o bot reinicia a cada alteração. Os slash commands são registrados automaticamente no boot.

Para registrar os comandos sem subir o bot:

```bash
npm run deploy:commands:dev
```

Durante o desenvolvimento, defina `DISCORD_GUILD_ID` com o ID do seu servidor de testes: o registro passa a ser instantâneo em vez de esperar a propagação global.

---

## Build e execução em produção

```bash
npm run build
```

```bash
npm start
```

O `build` compila `src/` → `dist/`; o `start` executa `node dist/index.js`. Em produção **nunca** se executa TypeScript direto.

---

## Docker

Build da imagem:

```bash
docker build -t squadbot .
```

Execução com volume persistente:

```bash
docker run -d --name squadbot --restart unless-stopped --env-file .env -v "$(pwd)/data:/app/data" squadbot
```

A imagem é multi-stage: um estágio compila o TypeScript, e o estágio final leva apenas as dependências de produção e o `dist/`. O container roda como usuário `node` (não-root) e o banco fica em `/app/data/squadbot.db`.

---

## Docker Compose

```bash
docker compose up -d --build
```

Ver os logs:

```bash
docker compose logs -f bot
```

Parar:

```bash
docker compose down
```

O `docker-compose.yml` monta `./data` em `/app/data`, então o banco sobrevive a `down`, `up` e rebuilds da imagem.

---

## Deploy (Railway e similares)

O SquadBot é um **worker de longa duração**, não um serviço HTTP — ele não expõe porta.

### Passo a passo no Railway

1. Crie um projeto e conecte o repositório. O Railway detecta o `Dockerfile` automaticamente.
2. Em **Variables**, cadastre `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `NODE_ENV=production` e `DATABASE_PATH=/app/data/squadbot.db`.
3. **Crie um volume persistente** (**Settings → Volumes → Add Volume**) com o mount path exatamente:

   ```text
   /app/data
   ```

4. Faça o deploy.

### Por que o volume é obrigatório

O filesystem das plataformas de hospedagem é **efêmero**: a cada deploy, restart ou reciclagem do container, tudo que não estiver num volume é perdido — inclusive o `squadbot.db` com todas as tarefas, notas, decisões e lembretes do squad.

**Sem volume persistente, o squad perde a memória a cada deploy.** Configure o volume antes do primeiro uso real.

### Checklist de produção

- [ ] Volume montado em `/app/data`
- [ ] `DATABASE_PATH=/app/data/squadbot.db`
- [ ] `NODE_ENV=production`
- [ ] `DISCORD_TOKEN` e `DISCORD_CLIENT_ID` cadastrados como variáveis (não no código)
- [ ] `DISCORD_GUILD_ID` **vazio** (registro global)
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
sqlite3 data/squadbot.db ".backup 'data/backup-$(date +%F).db'"
```

Dentro do Docker:

```bash
docker compose exec bot sh -c "node -e \"const D=require('better-sqlite3');new D('/app/data/squadbot.db').backup('/app/data/backup.db')\""
```

Copiando o backup para a sua máquina:

```bash
docker compose cp bot:/app/data/backup.db ./backup.db
```

Com o bot **parado**, basta copiar `data/squadbot.db` junto com `-wal` e `-shm`, se existirem.

Para restaurar: pare o bot, substitua o arquivo e suba de novo.

---

## Timezone

- **Tudo é gravado em UTC** (ISO 8601) no banco.
- A conversão acontece só na leitura da entrada e na exibição.
- Cada usuário tem o seu fuso; o padrão é o do servidor, que por sua vez cai em `DEFAULT_TIMEZONE`.

Configurar o seu fuso:

```text
/config timezone valor:America/Sao_Paulo
```

Configurar o padrão do servidor (apenas administradores):

```text
/config timezone valor:Europe/Lisbon escopo:Padrão do servidor (admin)
```

Ver a configuração atual:

```text
/config ver
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

Todo comando verifica `guildId`, `userId` e permissões antes de qualquer escrita.

---

## Arquitetura

```text
Discord Commands   →  coleta as opções, responde ao usuário
       ↓
Services           →  regras de negócio, validação, permissões
       ↓
Repositories       →  SQL com prepared statements
       ↓
SQLite
```

Comandos não contêm regras de negócio complexas: eles traduzem a interação do Discord e delegam.

```text
src/
├── index.ts                  bootstrap
├── config.ts                 leitura e validação do ambiente
├── bot/
│   ├── client.ts             criação do client discord.js
│   ├── events.ts             roteamento de interações e tratamento de erros
│   └── commands.ts           registro dos slash commands na API
├── commands/                 um diretório por domínio
│   ├── shared.ts             helpers: opções, autocomplete, paginação
│   ├── itemViews.ts          renderização de itens
│   └── project|task|note|idea|decision|link|reminder|general/
├── services/                 regras de negócio
├── database/
│   ├── Database.ts           conexão, WAL, prepared statements em cache
│   ├── migrations.ts         schema versionado
│   └── repositories/         acesso aos dados
├── workers/
│   └── ReminderWorker.ts     entrega dos lembretes
├── utils/                    dates, permissions, formatting, logger, errors
└── types/                    tipos compartilhados
```

### Worker de lembretes

A cada 30 segundos (configurável) o worker procura lembretes com `sent = 0` e `remind_at <= agora (UTC)`, entrega por DM, marca como enviado e grava `sent_at`.

Nada fica só em memória: **todo lembrete está no SQLite**. Se o bot cair ou for redeployado, os lembretes vencidos nesse intervalo são entregues assim que ele volta. Se a entrega falhar (DM bloqueada, por exemplo), o worker tenta novamente e desiste depois de 5 tentativas, registrando o motivo no log.

---

## Testes

```bash
npm test
```

```bash
npm run test:watch
```

Os testes rodam sobre SQLite **em memória** — rápidos e isolados, sem tocar no banco real. A suíte cobre criação de projeto, criação/conclusão de tarefa, notas, ideias, decisões, links, lembretes (para si e para outra pessoa), processamento de lembrete vencido, reentrega após restart, busca, isolamento entre servidores, permissões e conversão de timezone.

---

## Scripts npm

| Script | O que faz |
| --- | --- |
| `npm run dev` | Executa em modo watch com `tsx` |
| `npm run build` | Compila `src/` → `dist/` |
| `npm start` | Executa o JavaScript compilado |
| `npm test` | Roda a suíte de testes |
| `npm run test:watch` | Testes em modo watch |
| `npm run typecheck` | Verificação de tipos sem emitir arquivos |
| `npm run lint` | ESLint |
| `npm run lint:fix` | ESLint com correção automática |
| `npm run deploy:commands` | Registra os slash commands (compilado) |
| `npm run deploy:commands:dev` | Registra os slash commands (TypeScript) |

---

## Logs

Logs estruturados, sem dependência externa: JSON em produção, texto legível em desenvolvimento.

Eventos registrados: `Bot iniciado`, `Banco conectado`, `Comandos registrados`, `Discord conectado`, `Reminder worker iniciado`, `Comando executado`, `Comando rejeitado`, `Erro de comando`, `Lembrete enviado`, `Erro ao enviar lembrete`.

Tokens e campos sensíveis são substituídos por `[REDACTED]` antes de qualquer escrita. Erros técnicos ficam **apenas** no log — o usuário recebe uma mensagem amigável no Discord.

---

## Roadmap

A arquitetura está preparada para, no futuro:

- IA para interpretar mensagens em linguagem natural
- Resumo automático e relatórios semanais
- Lembretes recorrentes
- Dashboard web
- Integrações com GitHub e Google Calendar
- Estatísticas do squad, busca semântica e memória de longo prazo

Nada disso faz parte do MVP — o objetivo aqui é um bot simples, confiável e barato de manter.

---

## Licença

MIT
