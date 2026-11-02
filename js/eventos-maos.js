// Ações do "Com as mãos": pintar (toque na parte do desenho), folha com a caneta (o mesmo editor de
// tinta dos Cadernos), contador do crochê, ideias com cronômetro e a foto do projeto.
// A folha não é refeita a cada redesenho da tela: o editor fica guardado e volta para o lugar.

import { obterEstado, atualizarEstado } from './estado.js';
import { gravar } from './gravacao.js';
import { confirmar, perguntarTexto } from './confirmar.js';
import { EditorDeTinta, novaPaginaVazia } from './editor-tinta.js';
import { dimensoes } from './folhas.js';
import { vivosMaos, lerParametroMaos, svgFundoDaFolha, projetoDe } from './dados-maos.js';
import { listar, salvar } from './persistencia.js';
import {
  meuModelo, lerFonte, cinzaDe, limiarAutomatico, mascaraDe, pngDaMascara, mascaraDoDesenho, tracosNaCor,
  fundoParaCobrir, criarPintura, miniaturaDoCanvas,
} from './maos-modelos.js';

let app;
const avisar = (t) => app?.avisoCurto?.(t);
const linhaDe = (id) => vivosMaos(obterEstado()).find((m) => m.id === id) || null;
const rota = (...partes) => `#cantinho/${['maos', ...partes].filter(Boolean).join(':')}`;
const lerLocal = (chave, padrao) => { try { const v = localStorage.getItem(chave); return v === null ? padrao : JSON.parse(v); } catch { return padrao; } };
const gravarLocal = (chave, valor) => { try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* sem armazenamento: vale até fechar */ } };

export function ligarMaos(funcoes) {
  app = funcoes;
  atualizarEstado({ maosDedo: lerLocal('hub.maos.dedo', !document.body.dataset.aparelho || document.body.dataset.aparelho !== 'tablet'), maosCaneta: lerLocal('hub.maos.caneta', {}), maosCrono: lerLocal('hub.maos.crono', null) });
  // Pintar: o toque numa parte do desenho (não é um botão, é um <path data-r>).
  document.addEventListener('click', (e) => {
    const area = e.target.closest?.('[data-maos-pintar] path[data-r]');
    if (area) pintar(area.closest('[data-maos-pintar]').dataset.maosPintar, area);
  });
}

// ---------------------------------------------------------------------------
// Gravar (com atraso, para tocar várias vezes sem esperar)
// ---------------------------------------------------------------------------

const pendentes = new Map(); // id → dados ainda não gravados
const atuais = new Map(); // id → a versão mais nova (vale mais que a que volta da gravação)
let tempoGravar = null;
const porNaMemoria = (id, dados) => atualizarEstado({ maos: (obterEstado().maos || []).map((m) => (m.id === id ? { ...m, dados } : m)) });
function mudarDados(id, fn, { ja = false } = {}) {
  const linha = linhaDe(id);
  if (!linha) return null;
  const dados = { ...(atuais.get(id) || linha.dados || {}) };
  fn(dados);
  atuais.set(id, dados);
  pendentes.set(id, dados);
  // Estado na memória já com a mudança (a tela redesenha certo antes de gravar).
  porNaMemoria(id, dados);
  clearTimeout(tempoGravar);
  if (ja) gravarPendentes(); else tempoGravar = setTimeout(gravarPendentes, 150);
  return dados;
}
async function gravarPendentes() {
  clearTimeout(tempoGravar);
  const lote = [...pendentes];
  pendentes.clear();
  for (const [id, dados] of lote) {
    const linha = linhaDe(id);
    if (!linha) continue;
    await gravar('maos', 'maos', { ...linha, dados });
    // Mudou de novo enquanto gravava: a memória fica com a versão mais nova (ela grava em seguida).
    if (atuais.get(id) !== dados) porNaMemoria(id, atuais.get(id));
    else atuais.delete(id);
  }
}

async function criar(tipo, modelo, titulo, dados = {}) {
  const salvo = await gravar('maos', 'maos', { tipo, modelo: modelo || null, titulo: titulo || null, dados });
  return salvo;
}

// ---------------------------------------------------------------------------
// Pintar
// ---------------------------------------------------------------------------

function pintar(id, area) {
  const tinta = Number(obterEstado().maosTinta ?? 6);
  const r = area.dataset.r;
  const dados = mudarDados(id, (d) => {
    const cores = { ...(d.cores || {}) };
    const antes = cores[r] || 0;
    if (antes === tinta) return;
    if (tinta) cores[r] = tinta; else delete cores[r];
    d.cores = cores;
    d.historico = [...(d.historico || []), [r, antes]].slice(-80);
  });
  if (!dados) return;
  area.style.fill = tinta ? `var(--pinta-${tinta})` : 'var(--maos-vazio)';
  const n = Object.keys(dados.cores || {}).length;
  const contagem = document.querySelector('[data-maos-contagem]');
  if (contagem) contagem.textContent = `${n} ${n === 1 ? 'parte pintada' : 'partes pintadas'}`;
  const desfazer = document.querySelector('[data-acao="maos-desfazer-cor"]');
  if (desfazer) desfazer.disabled = !dados.historico?.length;
}

function marcarEscolha(seletor, valor) {
  document.querySelectorAll(seletor).forEach((b) => {
    const sim = String(b.dataset.valor) === String(valor);
    b.setAttribute('aria-checked', String(sim));
    if (b.hasAttribute('aria-pressed')) b.setAttribute('aria-pressed', String(sim));
  });
}

// ---------------------------------------------------------------------------
// Folha com a caneta
// ---------------------------------------------------------------------------

let folha = null; // { id, editor, tempo }
let trava = null;

function aplicarCaneta(editor) {
  const c = obterEstado().maosCaneta || {};
  editor.ferramenta = c.ferramenta || 'tinteiro';
  editor.tamanho = Number(c.tamanho) || 4;
  editor.tinta = c.tinta ? `pinta-${c.tinta}` : 'tinta'; // a tinta do tema, se ela não escolheu outra
  editor.dedoDesenha = Boolean(obterEstado().maosDedo);
}

// Toda folha do "Com as mãos" usa o papel do tema (como o de colorir), com o risco, a guia ou as linhas por baixo.
function fundoDaFolha(linha) {
  const [tipoModelo, alvo] = String(linha.modelo || '').split(':');
  if (linha.tipo === 'caligrafia') return { tipo: 'caligrafia', modelo: linha.modelo };
  if (tipoModelo === 'risco') return { tipo: 'risco', modelo: alvo };
  if (tipoModelo === 'meu') return { tipo: 'meu', modelo: alvo };
  if (tipoModelo === 'passo') return linha.dados?.semGuia ? { tipo: 'folha', modelo: 'branco' } : { tipo: 'passo', modelo: alvo, passo: Number(linha.dados?.passo) || 0 };
  return { tipo: 'folha', modelo: linha.tipo === 'escrever' ? (linha.modelo || 'pautada-media') : 'branco' };
}

const modeloDaFolha = () => 'proprio:maos';

function coresDaFolha() {
  const estilo = getComputedStyle(document.documentElement);
  const v = (n) => estilo.getPropertyValue(n).trim();
  const tinta = v('--maos-linha');
  // Linhas e guias são a tinta do desenho, bem clarinhas (a opacidade fica no próprio SVG).
  return { papel: v('--maos-vazio'), linha: tinta, guia: tinta };
}

function carregarFundo(editor, linha) {
  const fundo = fundoDaFolha(linha);
  if (fundo.tipo === 'meu') {
    const m = meuModelo(fundo.modelo);
    if (m) fundoParaCobrir(m, editor.dim).then((img) => { if (img && folha?.editor === editor) editor.definirImagemDeFundo(img); });
    return;
  }
  const svg = svgFundoDaFolha({ ...fundo, largura: editor.dim.largura, altura: editor.dim.altura, cores: coresDaFolha() });
  const img = new Image();
  img.onload = () => { if (folha?.editor === editor) editor.definirImagemDeFundo(img); };
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function miniaturaDa(editor) {
  try {
    const largura = 240;
    const altura = Math.round(largura * (editor.dim.altura / editor.dim.largura));
    const c = document.createElement('canvas');
    c.width = largura; c.height = altura;
    const x = c.getContext('2d');
    x.drawImage(editor.cPapel, 0, 0, largura, altura);
    x.drawImage(editor.cTinta, 0, 0, largura, altura);
    return c.toDataURL('image/jpeg', 0.72);
  } catch { return null; }
}

function guardarFolha({ ja = false } = {}) {
  if (!folha?.sujo) return; // só grava quando há traço novo
  folha.sujo = false;
  const { id, editor } = folha;
  mudarDados(id, (d) => {
    d.pagina = editor.pagina;
    const mini = miniaturaDa(editor);
    if (mini) d.miniatura = mini;
  }, { ja });
}

function montarFolha(id) {
  const lugar = document.querySelector(`[data-maos-folha="${CSS.escape(id)}"]`);
  const linha = linhaDe(id);
  if (!lugar || !linha) { soltarFolha(); return; }
  if (folha?.id === id) {
    // O mesmo trabalho: a folha volta para o lugar, sem perder o que estava na tela.
    lugar.replaceWith(folha.editor.recipiente);
    folha.editor.ajustarTamanho();
    carregarFundo(folha.editor, linha);
    return;
  }
  soltarFolha();
  const editor = new EditorDeTinta(lugar, { aoMudar: () => { if (!folha) return; folha.sujo = true; clearTimeout(folha.tempo); folha.tempo = setTimeout(() => guardarFolha(), 1200); } });
  aplicarCaneta(editor);
  const pagina = linha.dados?.pagina?.camadas ? linha.dados.pagina : novaPaginaVazia(modeloDaFolha(linha));
  pagina.modelo = modeloDaFolha(linha);
  editor.carregar(pagina, dimensoes('A4'));
  folha = { id, editor, tempo: null, sujo: false };
  carregarFundo(editor, linha);
}

function soltarFolha() {
  if (!folha) return;
  clearTimeout(folha.tempo);
  guardarFolha({ ja: true });
  folha.editor.destruir();
  folha = null;
}

async function manterTelaAcesa(querer) {
  try {
    if (querer && !trava && 'wakeLock' in navigator && !document.hidden) trava = await navigator.wakeLock.request('screen');
    if (!querer && trava) { await trava.release(); trava = null; }
  } catch { trava = null; }
}

// Se o aparelho ainda está com o arquivo de cores antigo (sem as tintas), avisa e oferece atualizar.
function conferirTintas() {
  if (getComputedStyle(document.documentElement).getPropertyValue('--pinta-1').trim()) return;
  const topo = document.querySelector('.ct-topo');
  if (!topo || document.querySelector('[data-maos-atualizar]')) return;
  topo.insertAdjacentHTML('afterend', '<div class="ct-faixa" data-maos-atualizar><div><strong>Falta atualizar as cores do app</strong><small>Este aparelho ainda está com a versão anterior das cores.</small></div><button class="botao botao-primario" type="button" data-acao="maos-atualizar">Atualizar</button></div>');
}

let relogioCrono = null;
// ---------------------------------------------------------------------------
// Colorir um modelo seu (balde)
// ---------------------------------------------------------------------------

let pintura = null; // { id, obra }
async function montarBalde(id) {
  const canvas = document.querySelector(`[data-maos-balde="${CSS.escape(id)}"]`);
  const linha = linhaDe(id);
  const m = linha && meuModelo(String(linha.modelo).slice(4));
  if (!canvas || !m) return;
  const obra = await criarPintura(canvas, m, linha.dados?.toques || [], Number(linha.dados?.vedar ?? 1));
  pintura = obra ? { id, obra, canvas } : null;
  canvas.addEventListener('click', (e) => {
    if (!pintura || pintura.canvas !== canvas) return;
    const r = canvas.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * canvas.width);
    const y = Math.round(((e.clientY - r.top) / r.height) * canvas.height);
    const n = Number(obterEstado().maosTinta ?? 6);
    if (!pintura.obra.tocar(x, y, n)) return;
    const dados = mudarDados(id, (d) => { d.toques = [...(d.toques || []), [x, y, n]].slice(-400); });
    const desfazer = document.querySelector('[data-acao="maos-desfazer-toque"]');
    if (desfazer) desfazer.disabled = !dados?.toques?.length;
    clearTimeout(pintura.tempoMini);
    pintura.tempoMini = setTimeout(() => mudarDados(id, (d) => { d.miniatura = miniaturaDoCanvas(canvas); }), 1500);
  });
}

// ---------------------------------------------------------------------------
// Adicionar modelo (imagem, foto ou PDF)
// ---------------------------------------------------------------------------

const importacao = { fonte: null, giro: 0, cinza: null, limpar: 50, mascara: null };

async function desenharPrevia() {
  const canvas = document.querySelector('[data-maos-previa]');
  if (!canvas || !importacao.fonte) return;
  if (!importacao.cinza) importacao.cinza = cinzaDe(importacao.fonte, importacao.giro);
  const auto = limiarAutomatico(importacao.cinza.cinza);
  const limiar = Math.max(10, Math.min(250, Math.round(auto + (50 - importacao.limpar) * 1.6)));
  importacao.mascara = mascaraDe(importacao.cinza, limiar);
  const img = new Image();
  img.src = pngDaMascara(importacao.mascara);
  await img.decode().catch(() => {});
  const estilo = getComputedStyle(document.documentElement);
  canvas.width = img.width; canvas.height = img.height;
  const x = canvas.getContext('2d');
  x.fillStyle = estilo.getPropertyValue('--maos-vazio').trim();
  x.fillRect(0, 0, canvas.width, canvas.height);
  x.drawImage(tracosNaCor(img, estilo.getPropertyValue('--maos-linha').trim()), 0, 0);
  canvas.hidden = false;
  const vazia = document.querySelector('[data-maos-previa-vazia]');
  if (vazia) vazia.hidden = true;
}

async function guardarModelo(nome, mascara) {
  const id = crypto.randomUUID();
  const valor = { nome: nome.slice(0, 60) || 'Meu modelo', imagem: pngDaMascara(mascara), largura: mascara.largura, altura: mascara.altura };
  await salvar('config', { chave: `maos_modelo:${id}`, valor });
  atualizarEstado({ config: await listar('config') });
  return id;
}

async function mudarModelo(id, fn) {
  const atual = (await listar('config', { incluirExcluidos: true })).find((c) => c.chave === `maos_modelo:${id}`);
  if (!atual) return;
  await salvar('config', fn({ ...atual }));
  atualizarEstado({ config: await listar('config') });
}

export function montarMaos(parametro) {
  conferirTintas();
  const { tipo, id } = lerParametroMaos(parametro);
  if (tipo === 'colorir' && id && String(linhaDe(id)?.modelo || '').startsWith('meu:')) montarBalde(id); else pintura = null;
  if (tipo === 'modelo') desenharPrevia(); else Object.assign(importacao, { fonte: null, giro: 0, cinza: null, limpar: 50, mascara: null });
  if (id && ['desenhar', 'escrever', 'caligrafia'].includes(tipo)) montarFolha(id); else soltarFolha();
  manterTelaAcesa(Boolean(id) || tipo === 'colorir');
  clearInterval(relogioCrono);
  const crono = obterEstado().maosCrono;
  if (crono && tipo === 'ideia') {
    const tic = () => { const el = document.querySelector('[data-maos-crono]'); if (el) el.textContent = `${Math.max(0, Math.floor((Date.now() - crono.inicio) / 60000))} min agora`; };
    tic();
    relogioCrono = setInterval(tic, 15000);
  }
}

export function desmontarMaos() {
  clearInterval(relogioCrono);
  if (folha) { clearTimeout(folha.tempo); guardarFolha(); }
}

export function sairDasMaos() {
  soltarFolha();
  manterTelaAcesa(false);
  gravarPendentes();
}

// ---------------------------------------------------------------------------
// Toques
// ---------------------------------------------------------------------------

function contar(id, campo, passo) {
  const dados = mudarDados(id, (d) => {
    const p = { ...projetoDe({ dados: d }), ...d };
    const novo = Math.max(0, (Number(p[campo]) || 0) + passo);
    d[campo] = novo;
    if (campo === 'carreira' && passo > 0 && p.zerarPontos !== false) d.pontos = 0;
  });
  if (!dados) return;
  document.querySelectorAll('[data-maos-valor]').forEach((el) => { el.textContent = String(dados[el.dataset.maosValor] ?? 0); });
  if (passo > 0) navigator.vibrate?.(12);
}

export function cliqueMaos(alvo) {
  const { acao, id, valor } = alvo.dataset;
  if (!acao?.startsWith('maos-')) return false;
  const estado = obterEstado();
  switch (acao) {
    case 'maos-novo': {
      const { tipo, modelo, titulo } = alvo.dataset;
      alvo.disabled = true;
      criar(tipo, modelo, titulo).then((salvo) => { location.hash = rota(tipo, salvo.id); }).catch(() => { alvo.disabled = false; avisar('Não deu para começar agora.'); });
      return true;
    }
    case 'maos-tinta':
      atualizarEstado({ maosTinta: Number(valor) });
      marcarEscolha('[data-acao="maos-tinta"]', valor);
      return true;
    case 'maos-desfazer-cor': {
      let volta = null;
      const dados = mudarDados(id, (d) => {
        const hist = [...(d.historico || [])];
        volta = hist.pop();
        if (!volta) return;
        const cores = { ...(d.cores || {}) };
        if (volta[1]) cores[volta[0]] = volta[1]; else delete cores[volta[0]];
        d.cores = cores;
        d.historico = hist;
      });
      if (volta) {
        const el = document.querySelector(`[data-maos-pintar] path[data-r="${CSS.escape(volta[0])}"]`);
        if (el) el.style.fill = volta[1] ? `var(--pinta-${volta[1]})` : 'var(--maos-vazio)';
      }
      alvo.disabled = !dados?.historico?.length;
      return true;
    }
    case 'maos-ferramenta':
    case 'maos-tamanho':
    case 'maos-cor-caneta': {
      const campo = { 'maos-ferramenta': 'ferramenta', 'maos-tamanho': 'tamanho', 'maos-cor-caneta': 'tinta' }[acao];
      const caneta = { ...(estado.maosCaneta || {}), [campo]: campo === 'ferramenta' ? valor : Number(valor) };
      atualizarEstado({ maosCaneta: caneta });
      gravarLocal('hub.maos.caneta', caneta);
      marcarEscolha(`[data-acao="${acao}"]`, valor);
      if (folha) aplicarCaneta(folha.editor);
      return true;
    }
    case 'maos-voltar-traco':
      folha?.editor.voltar();
      return true;
    case 'maos-avancar-traco':
      folha?.editor.avancar();
      return true;
    case 'maos-passo':
      mudarDados(id, (d) => { d.passo = Math.max(0, (Number(d.passo) || 0) + Number(valor)); }, { ja: true });
      app.renderizar();
      return true;
    case 'maos-contar':
      contar(id, alvo.dataset.campo, Number(valor));
      return true;
    case 'maos-zerar': {
      const campo = alvo.dataset.campo;
      const zerar = () => { mudarDados(id, (d) => { d[campo] = 0; }, { ja: true }); document.querySelectorAll(`[data-maos-valor="${campo}"]`).forEach((el) => { el.textContent = '0'; }); };
      if (campo === 'carreira') confirmar('Zerar as carreiras? O contador volta para 0.', { botao: 'Zerar' }).then((ok) => { if (ok) zerar(); });
      else zerar();
      return true;
    }
    case 'maos-excluir': {
      const linha = linhaDe(id);
      if (!linha) return true;
      confirmar(`Excluir "${linha.titulo || 'este trabalho'}"? Ele sai da sua galeria.`, { botao: 'Excluir', perigo: true }).then(async (ok) => {
        if (!ok) return;
        if (folha?.id === id) { folha.editor.destruir(); folha = null; }
        pendentes.delete(id);
        atuais.delete(id);
        await gravar('maos', 'maos', { ...linha, excluido_em: new Date().toISOString() });
        if (location.hash.includes(id)) location.hash = rota(linha.tipo === 'ideia' ? 'ideia' : linha.tipo);
        else app.renderizar();
      });
      return true;
    }
    case 'maos-desfazer-toque': {
      const dados = mudarDados(id, (d) => { d.toques = (d.toques || []).slice(0, -1); });
      if (pintura?.id === id) { pintura.obra.refazer(dados?.toques || []); mudarDados(id, (d) => { d.miniatura = miniaturaDoCanvas(pintura.canvas); }); }
      alvo.disabled = !dados?.toques?.length;
      return true;
    }
    case 'maos-vedar':
      mudarDados(id, (d) => { d.vedar = Number(valor); }, { ja: true });
      app.renderizar();
      return true;
    case 'maos-importar-girar':
      importacao.giro = (importacao.giro + 1) % 4;
      importacao.cinza = null;
      desenharPrevia();
      return true;
    case 'maos-modelo-renomear': {
      perguntarTexto('Novo nome do modelo', { padrao: meuModelo(id)?.nome || '', maximo: 60 }).then((nome) => {
        if (!nome?.trim()) return;
        mudarModelo(id, (c) => ({ ...c, valor: { ...c.valor, nome: nome.trim().slice(0, 60) } })).then(() => app.renderizar());
      });
      return true;
    }
    case 'maos-modelo-excluir': {
      const m = meuModelo(id);
      confirmar(`Excluir o modelo "${m?.nome || ''}"? Os desenhos já feitos com ele continuam na galeria, mas não dá para pintar de novo.`, { botao: 'Excluir', perigo: true }).then((ok) => {
        if (ok) mudarModelo(id, (c) => ({ ...c, excluido_em: new Date().toISOString() })).then(() => app.renderizar());
      });
      return true;
    }
    case 'maos-virar-modelo': {
      if (!folha?.editor) return true;
      const mascara = mascaraDoDesenho(folha.editor.cTinta);
      if (!mascara) { avisar('Desenhe alguma coisa primeiro.'); return true; }
      perguntarTexto('Nome do modelo', { padrao: linhaDe(id)?.titulo || 'Meu desenho', maximo: 60 }).then(async (nome) => {
        if (nome === null || nome === undefined) return;
        await guardarModelo(String(nome).trim() || 'Meu desenho', mascara);
        avisar('Virou modelo. Está em Colorir e em Desenhar → Meus modelos.');
      });
      return true;
    }
    case 'maos-atualizar':
      navigator.serviceWorker?.getRegistration().then((r) => r?.update()).finally(() => location.reload());
      return true;
    case 'maos-ideia-pronta':
      criar('ideia', null, valor).then(() => app.renderizar());
      return true;
    case 'maos-crono': {
      const crono = { id, inicio: Date.now() };
      atualizarEstado({ maosCrono: crono });
      gravarLocal('hub.maos.crono', crono);
      app.renderizar();
      return true;
    }
    case 'maos-crono-parar': {
      const crono = estado.maosCrono;
      const minutos = crono ? Math.max(1, Math.round((Date.now() - crono.inicio) / 60000)) : 0;
      atualizarEstado({ maosCrono: null });
      gravarLocal('hub.maos.crono', null);
      if (crono) mudarDados(crono.id, (d) => { d.minutos = (Number(d.minutos) || 0) + minutos; }, { ja: true });
      avisar(`${minutos} min só seus. 🧶`);
      app.renderizar();
      return true;
    }
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Campos que mudam na hora
// ---------------------------------------------------------------------------

// Foto pequena (até 640 px, JPEG), para não pesar a sincronização.
function fotoPequena(arquivo) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(arquivo);
    img.onload = () => {
      const escala = Math.min(1, 640 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * escala); c.height = Math.round(img.height * escala);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagem')); };
    img.src = url;
  });
}

export function mudancaMaos(alvo, tipo) {
  const acao = alvo.dataset?.acaoMudar;
  if (!acao?.startsWith('maos-')) return false;
  if (tipo === 'input' && (alvo.type === 'checkbox' || alvo.type === 'file')) return true; // só o "change" conta
  if (tipo === 'change' && alvo.type === 'range') return true; // o "input" já desenhou
  const id = alvo.dataset.id;
  switch (acao) {
    case 'maos-importar-arquivo': {
      const arquivo = alvo.files?.[0];
      if (!arquivo) return true;
      const nome = alvo.form?.elements.nome;
      if (nome && !nome.value) nome.value = arquivo.name.replace(/\.[^.]+$/, '').slice(0, 60);
      lerFonte(arquivo).then((fonte) => { Object.assign(importacao, { fonte, giro: 0, cinza: null }); return desenharPrevia(); })
        .catch(() => avisar('Não deu para ler esse arquivo. Tente uma imagem JPG, PNG ou um PDF.'));
      return true;
    }
    case 'maos-importar-limpar':
      importacao.limpar = Number(alvo.value);
      desenharPrevia();
      return true;
    case 'maos-dedo':
      atualizarEstado({ maosDedo: alvo.checked });
      gravarLocal('hub.maos.dedo', alvo.checked);
      if (folha) folha.editor.dedoDesenha = alvo.checked;
      return true;
    case 'maos-guia': {
      const semGuia = !alvo.checked;
      if (Boolean(linhaDe(id)?.dados?.semGuia) === semGuia) return true;
      mudarDados(id, (d) => { d.semGuia = semGuia; }, { ja: true });
      if (folha?.id === id) { folha.editor.pagina.modelo = modeloDaFolha(linhaDe(id)); carregarFundo(folha.editor, linhaDe(id)); folha.editor.desenharTudo(); }
      return true;
    }
    case 'maos-zerar-pontos':
      mudarDados(id, (d) => { d.zerarPontos = alvo.checked; }, { ja: true });
      return true;
    case 'maos-foto': {
      const arquivo = alvo.files?.[0];
      if (!arquivo || alvo.dataset.lendo) return true;
      alvo.dataset.lendo = '1';
      fotoPequena(arquivo).then((foto) => { mudarDados(id, (d) => { d.foto = foto; }, { ja: true }); app.renderizar(); })
        .catch(() => avisar('Não deu para ler essa foto.'))
        .finally(() => { delete alvo.dataset.lendo; });
      return true;
    }
    default:
      return false;
  }
}

export function enviarMaos(form) {
  const tipo = form.dataset.form;
  if (!tipo?.startsWith('maos-')) return false;
  const c = form.elements;
  const erro = (t) => { const el = form.querySelector('[data-erro]'); if (el) { el.textContent = t; el.hidden = !t; } };
  switch (tipo) {
    case 'maos-modelo': {
      if (!importacao.mascara) { erro('Escolha uma imagem primeiro.'); return true; }
      const pontos = importacao.mascara.m.reduce((t, v) => t + v, 0);
      if (pontos < 50) { erro('Ficou sem traço nenhum. Mexa no "Limpar o fundo" para a esquerda.'); return true; }
      const para = form.dataset.para === 'desenhar' ? 'desenhar' : 'colorir';
      guardarModelo(c.nome.value.trim() || 'Meu modelo', importacao.mascara).then(() => {
        avisar('Modelo guardado.');
        Object.assign(importacao, { fonte: null, cinza: null, mascara: null });
        location.hash = rota(para);
      });
      return true;
    }
    case 'maos-croche-novo': {
      const titulo = c.titulo.value.trim();
      if (!titulo) { erro('Dê um nome ao projeto.'); return true; }
      criar('croche', null, titulo, { carreira: 0, pontos: 0 }).then((salvo) => { location.hash = rota('croche', salvo.id); });
      return true;
    }
    case 'maos-croche': {
      const id = form.dataset.id;
      const receita = c.receita.value.trim();
      if (receita && !/^https?:\/\//i.test(receita)) { erro('O link da receita começa com https://'); return true; }
      erro('');
      mudarDados(id, (d) => {
        d.linha = c.linha.value.trim().slice(0, 80);
        d.agulha = c.agulha.value.trim().slice(0, 20);
        d.receita = receita.slice(0, 500);
        d.metaCarreiras = Math.max(0, Math.min(9999, Number(c.metaCarreiras.value) || 0));
        d.notas = c.notas.value.slice(0, 2000);
      }, { ja: true });
      avisar('Guardado.');
      app.renderizar();
      return true;
    }
    case 'maos-ideia': {
      const titulo = c.titulo.value.trim();
      if (!titulo) { erro('Escreva o que quer fazer.'); return true; }
      criar('ideia', null, titulo.slice(0, 80)).then(() => app.renderizar());
      return true;
    }
    default:
      return false;
  }
}
