// Cliques, formulários e gestos do Hub do YouTube (painel, página do vídeo e ajustes do canal).

import { obterEstado, atualizarEstado } from './estado.js';
import { listar, salvar, excluir } from './persistencia.js';
import { chamar } from './funcoes.js';
import { renderFormIdeia } from './views-youtube.js';
import { LIMITE_TAGS } from './views-youtube-video.js';
import {
  novoVideo, etapaVizinha, eventosDoVideo, MODELOS_ROTEIRO, palavrasDoRoteiro, duracaoEstimada, duracao, capitulos,
  configDoCanal, descricaoDoModelo, notaDaIdeia, textoDoTeleprompter, tempoDoBloco, ETAPAS,
} from './dados-youtube.js';
import { instanteLocal, chaveDia, dataDaChave } from './dados-calendario.js';
import { enviarThumb, apagarThumb, carregarThumbsDaTela, MAX_THUMBS } from './thumbs-youtube.js';
import { abrirTeleprompter } from './teleprompter.js';

let app; // { renderizar, avisoCurto }
let tempoSalvar = null;
let pendente = null; // { id, mudancas }
let tempoCanal = null;
let canalPendente = null; // ajustes do canal esperando para salvar

export function ligarYoutube(funcoes) {
  app = funcoes;
  document.addEventListener('pointerdown', aoApertar);
  document.addEventListener('pointermove', aoMover, { passive: false });
  document.addEventListener('pointerup', aoSoltar);
  document.addEventListener('pointercancel', aoCancelar);
  // Depois de cada desenho da tela, carrega as thumbnails que aparecem nela.
  new MutationObserver(() => {
    if (obterEstado().rota === 'youtube') carregarThumbsDaTela();
  }).observe(document.getElementById('conteudo'), { childList: true });
}

// A última versão salva fica guardada aqui: o estado da tela é recarregado logo depois,
// e duas gravações seguidas nunca partem de uma cópia antiga.
const ultimas = new Map();
function videoPeloId(id) {
  const daTela = (obterEstado().videos || []).find((v) => v.id === id);
  const salva = ultimas.get(id);
  const v = salva && (!daTela || Date.parse(salva.atualizado_em) >= Date.parse(daTela.atualizado_em)) ? salva : daTela;
  return v && !v.excluido_em ? v : null;
}

// As datas do vídeo viram eventos do Calendário (tipo "youtube"), atualizados quando mudam.
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

// Muda o vídeo aberto (salvando antes o que estava sendo digitado) e redesenha.
async function mudarVideo(fn, { redesenhar = true } = {}) {
  await salvarAgora();
  const v = videoPeloId(obterEstado().parametro);
  if (!v) return null;
  const mudancas = fn(structuredClone(v));
  if (!mudancas) return null;
  const salvo = await salvarVideo(v, mudancas);
  if (redesenhar) app.renderizar();
  return salvo;
}

async function lerConfigCanal() {
  const atual = (await listar('config')).find((c) => c.chave === 'youtube');
  return { atual, cfg: configDoCanal({ config: atual ? [atual] : [] }) };
}

async function salvarConfig(campos) {
  const { atual, cfg } = await lerConfigCanal();
  await salvar('config', { ...(atual || {}), chave: 'youtube', valor: { ...cfg, ...(atual?.valor || {}), ...campos } });
}

// Salva na hora o que a Carol digitou na aba Canal (antes de outra mudança nos pilares).
async function salvarCanalAgora() {
  clearTimeout(tempoCanal);
  if (!canalPendente) return;
  const campos = canalPendente;
  canalPendente = null;
  await salvarConfig(campos);
  const aviso = document.querySelector('[data-form="yt-canal"] [data-yt-salvo]');
  if (aviso) aviso.textContent = 'Salvo.';
}

async function mudarPilares(fn) {
  await salvarCanalAgora();
  const { cfg } = await lerConfigCanal();
  const pilares = fn(cfg.pilares.map((x) => ({ ...x })));
  if (!pilares) return;
  await salvarConfig({ pilares });
  app.renderizar();
}

function abrirIdeia(dia = '') {
  document.getElementById('folha-criar')?.close();
  document.getElementById('folha-evento-titulo').textContent = 'Nova ideia de vídeo';
  document.getElementById('folha-evento-conteudo').innerHTML = renderFormIdeia(obterEstado(), { dia });
  document.getElementById('folha-evento').showModal();
  document.querySelector('[data-form="yt-novo"] [name=titulo]')?.focus();
}

// ---------------------------------------------------------------------------
// IA (função youtube-ia)
// ---------------------------------------------------------------------------

async function pedirIa(acao) {
  await salvarAgora();
  const v = videoPeloId(obterEstado().parametro);
  if (!v) return;
  atualizarEstado({ ytIa: { videoId: v.id, acao, carregando: true } });
  app.renderizar();
  document.getElementById('yt-ia-titulo')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  const video = {
    titulo: v.titulo, formato: v.formato, gancho: v.gancho, publico: v.publico, notas: v.notas, roteiro: v.roteiro,
    pilar: configDoCanal(obterEstado()).pilares.find((p) => p.id === v.pilar)?.nome || '',
  };
  const r = await chamar('youtube-ia', { acao, video });
  if (obterEstado().ytIa?.videoId !== v.id || obterEstado().ytIa?.acao !== acao) return; // a Carol já pediu outra coisa
  atualizarEstado({ ytIa: { videoId: v.id, acao, resultado: r.ok ? r.resultado : null, erro: r.ok ? null : r.erro } });
  app.renderizar();
}

async function usarIa(alvo) {
  const ia = obterEstado().ytIa;
  if (!ia?.resultado) return;
  const r = ia.resultado;
  const i = Number(alvo.dataset.indice);
  const modo = alvo.dataset.modo;
  const cfg = configDoCanal(obterEstado());
  await mudarVideo((v) => {
    switch (ia.acao) {
      case 'titulos': {
        const t = r.titulos?.[i]?.titulo;
        if (!t) return null;
        if (modo === 'alternativo') return { titulos_alternativos: [...new Set([...(v.titulos_alternativos || []), t])].slice(0, 10) };
        return { titulo: t.slice(0, 100), titulos_alternativos: [...new Set([v.titulo, ...(v.titulos_alternativos || [])])].filter((x) => x && x !== t).slice(0, 10) };
      }
      case 'ganchos':
        return r.ganchos?.[i] ? { gancho: r.ganchos[i].gancho } : null;
      case 'roteiro': {
        const novos = (r.blocos || []).map((b) => ({ id: crypto.randomUUID(), tipo: b.tipo, titulo: b.titulo, texto: b.texto }));
        const blocos = modo === 'juntar' ? [...(v.roteiro?.blocos || []), ...novos] : novos;
        return { roteiro: { ...(v.roteiro || {}), blocos } };
      }
      case 'publicacao': {
        const base = { ...v, gancho: r.resumo || v.gancho };
        return {
          descricao: descricaoDoModelo(base, cfg),
          tags: (r.tags || []).slice(0, 30),
          detalhes: { ...(v.detalhes || {}), hashtags: (r.hashtags || []).join(' ') },
        };
      }
      case 'thumbs': {
        const t = r.ideias?.[i];
        return t ? { ideia_thumb: t.imagem, detalhes: { ...(v.detalhes || {}), texto_thumb: t.texto_na_thumb } } : null;
      }
      case 'cortes': {
        const c = r.cortes?.[i];
        if (!c) return null;
        const cortes = [...(v.detalhes?.cortes || []), { id: crypto.randomUUID(), titulo: c.titulo, gancho: c.gancho, trecho: c.de_onde }];
        return { detalhes: { ...(v.detalhes || {}), cortes } };
      }
      default:
        return null;
    }
  });
  app.avisoCurto(ia.acao === 'cortes' ? 'Corte adicionado.' : 'Pronto, entrou no vídeo.');
}

// ---------------------------------------------------------------------------
// Cliques
// ---------------------------------------------------------------------------

export function cliqueYoutube(alvo) {
  const id = alvo.dataset.id;
  const i = Number(alvo.dataset.indice);
  switch (alvo.dataset.acao) {
    case 'yt-novo':
      abrirIdeia(alvo.dataset.dia || '');
      return true;
    case 'yt-visao':
      atualizarEstado({ ytVisao: alvo.dataset.visao });
      app.renderizar();
      salvarConfig({ visao: alvo.dataset.visao });
      return true;
    case 'yt-mes': {
      const foco = obterEstado().ytMes || chaveDia(new Date());
      const d = dataDaChave(foco);
      atualizarEstado({ ytMes: chaveDia(new Date(d.getFullYear(), d.getMonth() + Number(alvo.dataset.passo), 1)) });
      app.renderizar();
      return true;
    }
    case 'yt-etapa': {
      const v = videoPeloId(id);
      if (!v) return true;
      salvarAgora().then(() => salvarVideo(videoPeloId(id), { etapa: etapaVizinha(v.etapa, Number(alvo.dataset.passo)) })).then(() => app.renderizar());
      return true;
    }
    case 'yt-aba':
      salvarAgora().then(() => {
        atualizarEstado({ ytAba: alvo.dataset.aba });
        app.renderizar();
      });
      return true;
    case 'yt-ia':
      pedirIa(alvo.dataset.ia);
      return true;
    case 'yt-ia-usar':
      usarIa(alvo);
      return true;
    case 'yt-ia-fechar':
      atualizarEstado({ ytIa: null });
      app.renderizar();
      return true;
    case 'yt-teleprompter':
      salvarAgora().then(() => {
        const v = videoPeloId(obterEstado().parametro);
        if (v) abrirTeleprompter(textoDoTeleprompter(v), v.titulo);
      });
      return true;
    case 'yt-bloco-novo':
      mudarVideo((v) => ({ roteiro: { ...(v.roteiro || {}), blocos: [...(v.roteiro?.blocos || []), { id: crypto.randomUUID(), tipo: 'bloco', titulo: `Bloco ${(v.roteiro?.blocos || []).filter((x) => x.tipo === 'bloco').length + 1}`, texto: '' }] } }));
      return true;
    case 'yt-bloco-mover':
      mudarVideo((v) => {
        const b = [...(v.roteiro?.blocos || [])];
        const j = i + Number(alvo.dataset.passo);
        if (j < 0 || j >= b.length) return null;
        [b[i], b[j]] = [b[j], b[i]];
        return { roteiro: { ...v.roteiro, blocos: b } };
      });
      return true;
    case 'yt-bloco-remover': {
      const v = videoPeloId(obterEstado().parametro);
      if (v?.roteiro?.blocos?.[i]?.texto?.trim() && !window.confirm('Remover este bloco? O texto dele se perde.')) return true;
      mudarVideo((x) => ({ roteiro: { ...x.roteiro, blocos: (x.roteiro?.blocos || []).filter((_, k) => k !== i) } }));
      return true;
    }
    case 'yt-modelo': {
      const v = videoPeloId(obterEstado().parametro);
      if (!v) return true;
      if ((v.roteiro?.blocos || []).some((b) => b.texto?.trim()) && !window.confirm('Trocar a estrutura do roteiro? Os blocos com texto ficam no fim.')) return true;
      mudarVideo((x) => ({
        roteiro: {
          ...x.roteiro,
          blocos: [...(MODELOS_ROTEIRO[x.formato] || MODELOS_ROTEIRO.longo).map((m) => ({ ...m, id: crypto.randomUUID() })), ...(x.roteiro?.blocos || []).filter((b) => b.texto?.trim())],
        },
      }));
      return true;
    }
    case 'yt-cenas-roteiro':
      mudarVideo((v) => {
        const atuais = v.detalhes?.cenas || [];
        const novas = (v.roteiro?.blocos || []).map((b) => ({ texto: [b.titulo, b.visual].filter(Boolean).join(' — '), feito: false })).filter((c) => c.texto);
        return { detalhes: { ...(v.detalhes || {}), cenas: [...atuais, ...novas.filter((n) => !atuais.some((a) => a.texto === n.texto))] } };
      });
      return true;
    case 'yt-item-novo': {
      const lista = alvo.dataset.lista;
      const campo = document.querySelector(`[data-novo-item="${lista}"]`);
      const texto = campo?.value.trim();
      if (!texto) {
        campo?.focus();
        return true;
      }
      mudarVideo((v) => ({ detalhes: { ...(v.detalhes || {}), [lista]: [...(v.detalhes?.[lista] || []), { texto, feito: false }] } }))
        .then(() => document.querySelector(`[data-novo-item="${lista}"]`)?.focus());
      return true;
    }
    case 'yt-item-remover':
      mudarVideo((v) => ({ detalhes: { ...(v.detalhes || {}), [alvo.dataset.lista]: (v.detalhes?.[alvo.dataset.lista] || []).filter((_, k) => k !== i) } }));
      return true;
    case 'yt-corte-novo':
      mudarVideo((v) => ({ detalhes: { ...(v.detalhes || {}), cortes: [...(v.detalhes?.cortes || []), { id: crypto.randomUUID(), titulo: '', trecho: '', gancho: '' }] } }));
      return true;
    case 'yt-corte-remover':
      mudarVideo((v) => ({ detalhes: { ...(v.detalhes || {}), cortes: (v.detalhes?.cortes || []).filter((_, k) => k !== i) } }));
      return true;
    case 'yt-corte-short':
      criarShortDoCorte(i);
      return true;
    case 'yt-thumb-escolher':
      mudarVideo((v) => ({ thumbs: (v.thumbs || []).map((t, k) => ({ ...t, escolhida: k === i ? !t.escolhida : false })), checklist: { ...(v.checklist || {}), thumb: true } }));
      return true;
    case 'yt-thumb-remover': {
      if (!window.confirm('Remover esta imagem?')) return true;
      const t = videoPeloId(obterEstado().parametro)?.thumbs?.[i];
      mudarVideo((x) => ({ thumbs: (x.thumbs || []).filter((_, k) => k !== i) })).then(() => t && apagarThumb(t.caminho));
      return true;
    }
    case 'yt-descricao-modelo': {
      const v = videoPeloId(obterEstado().parametro);
      if (!v) return true;
      if (v.descricao?.trim() && !window.confirm('Trocar a descrição pelo modelo do canal?')) return true;
      mudarVideo((x) => ({ descricao: descricaoDoModelo(x, configDoCanal(obterEstado())) }));
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
    case 'yt-pilar-novo':
      mudarPilares((pilares) => [...pilares, { id: `p-${crypto.randomUUID().slice(0, 6)}`, nome: 'Novo pilar', cor: 4 }]);
      return true;
    case 'yt-pilar-remover':
      mudarPilares((pilares) => {
        if (pilares.length <= 1) {
          app.avisoCurto('Deixe pelo menos um pilar.');
          return null;
        }
        return pilares.filter((_, k) => k !== i);
      });
      return true;
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

async function criarShortDoCorte(i) {
  await salvarAgora();
  const v = videoPeloId(obterEstado().parametro);
  const corte = v?.detalhes?.cortes?.[i];
  if (!corte) return;
  const base = novoVideo({
    titulo: (corte.titulo || `Short de ${v.titulo}`).slice(0, 100),
    formato: 'short',
    etapa: 'roteiro',
    pilar: v.pilar,
    video_origem_id: v.id,
  });
  base.gancho = corte.gancho || null;
  if (base.roteiro.blocos[0] && corte.gancho) base.roteiro.blocos[0].texto = corte.gancho;
  const short = await salvar('videos', base);
  const cortes = v.detalhes.cortes.map((c, k) => (k === i ? { ...c, videoId: short.id } : c));
  await salvarVideo(v, { detalhes: { ...v.detalhes, cortes } });
  app.renderizar();
  app.avisoCurto('Short criado na etapa Roteiro, ligado a este vídeo.');
}

// ---------------------------------------------------------------------------
// Página do vídeo: salva sozinha enquanto a Carol digita (sem redesenhar a tela).
// ---------------------------------------------------------------------------

const CAMPOS_TEXTO = ['formato', 'etapa', 'serie', 'gancho', 'publico', 'ideia_thumb', 'notas', 'descricao', 'link'];

function lerFormulario(form, video) {
  const c = form.elements;
  const m = {};
  const texto = (nome) => (c[nome] ? c[nome].value.trim() : undefined);
  if (c.titulo) m.titulo = texto('titulo') || video.titulo;
  if (c.titulos_alternativos) m.titulos_alternativos = c.titulos_alternativos.value.split('\n').map((t) => t.trim()).filter(Boolean).slice(0, 10);
  for (const nome of CAMPOS_TEXTO) {
    if (c[nome]) m[nome] = texto(nome) || (nome === 'formato' || nome === 'etapa' ? video[nome] : null);
  }
  if (c.pilar) m.pilar = c.pilar.value || null;
  if (c.prioridade) m.prioridade = Number(c.prioridade.value) || 2;
  if (c.data_gravacao) m.data_gravacao = c.data_gravacao.value || null;
  if (c.data_publicacao) m.data_publicacao = c.data_publicacao.value ? instanteLocal(c.data_publicacao.value, c.hora_publicacao?.value || '12:00') : null;
  if (c.tags) m.tags = c.tags.value.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 60);
  // Campos "d_*" ficam em detalhes.
  const camposDetalhe = form.querySelectorAll('[name^="d_"]');
  if (camposDetalhe.length) {
    m.detalhes = { ...(video.detalhes || {}) };
    for (const el of camposDetalhe) {
      const chave = el.name.slice(2);
      m.detalhes[chave] = ['potencial', 'esforco'].includes(chave) ? Number(el.value) : el.value.trim();
    }
  }
  const checks = form.querySelectorAll('input[name="check"]');
  if (checks.length) m.checklist = { ...(video.checklist || {}), ...Object.fromEntries([...checks].map((k) => [k.value, k.checked])) };
  const metricas = form.querySelectorAll('[name^="m_"]');
  if (metricas.length) {
    m.metricas = { ...(video.metricas || {}) };
    for (const el of metricas) {
      const chave = el.name.slice(2);
      m.metricas[chave] = el.type === 'number' ? (el.value === '' ? null : Number(el.value)) : (el.value.trim() || null);
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
  // Listas marcáveis (cenas) e cortes ficam em detalhes.
  const itens = form.querySelectorAll('[data-item-campo]');
  const cortes = form.querySelectorAll('[data-corte-campo]');
  if (itens.length || cortes.length) {
    m.detalhes = { ...(m.detalhes || video.detalhes || {}) };
    const copiadas = new Set();
    for (const el of itens) {
      const nome = el.dataset.lista;
      if (!copiadas.has(nome)) {
        m.detalhes[nome] = (m.detalhes[nome] || []).map((x) => ({ ...x }));
        copiadas.add(nome);
      }
      const item = m.detalhes[nome][Number(el.dataset.indice)];
      if (item) item[el.dataset.itemCampo] = el.type === 'checkbox' ? el.checked : el.value;
    }
    if (cortes.length) {
      const lista = (m.detalhes.cortes || []).map((x) => ({ ...x }));
      for (const el of cortes) {
        const corte = lista[Number(el.dataset.indice)];
        if (corte) corte[el.dataset.corteCampo] = el.value;
      }
      m.detalhes.cortes = lista;
    }
  }
  return m;
}

// Atualiza na hora as contagens (palavras, duração, tags, títulos, nota e capítulos) sem redesenhar.
function atualizarContagens(form, rascunho) {
  const contagem = form.querySelector('[data-yt-contagem]');
  if (contagem) {
    const n = palavrasDoRoteiro(rascunho);
    contagem.textContent = `${n} ${n === 1 ? 'palavra' : 'palavras'} · cerca de ${duracao(duracaoEstimada(rascunho))} de vídeo`;
  }
  form.querySelectorAll('[data-bloco-tempo]').forEach((el) => {
    const b = rascunho.roteiro?.blocos?.[Number(el.dataset.blocoTempo)];
    if (b) el.textContent = tempoDoBloco(b);
  });
  const tags = form.querySelector('[data-yt-tags]');
  if (tags && form.elements.tags) {
    const n = form.elements.tags.value.length;
    tags.textContent = `${n}/${LIMITE_TAGS} caracteres${n > LIMITE_TAGS ? ' · passou do limite do YouTube' : ''}`;
  }
  form.querySelectorAll('[data-contagem]').forEach((el) => {
    const nome = el.dataset.contagem;
    const campo = form.elements[nome] || form.elements[`d_${nome}`];
    if (campo) el.textContent = `${campo.value.length}/${campo.maxLength > 0 ? campo.maxLength : ''}`;
  });
  const nota = form.querySelector('[data-yt-nota]');
  if (nota) nota.textContent = notaDaIdeia(rascunho);
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

// Ajustes do canal (aba Canal): salvam sozinhos.
function mudancaCanal(form) {
  const cfg = configDoCanal(obterEstado());
  const pilares = cfg.pilares.map((p) => ({ ...p }));
  form.querySelectorAll('[data-pilar-campo]').forEach((el) => {
    const p = pilares[Number(el.dataset.indice)];
    if (p) p[el.dataset.pilarCampo] = el.dataset.pilarCampo === 'cor' ? Number(el.value) : el.value.trim() || p.nome;
  });
  const campos = {
    pilares,
    meta: Number(form.elements.meta.value) || 1,
    modeloDescricao: form.elements.modeloDescricao.value,
    hashtags: form.elements.hashtags.value.trim(),
    checklistExtra: form.elements.checklistExtra.value.split('\n').map((t) => t.trim()).filter(Boolean).slice(0, 20),
  };
  form.querySelector('[data-yt-salvo]').textContent = 'Salvando…';
  canalPendente = campos;
  clearTimeout(tempoCanal);
  tempoCanal = setTimeout(salvarCanalAgora, 600);
}

async function enviarImagem(input) {
  const arquivo = input.files?.[0];
  input.value = '';
  if (!arquivo) return;
  const v = videoPeloId(obterEstado().parametro);
  if (!v) return;
  if ((v.thumbs || []).length >= MAX_THUMBS) {
    app.avisoCurto(`Até ${MAX_THUMBS} imagens por vídeo.`);
    return;
  }
  const estadoTela = document.querySelector('[data-thumb-estado]');
  if (estadoTela) estadoTela.textContent = 'Enviando a imagem…';
  try {
    const thumb = await enviarThumb(v.id, arquivo);
    await mudarVideo((x) => ({ thumbs: [...(x.thumbs || []), thumb] }));
    app.avisoCurto('Imagem guardada.');
  } catch (erro) {
    const el = document.querySelector('[data-thumb-estado]');
    if (el) el.textContent = erro.message || 'Não deu para enviar a imagem.';
  }
}

export function mudancaYoutube(alvo) {
  if (alvo.dataset?.acaoMudar === 'yt-filtro-pilar') {
    atualizarEstado({ ytPilar: alvo.value });
    app.renderizar();
    return true;
  }
  if (alvo.dataset?.acaoArquivo === 'yt-thumb') {
    if (alvo.files?.length) enviarImagem(alvo);
    return true;
  }
  const canal = alvo.closest?.('[data-form="yt-canal"]');
  if (canal) {
    mudancaCanal(canal);
    return true;
  }
  const form = alvo.closest?.('[data-form="yt-video"]');
  if (!form) return false;
  if (alvo.dataset.novoItem !== undefined) return true; // campo de item novo: salva ao tocar em "+"
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
    // Enter num campo de item novo adiciona o item.
    const ativo = document.activeElement;
    if (ativo?.dataset?.novoItem) {
      document.querySelector(`[data-acao="yt-item-novo"][data-lista="${ativo.dataset.novoItem}"]`)?.click();
      return true;
    }
    salvarAgora();
    return true;
  }
  if (form.dataset.form === 'yt-canal') return true;
  if (form.dataset.form !== 'yt-novo') return false;
  const titulo = form.elements.titulo.value.trim();
  if (!titulo) {
    const erro = form.querySelector('[data-erro]');
    erro.textContent = 'Escreva a ideia em poucas palavras.';
    erro.hidden = false;
    return true;
  }
  const dia = form.dataset.dia;
  salvar('videos', novoVideo({
    titulo: titulo.slice(0, 100),
    formato: form.elements.formato.value,
    pilar: form.elements.pilar.value || null,
    data_publicacao: dia ? instanteLocal(dia, '12:00') : null,
  })).then(async (v) => {
    if (dia) await sincronizarEventos(v);
    document.getElementById('folha-evento').close();
    if (obterEstado().rota !== 'youtube') location.hash = '#youtube';
    else app.renderizar();
    app.avisoCurto('Ideia guardada. Toque nela para escrever o roteiro.');
  });
  return true;
}

// Ao sair da página do vídeo, salva o que estava esperando e fecha as sugestões da IA.
window.addEventListener('hashchange', () => {
  if (pendente) salvarAgora();
  if (canalPendente) salvarCanalAgora();
  if (obterEstado().ytIa) atualizarEstado({ ytIa: null });
});

// ---------------------------------------------------------------------------
// Quadro: arrastar o cartão (alça ⠿) para outra coluna
// ---------------------------------------------------------------------------

let arraste = null;

function aoApertar(e) {
  const alca = e.target.closest?.('[data-yt-arrastar]');
  if (!alca || e.button > 0) return;
  const cartao = alca.closest('.yt-cartao');
  e.preventDefault();
  try {
    alca.setPointerCapture(e.pointerId);
  } catch {
    // segue sem captura
  }
  arraste = { id: alca.dataset.ytArrastar, cartao, ponteiro: e.pointerId, x0: e.clientX, y0: e.clientY, moveu: false, coluna: null };
  cartao.classList.add('arrastando');
}

function aoMover(e) {
  if (!arraste || e.pointerId !== arraste.ponteiro) return;
  e.preventDefault();
  const dx = e.clientX - arraste.x0;
  const dy = e.clientY - arraste.y0;
  if (Math.abs(dx) + Math.abs(dy) > 4) arraste.moveu = true;
  arraste.cartao.style.transform = `translate(${dx}px, ${dy}px)`;
  // Rola o quadro para o lado quando o cartão chega perto da borda.
  const quadro = arraste.cartao.closest('.yt-quadro');
  const r = quadro?.getBoundingClientRect();
  if (r && e.clientX > r.right - 60) quadro.scrollLeft += 16;
  else if (r && e.clientX < r.left + 60) quadro.scrollLeft -= 16;
  arraste.cartao.style.pointerEvents = 'none';
  const coluna = document.elementFromPoint(e.clientX, e.clientY)?.closest('.yt-coluna');
  arraste.cartao.style.pointerEvents = '';
  document.querySelectorAll('.yt-coluna.alvo').forEach((c) => c !== coluna && c.classList.remove('alvo'));
  if (coluna) coluna.classList.add('alvo');
  arraste.coluna = coluna?.dataset.etapa || null;
}

function terminarArraste() {
  if (!arraste) return null;
  const a = arraste;
  arraste = null;
  a.cartao.classList.remove('arrastando');
  a.cartao.style.transform = '';
  document.querySelectorAll('.yt-coluna.alvo').forEach((c) => c.classList.remove('alvo'));
  return a;
}

function aoSoltar(e) {
  if (!arraste || e.pointerId !== arraste.ponteiro) return;
  const a = terminarArraste();
  if (!a.moveu || !a.coluna) return;
  const v = videoPeloId(a.id);
  if (!v || v.etapa === a.coluna) return;
  salvarVideo(v, { etapa: a.coluna }).then(() => {
    app.renderizar();
    app.avisoCurto(`Movido para ${ETAPAS.find((x) => x.id === a.coluna)?.nome}.`);
  });
}

function aoCancelar(e) {
  if (arraste && e.pointerId === arraste.ponteiro) terminarArraste();
}
