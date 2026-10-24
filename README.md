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

## Estrutura

```
index.html, manifest.webmanifest, sw.js, netlify.toml
icones/   ícones do app
css/      temas.css (todas as cores), base.css, layout.css, componentes.css
js/       main.js, estado.js, tema.js, rotas.js, eventos.js, views-*.js, ...
```

Ao mudar arquivos do app, aumente a `VERSAO` em `sw.js`: assim o app instalado avisa "Tem uma versão nova".
