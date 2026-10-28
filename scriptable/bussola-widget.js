// Bússola: widgets para a Tela de Início e a Tela Bloqueada do iPhone (app Scriptable).
// Um script só para todos os widgets: cada widget diz qual é no campo "Parâmetro".
// Estilo vidro (degradê da paleta, cartões translúcidos com borda clara), cores claras e
// escuras seguindo o iPhone (ou fixas), pequeno, médio, grande e os da Tela Bloqueada.
//
// Como usar:
// 1. Na Bússola: Configurações → Widgets do iPhone → "Gerar o código do widget" e copie.
//    Ali mesmo, monte os widgets (área e cores) e veja o "Parâmetro" de cada um.
// 2. No Scriptable: "+" → cole este script → nome "Bússola" → ▶︎ → cole o endereço e o código
//    (ficam no Keychain do iPhone, não no script).
// 3. Na Tela de Início: segure → "+" → Scriptable → tamanho → toque no widget →
//    Script: Bússola · Parâmetro: o do widget (ex.: financas-rosa). Vazio = Hoje.

const CHAVE_ENDERECO = 'bussola.endereco';
const CHAVE_CODIGO = 'bussola.codigo';

// ---------------------------------------------------------------------------
// Configuração (no Keychain do iPhone)
// ---------------------------------------------------------------------------

async function configurar() {
  const a = new Alert();
  a.title = 'Bússola';
  a.message = 'Cole o endereço da Bússola e o código do widget (Configurações → Widgets do iPhone).';
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
    erro.message = 'O endereço começa com https:// e o código tem mais de 30 letras.';
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
// Dados (com a última resposta guardada, para mostrar algo sem internet)
// ---------------------------------------------------------------------------

const fm = FileManager.local();
const cache = (p) => fm.joinPath(fm.documentsDirectory(), `bussola-widget-${(p || 'hoje').replace(/[^a-z0-9-]/gi, '')}.json`);

async function buscar(parametro) {
  try {
    const r = new Request(`${Keychain.get(CHAVE_ENDERECO)}/.netlify/functions/widget?w=${encodeURIComponent(parametro || '')}`);
    r.headers = { Authorization: `Bearer ${Keychain.get(CHAVE_CODIGO)}` };
    r.timeoutInterval = 15;
    const d = await r.loadJSON();
    if (d && d.ok) {
      fm.writeString(cache(parametro), JSON.stringify(d));
      return d;
    }
    if (r.response && r.response.statusCode === 401) return { ok: false, erro: 'Código inválido. Abra o script no Scriptable e troque o código.' };
  } catch (e) {
    // sem internet: usa a última resposta
  }
  if (fm.fileExists(cache(parametro))) return { ...JSON.parse(fm.readString(cache(parametro))), daCopia: true };
  return { ok: false, erro: 'Sem internet e sem cópia ainda.' };
}

// ---------------------------------------------------------------------------
// Cores e peças do estilo vidro
// ---------------------------------------------------------------------------

let C; // cores dinâmicas do widget atual

function prepararCores(cores) {
  const dyn = (campo, alfa = 1) => Color.dynamic(new Color(cores.claro[campo], alfa), new Color(cores.escuro[campo], alfa));
  const dynA = (campo) => Color.dynamic(new Color(cores.claro[campo][0], cores.claro[campo][1]), new Color(cores.escuro[campo][0], cores.escuro[campo][1]));
  C = {
    fundo1: Color.dynamic(new Color(cores.claro.fundo[0]), new Color(cores.escuro.fundo[0])),
    fundo2: Color.dynamic(new Color(cores.claro.fundo[1]), new Color(cores.escuro.fundo[1])),
    texto: dyn('texto'),
    suave: dyn('suave'),
    destaque: dyn('destaque'),
    trilho: dyn('destaque', 0.22),
    alerta: dyn('alerta'),
    vidro: dynA('vidro'),
    borda: dynA('borda'),
  };
}

const FONTES = {
  numero: (n) => Font.boldRoundedSystemFont(n),
  titulo: (n) => Font.semiboldRoundedSystemFont(n),
  texto: (n) => Font.mediumSystemFont(n),
  leve: (n) => Font.systemFont(n),
};

function txt(pilha, conteudo, { tam = 13, fonte = 'texto', cor = C.texto, linhas = 1, encolher = 0.75 } = {}) {
  const t = pilha.addText(String(conteudo ?? ''));
  t.font = FONTES[fonte](tam);
  t.textColor = cor;
  t.lineLimit = linhas;
  t.minimumScaleFactor = encolher;
  return t;
}

function simbolo(pilha, nome, { tam = 13, cor = C.destaque } = {}) {
  const s = SFSymbol.named(nome) || SFSymbol.named('circle.fill');
  s.applyFont(Font.semiboldSystemFont(tam));
  const img = pilha.addImage(s.image);
  img.imageSize = new Size(tam + 2, tam + 2);
  img.tintColor = cor;
  return img;
}

// Cartão de vidro: translúcido, borda fininha clara, cantos arredondados.
function vidro(pilha, { vertical = true, pad = 10, raio = 16 } = {}) {
  const v = pilha.addStack();
  if (vertical) v.layoutVertically();
  v.backgroundColor = C.vidro;
  v.borderColor = C.borda;
  v.borderWidth = 1;
  v.cornerRadius = raio;
  v.setPadding(pad, pad + 2, pad, pad + 2);
  return v;
}

// Anel de progresso desenhado como modelo (o iPhone pinta com a cor de destaque no claro e no escuro).
function anel(fracao, rotulo, { tam = 64, espessura = 7, sub = '' } = {}) {
  const ctx = new DrawContext();
  const escala = 3;
  const s = tam * escala;
  ctx.size = new Size(s, s);
  ctx.opaque = false;
  ctx.respectScreenScale = false;
  const e = espessura * escala;
  const r = (s - e) / 2;
  const centro = s / 2;
  ctx.setStrokeColor(new Color('#000000', 0.22));
  ctx.setLineWidth(e);
  ctx.strokeEllipse(new Rect(e / 2, e / 2, s - e, s - e));
  const f = Math.max(0, Math.min(1, fracao || 0));
  if (f > 0) {
    ctx.setStrokeColor(new Color('#000000', 1));
    ctx.setFillColor(new Color('#000000', 1));
    const passos = Math.max(2, Math.round(120 * f));
    const p = new Path();
    for (let i = 0; i <= passos; i += 1) {
      const ang = -Math.PI / 2 + (2 * Math.PI * f * i) / passos;
      const pt = new Point(centro + r * Math.cos(ang), centro + r * Math.sin(ang));
      if (i === 0) p.move(pt); else p.addLine(pt);
    }
    ctx.addPath(p);
    ctx.strokePath();
    // pontas arredondadas
    for (const ang of [-Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * f]) {
      ctx.fillEllipse(new Rect(centro + r * Math.cos(ang) - e / 2, centro + r * Math.sin(ang) - e / 2, e, e));
    }
  }
  ctx.setTextColor(new Color('#000000', 1));
  ctx.setTextAlignedCenter();
  const fonte = Math.round(s * (String(rotulo).length > 3 ? 0.24 : 0.32));
  ctx.setFont(Font.boldRoundedSystemFont(fonte));
  const alturaSub = sub ? s * 0.14 : 0;
  ctx.drawTextInRect(String(rotulo), new Rect(0, centro - fonte * 0.62 - alturaSub / 2, s, fonte * 1.3));
  if (sub) {
    ctx.setFont(Font.semiboldSystemFont(Math.round(s * 0.11)));
    ctx.setTextColor(new Color('#000000', 0.7));
    ctx.drawTextInRect(sub, new Rect(0, centro + fonte * 0.42, s, s * 0.16));
  }
  return ctx.getImage();
}

function addAnel(pilha, fracao, rotulo, opcoes = {}) {
  const img = pilha.addImage(anel(fracao, rotulo, opcoes));
  img.imageSize = new Size(opcoes.tam || 64, opcoes.tam || 64);
  img.tintColor = opcoes.cor || C.destaque;
  return img;
}

// Barra de progresso (pilhas com largura fixa: acompanha as cores dinâmicas).
function barra(pilha, fracao, { largura = 120, altura = 6, cor = C.destaque } = {}) {
  const fora = pilha.addStack();
  fora.size = new Size(largura, altura);
  fora.backgroundColor = C.trilho;
  fora.cornerRadius = altura / 2;
  const f = Math.max(0, Math.min(1, fracao || 0));
  if (f > 0) {
    const dentro = fora.addStack();
    dentro.size = new Size(Math.max(altura, largura * f), altura);
    dentro.backgroundColor = cor;
    dentro.cornerRadius = altura / 2;
  }
  fora.addSpacer();
  return fora;
}

function linhaLista(pilha, { marca = 'circle', corMarca = C.destaque, texto: t, detalhe = '', tam = 12, linhas = 1 }) {
  const l = pilha.addStack();
  l.centerAlignContent();
  simbolo(l, marca, { tam: tam - 2, cor: corMarca });
  l.addSpacer(6);
  txt(l, t, { tam, linhas });
  if (detalhe) {
    l.addSpacer(4);
    txt(l, detalhe, { tam: tam - 1, cor: C.suave });
  }
  l.addSpacer();
  return l;
}

const horas = (min) => `${(Math.round((min / 60) * 10) / 10).toLocaleString('pt-BR')}h`;
const dinheiro = (v) => `R$ ${(Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const dinheiroExato = (v) => `R$ ${(Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function diaCurto(dia, hoje) {
  if (dia === hoje) return 'hoje';
  const d = new Date(`${hoje}T12:00:00`);
  d.setDate(d.getDate() + 1);
  const amanha = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (dia === amanha) return 'amanhã';
  const nomes = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  return `${nomes[new Date(`${dia}T12:00:00`).getDay()]} ${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

function cabecalho(w, d, { compacto = false } = {}) {
  const l = w.addStack();
  l.centerAlignContent();
  simbolo(l, d.widget.simbolo, { tam: compacto ? 12 : 13 });
  l.addSpacer(5);
  txt(l, d.widget.titulo, { tam: compacto ? 12 : 13, fonte: 'titulo', cor: C.suave });
  l.addSpacer();
  if (d.daCopia) simbolo(l, 'wifi.slash', { tam: 10, cor: C.suave });
  return l;
}

// O número principal de cada área (Tela Bloqueada e widgets pequenos).
function principal(d) {
  const x = d.dados;
  switch (d.widget.area) {
    case 'tarefas': return { valor: String(x.total), fracao: x.progresso, rotulo: x.total === 1 ? 'tarefa' : 'tarefas', linha: x.lista[0]?.titulo || 'Tudo feito hoje' };
    case 'habitos': return { valor: `${x.feitos}/${x.total}`, fracao: x.progresso, rotulo: 'hábitos', linha: x.lista.find((h) => !h.feito)?.nome || 'Todos feitos' };
    case 'demandas': return { valor: String(x.total), fracao: null, rotulo: x.aprovacao ? `${x.aprovacao} p/ aprovar` : 'demandas', linha: x.lista[0]?.titulo || 'Nada esperando' };
    case 'financas': return { valor: dinheiro(x.livre), fracao: null, rotulo: 'dá para gastar', linha: `${dinheiro(x.porDia)} por dia` };
    case 'faculdade': return x.prova ? { valor: String(x.prova.dias), fracao: null, rotulo: x.prova.dias === 1 ? 'dia p/ prova' : 'dias p/ prova', linha: x.prova.disciplina || x.prova.titulo } : { valor: '–', fracao: null, rotulo: 'sem prova', linha: x.notas[0] ? `${x.notas[0].disciplina}: ${x.notas[0].texto}` : 'Tudo encaminhado' };
    case 'foco': return { valor: `${x.hoje}`, fracao: Math.min(1, x.hoje / 120), rotulo: 'min hoje', linha: `${horas(x.semana)} na semana` };
    case 'substack': return { valor: `${x.feitos}/${x.meta}`, fracao: x.fracao, rotulo: 'no mês', linha: x.proxima?.titulo || 'Sem pauta aberta' };
    case 'metas': return { valor: x.lista[0] ? `${Math.round(x.lista[0].fracao * 100)}%` : '–', fracao: x.lista[0]?.fracao ?? null, rotulo: 'meta', linha: x.lista[0]?.titulo || 'Sem meta ativa' };
    case 'agenda': { const e = x.agora || x.lista[0]; return { valor: x.lista.length ? String(x.lista.length) : '0', fracao: null, rotulo: 'próximos', linha: e ? `${x.agora ? 'Agora' : diaCurto(e.dia, d.hoje)}${e.hora && !x.agora ? ` ${e.hora}` : ''}: ${e.titulo}` : 'Nada marcado' }; }
    case 'youtube': return { valor: String(x.etapas.reduce((t, e) => t + e.total, 0)), fracao: null, rotulo: 'vídeos', linha: x.proximo ? `${x.proximo.etapa}: ${x.proximo.titulo}` : 'Sem vídeo em produção' };
    case 'leituras': return { valor: String(x.lendo), fracao: null, rotulo: 'lendo', linha: x.lista[0]?.titulo || 'Nada na fila' };
    case 'frase': return { valor: '“', fracao: null, rotulo: '', linha: x.texto };
    default: { const t = x.tarefas; return { valor: String(t.total), fracao: t.progresso, rotulo: t.total === 1 ? 'tarefa' : 'tarefas', linha: x.agenda.agora ? `Agora: ${x.agenda.agora.titulo}` : x.agenda.lista[0] ? `${diaCurto(x.agenda.lista[0].dia, d.hoje)} ${x.agenda.lista[0].hora || ''} ${x.agenda.lista[0].titulo}` : 'Agenda livre' }; }
  }
}

// ---------------------------------------------------------------------------
// Conteúdo de cada área (médio e grande); o pequeno usa o "principal"
// ---------------------------------------------------------------------------

function listaTarefas(p, x, n, tam = 12) {
  if (!x.lista.length) { txt(p, 'Tudo feito por hoje.', { tam, cor: C.suave }); return; }
  for (const t of x.lista.slice(0, n)) {
    linhaLista(p, { marca: t.prioridade >= 2 ? 'exclamationmark.circle.fill' : 'circle', corMarca: t.atrasada || t.prioridade >= 2 ? C.alerta : C.destaque, texto: t.titulo, detalhe: t.hora || '', tam });
    p.addSpacer(3);
  }
}

function listaAgenda(p, x, hoje, n, tam = 12) {
  if (x.agora) {
    linhaLista(p, { marca: 'record.circle', corMarca: C.alerta, texto: x.agora.titulo, detalhe: `até ${x.agora.fim}`, tam });
    p.addSpacer(3);
  }
  if (!x.lista.length && !x.agora) { txt(p, 'Nada marcado nos próximos dias.', { tam, cor: C.suave }); return; }
  for (const e of x.lista.slice(0, n)) {
    linhaLista(p, { marca: e.tipo === 'prova' ? 'pencil.and.outline' : 'calendar', corMarca: e.tipo === 'prova' ? C.alerta : C.destaque, texto: e.titulo, detalhe: `${diaCurto(e.dia, hoje)}${e.hora ? ` ${e.hora}` : ''}`, tam });
    p.addSpacer(3);
  }
}

function conteudo(w, d, familia) {
  const x = d.dados;
  const grande = familia === 'large' || familia === 'extraLarge';
  const n = grande ? 7 : 3;
  const area = d.widget.area;
  const linhaAnel = (fracao, rotulo, sub, titulo, linha) => {
    const l = w.addStack();
    l.centerAlignContent();
    addAnel(l, fracao, rotulo, { tam: grande ? 72 : 62, sub });
    l.addSpacer(12);
    const col = l.addStack();
    col.layoutVertically();
    txt(col, titulo, { tam: grande ? 17 : 15, fonte: 'titulo', linhas: 2 });
    if (linha) { col.addSpacer(2); txt(col, linha, { tam: 12, cor: C.suave, linhas: 2 }); }
    l.addSpacer();
    return l;
  };

  if (area === 'tarefas') {
    const resto = x.total;
    linhaAnel(x.progresso, `${x.feitas}`, 'feitas', resto ? `${resto} ${resto === 1 ? 'tarefa' : 'tarefas'} para hoje` : 'Tudo feito hoje', x.atrasadas ? `${x.atrasadas} atrasada${x.atrasadas === 1 ? '' : 's'}` : '');
    w.addSpacer(8);
    const v = vidro(w);
    listaTarefas(v, x, grande ? 7 : 2);
  } else if (area === 'agenda') {
    const v = vidro(w);
    listaAgenda(v, x, d.hoje, grande ? 8 : 3);
  } else if (area === 'demandas') {
    const l = w.addStack();
    l.bottomAlignContent();
    txt(l, String(x.total), { tam: 34, fonte: 'numero' });
    l.addSpacer(6);
    txt(l, x.total === 1 ? 'demanda esperando' : 'demandas esperando', { tam: 13, cor: C.suave });
    if (x.aprovacao) { l.addSpacer(8); txt(l, `${x.aprovacao} p/ aprovar`, { tam: 12, fonte: 'titulo', cor: C.alerta }); }
    w.addSpacer(8);
    if (x.lista.length) {
      const v = vidro(w);
      for (const dm of x.lista.slice(0, n)) {
        linhaLista(v, { marca: dm.tipo === 'aprovacao' ? 'paperplane.fill' : dm.origem === 'notion' ? 'doc.text' : 'tray', corMarca: dm.tipo === 'aprovacao' ? C.alerta : C.destaque, texto: dm.titulo, detalhe: grande && dm.quem ? dm.quem : '' });
        v.addSpacer(3);
      }
    }
  } else if (area === 'habitos') {
    linhaAnel(x.progresso, `${x.feitos}/${x.total}`, 'hoje', x.feitos === x.total && x.total ? 'Todos os hábitos feitos' : `Faltam ${x.total - x.feitos}`, '');
    w.addSpacer(8);
    const v = vidro(w);
    for (const h of x.lista.slice(0, grande ? 7 : 2)) {
      linhaLista(v, { marca: h.feito ? 'checkmark.circle.fill' : 'circle', texto: `${h.icone ? `${h.icone} ` : ''}${h.nome}`, detalhe: h.meta > 1 ? `${h.valor}/${h.meta}` : '' });
      v.addSpacer(3);
    }
  } else if (area === 'financas') {
    const l = w.addStack();
    const esq = l.addStack();
    esq.layoutVertically();
    txt(esq, 'Dá para gastar', { tam: 12, cor: C.suave });
    txt(esq, dinheiro(x.livre), { tam: grande ? 34 : 28, fonte: 'numero', cor: x.livre < 0 ? C.alerta : C.texto });
    txt(esq, `${dinheiro(x.porDia)} por dia · ${x.diasRestantes} dias`, { tam: 11, cor: C.suave });
    l.addSpacer(10);
    const v = vidro(l, { pad: 8 });
    txt(v, 'Saiu no mês', { tam: 11, cor: C.suave });
    txt(v, dinheiro(x.saiu), { tam: 16, fonte: 'numero' });
    v.addSpacer(2);
    txt(v, 'Entrou', { tam: 11, cor: C.suave });
    txt(v, dinheiro(x.entrou), { tam: 16, fonte: 'numero' });
    if (grande) {
      w.addSpacer(10);
      const cats = vidro(w);
      txt(cats, 'Para onde foi', { tam: 12, fonte: 'titulo', cor: C.suave });
      cats.addSpacer(6);
      const maior = Math.max(1, ...x.categorias.map((c) => c.total));
      for (const c of x.categorias) {
        const linha = cats.addStack();
        linha.centerAlignContent();
        txt(linha, c.nome, { tam: 12 });
        linha.addSpacer();
        txt(linha, dinheiro(c.total), { tam: 12, fonte: 'titulo' });
        cats.addSpacer(3);
        barra(cats, c.total / maior, { largura: 270, altura: 5 });
        cats.addSpacer(6);
      }
      if (x.contas.length) {
        w.addSpacer(8);
        const ct = vidro(w);
        txt(ct, 'Contas da semana', { tam: 12, fonte: 'titulo', cor: C.suave });
        ct.addSpacer(4);
        for (const c of x.contas) { linhaLista(ct, { marca: c.atrasada ? 'exclamationmark.circle.fill' : 'calendar', corMarca: c.atrasada ? C.alerta : C.destaque, texto: c.nome, detalhe: `${dinheiroExato(c.valor)} · ${c.atrasada ? 'atrasada' : c.dias === 0 ? 'hoje' : `${c.dias}d`}` }); ct.addSpacer(3); }
      }
    }
  } else if (area === 'faculdade') {
    if (x.prova) {
      const l = w.addStack();
      l.bottomAlignContent();
      txt(l, String(x.prova.dias), { tam: 34, fonte: 'numero', cor: x.prova.dias <= 2 ? C.alerta : C.texto });
      l.addSpacer(6);
      const col = l.addStack();
      col.layoutVertically();
      txt(col, x.prova.dias === 1 ? 'dia para a prova' : 'dias para a prova', { tam: 12, cor: C.suave });
      txt(col, x.prova.disciplina || x.prova.titulo, { tam: 14, fonte: 'titulo' });
    } else txt(w, 'Nenhuma prova marcada.', { tam: 14, fonte: 'titulo' });
    w.addSpacer(8);
    if (x.notas.length || x.faltas.length) {
      const v = vidro(w);
      for (const nt of x.notas.slice(0, grande ? 4 : 2)) { linhaLista(v, { marca: nt.nivel === 'impossivel' || nt.nivel === 'abaixo' ? 'exclamationmark.triangle.fill' : 'graduationcap', corMarca: ['impossivel', 'abaixo', 'dificil'].includes(nt.nivel) ? C.alerta : C.destaque, texto: nt.disciplina, detalhe: nt.texto }); v.addSpacer(3); }
      if (grande) for (const f of x.faltas) { linhaLista(v, { marca: 'person.crop.circle.badge.exclamationmark', corMarca: C.alerta, texto: f.disciplina, detalhe: f.restantes < 0 ? 'passou das faltas' : `pode faltar ${f.restantes}` }); v.addSpacer(3); }
    }
  } else if (area === 'metas') {
    const v = vidro(w);
    if (!x.lista.length) txt(v, 'Nenhuma meta ativa com progresso.', { tam: 12, cor: C.suave });
    for (const m of x.lista.slice(0, grande ? 5 : 2)) {
      const l = v.addStack();
      txt(l, m.titulo, { tam: 12, fonte: 'titulo' });
      l.addSpacer();
      txt(l, m.texto, { tam: 12, cor: C.suave });
      v.addSpacer(4);
      barra(v, m.fracao, { largura: 270, altura: 6 });
      v.addSpacer(8);
    }
  } else if (area === 'foco') {
    const l = w.addStack();
    l.centerAlignContent();
    addAnel(l, Math.min(1, x.hoje / 120), `${x.hoje}`, { tam: 62, sub: 'min hoje' });
    l.addSpacer(14);
    // Barras da semana (seg a dom)
    const grafico = l.addStack();
    grafico.bottomAlignContent();
    const maior = Math.max(30, ...x.porDia);
    ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].forEach((letra, i) => {
      const col = grafico.addStack();
      col.layoutVertically();
      col.bottomAlignContent();
      const alto = Math.max(4, Math.round(48 * (x.porDia[i] / maior)));
      const b = col.addStack();
      b.size = new Size(12, alto);
      b.backgroundColor = x.porDia[i] ? C.destaque : C.trilho;
      b.cornerRadius = 4;
      col.addSpacer(3);
      txt(col, letra, { tam: 9, cor: C.suave });
      grafico.addSpacer(6);
    });
    l.addSpacer();
    w.addSpacer(6);
    txt(w, `${horas(x.semana)} de foco na semana · ${x.sessoes} ${x.sessoes === 1 ? 'sessão' : 'sessões'}`, { tam: 12, cor: C.suave });
  } else if (area === 'frase') {
    const v = vidro(w, { pad: 12 });
    txt(v, `“${x.texto}”`, { tam: grande ? 20 : 15, fonte: 'titulo', linhas: grande ? 8 : 4, encolher: 0.6 });
    if (x.autor) { v.addSpacer(6); txt(v, x.autor, { tam: 12, cor: C.suave }); }
  } else if (area === 'youtube') {
    if (x.proximo) {
      txt(w, x.proximo.etapa, { tam: 12, fonte: 'titulo', cor: C.destaque });
      txt(w, x.proximo.titulo, { tam: 16, fonte: 'titulo', linhas: 2 });
      if (x.proximo.publicacao) txt(w, `publica ${diaCurto(x.proximo.publicacao, d.hoje)}`, { tam: 11, cor: C.suave });
    } else txt(w, 'Nenhum vídeo em produção.', { tam: 14, fonte: 'titulo' });
    w.addSpacer(8);
    if (x.etapas.length) {
      const v = vidro(w, { vertical: false, pad: 8 });
      x.etapas.slice(0, grande ? 7 : 4).forEach((e, i) => {
        if (i) v.addSpacer();
        const col = v.addStack();
        col.layoutVertically();
        txt(col, String(e.total), { tam: 16, fonte: 'numero' });
        txt(col, e.nome, { tam: 10, cor: C.suave });
      });
    }
  } else if (area === 'substack') {
    linhaAnel(x.fracao, `${x.feitos}/${x.meta}`, 'no mês', x.feitos >= x.meta ? 'Meta do mês feita' : `Faltam ${x.meta - x.feitos} textos`, x.proxima ? `Próximo: ${x.proxima.titulo}` : '');
  } else if (area === 'leituras') {
    txt(w, `${x.lendo} lendo · ${x.fila} na fila`, { tam: 13, cor: C.suave });
    w.addSpacer(6);
    const v = vidro(w);
    if (!x.lista.length) txt(v, 'Nada na fila de leitura.', { tam: 12, cor: C.suave });
    for (const a of x.lista.slice(0, n)) { linhaLista(v, { marca: a.status === 'lendo' ? 'book.fill' : 'book', texto: a.titulo, detalhe: grande && a.autor ? a.autor : '' }); v.addSpacer(3); }
  } else {
    // Hoje
    const t = x.tarefas;
    linhaAnel(t.progresso, `${t.total}`, t.total === 1 ? 'tarefa' : 'tarefas', t.total ? 'Para hoje' : 'Tarefas em dia', [x.demandas.aprovacao ? `${x.demandas.aprovacao} post${x.demandas.aprovacao === 1 ? '' : 's'} p/ aprovar` : x.demandas.total ? `${x.demandas.total} demanda${x.demandas.total === 1 ? '' : 's'}` : '', x.habitos.total ? `hábitos ${x.habitos.feitos}/${x.habitos.total}` : ''].filter(Boolean).join(' · '));
    w.addSpacer(8);
    const v = vidro(w);
    if (grande) {
      txt(v, 'Tarefas', { tam: 11, fonte: 'titulo', cor: C.suave });
      v.addSpacer(4);
      listaTarefas(v, t, 4);
      v.addSpacer(6);
      txt(v, 'Próximos', { tam: 11, fonte: 'titulo', cor: C.suave });
      v.addSpacer(4);
      listaAgenda(v, x.agenda, d.hoje, 3);
    } else {
      listaAgenda(v, x.agenda, d.hoje, 2);
    }
  }
}

function pequeno(w, d) {
  const m = principal(d);
  if (d.widget.area === 'frase') {
    txt(w, `“${d.dados.texto}”`, { tam: 14, fonte: 'titulo', linhas: 6, encolher: 0.55 });
    if (d.dados.autor) { w.addSpacer(4); txt(w, d.dados.autor, { tam: 10, cor: C.suave }); }
    return;
  }
  if (m.fracao !== null) {
    const l = w.addStack();
    l.addSpacer();
    addAnel(l, m.fracao, m.valor, { tam: 72, sub: m.rotulo });
    l.addSpacer();
  } else {
    txt(w, m.valor, { tam: m.valor.length > 7 ? 24 : 34, fonte: 'numero', encolher: 0.5 });
    txt(w, m.rotulo, { tam: 12, cor: C.suave });
  }
  w.addSpacer();
  txt(w, m.linha, { tam: 11, linhas: 2, cor: C.texto });
}

// Tela Bloqueada: o iPhone pinta em uma cor só (por isso tudo em branco, sem fundo).
function bloqueada(w, d, familia) {
  const m = principal(d);
  const branco = Color.white();
  if (familia === 'accessoryInline') {
    txt(w, `${m.valor} ${m.rotulo}${m.linha ? ` · ${m.linha}` : ''}`, { tam: 12, cor: branco });
    return;
  }
  if (familia === 'accessoryCircular') {
    const img = w.addImage(anel(m.fracao ?? 1, m.valor.length > 4 ? m.valor.slice(0, 4) : m.valor, { tam: 58, espessura: 5 }));
    img.imageSize = new Size(58, 58);
    img.tintColor = branco;
    return;
  }
  const l = w.addStack();
  l.centerAlignContent();
  simbolo(l, d.widget.simbolo, { tam: 11, cor: branco });
  l.addSpacer(4);
  txt(l, `${m.valor} ${m.rotulo}`, { tam: 13, fonte: 'titulo', cor: branco });
  w.addSpacer(2);
  txt(w, m.linha, { tam: 12, cor: branco, linhas: 2 });
}

function montar(d, familia) {
  const w = new ListWidget();
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  const endereco = Keychain.contains(CHAVE_ENDERECO) ? Keychain.get(CHAVE_ENDERECO) : '';
  if (!d.ok) {
    prepararCores({ claro: { fundo: ['#F6F2EE', '#E7DED5'], texto: '#2B1E16', suave: '#6B5A4E', destaque: '#8C6A4A', vidro: ['#FFFFFF', 0.6], borda: ['#FFFFFF', 0.9], alerta: '#A3301F' }, escuro: { fundo: ['#2A2420', '#141211'], texto: '#F1E6DA', suave: '#B3A596', destaque: '#E3C9AE', vidro: ['#FFFFFF', 0.08], borda: ['#FFFFFF', 0.16], alerta: '#F7A593' } });
    w.backgroundGradient = fundo();
    txt(w, 'Bússola', { tam: 13, fonte: 'titulo', cor: C.destaque });
    w.addSpacer(6);
    txt(w, d.erro, { tam: 12, cor: C.suave, linhas: 4 });
    return w;
  }
  w.url = `${endereco}/#${{ hoje: 'inicio', tarefas: 'tarefas', agenda: 'calendario', demandas: 'inicio', habitos: 'habitos', financas: 'financas', faculdade: 'faculdade', metas: 'metas/lista', foco: 'foco', frase: 'inicio', youtube: 'youtube', substack: 'substack', leituras: 'biblioteca' }[d.widget.area] || 'inicio'}`;
  prepararCores(d.widget.cores);
  if (String(familia).startsWith('accessory')) {
    bloqueada(w, d, familia);
    return w;
  }
  w.backgroundGradient = fundo();
  const pad = familia === 'small' ? 14 : 16;
  w.setPadding(pad, pad, pad, pad);
  cabecalho(w, d, { compacto: familia === 'small' });
  w.addSpacer(familia === 'small' ? 6 : 10);
  if (familia === 'small') pequeno(w, d);
  else { conteudo(w, d, familia); w.addSpacer(); }
  return w;
}

function fundo() {
  const g = new LinearGradient();
  g.colors = [C.fundo1, C.fundo2];
  g.locations = [0, 1];
  g.startPoint = new Point(0, 0);
  g.endPoint = new Point(1, 1);
  return g;
}

// ---------------------------------------------------------------------------
// Rodar
// ---------------------------------------------------------------------------

async function principalDoScript() {
  if (!config.runsInWidget) {
    if (!configurado()) {
      if (!(await configurar())) return;
    } else {
      const menu = new Alert();
      menu.title = 'Bússola';
      menu.message = 'Ver como fica (com o parâmetro abaixo) ou trocar o código.';
      menu.addTextField('Parâmetro (vazio = Hoje)', '');
      menu.addAction('Ver pequeno');
      menu.addAction('Ver médio');
      menu.addAction('Ver grande');
      menu.addAction('Trocar o código');
      menu.addCancelAction('Fechar');
      const escolha = await menu.presentAlert();
      if (escolha === -1) return;
      if (escolha === 3) { await configurar(); return; }
      const familia = ['small', 'medium', 'large'][escolha];
      const d = await buscar(menu.textFieldValue(0).trim());
      const w = montar(d, familia);
      if (familia === 'small') await w.presentSmall();
      else if (familia === 'medium') await w.presentMedium();
      else await w.presentLarge();
      return;
    }
  }
  const familia = config.widgetFamily || 'medium';
  const d = configurado() ? await buscar(args.widgetParameter || '') : { ok: false, erro: 'Abra este script no Scriptable para colar o código do widget.' };
  const w = montar(d, familia);
  if (config.runsInWidget) Script.setWidget(w);
  else await w.presentMedium();
}

await principalDoScript();
Script.complete();
