// Trabalho → Pautas: busca os cartões da cliente no Trello (só leitura), baixa as artes marcadas,
// legenda da descrição ou com a IA (em segundo plano, olhando as artes), prévia e PPTX/PDF.
// A pauta fica em config "pauta:<cliente>:<AAAA-MM>"; as artes ficam só na memória (vêm do Trello de novo).

import { obterEstado, atualizarEstado } from './estado.js';
import { listar, salvar } from './persistencia.js';
import { chamar, dispararSegundoPlano } from './funcoes.js';
import { enviarArquivo, rest, idDaUsuaria } from './nuvem.js';
import { confirmar } from './confirmar.js';
import { clientePelaChave } from './dados-trabalho.js';
import { MES_VALIDO } from './dados-relatorio.js';
import {
  pautaDaRota, lerParametroPauta, parametroDaPauta, chaveDaPauta, normalizarPauta, pecaDoCartao, legendaDaDescricao,
  montarSlidesDaPauta, nomeDoArquivoDaPauta, ehVideo, PREFIXO_PAUTA,
} from './dados-pauta.js';
import { prepararMedidas, medir, canvasDoSlide, pptxDeSlides, pdfDeSlides, carregarFontes } from './slides-arquivos.js';
import { baixar } from './exportar-caderno.js';

let app;
const avisar = (t) => app?.avisoCurto(t);
const pedir = (corpo) => chamar('trabalho', corpo);

export function ligarPauta(funcoes) {
  app = funcoes;
}

function atual() {
  const estado = obterEstado();
  if (estado.rota !== 'pautas') return null;
  const p = lerParametroPauta(estado.parametro);
  if (!p) return null;
  return pautaDaRota(estado, estado.parametro, clientePelaChave(estado, p.cliente)?.nome || '');
}

// ---------------------------------------------------------------------------
// Guardar
// ---------------------------------------------------------------------------

let tempoSalvar = null;
let pendente = null;
function mudar(fn, { redesenhar = false } = {}) {
  const pauta = atual();
  if (!pauta) return;
  const nova = { ...pauta, pecas: pauta.pecas.map((x) => ({ ...x })) };
  fn(nova);
  atualizarEstado({ pautaAtual: nova });
  pendente = nova;
  clearTimeout(tempoSalvar);
  tempoSalvar = setTimeout(salvarAgora, 600);
  if (redesenhar) app.renderizar(); else agendarPrevia();
}

async function salvarAgora() {
  clearTimeout(tempoSalvar);
  const p = pendente;
  pendente = null;
  if (!p) return;
  const { chave, ...valor } = p;
  const linha = (await listar('config', { incluirExcluidos: true })).find((c) => c.chave === chave);
  await salvar('config', { ...(linha || {}), excluido_em: null, chave, valor });
  atualizarEstado({ config: await listar('config') });
}

// Muda uma peça de uma pauta que pode não estar aberta (a legenda da IA chega depois).
async function mudarPeca(chave, card, fn) {
  const aberta = atual();
  if (aberta?.chave === chave) {
    mudar((p) => { p.pecas = p.pecas.map((x) => (x.card === card ? fn({ ...x }) : x)); }, { redesenhar: true });
    return;
  }
  const linha = (await listar('config', { incluirExcluidos: true })).find((c) => c.chave === chave && !c.excluido_em);
  if (!linha) return;
  const p = lerParametroPauta(chave.slice(PREFIXO_PAUTA.length));
  const v = normalizarPauta(linha.valor, p.cliente, p.mes);
  v.pecas = v.pecas.map((x) => (x.card === card ? fn({ ...x }) : x));
  await salvar('config', { ...linha, valor: v });
  atualizarEstado({ config: await listar('config') });
}

// ---------------------------------------------------------------------------
// Cartões e artes do Trello
// ---------------------------------------------------------------------------

async function buscarCartoes() {
  const pauta = atual();
  if (!pauta) return;
  const chave = pauta.chave;
  atualizarEstado({ pautaCartoes: { ...(obterEstado().pautaCartoes?.chave === chave ? obterEstado().pautaCartoes : { cartoes: [] }), chave, carregando: true, erro: null } });
  app.renderizar();
  const r = await pedir({ acao: 'pauta-cartoes', cliente: pauta.cliente });
  const anterior = obterEstado().pautaCartoes;
  atualizarEstado({ pautaCartoes: { chave, carregando: false, cartoes: r.ok ? r.cartoes : anterior?.cartoes || [], erro: r.ok ? null : r.erro || 'Não deu para ler o Trello agora.' } });
  if (obterEstado().rota === 'pautas') app.renderizar();
  baixarArtesDaPauta();
}

const artes = () => obterEstado().pautaArtes || {};
function mudarArte(chave, campos) {
  atualizarEstado({ pautaArtes: { ...artes(), [chave]: { ...(artes()[chave] || {}), ...campos } } });
}

const fila = [];
let rodando = 0;
const esperando = new Map();
function pedirArte(card, anexo) {
  const chave = `${card}:${anexo}`;
  const a = artes()[chave];
  if (a?.src || a?.erro) return Promise.resolve();
  if (esperando.has(chave)) return esperando.get(chave);
  const promessa = new Promise((resolver) => fila.push({ card, anexo, chave, resolver }));
  esperando.set(chave, promessa);
  mudarArte(chave, { carregando: true });
  andarFila();
  return promessa;
}

function andarFila() {
  while (rodando < 3 && fila.length) {
    const item = fila.shift();
    rodando += 1;
    baixarArte(item).finally(() => {
      rodando -= 1;
      esperando.delete(item.chave);
      item.resolver();
      agendarRedesenho();
      andarFila();
    });
  }
}

let tempoRedesenho = null;
function agendarRedesenho() {
  clearTimeout(tempoRedesenho);
  tempoRedesenho = setTimeout(() => {
    if (obterEstado().rota !== 'pautas' || digitando()) { agendarPrevia(); return; }
    app.renderizar();
  }, 250);
}
const digitando = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '') && document.activeElement.type !== 'checkbox';

async function baixarArte({ card, anexo, chave }) {
  if (!navigator.onLine) { mudarArte(chave, { carregando: false, erro: 'Sem internet para baixar a arte.' }); return; }
  const r = await pedir({ acao: 'pauta-anexo', cartao: card, anexo });
  if (!r.ok) { mudarArte(chave, { carregando: false, erro: r.erro || 'Não deu para baixar a arte.' }); return; }
  try {
    const bin = atob(r.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    let blob = new Blob([bytes], { type: r.tipo });
    if (/^video\//.test(r.tipo) || ehVideo({ nome: r.nome })) blob = await quadroDoVideo(blob);
    const dims = await medidasDe(blob);
    mudarArte(chave, { carregando: false, src: URL.createObjectURL(blob), largura: dims.w, altura: dims.h, erro: null });
  } catch {
    mudarArte(chave, { carregando: false, erro: 'Essa arte não abriu como imagem. Escolha outra.' });
  }
}

function medidasDe(blob) {
  return new Promise((resolver, rejeitar) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { resolver({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { URL.revokeObjectURL(url); rejeitar(new Error('imagem')); };
    img.src = url;
  });
}

// Um quadro do vídeo (perto de 1 s) vira a capa do reel.
function quadroDoVideo(blob) {
  return new Promise((resolver, rejeitar) => {
    const url = URL.createObjectURL(blob);
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    const fim = setTimeout(() => { URL.revokeObjectURL(url); rejeitar(new Error('tempo')); }, 15000);
    v.onloadeddata = () => { v.currentTime = Math.min(1, (v.duration || 2) / 2); };
    v.onseeked = () => {
      const c = document.createElement('canvas');
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext('2d').drawImage(v, 0, 0);
      clearTimeout(fim);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolver(b) : rejeitar(new Error('quadro'))), 'image/jpeg', 0.9);
    };
    v.onerror = () => { clearTimeout(fim); URL.revokeObjectURL(url); rejeitar(new Error('video')); };
    v.src = url;
  });
}

function baixarArtesDaPauta() {
  const pauta = atual();
  if (!pauta) return Promise.resolve();
  const cartoes = obterEstado().pautaCartoes?.chave === pauta.chave ? obterEstado().pautaCartoes.cartoes : [];
  const pedidos = [];
  for (const x of pauta.pecas) {
    for (const l of x.locais || []) if (!artes()[`${x.card}:${l.id}`]?.src) mudarArte(`${x.card}:${l.id}`, { src: l.src, largura: l.largura, altura: l.altura });
    const doCartao = new Set((cartoes.find((c) => c.id === x.card)?.anexos || []).map((a) => a.id));
    for (const id of x.anexos) if (doCartao.has(id)) pedidos.push(pedirArte(x.card, id));
    // Miniaturas dos outros anexos do cartão (para escolher), depois das escolhidas.
  }
  for (const x of pauta.pecas) {
    for (const a of cartoes.find((c) => c.id === x.card)?.anexos || []) if (!x.anexos.includes(a.id) && !ehVideo(a)) pedidos.push(pedirArte(x.card, a.id));
  }
  return Promise.all(pedidos);
}

const artesDe = (peca) => peca.anexos.map((id) => artes()[`${peca.card}:${id}`]).filter((a) => a?.src)
  .map((a) => ({ src: a.src, largura: a.largura, altura: a.altura }));

// ---------------------------------------------------------------------------
// Prévia
// ---------------------------------------------------------------------------

let tempoPrevia = null;
let geracao = 0;
function agendarPrevia() {
  clearTimeout(tempoPrevia);
  tempoPrevia = setTimeout(desenharPrevia, 150);
}

async function desenharPrevia() {
  const caixa = document.querySelector('[data-pauta-previa]');
  const pauta = atual();
  if (!caixa || !pauta) return;
  const minha = ++geracao;
  await prepararMedidas();
  const slides = montarSlidesDaPauta(pauta, artesDe, medir);
  if (minha !== geracao || !caixa.isConnected) return;
  const largura = Math.min(1400, Math.round((caixa.clientWidth || 600) * (window.devicePixelRatio || 1)));
  const existentes = [...caixa.querySelectorAll('canvas')];
  for (let i = 0; i < slides.length; i += 1) {
    let c = existentes[i];
    if (!c) {
      c = document.createElement('canvas');
      c.className = 'rel-slide';
      caixa.append(c);
    }
    c.setAttribute('role', 'img');
    c.setAttribute('aria-label', `Página ${i + 1}`);
    await canvasDoSlide(slides[i], largura, c);
    if (minha !== geracao) return;
  }
  existentes.slice(slides.length).forEach((c) => c.remove());
}

export function montarPauta() {
  const estado = obterEstado();
  if (!lerParametroPauta(estado.parametro)) return;
  carregarFontes();
  const pauta = atual();
  if (pauta && estado.pautaCartoes?.chave !== pauta.chave) buscarCartoes();
  else baixarArtesDaPauta();
  desenharPrevia();
}
export function desmontarPauta() {
  if (pendente) salvarAgora();
}

// ---------------------------------------------------------------------------
// Legenda com a IA (em segundo plano, olhando as artes)
// ---------------------------------------------------------------------------

function mudarLegenda(card, campos) {
  const l = obterEstado().pautaLegendas || {};
  atualizarEstado({ pautaLegendas: { ...l, [card]: { ...(l[card] || {}), ...campos } } });
  if (obterEstado().rota === 'pautas' && !digitando()) app.renderizar();
}

async function jpegDaArte(src) {
  const img = await new Promise((resolver, rejeitar) => {
    const i = new Image();
    i.onload = () => resolver(i);
    i.onerror = rejeitar;
    i.src = src;
  });
  const s = Math.min(1, 1000 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * s);
  c.height = Math.round(img.naturalHeight * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
}

async function escreverLegenda(card) {
  const pauta = atual();
  const x = pauta?.pecas.find((p) => p.card === card);
  if (!x) return;
  const usuaria = idDaUsuaria();
  if (!usuaria) return avisar('Entre no app de novo para continuar.');
  if (!navigator.onLine) return avisar('Sem internet agora. A IA precisa de conexão.');
  const chavePauta = pauta.chave;
  mudarLegenda(card, { status: 'enviando', erro: null });
  await Promise.all(x.anexos.map((id) => (x.locais || []).some((l) => l.id === id) ? null : pedirArte(card, id)));
  const fontes = artesDe(x).slice(0, 6);
  if (!fontes.length && !x.descricao) { mudarLegenda(card, { status: 'erro', erro: 'Sem arte e sem descrição: escolha uma imagem ou escreva a legenda.' }); return; }
  const id = crypto.randomUUID();
  try {
    const caminhos = [];
    for (let i = 0; i < fontes.length; i += 1) {
      const blob = await jpegDaArte(fontes[i].src);
      const caminho = `${usuaria}/importacoes/${id}-${i + 1}.jpg`;
      await enviarArquivo(caminho, blob);
      caminhos.push(caminho);
    }
    await rest('importacoes', {
      metodo: 'POST',
      corpo: { id, user_id: usuaria, tipo: 'pauta', status: 'lendo', arquivo: caminhos.join('\n') || null, texto: JSON.stringify({ cliente: pauta.cliente, nome: pauta.nome, titulo: x.titulo, formato: x.tipo, descricao: x.descricao }) },
      prefer: 'return=minimal',
    });
    const r = await dispararSegundoPlano('pauta-legenda-background', { id });
    if (!r.ok) throw new Error(r.erro);
  } catch (erro) {
    const semMigracao = erro?.codigo === '23514' || /check constraint|importacoes_tipo_check/i.test(erro?.message || '');
    mudarLegenda(card, { status: 'erro', erro: semMigracao ? 'Falta rodar a migração 015-pauta.sql no SQL Editor do Supabase. Depois tente de novo.' : (erro?.message || 'Não deu certo agora.') });
    return;
  }
  mudarLegenda(card, { status: 'lendo', id });
  const limite = Date.now() + 4 * 60 * 1000;
  while (Date.now() < limite) {
    await new Promise((r) => setTimeout(r, 3000));
    let linha;
    try { [linha] = await rest(`importacoes?id=eq.${encodeURIComponent(id)}&select=status,resultado,erro`); } catch { continue; }
    if (!linha) { mudarLegenda(card, { status: 'erro', erro: 'O pedido sumiu. Tente de novo.' }); return; }
    if (linha.status === 'lendo') continue;
    rest(`importacoes?id=eq.${encodeURIComponent(id)}`, { metodo: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
    if (linha.status === 'erro') { mudarLegenda(card, { status: 'erro', erro: linha.erro }); return; }
    const legenda = String(linha.resultado?.legenda || '');
    mudarLegenda(card, { status: 'pronto', erro: null });
    await mudarPeca(chavePauta, card, (p) => ({ ...p, legenda, modo: 'ia' }));
    return;
  }
  mudarLegenda(card, { status: 'erro', erro: 'A IA demorou demais. Tente de novo.' });
}

async function escreverTodas() {
  const pauta = atual();
  if (!pauta) return;
  const faltam = pauta.pecas.filter((x) => !String(x.legenda).trim()).map((x) => x.card);
  if (!faltam.length) return;
  let i = 0;
  const trabalhar = async () => { while (i < faltam.length) { const card = faltam[i++]; await escreverLegenda(card); } };
  await Promise.all([trabalhar(), trabalhar()]);
}

// ---------------------------------------------------------------------------
// Baixar
// ---------------------------------------------------------------------------

async function baixarArquivo(tipo) {
  const pauta = atual();
  if (!pauta) return;
  if (pendente) await salvarAgora();
  atualizarEstado({ pautaOcupado: 'Baixando as artes…' });
  app.renderizar();
  try {
    await baixarArtesDaPauta();
    atualizarEstado({ pautaOcupado: tipo === 'pptx' ? 'Montando o PPTX…' : 'Montando o PDF…' });
    app.renderizar();
    await prepararMedidas();
    const p = atual() || pauta;
    const slides = montarSlidesDaPauta(p, artesDe, medir);
    const semArte = p.pecas.filter((x) => x.anexos.length && !artesDe(x).length).length;
    const arquivo = tipo === 'pptx' ? await pptxDeSlides(slides, { titulo: `Pauta · ${p.nome}` }) : await pdfDeSlides(slides);
    baixar(arquivo, nomeDoArquivoDaPauta(p, tipo));
    avisar(semArte ? `${tipo.toUpperCase()} baixado. ${semArte} ${semArte === 1 ? 'peça ficou' : 'peças ficaram'} sem arte (o Trello não deixou baixar).` : `${tipo.toUpperCase()} baixado.`);
  } catch (erro) {
    avisar(erro?.message || 'Não deu para montar o arquivo agora.');
  } finally {
    atualizarEstado({ pautaOcupado: '' });
    app.renderizar();
  }
}

// ---------------------------------------------------------------------------
// Ligações com o app
// ---------------------------------------------------------------------------

function inserirPorData(pecas, nova) {
  const i = pecas.findIndex((x) => (x.data || '9999') > (nova.data || '9999'));
  return i < 0 ? [...pecas, nova] : [...pecas.slice(0, i), nova, ...pecas.slice(i)];
}

export function cliquePauta(alvo) {
  const { acao, valor, card } = alvo.dataset;
  if (!acao?.startsWith('pauta-')) return false;
  switch (acao) {
    case 'pauta-buscar':
      buscarCartoes();
      return true;
    case 'pauta-filtro':
      atualizarEstado({ pautaFiltro: valor === 'todos' ? 'todos' : 'mes' });
      app.renderizar();
      return true;
    case 'pauta-anexo':
      mudar((p) => {
        p.pecas = p.pecas.map((x) => {
          if (x.card !== card) return x;
          const tem = x.anexos.includes(valor);
          return { ...x, anexos: tem ? x.anexos.filter((a) => a !== valor) : [...x.anexos, valor] };
        });
      }, { redesenhar: true });
      pedirArte(card, valor);
      return true;
    case 'pauta-mover':
      mudar((p) => {
        const i = p.pecas.findIndex((x) => x.card === card);
        const j = i + Number(valor);
        if (i < 0 || j < 0 || j >= p.pecas.length) return;
        const lista = [...p.pecas];
        [lista[i], lista[j]] = [lista[j], lista[i]];
        p.pecas = lista;
      }, { redesenhar: true });
      return true;
    case 'pauta-tirar':
      mudar((p) => { p.pecas = p.pecas.filter((x) => x.card !== card); }, { redesenhar: true });
      return true;
    case 'pauta-modo':
      mudar((p) => {
        p.pecas = p.pecas.map((x) => {
          if (x.card !== card) return x;
          if (valor === 'descricao') return { ...x, modo: 'descricao', legenda: legendaDaDescricao(x.descricao) };
          return { ...x, modo: 'ia', legenda: x.modo === 'descricao' ? '' : x.legenda };
        });
      }, { redesenhar: true });
      return true;
    case 'pauta-ia':
      escreverLegenda(card);
      return true;
    case 'pauta-ia-todas':
      escreverTodas();
      return true;
    case 'pauta-baixar':
      baixarArquivo(valor);
      return true;
    case 'pauta-excluir': {
      const linha = (obterEstado().config || []).find((c) => c.chave === valor);
      confirmar(`Excluir a pauta de ${linha?.valor?.nome || 'esta cliente'}? As escolhas e as legendas deste mês somem (no Trello nada muda).`, { botao: 'Excluir', perigo: true }).then(async (ok) => {
        if (!ok) return;
        const l = (await listar('config', { incluirExcluidos: true })).find((c) => c.chave === valor);
        if (l) await salvar('config', { ...l, excluido_em: new Date().toISOString() });
        atualizarEstado({ config: await listar('config'), pautaAtual: obterEstado().pautaAtual?.chave === valor ? null : obterEstado().pautaAtual });
        app.renderizar();
      });
      return true;
    }
    default:
      return false;
  }
}

export function mudancaPauta(alvo, tipo) {
  const acao = alvo.dataset?.acaoMudar;
  if (!acao?.startsWith('pauta-')) return false;
  if (acao === 'pauta-marcar') {
    if (tipo !== 'change') return true;
    const pauta = atual();
    const c = (obterEstado().pautaCartoes?.cartoes || []).find((x) => x.id === alvo.value);
    if (!pauta || !c) return true;
    if (alvo.checked) {
      if (pauta.pecas.some((x) => x.card === c.id)) return true;
      mudar((p) => { p.pecas = inserirPorData(p.pecas, pecaDoCartao(c, p.nome)); }, { redesenhar: true });
      baixarArtesDaPauta();
    } else mudar((p) => { p.pecas = p.pecas.filter((x) => x.card !== c.id); }, { redesenhar: true });
    return true;
  }
  if (acao === 'pauta-nome') {
    mudar((p) => { p.nome = alvo.value.slice(0, 80); });
    return true;
  }
  if (acao === 'pauta-campo') {
    const { campo, card } = alvo.dataset;
    if (campo === 'tipo' && tipo !== 'change') return true;
    mudar((p) => {
      p.pecas = p.pecas.map((x) => {
        if (x.card !== card) return x;
        const novo = { ...x, [campo]: alvo.value };
        if (campo === 'legenda' && x.modo === 'descricao' && alvo.value !== legendaDaDescricao(x.descricao)) novo.modo = 'manual';
        return novo;
      });
    });
    return true;
  }
  if (acao === 'pauta-arquivo') {
    if (tipo !== 'change') return true;
    const arquivo = alvo.files?.[0];
    const card = alvo.dataset.card;
    alvo.value = '';
    if (!arquivo) return true;
    const url = URL.createObjectURL(arquivo);
    jpegDaArteGrande(url).then(({ src, w, h }) => {
      URL.revokeObjectURL(url);
      const id = `local-${crypto.randomUUID().slice(0, 8)}`;
      mudarArte(`${card}:${id}`, { src, largura: w, altura: h });
      mudar((p) => {
        p.pecas = p.pecas.map((x) => (x.card === card ? { ...x, locais: [...(x.locais || []), { id, src, largura: w, altura: h }], anexos: [...x.anexos, id] } : x));
      }, { redesenhar: true });
    }).catch(() => avisar('Esse arquivo não abriu como imagem.'));
    return true;
  }
  return false;
}

// Imagem do aparelho: JPEG de até 1080 px (fica guardada na pauta).
async function jpegDaArteGrande(src) {
  const img = await new Promise((resolver, rejeitar) => {
    const i = new Image();
    i.onload = () => resolver(i);
    i.onerror = rejeitar;
    i.src = src;
  });
  const s = Math.min(1, 1080 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * s);
  c.height = Math.round(img.naturalHeight * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return { src: c.toDataURL('image/jpeg', 0.85), w: c.width, h: c.height };
}

export function enviarPauta(form) {
  if (form.dataset.form !== 'pauta-nova') return false;
  const dados = new FormData(form);
  const cliente = String(dados.get('cliente') || '');
  const mes = String(dados.get('mes') || '');
  const erro = form.querySelector('[data-erro]');
  const falhar = (t) => { erro.textContent = t; erro.hidden = false; return true; };
  if (!cliente) return falhar('Escolha a cliente.');
  if (!MES_VALIDO.test(mes)) return falhar('Escolha o mês.');
  const estado = obterEstado();
  const chave = chaveDaPauta(cliente, mes);
  if (!(estado.config || []).some((c) => c.chave === chave && !c.excluido_em)) {
    pendente = pautaDaRota(estado, `${cliente}:${mes}`, clientePelaChave(estado, cliente)?.nome || '');
    salvarAgora();
  }
  location.hash = `#pautas/${parametroDaPauta(cliente, mes)}`;
  return true;
}
