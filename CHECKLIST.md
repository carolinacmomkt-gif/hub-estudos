# Checklist para fechar a Bússola (29/10/2026)

O código está pronto e publicado na branch `claude/nifty-bardeen-v4uatb` (a Netlify publica dela).
O que falta depende de você, Carol, porque mexe no seu Supabase, na sua Netlify e nos seus aparelhos.

## 1. Supabase (SQL Editor), uma vez, nesta ordem
Rode só as que ainda não rodou (o app avisa em Configurações → Sincronização quando falta alguma):
- `supabase/esquema.sql` (se o projeto for novo)
- `supabase/migracoes/002-faculdade.sql` … `009-vida.sql` (as da fase 1 e das áreas de vida)
- `supabase/migracoes/010-demandas.sql` (Caixa de demandas)
- `supabase/migracoes/011-livros.sql` (livros na Biblioteca e a caneta por cima do PDF)

## 2. Netlify → Site configuration → Environment variables
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `AVA_BASE_URL` (`https://avagrad.unievangelica.edu.br`)
- `TOKEN_CRYPTO_KEY` (32 bytes em base64; criptografa o token do AVA, a senha do Lyceum, o Trello e o Notion)
- `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` (avisos por push)
- `TRELLO_API_KEY` (chave do app no Trello, para a Caixa de demandas)
Depois de criar ou mudar uma variável, faça um novo deploy ("Trigger deploy").

## 3. Conexões, dentro do app (Configurações)
- AVA: matrícula e senha uma vez (fica só o token).
- Lyceum: matrícula e senha uma vez (senha criptografada).
- Trello: "Conectar" abre a autorização oficial; depois escolha o quadro dos designers e os dos seus clientes.
- Notion: cole o segredo da conexão interna e escolha as bases.
- Avisos: ative e escolha os horários (no iPhone, só com o app na Tela de Início).
- Horas protegidas, meta de leitura, vidro e tema do seu jeito.

## 4. Instalar nos aparelhos
- **Galaxy Tab S10 Lite**: Chrome → menu → "Instalar app". Teste com a S Pen: caderno, caneta por cima do PDF, folhas laterais em paisagem e o desfoque do vidro (se pesar, desligue o Vidro em Configurações → Aparência).
- **iPhone**: Safari → Compartilhar → "Adicionar à Tela de Início" (se já tinha o app, remova e adicione de novo para o ícone novo aparecer).
- **Computador**: Chrome/Edge → ícone de instalar na barra de endereço.
- Entre com o mesmo e-mail nos três: foco, "continuar de onde parou" e tudo o mais sincroniza.

## 5. Widgets do iPhone e do Mac
- Scriptable → novo script "Bússola" → cole `scriptable/bussola-widget.js` (sem segredo nenhum).
- No app: Configurações → Widgets do iPhone → gere o código do widget (aparece uma vez) e monte cada widget; no Scriptable, o Parâmetro de cada widget é o que a tela mostra.
- Se já usava o script, cole a versão nova (os widgets Finanças e Leituras ganharam linhas novas).

## 6. Primeira semana
- Deixe o "Como estou hoje", o foco, a leitura e os gastos registrados: os "Padrões que você não vê" e a Retrospectiva do mês precisam de umas duas semanas de dados.
- O backup automático roda todo dia às 3h; "Fazer uma cópia agora" fica em Configurações.
