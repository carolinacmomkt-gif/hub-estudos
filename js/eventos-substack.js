// Cliques, campos e arrastar do Substack (painel e editor do texto).

import { obterEstado, atualizarEstado } from './estado.js';
import { listar, salvar } from './persistencia.js';
import { gravar, criarGravador } from './gravacao.js';
import { renderFormPauta } from './views-substack.js';
import { lerTags, artigoPeloId } from './dados-biblioteca.js';
import { confirmar, perguntarTexto } from './confirmar.js';
import {
  pautaPeloId, etapaVizinhaSubstack, eventoDaPauta, estatisticasDoTexto, markdownDaPauta, htmlDaPauta, textoPuroDaPauta,
  ETAPAS_SUBSTACK, nomeEtapaSubstack,
} from './dados-substack.js';

let app; // { renderizar, avisoCurto }
let arraste = null;
let tempoMeta = null;

// A data agendada vira (ou deixa de ser) evento do Calendário. Em fila: duas gravações
// seguidas não podem criar o mesmo evento duas vezes.
let filaEventos = Promise.resolve();
function sincronizarEvento(pauta) {
  filaEventos = filaEventos.then(() => atualizarEvento(pauta)).catch((erro) => console.warn('Evento do Substack:', erro));
  return filaEventos;
}

async function atualizarEvento(pauta) {
  const origemId = `${pauta.id}:publicar`;
  const atual = (await listar('eventos', { incluirExcluidos: true })).find((e) => e.origem === 'substack' && e.origem_id === origemId);
  const desejado = pauta.excluido_em ? null : eventoDaPauta(pauta);
  if (desejado) {
    if (atual && !atual.excluido_em && atual.titulo === desejado.titulo && Date.parse(atual.inicio) === Date.parse(desejado.inicio)) return;
    await salvar('eventos', { ...(atual || {}), ...desejado, tipo: 'substack', origem: 'substack', status: null, disciplina_id: null, link: null, excluido_em: null });
  } else if (atual && !atual.excluido_em) {
    await salvar('eventos', { ...atual, excluido_em: new Date().toISOString() });
  }
}

const gravador = criarGravador('pautas_substack', 'pautas', {
  depois: async (p) => {
    await sincronizarEvento(p);
    const salvo = document.getElementById('ss-salvo');
    if (salvo) salvo.textContent = 'Salvo';
  },
});

export function ligarSubstack(funcoes) {
  app = funcoes;
  document.addEventListener('pointerdown', aoApertar);
  document.addEventListener('pointermove', aoMover, { passive: false });
  document.addEventListener('pointerup', aoSoltar);
  document.addEventListener('pointercancel', () => terminarArraste());
}

function base() {
  return pautaPeloId(obterEstado(), obterEstado().parametro);
}

function aberta() {
  const b = base();
  return b ? gravador.vigente(b) : null;
}

async function mudarPauta(id, campos, { redesenhar = true } = {}) {
  const b = pautaPeloId(obterEstado(), id);
  if (!b) return null;
  const v = gravador.vigente(b);
  if (campos.etapa === 'publicado' && v.etapa !== 'publicado') campos.publicado_em = v.publicado_em || new Date().toISOString();
  if (campos.etapa && campos.etapa !== 'publicado') campos.publicado_em = null;
  const salvo = await gravador.ja(b, campos);
  if (redesenhar) app.renderizar();
  return salvo;
}

function abrirNova() {
  document.getElementById('folha-criar')?.close();
  document.getElementById('folha-evento-titulo').textContent = 'Nova pauta';
  document.getElementById('folha-evento-conteudo').innerHTML = renderFormPauta();
  document.getElementById('folha-evento').showModal();
  document.querySelector('#folha-evento-conteudo input')?.focus();
}

async function copiar(tipo) {
  await gravador.agora();
  const p = aberta();
  if (!p) return;
  try {
    if (tipo === 'html' && window.ClipboardItem) {
      const html = htmlDaPauta(p);
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([textoPuroDaPauta(p)], { type: 'text/plain' }),
      })]);
    } else {
      await navigator.clipboard.writeText(tipo === 'md' ? markdownDaPauta(p) : textoPuroDaPauta(p));
    }
    app.avisoCurto('Copiado. Agora é só colar no editor do Substack.');
  } catch {
    app.avisoCurto('Não deu para copiar neste navegador.');
  }
}

// Barra de formatação: envolve a seleção do texto com as marcas do Markdown.
function formatar(tipo) {
  const area = document.getElementById('ss-area');
  if (!area) return;
  const { selectionStart: ini, selectionEnd: fim, value } = area;
  const sel = value.slice(ini, fim);
  const inicioLinha = value.lastIndexOf('\n', ini - 1) + 1;
  let novo;
  let cursor;
  const envolver = (marca, vazio) => {
    const miolo = sel || vazio;
    novo = `${value.slice(0, ini)}${marca}${miolo}${marca}${value.slice(fim)}`;
    cursor = [ini + marca.length, ini + marca.length + miolo.length];
  };
  const prefixar = (marca) => {
    novo = `${value.slice(0, inicioLinha)}${marca}${value.slice(inicioLinha)}`;
    cursor = [fim + marca.length, fim + marca.length];
  };
  switch (tipo) {
    case 'negrito': envolver('**', 'negrito'); break;
    case 'italico': envolver('*', 'itálico'); break;
    case 'titulo': prefixar('## '); break;
    case 'citacao': prefixar('> '); break;
    case 'lista': prefixar('- '); break;
    case 'divisor':
      novo = `${value.slice(0, ini)}\n\n---\n\n${value.slice(fim)}`;
      cursor = [ini + 7, ini + 7];
      break;
    case 'link': {
      if (url === undefined) {
        perguntarTexto('Endereço do link (https://…)').then((u) => u && formatar('link', u));
        return;
      }
      if (!url || !/^https?:\/\//i.test(url.trim())) return;
      const txt = sel || 'texto do link';
      novo = `${value.slice(0, ini)}[${txt}](${url.trim()})${value.slice(fim)}`;
      cursor = [ini + 1, ini + 1 + txt.length];
      break;
    }
    default: return;
  }
  area.value = novo;
  area.focus();
  area.setSelectionRange(...cursor);
  area.dispatchEvent(new Event('input', { bubbles: true }));
}

async function citarReferencia(id) {
  const p = aberta();
  const a = artigoPeloId(obterEstado(), id);
  if (!p || !a) return;
  const linhas = [`Ref.: ${a.titulo}${a.autor ? `, de ${a.autor}` : ''}${a.url ? ` (${a.url})` : ''}`, ...(a.destaques || []).map((d) => `“${d.texto}”`)];
  await mudarPauta(p.id, { notas: [p.notas, linhas.join('\n')].filter(Boolean).join('\n\n') }, { redesenhar: false });
  app.avisoCurto('Referência levada para as notas da margem.');
}

export function cliqueSubstack(alvo) {
  const acao = alvo.dataset.acao;
  if (!acao?.startsWith('ss-')) return false;
  const p = aberta();
  switch (acao) {
    case 'ss-nova':
      abrirNova();
      break;
    case 'ss-etapa': {
      const b = pautaPeloId(obterEstado(), alvo.dataset.id);
      if (b) mudarPauta(b.id, { etapa: etapaVizinhaSubstack(gravador.vigente(b).etapa, Number(alvo.dataset.passo)) });
      break;
    }
    case 'ss-aba':
      gravador.agora().then(() => {
        atualizarEstado({ ssAba: alvo.dataset.valor });
        app.renderizar();
      });
      break;
    case 'ss-formatar':
      formatar(alvo.dataset.valor);
      break;
    case 'ss-copiar':
      copiar(alvo.dataset.valor);
      break;
    case 'ss-publicado':
      if (p) mudarPauta(p.id, { etapa: 'publicado' }).then(() => app.avisoCurto('Publicado! Conta para a meta do mês.'));
      break;
    case 'ss-ref-ligar': {
      const id = alvo.dataset.id || document.getElementById('ss-ref-escolha')?.value;
      if (p && id && !(p.referencias || []).includes(id)) {
        atualizarEstado({ substackReferencia: null });
        mudarPauta(p.id, { referencias: [...(p.referencias || []), id] }).then(() => app.avisoCurto('Referência ligada.'));
      }
      break;
    }
    case 'ss-ref-tirar':
      if (p) mudarPauta(p.id, { referencias: (p.referencias || []).filter((id) => id !== alvo.dataset.id) });
      break;
    case 'ss-ref-citar':
      citarReferencia(alvo.dataset.id);
      break;
    case 'ss-ref-cancelar':
      atualizarEstado({ substackReferencia: null });
      app.renderizar();
      break;
    case 'ss-excluir':
      if (p) confirmar(`Excluir a pauta "${p.titulo}"?`).then((ok) => { if (!ok) return;
        mudarPauta(p.id, { excluido_em: new Date().toISOString() }, { redesenhar: false }).then(() => {
          location.hash = '#substack';
          app.avisoCurto('Pauta excluída.');
        });
      });
      break;
    default:
      return false;
  }
  return true;
}

async function salvarMeta(valor) {
  const atual = (await listar('config')).find((c) => c.chave === 'substack');
  const porMes = Math.max(1, Math.min(30, Number(valor) || 4));
  await gravar('config', 'config', { ...(atual || {}), chave: 'substack', valor: { ...(atual?.valor || {}), porMes } });
}

export function mudancaSubstack(alvo, tipo) {
  if (alvo.dataset?.ssMeta !== undefined) {
    clearTimeout(tempoMeta);
    tempoMeta = setTimeout(() => salvarMeta(alvo.value).then(() => tipo === 'change' && app.renderizar()), tipo === 'change' ? 0 : 900);
    return true;
  }
  if (alvo.dataset?.acaoMudar === 'ss-etapa') {
    if (tipo === 'change' && base()) mudarPauta(base().id, { etapa: alvo.value });
    return true;
  }
  const b = base();
  if (!b) return false;
  const marcar = () => {
    const salvo = document.getElementById('ss-salvo');
    if (salvo) salvo.textContent = 'Salvando…';
  };
  if (alvo.dataset?.ssCampo) {
    const campo = alvo.dataset.ssCampo;
    if (campo === 'agendado_para') {
      if (tipo !== 'change') return true;
      gravador.ja(b, { agendado_para: alvo.value ? new Date(alvo.value).toISOString() : null }).then(() => app.avisoCurto(alvo.value ? 'Data no Calendário.' : 'Data tirada.'));
      return true;
    }
    let valor = alvo.value;
    if (campo === 'tags') valor = lerTags(valor);
    if (campo === 'link') valor = /^https?:\/\//i.test(valor.trim()) ? valor.trim() : null;
    if (campo === 'titulo') {
      valor = valor.trim();
      if (!valor) return true;
    }
    if (campo === 'texto') {
      const est = estatisticasDoTexto(valor);
      const cont = document.getElementById('ss-contagem');
      if (cont) cont.textContent = `${est.palavras.toLocaleString('pt-BR')} palavras · ${est.minutos} min de leitura`;
    }
    marcar();
    gravador.adiar(b, { [campo]: valor });
    return true;
  }
  if (alvo.dataset?.ssDetalhe) {
    marcar();
    gravador.adiar(b, { detalhes: { ...(gravador.vigente(b).detalhes || {}), [alvo.dataset.ssDetalhe]: alvo.value } });
    return true;
  }
  if (alvo.dataset?.ssCheck) {
    if (tipo !== 'change') return true;
    gravador.ja(b, { checklist: { ...(gravador.vigente(b).checklist || {}), [alvo.dataset.ssCheck]: alvo.checked } });
    return true;
  }
  return false;
}

async function enviarNova(form) {
  const titulo = form.elements.titulo.value.trim();
  if (!titulo) {
    form.elements.titulo.focus();
    return;
  }
  const ref = obterEstado().substackReferencia;
  const p = await gravar('pautas_substack', 'pautas', {
    titulo, etapa: 'ideia', texto: '', referencias: ref ? [ref] : [], tags: [], checklist: {},
    detalhes: { angulo: form.elements.angulo.value.trim() }, link: null, publicado_em: null, agendado_para: null,
  });
  atualizarEstado({ substackReferencia: null, ssAba: 'escrever' });
  document.getElementById('folha-evento').close();
  location.hash = `#substack/${p.id}`;
  app.avisoCurto('Pauta guardada.');
}

export function enviarSubstack(form) {
  if (form.dataset.form !== 'ss-nova') return false;
  enviarNova(form);
  return true;
}

export const salvarSubstackAgora = () => gravador.agora();

// ---------------------------------------------------------------------------
// Arrastar entre as colunas
// ---------------------------------------------------------------------------

function aoApertar(e) {
  const alca = e.target.closest?.('[data-ss-arrastar]');
  if (!alca || e.button > 0) return;
  e.preventDefault();
  try {
    alca.setPointerCapture(e.pointerId);
  } catch {
    // segue sem captura
  }
  const cartao = alca.closest('.yt-cartao');
  arraste = { id: alca.dataset.ssArrastar, cartao, ponteiro: e.pointerId, x0: e.clientX, y0: e.clientY, moveu: false, coluna: null };
  cartao.classList.add('arrastando');
}

function aoMover(e) {
  if (!arraste || e.pointerId !== arraste.ponteiro) return;
  e.preventDefault();
  const dx = e.clientX - arraste.x0;
  const dy = e.clientY - arraste.y0;
  if (Math.abs(dx) + Math.abs(dy) > 4) arraste.moveu = true;
  arraste.cartao.style.transform = `translate(${dx}px, ${dy}px)`;
  const quadro = arraste.cartao.closest('.ss-quadro');
  const r = quadro?.getBoundingClientRect();
  if (r && e.clientX > r.right - 60) quadro.scrollLeft += 16;
  else if (r && e.clientX < r.left + 60) quadro.scrollLeft -= 16;
  if (e.clientY > window.innerHeight - 50) window.scrollBy(0, 12);
  else if (e.clientY < 50) window.scrollBy(0, -12);
  arraste.cartao.style.pointerEvents = 'none';
  const coluna = document.elementFromPoint(e.clientX, e.clientY)?.closest('.ss-coluna');
  arraste.cartao.style.pointerEvents = '';
  document.querySelectorAll('.ss-coluna.alvo').forEach((c) => c !== coluna && c.classList.remove('alvo'));
  if (coluna) coluna.classList.add('alvo');
  arraste.coluna = coluna?.dataset.etapa || null;
}

function terminarArraste() {
  if (!arraste) return null;
  const a = arraste;
  arraste = null;
  a.cartao.classList.remove('arrastando');
  a.cartao.style.transform = '';
  document.querySelectorAll('.ss-coluna.alvo').forEach((c) => c.classList.remove('alvo'));
  return a;
}

function aoSoltar(e) {
  if (!arraste || e.pointerId !== arraste.ponteiro) return;
  const a = terminarArraste();
  if (!a.moveu || !a.coluna || !ETAPAS_SUBSTACK.some((x) => x.id === a.coluna)) return;
  const b = pautaPeloId(obterEstado(), a.id);
  if (!b || gravador.vigente(b).etapa === a.coluna) return;
  mudarPauta(b.id, { etapa: a.coluna }).then(() => app.avisoCurto(`Movida para ${nomeEtapaSubstack(a.coluna)}.`));
}
