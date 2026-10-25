// Cliques e formulários do Hub do YouTube (painel e página do vídeo).

import { obterEstado, atualizarEstado } from './estado.js';
import { listar, salvar, excluir } from './persistencia.js';
import { renderFormIdeia, configYoutube, LIMITE_TAGS } from './views-youtube.js';
import {
  novoVideo, etapaVizinha, eventosDoVideo, MODELOS_ROTEIRO, palavrasDoRoteiro, duracaoEstimada, duracao, capitulos,
} from './dados-youtube.js';
import { instanteLocal } from './dados-calendario.js';

let app; // { renderizar, avisoCurto }
let tempoSalvar = null;
let pendente = null; // { id, mudancas }

export function ligarYoutube(funcoes) {
  app = funcoes;
}

// A última versão salva fica guardada aqui: o estado da tela é recarregado logo depois,
// e duas gravações seguidas nunca partem de uma cópia antiga.
const ultimas = new Map();
function videoPeloId(id) {
  const daTela = (obterEstado().videos || []).find((v) => v.id === id);
  const salva = ultimas.get(id);
  const v = salva && (!daTela || String(salva.atualizado_em) >= String(daTela.atualizado_em)) ? salva : daTela;
  return v && !v.excluido_em ? v : null;
}

// As datas do vídeo viram eventos do Calendário (tipo "youtube"), atualizados a cada mudança.
async function sincronizarEventos(video) {
  const prefixo = `${video.id}:`;
  const existentes = (await listar('eventos', { incluirExcluidos: true })).filter((e) => e.origem === 'youtube' && String(e.origem_id).startsWith(prefixo));
  const desejados = eventosDoVideo(video);
  for (const d of desejados) {
    const atual = existentes.find((e) => e.origem_id === d.origem_id);
    if (atual && !atual.excluido_em && atual.titulo === d.titulo && Date.parse(atual.inicio) === Date.parse(d.inicio) && atual.dia_inteiro === d.dia_inteiro) continue;
    await salvar('eventos', {
      ...(atual || {}), ...d, tipo: 'youtube', origem: 'youtube', status: null, disciplina_id: null, link: null, excluido_em: null,
    });
  }
  for (const e of existentes) {
    if (!e.excluido_em && !desejados.some((d) => d.origem_id === e.origem_id)) await salvar('eventos', { ...e, excluido_em: new Date().toISOString() });
  }
}

async function salvarVideo(video, mudancas) {
  const salvo = await salvar('videos', { ...video, ...mudancas });
  ultimas.set(salvo.id, salvo);
  await sincronizarEventos(salvo);
  return salvo;
}

async function salvarConfig(campos) {
  const atual = (await listar('config')).find((c) => c.chave === 'youtube');
  await salvar('config', { ...(atual || {}), chave: 'youtube', valor: { ...configYoutube(obterEstado()), ...(atual?.valor || {}), ...campos } });
}

function abrirIdeia() {
  document.getElementById('folha-criar')?.close();
  document.getElementById('folha-evento-titulo').textContent = 'Nova ideia de vídeo';
  document.getElementById('folha-evento-conteudo').innerHTML = renderFormIdeia();
  document.getElementById('folha-evento').showModal();
  document.querySelector('[data-form="yt-novo"] [name=titulo]')?.focus();
}

// Roteiro: mudanças de estrutura (adicionar, mover, remover blocos) salvam e redesenham.
async function mudarBlocos(fn) {
  const v = videoPeloId(obterEstado().parametro);
  if (!v) return;
  await salvarAgora();
  const blocos = (videoPeloId(v.id)?.roteiro?.blocos || []).map((b) => ({ ...b }));
  fn(blocos);
  await salvarVideo(videoPeloId(v.id), { roteiro: { ...(v.roteiro || {}), blocos } });
  app.renderizar();
}

export function cliqueYoutube(alvo) {
  const id = alvo.dataset.id;
  switch (alvo.dataset.acao) {
    case 'yt-novo':
      abrirIdeia();
      return true;
    case 'yt-visao':
      salvarConfig({ visao: alvo.dataset.visao }).then(() => app.renderizar());
      return true;
    case 'yt-etapa': {
      const v = videoPeloId(id);
      if (!v) return true;
      const etapa = etapaVizinha(v.etapa, Number(alvo.dataset.passo));
      salvarVideo(v, { etapa }).then(() => app.renderizar());
      return true;
    }
    case 'yt-aba':
      salvarAgora().then(() => {
        atualizarEstado({ ytAba: alvo.dataset.aba });
        app.renderizar();
      });
      return true;
    case 'yt-bloco-novo':
      mudarBlocos((b) => b.push({ id: crypto.randomUUID(), tipo: 'bloco', titulo: `Bloco ${b.filter((x) => x.tipo === 'bloco').length + 1}`, texto: '' }));
      return true;
    case 'yt-bloco-mover': {
      const i = Number(alvo.dataset.indice);
      const j = i + Number(alvo.dataset.passo);
      mudarBlocos((b) => {
        if (j >= 0 && j < b.length) [b[i], b[j]] = [b[j], b[i]];
      });
      return true;
    }
    case 'yt-bloco-remover': {
      const i = Number(alvo.dataset.indice);
      const v = videoPeloId(obterEstado().parametro);
      const bloco = v?.roteiro?.blocos?.[i];
      if (bloco?.texto?.trim() && !window.confirm('Remover este bloco? O texto dele se perde.')) return true;
      mudarBlocos((b) => b.splice(i, 1));
      return true;
    }
    case 'yt-modelo': {
      const v = videoPeloId(obterEstado().parametro);
      if (!v) return true;
      const temTexto = (v.roteiro?.blocos || []).some((b) => b.texto?.trim());
      if (temTexto && !window.confirm('Trocar a estrutura do roteiro? Os blocos com texto ficam no fim.')) return true;
      mudarBlocos((b) => {
        const comTexto = b.filter((x) => x.texto?.trim());
        b.splice(0, b.length, ...(MODELOS_ROTEIRO[v.formato] || MODELOS_ROTEIRO.longo).map((m) => ({ ...m, id: crypto.randomUUID() })), ...comTexto);
      });
      return true;
    }
    case 'yt-copiar': {
      const el = document.getElementById(`yt-${alvo.dataset.alvo}`);
      if (!el) return true;
      navigator.clipboard?.writeText(el.value).then(
        () => app.avisoCurto('Copiado. É só colar no YouTube Studio.'),
        () => { el.select(); app.avisoCurto('Selecionei o texto: use Copiar do teclado.'); },
      );
      return true;
    }
    case 'yt-excluir': {
      const v = videoPeloId(id);
      if (!v || !window.confirm(`Excluir "${v.titulo}"? As datas dele saem do Calendário.`)) return true;
      clearTimeout(tempoSalvar);
      pendente = null;
      excluir('videos', id).then(async (removido) => {
        if (removido) await sincronizarEventos(removido);
        location.hash = '#youtube';
        app.avisoCurto('Vídeo excluído.');
      });
      return true;
    }
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Página do vídeo: salva sozinha enquanto a Carol digita (sem redesenhar a tela).
// ---------------------------------------------------------------------------

function lerFormulario(form, video) {
  const c = form.elements;
  const m = {};
  const texto = (nome) => (c[nome] ? c[nome].value.trim() : undefined);
  if (c.titulo) m.titulo = texto('titulo') || video.titulo;
  if (c.titulos_alternativos) m.titulos_alternativos = c.titulos_alternativos.value.split('\n').map((t) => t.trim()).filter(Boolean).slice(0, 10);
  for (const nome of ['formato', 'etapa', 'serie', 'gancho', 'publico', 'ideia_thumb', 'notas', 'descricao', 'link']) {
    if (c[nome]) m[nome] = texto(nome) || (nome === 'formato' || nome === 'etapa' ? video[nome] : null);
  }
  if (c.prioridade) m.prioridade = Number(c.prioridade.value) || 2;
  if (c.data_gravacao) m.data_gravacao = c.data_gravacao.value || null;
  if (c.data_publicacao) m.data_publicacao = c.data_publicacao.value ? instanteLocal(c.data_publicacao.value, c.hora_publicacao.value || '12:00') : null;
  if (c.tags) m.tags = c.tags.value.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 60);
  const checks = form.querySelectorAll('input[name="check"]');
  if (checks.length) m.checklist = { ...(video.checklist || {}), ...Object.fromEntries([...checks].map((k) => [k.value, k.checked])) };
  const metricas = form.querySelectorAll('[name^="m_"]');
  if (metricas.length) {
    m.metricas = { ...(video.metricas || {}) };
    for (const el of metricas) {
      const chave = el.name.slice(2);
      if (el.type === 'number') m.metricas[chave] = el.value === '' ? null : Number(el.value);
      else m.metricas[chave] = el.value.trim() || null;
    }
  }
  const blocos = form.querySelectorAll('[data-bloco-campo]');
  if (blocos.length) {
    const lista = (video.roteiro?.blocos || []).map((b) => ({ ...b }));
    for (const el of blocos) {
      const b = lista[Number(el.dataset.indice)];
      if (b) b[el.dataset.blocoCampo] = el.value;
    }
    m.roteiro = { ...(video.roteiro || {}), blocos: lista };
  }
  return m;
}

// Atualiza na hora as contagens (palavras, duração, tags e capítulos) sem redesenhar.
function atualizarContagens(form, rascunho) {
  const contagem = form.querySelector('[data-yt-contagem]');
  if (contagem) {
    const n = palavrasDoRoteiro(rascunho);
    contagem.textContent = `${n} ${n === 1 ? 'palavra' : 'palavras'} · cerca de ${duracao(duracaoEstimada(rascunho))} de vídeo`;
  }
  const tags = form.querySelector('[data-yt-tags]');
  if (tags && form.elements.tags) {
    const n = form.elements.tags.value.length;
    tags.textContent = `${n}/${LIMITE_TAGS} caracteres${n > LIMITE_TAGS ? ' · passou do limite do YouTube' : ''}`;
  }
  const caps = document.getElementById('yt-capitulos');
  if (caps) caps.value = capitulos(rascunho);
}

async function salvarAgora() {
  clearTimeout(tempoSalvar);
  tempoSalvar = null;
  if (!pendente) return;
  const { id, mudancas } = pendente;
  pendente = null;
  const video = videoPeloId(id);
  if (!video) return;
  await salvarVideo(video, mudancas);
  const aviso = document.querySelector('[data-yt-salvo]');
  if (aviso) aviso.textContent = 'Salvo.';
}

export function mudancaYoutube(alvo) {
  if (alvo.dataset?.acaoMudar === 'yt-meta') {
    salvarConfig({ meta: Number(alvo.value) || 1 }).then(() => app.renderizar());
    return true;
  }
  const form = alvo.closest('[data-form="yt-video"]');
  if (!form) return false;
  const video = videoPeloId(form.dataset.id);
  if (!video) return true;
  const mudancas = lerFormulario(form, video);
  pendente = { id: video.id, mudancas: { ...(pendente?.id === video.id ? pendente.mudancas : {}), ...mudancas } };
  atualizarContagens(form, { ...video, ...pendente.mudancas });
  const aviso = form.querySelector('[data-yt-salvo]');
  if (aviso) aviso.textContent = 'Salvando…';
  clearTimeout(tempoSalvar);
  tempoSalvar = setTimeout(salvarAgora, 800);
  return true;
}

export function enviarYoutube(form) {
  if (form.dataset.form === 'yt-video') {
    salvarAgora();
    return true;
  }
  if (form.dataset.form !== 'yt-novo') return false;
  const titulo = form.elements.titulo.value.trim();
  if (!titulo) {
    const erro = form.querySelector('[data-erro]');
    erro.textContent = 'Escreva a ideia em poucas palavras.';
    erro.hidden = false;
    return true;
  }
  salvar('videos', novoVideo({ titulo: titulo.slice(0, 100), formato: form.elements.formato.value })).then(() => {
    document.getElementById('folha-evento').close();
    if (obterEstado().rota !== 'youtube') location.hash = '#youtube';
    app.avisoCurto('Ideia guardada. Toque nela para escrever o roteiro.');
  });
  return true;
}

// Ao sair da página do vídeo, salva o que estava esperando.
window.addEventListener('hashchange', () => {
  if (pendente) salvarAgora();
});
