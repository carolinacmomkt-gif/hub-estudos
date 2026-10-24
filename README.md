# Hub de Estudos da Carol

App pessoal de estudos em HTML, CSS e JavaScript puro (sem build), instalável como PWA.
As regras do projeto estão em [CLAUDE.md](CLAUDE.md) e as etapas em [ROTEIRO.md](ROTEIRO.md).

## Rodar no computador

O app precisa de um servidor local, porque módulos JS e o service worker não funcionam abrindo o arquivo direto.

```bash
# na pasta do projeto, um dos dois:
npx serve .
python3 -m http.server 8080
```

Abra o endereço que aparecer (ex.: http://localhost:8080). Para ver nos tamanhos do tablet e do celular,
use o Chrome: F12 → ícone de celular → dimensões 1340×800, 800×1340 e 375×812.

## Publicar na Netlify

1. Netlify → **Add new site → Import an existing project → GitHub** → escolha `hub-estudos`.
2. Branch: a que você quer publicar. **Build command**: deixe vazio. **Publish directory**: `.`
3. Clique em **Deploy**. Cada novo push nessa branch publica sozinho.

O `netlify.toml` já cuida do resto (cabeçalhos e o service worker sem cache).
O `package.json` lista só o que as funções usam (o SDK da Anthropic); a Netlify instala sozinha a cada deploy.
O front-end continua sem build.

### Variáveis de ambiente

Na Netlify: **Project configuration → Environment variables → Add a variable**. Nunca coloque esses valores no código.

| Variável | De onde vem | Secreta? |
|---|---|---|
| `AVA_BASE_URL` | `https://avagrad.unievangelica.edu.br` | não |
| `SUPABASE_URL` | Supabase → Project Settings → Data API → Project URL (`https://xxxx.supabase.co`; se vier com `/rest/v1` no fim, o app ignora) | não |
| `SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → `anon` `public` | não (o RLS protege) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → `service_role` | **sim** |
| `TOKEN_CRYPTO_KEY` | Terminal do Mac: `openssl rand -base64 32` | **sim** |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys → Create Key (usada na leitura do calendário acadêmico e, depois, no gerador de questões) | **sim** |

Depois de criar ou mudar uma variável, faça um novo deploy (**Deploys → Trigger deploy**).
`HUB_CODIGO_ACESSO` não é mais usada desde a Etapa 2 (o login protege as funções) e pode ser apagada.

## Banco de dados (Supabase)

O esquema completo está em [`supabase/esquema.sql`](supabase/esquema.sql): cole no **SQL Editor** do Supabase e clique em **Run**.
Pode rodar de novo sem problema. Toda tabela tem RLS ligado à dona; a tabela `credenciais` (token do AVA e senha
do Lyceum, criptografados) não pode ser lida nem pelo app, só pelas funções.

Login: e-mail e senha da usuária criada no Supabase (Authentication → Users), com o cadastro de novas contas desligado.

**Migrações**: quando uma etapa muda o banco, o arquivo novo fica em [`supabase/migracoes/`](supabase/migracoes/).
Rode cada um uma vez no SQL Editor, em ordem (o `esquema.sql` já inclui todos, para instalações novas).
- `002-faculdade.sql` (Etapa 4a): campos das disciplinas para juntar AVA e Lyceum, pesos da calculadora e média.
- `003-calendario.sql` (Etapa 4b): tabela `importacoes`, onde fica a leitura do calendário acadêmico até a Carol revisar.

## Estrutura

```
index.html, manifest.webmanifest, sw.js, netlify.toml
icones/             ícones do app
css/                temas.css (todas as cores), base.css, layout.css, componentes.css, editor.css, calendario.css
js/                 main.js, estado.js, persistencia.js (aparelho + sincronização), nuvem.js (Supabase),
                    funcoes.js, eventos.js, editor-tinta.js (escrita à mão), views-*.js, ...
js/vendor/          perfect-freehand (MIT), copiado sem alterações
netlify/functions/  ava-conectar, lyceum-conectar, desconectar, config-publica, sincronizar, sincronizar-agendado (6h),
                    calendario-ler-background (lê o calendário acadêmico com a IA, em segundo plano)
netlify/lib/        peças das funções: supabase, cripto, ava, lyceum, http, faculdade, sincronizar-ava, sincronizar-lyceum, sincronizacao, ia-calendario
supabase/           esquema.sql
```

Ao mudar arquivos do app, aumente a `VERSAO` em `sw.js`: assim o app instalado avisa "Tem uma versão nova".
