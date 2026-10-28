// Bússola: widget para a Tela de Início do iPhone (app Scriptable).
// Pequeno, médio e grande, nas versões clara e escura (segue o iPhone). Tocar abre a Bússola.
//
// Como usar:
// 1. Na Bússola: Configurações → Widget do iPhone → "Gerar o código do widget" e copie o código.
// 2. No Scriptable: "+" → cole este script → dê o nome "Bússola" → toque em ▶︎.
//    Ele pede o endereço da Bússola e o código (ficam guardados no Keychain do iPhone, não no script).
// 3. Na Tela de Início: segure → "+" → Scriptable → escolha o tamanho → toque no widget →
//    Script: Bússola.
// Para trocar o código: abra o script no Scriptable e escolha "Trocar o código".

const CHAVE_ENDERECO = 'bussola.endereco';
const CHAVE_CODIGO = 'bussola.codigo';
const ARQUIVO_CACHE = 'bussola-widget.json';

// Cores da Bússola: [claro, escuro]
const COR = {
  fundo: Color.dynamic(new Color('#F1F1F1'), new Color('#191919')),
  card: Color.dynamic(new Color('#FFFFFF'), new Color('#242424')),
  texto: Color.dynamic(new Color('#2B1E16'), new Color('#EBDCCB')),
  suave: Color.dynamic(new Color('#6B5A4E'), new Color('#A89A8C')),
  destaque: Color.dynamic(new Color('#B08F6E'), new Color('#C9B7A4')),
  alerta: Color.dynamic(new Color('#B3372A'), new Color('#F7A593')),
  laranja: Color.dynamic(new Color('#8A4A0C'), new Color('#F5BE84')),
};

// ---------------------------------------------------------------------------
// Configuração (no Keychain do iPhone)
// ---------------------------------------------------------------------------

async function configurar() {
  const a = new Alert();
  a.title = 'Bússola';
  a.message = 'Cole o endereço da Bússola e o código do widget (Configurações → Widget do iPhone).';
  a.addTextField('https://seu-app.netlify.app', Keychain.contains(CHAVE_ENDERECO) ? Keychain.get(CHAVE_ENDERECO) : '');
  a.addSecureTextField('Código do widget', '');
  a.addAction('Salvar');
  a.addCancelAction('Cancelar');
  if ((await a.presentAlert()) === -1) return false;
  const endereco = a.textFieldValue(0).trim().replace(/\/+$/, '');
  const codigo = a.textFieldValue(1).trim();
  if (!/^https:\/\//.test(endereco) || codigo.length < 30) {
    const erro = new Alert();
    erro.title = 'Faltou algo';
    erro.message = 'O endereço precisa começar com https:// e o código tem mais de 30 letras.';
    erro.addAction('OK');
    await erro.presentAlert();
    return false;
  }
  Keychain.set(CHAVE_ENDERECO, endereco);
  Keychain.set(CHAVE_CODIGO, codigo);
  return true;
}

const configurado = () => Keychain.contains(CHAVE_ENDERECO) && Keychain.contains(CHAVE_CODIGO);

// ---------------------------------------------------------------------------
// Dados (com cópia no iPhone, para mostrar algo sem internet)
// ---------------------------------------------------------------------------

const fm = FileManager.local();
const caminhoCache = fm.joinPath(fm.documentsDirectory(), ARQUIVO_CACHE);

async function buscarResumo() {
  try {
    const r = new Request(`${Keychain.get(CHAVE_ENDERECO)}/.netlify/functions/widget`);
    r.headers = { Authorization: `Bearer ${Keychain.get(CHAVE_CODIGO)}` };
    r.timeoutInterval = 15;
    const dados = await r.loadJSON();
    if (dados && dados.ok) {
      fm.writeString(caminhoCache, JSON.stringify(dados));
      return dados;
    }
    if (r.response && r.response.statusCode === 401) return { ok: false, erro: 'Código inválido. Abra o script e troque o código.' };
  } catch (e) {
    // sem internet: usa a última cópia
  }
  if (fm.fileExists(caminhoCache)) return { ...JSON.parse(fm.readString(caminhoCache)), daCopia: true };
  return { ok: false, erro: 'Sem internet e sem cópia ainda.' };
}

// ---------------------------------------------------------------------------
// Desenho
// ---------------------------------------------------------------------------

function texto(pilha, conteudo, { tamanho = 13, peso = 'regular', cor = COR.texto, linhas = 1 } = {}) {
  const t = pilha.addText(String(conteudo));
  t.font = peso === 'bold' ? Font.boldSystemFont(tamanho) : peso === 'semibold' ? Font.semiboldSystemFont(tamanho) : Font.systemFont(tamanho);
  t.textColor = cor;
  t.lineLimit = linhas;
  return t;
}

function diaCurto(dia, hoje) {
  if (dia === hoje) return 'hoje';
  const amanha = new Date(`${hoje}T12:00:00`);
  amanha.setDate(amanha.getDate() + 1);
  const a = `${amanha.getFullYear()}-${String(amanha.getMonth() + 1).padStart(2, '0')}-${String(amanha.getDate()).padStart(2, '0')}`;
  if (dia === a) return 'amanhã';
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

function topo(w, d, tamanho) {
  const linha = w.addStack();
  linha.centerAlignContent();
  texto(linha, 'Bússola', { tamanho: tamanho === 'small' ? 12 : 13, peso: 'semibold', cor: COR.destaque });
  linha.addSpacer();
  if (d.daCopia) texto(linha, 'sem internet', { tamanho: 10, cor: COR.suave });
}

function blocoTarefas(w, d, quantas) {
  const t = d.tarefas;
  const cab = w.addStack();
  cab.centerAlignContent();
  texto(cab, t.total ? `${t.total} ${t.total === 1 ? 'tarefa' : 'tarefas'} hoje` : 'Tarefas em dia', { tamanho: 15, peso: 'bold' });
  if (t.atrasadas) {
    cab.addSpacer(6);
    texto(cab, `${t.atrasadas} atrasada${t.atrasadas === 1 ? '' : 's'}`, { tamanho: 11, peso: 'semibold', cor: COR.alerta });
  }
  w.addSpacer(4);
  for (const x of t.primeiras.slice(0, quantas)) {
    const l = w.addStack();
    texto(l, x.prioridade >= 2 ? '!! ' : x.prioridade === 1 ? '! ' : '• ', { tamanho: 12, peso: 'bold', cor: x.prioridade ? COR.laranja : COR.destaque });
    texto(l, `${x.hora ? `${x.hora} ` : ''}${x.titulo}`, { tamanho: 12 });
    w.addSpacer(2);
  }
}

function blocoAgenda(w, d, quantos) {
  if (d.agora) {
    const l = w.addStack();
    texto(l, 'Agora: ', { tamanho: 12, peso: 'semibold', cor: COR.destaque });
    texto(l, `${d.agora.titulo} (até ${d.agora.fim})`, { tamanho: 12 });
    w.addSpacer(3);
  }
  for (const e of d.proximos.slice(0, quantos)) {
    const l = w.addStack();
    texto(l, `${diaCurto(e.dia, d.hoje)}${e.hora ? ` ${e.hora}` : ''}  `, { tamanho: 12, peso: 'semibold', cor: e.tipo === 'prova' ? COR.alerta : COR.destaque });
    texto(l, e.titulo, { tamanho: 12 });
    w.addSpacer(2);
  }
  if (!d.agora && !d.proximos.length) texto(w, 'Nada marcado nos próximos dias.', { tamanho: 12, cor: COR.suave });
}

function rodape(w, d) {
  const l = w.addStack();
  l.centerAlignContent();
  const partes = [];
  if (d.demandas.total) partes.push(`${d.demandas.total} demanda${d.demandas.total === 1 ? '' : 's'}${d.demandas.aprovacao ? ` (${d.demandas.aprovacao} p/ aprovar)` : ''}`);
  if (d.habitos.total) partes.push(`hábitos ${d.habitos.feitos}/${d.habitos.total}`);
  texto(l, partes.join(' · ') || 'Tudo em ordem', { tamanho: 11, cor: d.demandas.aprovacao ? COR.alerta : COR.suave });
}

function montar(d, tamanho) {
  const w = new ListWidget();
  w.backgroundColor = COR.fundo;
  w.setPadding(14, 14, 14, 14);
  w.url = `${Keychain.contains(CHAVE_ENDERECO) ? Keychain.get(CHAVE_ENDERECO) : ''}/#inicio`;
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  if (!d.ok) {
    texto(w, 'Bússola', { tamanho: 13, peso: 'semibold', cor: COR.destaque });
    w.addSpacer(6);
    texto(w, d.erro, { tamanho: 12, cor: COR.suave, linhas: 4 });
    return w;
  }
  topo(w, d, tamanho);
  w.addSpacer(6);
  if (tamanho === 'small') {
    blocoTarefas(w, d, 2);
    w.addSpacer();
    const prox = d.agora ? `Agora: ${d.agora.titulo}` : d.proximos[0] ? `${diaCurto(d.proximos[0].dia, d.hoje)} ${d.proximos[0].hora || ''} ${d.proximos[0].titulo}` : '';
    if (prox) texto(w, prox, { tamanho: 11, cor: COR.suave, linhas: 2 });
    return w;
  }
  if (tamanho === 'medium') {
    const linha = w.addStack();
    const esq = linha.addStack();
    esq.layoutVertically();
    blocoTarefas(esq, d, 3);
    linha.addSpacer(12);
    const dir = linha.addStack();
    dir.layoutVertically();
    texto(dir, 'Próximos', { tamanho: 12, peso: 'semibold', cor: COR.suave });
    dir.addSpacer(4);
    blocoAgenda(dir, d, 3);
    w.addSpacer();
    rodape(w, d);
    return w;
  }
  // grande
  blocoTarefas(w, d, 5);
  w.addSpacer(10);
  texto(w, 'Próximos', { tamanho: 12, peso: 'semibold', cor: COR.suave });
  w.addSpacer(4);
  blocoAgenda(w, d, 4);
  w.addSpacer();
  if (d.demandas.primeira) {
    texto(w, `Demanda: ${d.demandas.primeira}`, { tamanho: 11, cor: COR.texto, linhas: 2 });
    w.addSpacer(4);
  }
  rodape(w, d);
  return w;
}

// ---------------------------------------------------------------------------
// Rodar
// ---------------------------------------------------------------------------

async function principal() {
  if (!config.runsInWidget) {
    if (!configurado()) {
      if (!(await configurar())) return;
    } else {
      const menu = new Alert();
      menu.title = 'Bússola';
      menu.addAction('Ver o widget');
      menu.addAction('Trocar o código');
      menu.addCancelAction('Fechar');
      const escolha = await menu.presentAlert();
      if (escolha === -1) return;
      if (escolha === 1 && !(await configurar())) return;
    }
  }
  const tamanho = config.widgetFamily || 'medium';
  const dados = configurado() ? await buscarResumo() : { ok: false, erro: 'Abra este script no Scriptable para colar o código do widget.' };
  const widget = montar(dados, tamanho);
  if (config.runsInWidget) Script.setWidget(widget);
  else await widget.presentMedium();
}

await principal();
Script.complete();
