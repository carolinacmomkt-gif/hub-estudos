// Trabalho → Relatórios: prints, leitura pela IA (em segundo plano), recorte das capas, considerações,
// prévia (canvas) e os arquivos (PPTX e PDF). O relatório fica em config "relatorio:<cliente>:<AAAA-MM>";
// os prints ficam só na memória deste aparelho enquanto a tela está aberta.

import { obterEstado, atualizarEstado } from './estado.js';
import { listar, salvar } from './persistencia.js';
import { chamar, dispararSegundoPlano } from './funcoes.js';
import { enviarArquivo, rest, idDaUsuaria } from './nuvem.js';
import { confirmar } from './confirmar.js';
import { clientePelaChave } from './dados-trabalho.js';
import {
  METRICAS, PROPORCAO_IMAGEM, relatorioDaRota, lerParametro, parametroDe, chaveDoRelatorio, chaveDoNome, lerNumero,
  comparar, textoComparacao, anteriorDe, formatar, mesCurto, MES_VALIDO, normalizar,
} from './dados-relatorio.js';
import { slidesDoRelatorio, canvasDoSlide, baixarPptx, baixarPdf, carregarFontes } from './slides-arquivos.js';

let app;
const avisar = (t) => app?.avisoCurto(t);
const LEITURA_GUARDADA = 'hub.relatorio.leitura';
const MAX_PRINTS = 12;
const LADO_PRINT = 1600; // px no lado maior (legível para a IA e leve para mandar)
const CAPA_L = 600;
const CAPA_A = Math.round(CAPA_L / PROPORCAO_IMAGEM);

export function ligarRelatorio(funcoes) {
  app = funcoes;
}

// ---------------------------------------------------------------------------
// Rascunho em edição
// ---------------------------------------------------------------------------

function atual() {
  const estado = obterEstado();
  if (estado.rota !== 'relatorio') return null;
  const p = lerParametro(estado.parametro);
  if (!p) return null;
  return relatorioDaRota(estado, estado.parametro, clientePelaChave(estado, p.cliente)?.nome || '');
}

let tempoSalvar = null;
let pendente = null;
function mudar(fn, { redesenhar = false } = {}) {
  const rel = atual();
  if (!rel) return;
  const novo = { ...rel };
  fn(novo);
  atualizarEstado({ relAtual: novo });
  pendente = novo;
  clearTimeout(tempoSalvar);
  tempoSalvar = setTimeout(salvarAgora, 600);
  if (redesenhar) app.renderizar(); else agendarPrevia();
}

async function salvarAgora() {
  clearTimeout(tempoSalvar);
  const rel = pendente;
  pendente = null;
  if (!rel) return;
  const { chave, ...valor } = rel;
  const linha = (await listar('config', { incluirExcluidos: true })).find((c) => c.chave === chave);
  await salvar('config', { ...(linha || {}), excluido_em: null, chave, valor });
  atualizarEstado({ config: await listar('config') });
}

// ---------------------------------------------------------------------------
// Prévia
// ---------------------------------------------------------------------------

let tempoPrevia = null;
let geracao = 0;
function agendarPrevia() {
  clearTimeout(tempoPrevia);
  tempoPrevia = setTimeout(desenharPrevia, 120);
}

async function desenharPrevia() {
  const caixa = document.querySelector('[data-rel-previa]');
  const rel = atual();
  if (!caixa || !rel) return;
  const minha = ++geracao;
  const slides = await slidesDoRelatorio(rel);
  if (minha !== geracao || !caixa.isConnected) return;
  const largura = Math.min(1600, Math.round((caixa.clientWidth || 600) * (window.devicePixelRatio || 1)));
  const existentes = [...caixa.querySelectorAll('canvas')];
  for (let i = 0; i < slides.length; i += 1) {
    let c = existentes[i];
    if (!c) {
      c = document.createElement('canvas');
      c.className = 'rel-slide';
      caixa.append(c);
    }
    c.setAttribute('role', 'img');
    c.setAttribute('aria-label', `Slide ${i + 1}`);
    await canvasDoSlide(slides[i], largura, c);
    if (minha !== geracao) return;
  }
  existentes.slice(slides.length).forEach((c) => c.remove());
}

export function montarRelatorio() {
  const estado = obterEstado();
  if (!lerParametro(estado.parametro)) return;
  carregarFontes();
  retomarLeitura();
  desenharPrevia();
}
export function desmontarRelatorio() {
  if (pendente) salvarAgora();
}

// ---------------------------------------------------------------------------
// Imagens
// ---------------------------------------------------------------------------

function abrirImagem(arquivo) {
  return new Promise((resolver, rejeitar) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => resolver({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); rejeitar(new Error('imagem')); };
    img.src = url;
  });
}

const blobDe = (canvas, tipo = 'image/jpeg', q = 0.86) => new Promise((r) => canvas.toBlob(r, tipo, q));

async function reduzirPrint(arquivo) {
  const { img, url } = await abrirImagem(arquivo);
  URL.revokeObjectURL(url);
  const s = Math.min(1, LADO_PRINT / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * s);
  c.height = Math.round(img.naturalHeight * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const blob = await blobDe(c, 'image/jpeg', 0.88);
  return { id: crypto.randomUUID(), blob, url: URL.createObjectURL(blob), largura: c.width, altura: c.height };
}

// Recorte (em px da imagem) → capa JPEG na proporção do slide.
function capaDoRecorte(img, r) {
  const c = document.createElement('canvas');
  c.width = CAPA_L;
  c.height = CAPA_A;
  c.getContext('2d').drawImage(img, r.x, r.y, r.w, r.h, 0, 0, CAPA_L, CAPA_A);
  return c.toDataURL('image/jpeg', 0.86);
}

// Maior recorte na proporção da capa, centrado (para uma imagem escolhida da galeria).
function recorteCentral(w, h) {
  const rw = Math.min(w, h * PROPORCAO_IMAGEM);
  const rh = rw / PROPORCAO_IMAGEM;
  return { x: (w - rw) / 2, y: (h - rh) / 2, w: rw, h: rh };
}

// A caixa da IA vira um recorte na proporção da capa, centrado nela e dentro da imagem.
function recorteDaCaixa(d, w, h) {
  const cx = (d.x + d.w / 2) * w;
  const cy = (d.y + d.h / 2) * h;
  let rw = Math.max(d.w * w, d.h * h * PROPORCAO_IMAGEM);
  rw = Math.min(rw, w, h * PROPORCAO_IMAGEM);
  if (rw < 40) return null;
  const rh = rw / PROPORCAO_IMAGEM;
  return { x: Math.min(Math.max(0, cx - rw / 2), w - rw), y: Math.min(Math.max(0, cy - rh / 2), h - rh), w: rw, h: rh };
}

const printsDe = (rel) => {
  const p = obterEstado().relPrints;
  return p?.chave === rel.chave ? p.lista : [];
};

async function acrescentarPrints(arquivos) {
  const rel = atual();
  if (!rel) return;
  const lista = [...printsDe(rel)];
  let falhou = 0;
  for (const a of arquivos) {
    if (lista.length >= MAX_PRINTS) { avisar(`Até ${MAX_PRINTS} prints por relatório.`); break; }
    try { lista.push(await reduzirPrint(a)); } catch { falhou += 1; }
  }
  if (falhou) avisar(falhou === 1 ? 'Um arquivo não abriu como imagem.' : `${falhou} arquivos não abriram como imagem.`);
  atualizarEstado({ relPrints: { chave: rel.chave, lista } });
  app.renderizar();
}

// ---------------------------------------------------------------------------
// Leitura dos prints pela IA (função em segundo plano + linha em importacoes)
// ---------------------------------------------------------------------------

let acompanhando = null;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const guardarLeitura = (v) => { try { if (v) localStorage.setItem(LEITURA_GUARDADA, JSON.stringify(v)); else localStorage.removeItem(LEITURA_GUARDADA); } catch { /* sem armazenamento */ } };

function mudarLeitura(chave, campos) {
  atualizarEstado({ relLeitura: { ...(obterEstado().relLeitura?.chave === chave ? obterEstado().relLeitura : {}), chave, ...campos } });
  if (obterEstado().rota === 'relatorio') app.renderizar();
}

async function lerPrints() {
  const rel = atual();
  if (!rel) return;
  const prints = printsDe(rel);
  if (!prints.length) return avisar('Escolha os prints primeiro.');
  const usuaria = idDaUsuaria();
  if (!usuaria) return avisar('Entre no app de novo para continuar.');
  if (!navigator.onLine) return avisar('Sem internet agora. Ler os prints precisa de conexão.');
  const id = crypto.randomUUID();
  const fotografia = prints.slice(); // a ordem que a IA vê (o índice dos destaques aponta para cá)
  mudarLeitura(rel.chave, { id, status: 'enviando', erro: null, texto: null, prints: fotografia });
  try {
    const caminhos = [];
    for (let i = 0; i < fotografia.length; i += 1) {
      const caminho = `${usuaria}/importacoes/${id}-${i + 1}.jpg`;
      await enviarArquivo(caminho, fotografia[i].blob);
      caminhos.push(caminho);
    }
    await rest('importacoes', {
      metodo: 'POST',
      corpo: { id, user_id: usuaria, tipo: 'relatorio', status: 'lendo', arquivo: caminhos.join('\n'), texto: JSON.stringify({ nome: rel.nome, mes: mesCurto(rel.mes) }) },
      prefer: 'return=minimal',
    });
    const r = await dispararSegundoPlano('relatorio-ler-background', { id });
    if (!r.ok) throw new Error(r.erro);
  } catch (erro) {
    const semMigracao = erro?.codigo === '23514' || /check constraint|importacoes_tipo_check/i.test(erro?.message || '');
    const semTabela = erro?.codigo === 'PGRST205' || (erro?.status === 404 && /importacoes|schema cache/i.test(erro?.message || ''));
    mudarLeitura(rel.chave, { status: 'erro', erro: semMigracao || semTabela ? 'Falta rodar a migração 014-relatorio.sql no SQL Editor do Supabase. Depois tente de novo.' : (erro?.message || 'Não deu certo agora.') });
    return null;
  }
  guardarLeitura({ id, chave: rel.chave });
  mudarLeitura(rel.chave, { status: 'lendo' });
  acompanhar(id, rel.chave);
  return null;
}

async function acompanhar(id, chave) {
  if (acompanhando === id) return;
  acompanhando = id;
  const limite = Date.now() + 5 * 60 * 1000;
  try {
    while (acompanhando === id && Date.now() < limite) {
      await espera(3000);
      let linha;
      try {
        [linha] = await rest(`importacoes?id=eq.${encodeURIComponent(id)}&select=status,resultado,erro`);
      } catch { continue; }
      if (!linha) { mudarLeitura(chave, { status: 'erro', erro: 'A leitura sumiu. Tente de novo.' }); break; }
      if (linha.status === 'lendo') continue;
      guardarLeitura(null);
      rest(`importacoes?id=eq.${encodeURIComponent(id)}`, { metodo: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
      if (linha.status === 'erro') { mudarLeitura(chave, { status: 'erro', erro: linha.erro }); break; }
      await aplicarLeitura(chave, linha.resultado || {});
      break;
    }
    if (acompanhando === id && Date.now() >= limite) mudarLeitura(chave, { status: 'erro', erro: 'A leitura demorou demais. Tente de novo com menos prints.' });
  } finally {
    if (acompanhando === id) acompanhando = null;
  }
}

function retomarLeitura() {
  let g = null;
  try { g = JSON.parse(localStorage.getItem(LEITURA_GUARDADA) || 'null'); } catch { /* nada */ }
  const rel = atual();
  if (!g?.id || !rel || g.chave !== rel.chave || acompanhando === g.id) return;
  if (obterEstado().relLeitura?.id !== g.id) atualizarEstado({ relLeitura: { chave: g.chave, id: g.id, status: 'lendo' } });
  acompanhar(g.id, g.chave);
}

async function aplicarLeitura(chave, r) {
  const estado = obterEstado();
  const leitura = estado.relLeitura?.chave === chave ? estado.relLeitura : {};
  const prints = leitura.prints || (estado.relPrints?.chave === chave ? estado.relPrints.lista : []);
  const achados = METRICAS.filter((m) => Number.isFinite(r.numeros?.[m.id]));
  // Capas sugeridas pela IA (só nos espaços vazios).
  const capas = [];
  for (const d of (r.destaques || []).slice(0, 3)) {
    const pr = prints[d.print];
    if (!pr) { capas.push(null); continue; }
    try {
      const { img, url } = await abrirImagem(pr.blob);
      URL.revokeObjectURL(url);
      const rec = recorteDaCaixa(d, img.naturalWidth, img.naturalHeight);
      capas.push(rec ? capaDoRecorte(img, rec) : null);
    } catch { capas.push(null); }
  }
  const aplicar = (rel) => {
    for (const m of METRICAS) {
      if (Number.isFinite(r.numeros?.[m.id])) rel.numeros = { ...rel.numeros, [m.id]: r.numeros[m.id] };
      rel.variacao = { ...rel.variacao, [m.id]: Number.isFinite(r.variacao?.[m.id]) ? r.variacao[m.id] : null };
    }
    rel.destaques = (r.destaques || []).map((d) => ({ tema: d.tema || '', print: d.print, x: d.x, y: d.y, w: d.w, h: d.h }));
    const vazias = [0, 1, 2].filter((i) => !rel.imagens[i]);
    const imagens = [...rel.imagens];
    capas.filter(Boolean).forEach((src) => { const i = vazias.shift(); if (i !== undefined) imagens[i] = src; });
    rel.imagens = imagens;
  };
  const texto = achados.length
    ? `A IA achou ${achados.length} de ${METRICAS.length} números${r.periodo ? ` (${r.periodo})` : ''}. Confira com os prints antes de baixar.${r.avisos ? ` ${r.avisos}` : ''}`
    : `A IA não achou os números nesses prints.${r.avisos ? ` ${r.avisos}` : ''} Confira se são das estatísticas do perfil ou digite abaixo.`;
  const rel = atual();
  if (rel?.chave === chave) {
    mudar(aplicar);
  } else {
    // Ela saiu da tela: grava direto no relatório salvo.
    const linha = (await listar('config', { incluirExcluidos: true })).find((c) => c.chave === chave);
    if (linha) {
      const [cliente, mes] = chave.slice('relatorio:'.length).split(/:(?=\d{4}-\d{2}$)/);
      const v = normalizar(linha.valor, cliente, mes);
      aplicar(v);
      await salvar('config', { ...linha, valor: v });
      atualizarEstado({ config: await listar('config') });
    }
  }
  mudarLeitura(chave, { status: 'pronto', texto });
}

// ---------------------------------------------------------------------------
// Recorte de um print (folha com o print e um retângulo na proporção da capa)
// ---------------------------------------------------------------------------

function abrirRecorte(indice) {
  const rel = atual();
  const prints = rel ? printsDe(rel) : [];
  if (!prints.length) return;
  const folha = document.getElementById('folha-evento');
  document.getElementById('folha-evento-titulo').textContent = `Capa ${indice + 1}: recortar do print`;
  const sugestao = rel.destaques?.[indice];
  let atualPrint = sugestao && prints[sugestao.print] ? sugestao.print : 0;
  const conteudo = document.getElementById('folha-evento-conteudo');
  conteudo.innerHTML = `
    ${prints.length > 1 ? `<div class="rel-recorte-prints" role="group" aria-label="Escolha o print">${prints.map((p, i) => `<button type="button" class="rel-recorte-mini${i === atualPrint ? ' ativo' : ''}" data-print="${i}" aria-label="Print ${i + 1}"><img src="${p.url}" alt=""></button>`).join('')}</div>` : ''}
    <p class="campo-ajuda">Arraste o quadro até a capa do post. Puxe o canto para aumentar ou diminuir.</p>
    <div class="rel-recorte-palco"><div class="rel-recorte-caixa"><img alt="Print" draggable="false"><div class="rel-recorte-quadro" tabindex="0" aria-label="Área do recorte"><span class="rel-recorte-canto" aria-hidden="true"></span></div></div></div>
    <div class="acoes"><button class="botao botao-primario" type="button" data-rel-usar>Usar este recorte</button><button class="botao botao-secundario" type="button" data-rel-cancelar>Cancelar</button></div>`;
  const img = conteudo.querySelector('.rel-recorte-caixa img');
  const quadro = conteudo.querySelector('.rel-recorte-quadro');
  let r = null; // em frações da imagem mostrada

  const mostrar = () => {
    const W = img.clientWidth;
    const H = img.clientHeight;
    Object.assign(quadro.style, { left: `${r.x * W}px`, top: `${r.y * H}px`, width: `${r.w * W}px`, height: `${r.h * H}px` });
  };
  const limitar = () => {
    const W = img.clientWidth || 1;
    const H = img.clientHeight || 1;
    const aspecto = PROPORCAO_IMAGEM * (H / W); // largura/altura em frações
    r.w = Math.min(Math.max(r.w, 0.08), 1, aspecto);
    r.h = r.w / aspecto;
    r.x = Math.min(Math.max(0, r.x), 1 - r.w);
    r.y = Math.min(Math.max(0, r.y), 1 - r.h);
  };
  const carregar = (i) => {
    atualPrint = i;
    conteudo.querySelectorAll('.rel-recorte-mini').forEach((b) => b.classList.toggle('ativo', Number(b.dataset.print) === i));
    img.onload = () => {
      const W = img.clientWidth || 1;
      const H = img.clientHeight || 1;
      const s = rel.destaques?.[indice];
      if (s && s.print === i && s.w > 0) {
        const rec = recorteDaCaixa(s, W, H);
        if (rec) r = { x: rec.x / W, y: rec.y / H, w: rec.w / W, h: rec.h / H };
      }
      if (!r) { const c = recorteCentral(W * 0.6, H * 0.6); r = { x: 0.2 + c.x / W, y: 0.2 + c.y / H, w: c.w / W, h: c.h / H }; }
      limitar();
      mostrar();
    };
    r = null;
    img.src = prints[i].url;
  };

  let arrasto = null;
  quadro.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    quadro.setPointerCapture(e.pointerId);
    arrasto = { tipo: e.target.classList.contains('rel-recorte-canto') ? 'canto' : 'mover', x: e.clientX, y: e.clientY, r: { ...r } };
  });
  quadro.addEventListener('pointermove', (e) => {
    if (!arrasto) return;
    const dx = (e.clientX - arrasto.x) / img.clientWidth;
    const dy = (e.clientY - arrasto.y) / img.clientHeight;
    if (arrasto.tipo === 'mover') r = { ...arrasto.r, x: arrasto.r.x + dx, y: arrasto.r.y + dy };
    else {
      // O canto acompanha o lado que mais andou (a proporção da capa fica fixa).
      const aspecto = PROPORCAO_IMAGEM * (img.clientHeight / img.clientWidth);
      const dw = Math.abs(dx) > Math.abs(dy * aspecto) ? dx : dy * aspecto;
      r = { ...arrasto.r, w: arrasto.r.w + dw };
    }
    limitar();
    mostrar();
  });
  const soltar = () => { arrasto = null; };
  quadro.addEventListener('pointerup', soltar);
  quadro.addEventListener('pointercancel', soltar);
  quadro.addEventListener('keydown', (e) => {
    const passo = e.shiftKey ? 0.05 : 0.01;
    const mapa = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] };
    if (mapa[e.key]) { e.preventDefault(); r.x += mapa[e.key][0]; r.y += mapa[e.key][1]; limitar(); mostrar(); }
    if (e.key === '+' || e.key === '-') { e.preventDefault(); r.w *= e.key === '+' ? 1.05 : 0.95; limitar(); mostrar(); }
  });
  conteudo.querySelectorAll('.rel-recorte-mini').forEach((b) => b.addEventListener('click', () => carregar(Number(b.dataset.print))));
  conteudo.querySelector('[data-rel-cancelar]').addEventListener('click', () => folha.close());
  conteudo.querySelector('[data-rel-usar]').addEventListener('click', async () => {
    const { img: original, url } = await abrirImagem(prints[atualPrint].blob);
    URL.revokeObjectURL(url);
    const W = original.naturalWidth;
    const H = original.naturalHeight;
    const src = capaDoRecorte(original, { x: r.x * W, y: r.y * H, w: r.w * W, h: r.h * H });
    folha.close();
    mudar((rel2) => { const im = [...rel2.imagens]; im[indice] = src; rel2.imagens = im; }, { redesenhar: true });
  });
  folha.showModal();
  carregar(atualPrint);
}

// ---------------------------------------------------------------------------
// Considerações com a IA
// ---------------------------------------------------------------------------

async function escrever() {
  const rel = atual();
  if (!rel) return;
  const topicos = rel.consideracoes.map((c) => String(c.titulo).trim()).filter(Boolean);
  if (!topicos.length) return avisar('Dê nome a pelo menos um tópico.');
  const anterior = anteriorDe(obterEstado(), rel);
  const metricas = METRICAS.filter((m) => Number.isFinite(rel.numeros[m.id])).map((m) => ({
    rotulo: m.rotulo,
    valor: m.id === 'seguidores' && rel.numeros[m.id] > 0 ? `+${formatar(rel.numeros[m.id])}` : formatar(rel.numeros[m.id]),
    comparacao: textoComparacao(comparar(rel, anterior, m.id)),
  }));
  if (!metricas.length) return avisar('Preencha os números primeiro (ou leia os prints).');
  const temOTexto = rel.consideracoes.some((c) => String(c.texto).trim());
  if (temOTexto && !(await confirmar('Trocar o texto das considerações? A IA reescreve todos os tópicos.', { botao: 'Trocar' }))) return;
  atualizarEstado({ relEscrevendo: true, relEscritaStatus: 'A IA está escrevendo…' });
  app.renderizar();
  const r = await chamar('trabalho', {
    acao: 'relatorio-consideracoes',
    nome: rel.nome,
    mes: mesCurto(rel.mes),
    metricas,
    temas: (rel.destaques || []).map((d) => d.tema).filter(Boolean),
    topicos,
    observacoes: rel.observacoes || '',
  });
  atualizarEstado({ relEscrevendo: false, relEscritaStatus: r.ok ? 'Pronto. Leia e ajuste o que quiser.' : (r.erro || 'Não deu para escrever agora.') });
  if (r.ok && Array.isArray(r.consideracoes)) {
    mudar((novo) => {
      novo.consideracoes = topicos.map((titulo, i) => ({ titulo, texto: r.consideracoes[i]?.texto || '' }));
    }, { redesenhar: true });
  } else app.renderizar();
  return null;
}

// ---------------------------------------------------------------------------
// Baixar
// ---------------------------------------------------------------------------

async function baixarArquivo(tipo) {
  const rel = atual();
  if (!rel) return;
  if (pendente) await salvarAgora();
  atualizarEstado({ relOcupado: tipo === 'pptx' ? 'Montando o PPTX…' : 'Montando o PDF…' });
  app.renderizar();
  try {
    if (tipo === 'pptx') await baixarPptx(rel); else await baixarPdf(rel);
    avisar(tipo === 'pptx' ? 'PPTX baixado.' : 'PDF baixado.');
  } catch (erro) {
    avisar(erro?.message || 'Não deu para montar o arquivo agora.');
  } finally {
    atualizarEstado({ relOcupado: '' });
    app.renderizar();
  }
}

// ---------------------------------------------------------------------------
// Ligações com o app
// ---------------------------------------------------------------------------

export function cliqueRelatorio(alvo) {
  const { acao, valor } = alvo.dataset;
  if (!acao?.startsWith('rel-')) return false;
  switch (acao) {
    case 'rel-ler':
      lerPrints();
      return true;
    case 'rel-print-tirar': {
      const rel = atual();
      if (!rel) return true;
      const lista = printsDe(rel).filter((p) => {
        if (p.id !== valor) return true;
        URL.revokeObjectURL(p.url);
        return false;
      });
      atualizarEstado({ relPrints: { chave: rel.chave, lista } });
      app.renderizar();
      return true;
    }
    case 'rel-recortar':
      abrirRecorte(Number(valor));
      return true;
    case 'rel-capa-tirar':
      mudar((rel) => { const im = [...rel.imagens]; im[Number(valor)] = null; rel.imagens = im; }, { redesenhar: true });
      return true;
    case 'rel-topico-novo':
      mudar((rel) => { rel.consideracoes = [...rel.consideracoes, { titulo: '', texto: '' }]; }, { redesenhar: true });
      setTimeout(() => [...document.querySelectorAll('.rel-topico-titulo')].pop()?.focus(), 50);
      return true;
    case 'rel-topico-tirar': {
      const i = Number(valor);
      const rel = atual();
      const c = rel?.consideracoes[i];
      const tirar = () => mudar((r) => { r.consideracoes = r.consideracoes.filter((_, j) => j !== i); }, { redesenhar: true });
      if (c && String(c.texto).trim()) confirmar(`Tirar o tópico "${c.titulo || 'sem nome'}"? O texto dele sai do relatório.`, { botao: 'Tirar', perigo: true }).then((ok) => ok && tirar());
      else tirar();
      return true;
    }
    case 'rel-escrever':
      escrever();
      return true;
    case 'rel-baixar':
      baixarArquivo(valor);
      return true;
    case 'rel-excluir': {
      const chave = valor;
      const linha = (obterEstado().config || []).find((c) => c.chave === chave);
      confirmar(`Excluir o relatório de ${linha?.valor?.nome || 'esta cliente'}? Os números e o texto somem deste mês.`, { botao: 'Excluir', perigo: true }).then(async (ok) => {
        if (!ok) return;
        const atualLinha = (await listar('config', { incluirExcluidos: true })).find((c) => c.chave === chave);
        if (atualLinha) await salvar('config', { ...atualLinha, excluido_em: new Date().toISOString() });
        atualizarEstado({ config: await listar('config'), relAtual: obterEstado().relAtual?.chave === chave ? null : obterEstado().relAtual });
        app.renderizar();
      });
      return true;
    }
    default:
      return false;
  }
}

export function mudancaRelatorio(alvo, tipo) {
  const acao = alvo.dataset?.acaoMudar;
  if (!acao?.startsWith('rel-')) return false;
  if (acao === 'rel-novo-cliente') {
    const outro = document.querySelector('[data-rel-outro]');
    if (outro) outro.hidden = alvo.value !== '';
    return true;
  }
  if (acao === 'rel-prints') {
    if (tipo !== 'change') return true;
    const arquivos = [...(alvo.files || [])];
    alvo.value = '';
    if (arquivos.length) acrescentarPrints(arquivos);
    return true;
  }
  if (acao === 'rel-capa') {
    if (tipo !== 'change') return true;
    const arquivo = alvo.files?.[0];
    const i = Number(alvo.dataset.indice);
    alvo.value = '';
    if (!arquivo) return true;
    abrirImagem(arquivo).then(({ img, url }) => {
      URL.revokeObjectURL(url);
      const src = capaDoRecorte(img, recorteCentral(img.naturalWidth, img.naturalHeight));
      mudar((rel) => { const im = [...rel.imagens]; im[i] = src; rel.imagens = im; }, { redesenhar: true });
    }).catch(() => avisar('Esse arquivo não abriu como imagem.'));
    return true;
  }
  if (acao === 'rel-campo') {
    const campo = alvo.dataset.campo;
    if (campo === 'nome' || campo === 'observacoes') mudar((rel) => { rel[campo] = alvo.value.slice(0, campo === 'nome' ? 80 : 1200); });
    return true;
  }
  if (acao === 'rel-numero') {
    const id = alvo.dataset.campo;
    const v = lerNumero(alvo.value);
    mudar((rel) => { rel.numeros = { ...rel.numeros, [id]: v }; });
    if (tipo === 'change') alvo.value = formatar(v);
    const rel = atual();
    const comp = document.querySelector(`[data-rel-comp="${id}"]`);
    if (rel && comp) comp.textContent = textoComparacao(comparar(rel, anteriorDe(obterEstado(), rel), id));
    return true;
  }
  if (acao === 'rel-slide') {
    if (tipo !== 'change') return true;
    mudar((rel) => { rel.slides = { ...rel.slides, [alvo.value]: alvo.checked }; });
    return true;
  }
  if (acao === 'rel-topico') {
    const i = Number(alvo.dataset.indice);
    const campo = alvo.dataset.campo;
    mudar((rel) => { rel.consideracoes = rel.consideracoes.map((c, j) => (j === i ? { ...c, [campo]: alvo.value } : c)); });
    return true;
  }
  return false;
}

export function enviarRelatorio(form) {
  if (form.dataset.form !== 'rel-novo') return false;
  const dados = new FormData(form);
  const chaveCliente = String(dados.get('cliente') || '');
  const nomeDigitado = String(dados.get('nome') || '').trim();
  const mes = String(dados.get('mes') || '');
  const erro = form.querySelector('[data-erro]');
  const falhar = (t) => { erro.textContent = t; erro.hidden = false; };
  if (!MES_VALIDO.test(mes)) return falhar('Escolha o mês.'), true;
  const estado = obterEstado();
  const cli = chaveCliente ? clientePelaChave(estado, chaveCliente) : null;
  const nome = cli?.nome || nomeDigitado;
  const cliente = chaveCliente || chaveDoNome(nomeDigitado);
  if (!cliente) return falhar('Escolha a cliente ou digite o nome.'), true;
  const chave = chaveDoRelatorio(cliente, mes);
  if (!(estado.config || []).some((c) => c.chave === chave && !c.excluido_em)) {
    const rel = relatorioDaRota(estado, `${cliente}:${mes}`, nome);
    pendente = { ...rel, nome: rel.nome || nome };
    salvarAgora();
  }
  location.hash = `#relatorio/${parametroDe(cliente, mes)}`;
  return true;
}
