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

### Variáveis de ambiente

Na Netlify: **Site configuration → Environment variables → Add a variable**. Nunca coloque esses valores no código.

| Variável | Valor | Desde |
|---|---|---|
| `AVA_BASE_URL` | `https://avagrad.unievangelica.edu.br` | Etapa 3 |
| `HUB_CODIGO_ACESSO` | um código que você inventa (ex.: uma frase longa); protege o teste do AVA até o login existir | Etapa 3 |

Depois de criar ou mudar uma variável, faça um novo deploy (**Deploys → Trigger deploy → Deploy site**).

## Testar a conexão com o AVA (Etapa 3)

1. Com o site publicado e as duas variáveis criadas, abra **Configurações** no app.
2. Em "Testar a conexão com o AVA", digite matrícula, senha e o código de acesso e toque em **Testar conexão**.
3. O app mostra o passo a passo, os métodos liberados (✓) e bloqueados (✕), a frequência e os arquivos.
   A senha e o token não são guardados.

Para rodar as funções no computador: `npx netlify-cli dev` (precisa das variáveis num arquivo `.env`, que nunca vai para o repositório).

## Estrutura

```
index.html, manifest.webmanifest, sw.js, netlify.toml
icones/   ícones do app
css/      temas.css (todas as cores), base.css, layout.css, componentes.css
js/       main.js, estado.js, tema.js, rotas.js, eventos.js, views-*.js, ...
```

Ao mudar arquivos do app, aumente a `VERSAO` em `sw.js`: assim o app instalado avisa "Tem uma versão nova".
