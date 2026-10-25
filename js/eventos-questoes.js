// Cliques e formulários de Questões: gerar com a IA, salvar no banco, simulados e revisão.

import { obterEstado, atualizarEstado } from './estado.js';
import { salvar } from './persistencia.js';
import { chamar } from './funcoes.js';
import { iniciarTrabalho, trabalho, encerrarTrabalho } from './trabalhos-ia.js';
import { gravar } from './gravacao.js';
import { nomeDaDisciplina } from './dados-faculdade.js';
import { nomeDaArea } from './dados-estudos.js';
import { artigoPeloId, lerTags, textoParaQuestoes } from './dados-biblioteca.js';
import { renderFormSimulado, renderFormQuestao } from './views-questoes.js';
import {
  questaoPeloId, revisaoDaQuestao, avancarRevisao, confere, notaDoSimulado, filtrarQuestoes, revisoesDoDia,
  sortear, cabeNoModo, MODOS, LETRAS,
} from './dados-questoes.js';
import { chaveDia, somarDias } from './dados-calendario.js';

let app; // { renderizar, avisoCurto }
const MAX_IMAGEM = 1600;

export function ligarQuestoes(funcoes) {
  app = funcoes;
  window.addEventListener('hub:trabalho', (e) => {
    if (e.detail?.tipo !== 'questoes') return;
    const { rota, parametro } = obterEstado();
    if (rota === 'questoes' && (!parametro || parametro === 'gerar')) app.renderizar();
    if (e.detail.status === 'pronto' && !(rota === 'questoes' && parametro === 'gerar')) app.avisoCurto('Suas questões ficaram prontas. Abra Questões → Gerar para revisar.');
  });
}

function abrirFolha(titulo, html) {
  document.getElementById('folha-evento-titulo').textContent = titulo;
  document.getElementById('folha-evento-conteudo').innerHTML = html;
  document.getElementById('folha-evento').showModal();
  document.querySelector('#folha-evento-conteudo input:not([type="radio"]), #folha-evento-conteudo textarea')?.focus();
}

const fecharFolha = () => document.getElementById('folha-evento').close();

function mostrarErro(form, texto) {
  const caixa = form.querySelector('[data-erro]');
  if (!caixa) return;
  caixa.textContent = texto;
  caixa.hidden = !texto;
}

function simuladoAberto() {
  const { parametro, simulados = [] } = obterEstado();
  return simulados.find((s) => s.id === parametro && !s.excluido_em) || null;
}

function questaoAtual(s) {
  const estado = obterEstado();
  const questoes = (s.questoes || []).map((id) => questaoPeloId(estado, id)).filter(Boolean);
  const aberta = questoes.findIndex((q) => !(s.respostas?.[q.id]?.respondida || (s.modo === 'prova' && s.respostas?.[q.id]?.resposta)));
  const i = Number.isInteger(estado.qIndice?.[s.id]) ? Math.min(estado.qIndice[s.id], questoes.length - 1) : Math.max(0, aberta);
  return { questoes, indice: i, q: questoes[i] };
}

function irPara(s, indice) {
  atualizarEstado({ qIndice: { ...(obterEstado().qIndice || {}), [s.id]: indice } });
  app.renderizar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------------------------------------------------------------------------
// Respostas, acertos e revisão espaçada
// ---------------------------------------------------------------------------

async function registrarResposta(q, r, modo) {
  await salvar('respostas', {
    questao_id: q.id, modo, resposta: String(r.resposta ?? ''), correta: Boolean(r.correta),
    nota: r.nota ?? null, comentario: r.comentario ?? null, respondida_em: new Date().toISOString(),
  });
  const atual = questaoPeloId(obterEstado(), q.id) || q;
  await gravar('questoes', 'questoes', {
    ...atual,
    acertos: (Number(atual.acertos) || 0) + (r.correta ? 1 : 0),
    erros: (Number(atual.erros) || 0) + (r.correta ? 0 : 1),
  });
  const rev = revisaoDaQuestao(obterEstado(), q.id);
  if (modo === 'revisao' && rev) await gravar('revisoes', 'revisoes', { ...rev, ...avancarRevisao(rev, Boolean(r.correta)) });
  else if (!r.correta) await gravar('revisoes', 'revisoes', { ...(rev || { questao_id: q.id }), ...avancarRevisao(rev, false) });
}

async function mudarResposta(s, q, campos) {
  const respostas = { ...(s.respostas || {}), [q.id]: { ...(s.respostas?.[q.id] || {}), ...campos } };
  return gravar('simulados', 'simulados', { ...s, respostas });
}

async function responder(valor) {
  const s = simuladoAberto();
  if (!s) return;
  const { q } = questaoAtual(s);
  if (!q || q.tipo === 'dissertativa') return;
  if (s.modo === 'prova') {
    await mudarResposta(s, q, { resposta: valor });
    app.renderizar();
    return;
  }
  if (s.respostas?.[q.id]?.respondida) return;
  const correta = confere(q, valor);
  await mudarResposta(s, q, { resposta: valor, correta, respondida: true });
  await registrarResposta(q, { resposta: valor, correta }, s.modo);
  app.renderizar();
}

async function enviarDissertativa(form) {
  const s = simuladoAberto();
  const q = s && questaoPeloId(obterEstado(), form.dataset.id);
  if (!q) return;
  const resposta = form.elements.resposta.value.trim();
  if (!resposta) {
    mostrarErro(form, 'Escreva a sua resposta primeiro.');
    form.elements.resposta.focus();
    return;
  }
  if (form.dataset.enviadoPor === 'eu') {
    await mudarResposta(s, q, { resposta, respondida: true, autoavaliar: true });
    app.renderizar();
    return;
  }
  if (!navigator.onLine) {
    mostrarErro(form, 'Sem internet agora. Use "Ver a resposta e eu mesma avalio".');
    return;
  }
  atualizarEstado({ qCorrigindo: q.id, qRascunho: { ...(obterEstado().qRascunho || {}), [q.id]: resposta } });
  app.renderizar();
  let r;
  try {
    r = await chamar('questoes-corrigir', { enunciado: q.enunciado, esperada: q.resposta_correta, resposta });
  } catch (erro) {
    r = { ok: false, erro: erro.message };
  }
  atualizarEstado({ qCorrigindo: null });
  if (!r.ok) {
    app.renderizar();
    const novo = document.querySelector(`[data-form="q-dissertativa"][data-id="${CSS.escape(q.id)}"]`);
    if (novo) mostrarErro(novo, `${r.erro || 'Não foi possível corrigir agora.'} Você pode usar "Ver a resposta e eu mesma avalio".`);
    return;
  }
  const c = r.correcao;
  const atual = simuladoAberto() || s;
  await mudarResposta(atual, q, { resposta, respondida: true, nota: c.nota, comentario: c.comentario, correta: c.correta });
  await registrarResposta(q, { resposta, nota: c.nota, comentario: c.comentario, correta: c.correta }, s.modo);
  app.renderizar();
}

async function autoavaliar(acertou) {
  const s = simuladoAberto();
  if (!s) return;
  const { q } = questaoAtual(s);
  const r = s.respostas?.[q?.id];
  if (!q || !r?.autoavaliar) return;
  await mudarResposta(s, q, { autoavaliar: false, correta: acertou, nota: acertou ? 10 : 0, comentario: 'Avaliada por você.' });
  await registrarResposta(q, { resposta: r.resposta, correta: acertou, nota: acertou ? 10 : 0, comentario: 'Autoavaliação' }, s.modo);
  app.renderizar();
}

async function terminar() {
  let s = simuladoAberto();
  if (!s) return;
  const { questoes } = questaoAtual(s);
  if (s.modo === 'prova') {
    const semResposta = questoes.filter((q) => !s.respostas?.[q.id]?.resposta).length;
    if (semResposta && !window.confirm(`${semResposta} ${semResposta === 1 ? 'questão está' : 'questões estão'} sem resposta e vão contar como erradas. Terminar mesmo assim?`)) return;
    const respostas = { ...(s.respostas || {}) };
    for (const q of questoes) {
      const resposta = respostas[q.id]?.resposta || '';
      const correta = Boolean(confere(q, resposta));
      respostas[q.id] = { ...(respostas[q.id] || {}), resposta, correta, respondida: true };
      await registrarResposta(q, { resposta, correta }, 'prova');
    }
    s = { ...s, respostas };
  }
  const nota = notaDoSimulado(s, questoes);
  await gravar('simulados', 'simulados', { ...s, ...nota, concluido_em: new Date().toISOString() });
  window.scrollTo({ top: 0 });
  app.renderizar();
}

// ---------------------------------------------------------------------------
// Simulados
// ---------------------------------------------------------------------------

export async function criarSimulado({ modo, ids, titulo, disciplina_id = null, area_id = null }) {
  const s = await gravar('simulados', 'simulados', {
    titulo: String(titulo).slice(0, 140), modo, questoes: ids, respostas: {}, disciplina_id, area_id,
    iniciado_em: new Date().toISOString(), concluido_em: null,
  });
  atualizarEstado({ qIndice: { ...(obterEstado().qIndice || {}), [s.id]: 0 } });
  location.hash = `#questoes/${s.id}`;
  return s;
}

function tituloDoSimulado(modo, filtros) {
  const estado = obterEstado();
  const nome = MODOS.find((m) => m.id === modo)?.nome || 'Simulado';
  const de = nomeDaDisciplina(estado, filtros.disciplina) || nomeDaArea(estado, filtros.area) || (filtros.tag ? `#${filtros.tag}` : '');
  const dia = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' }).format(new Date()).replace('.', '');
  return `${nome}${de ? ` · ${de}` : ''} · ${dia}`;
}

async function enviarSimulado(form) {
  const estado = obterEstado();
  const modo = form.elements.modo.value;
  const n = Math.max(1, Math.min(50, Number(form.elements.quantidade.value) || 10));
  const filtros = form.dataset.filtrado ? (estado.qFiltros || {}) : {
    disciplina: form.elements.disciplina.value, area: form.elements.area.value, situacao: form.elements.situacao.value,
  };
  let candidatas;
  if (modo === 'revisao') {
    const ids = new Set(revisoesDoDia(estado).map((r) => r.questao_id));
    candidatas = filtrarQuestoes(estado, filtros).filter((q) => ids.has(q.id));
  } else {
    candidatas = filtrarQuestoes(estado, filtros).filter((q) => cabeNoModo(q, modo));
  }
  if (!candidatas.length) {
    mostrarErro(form, modo === 'prova' ? 'Nenhuma questão de múltipla escolha ou V/F com esses filtros.' : 'Nenhuma questão com esses filtros.');
    return;
  }
  fecharFolha();
  await criarSimulado({
    modo, ids: sortear(candidatas, n).map((q) => q.id), titulo: tituloDoSimulado(modo, filtros),
    disciplina_id: filtros.disciplina || null, area_id: filtros.area || null,
  });
}

async function revisarHoje() {
  const ids = revisoesDoDia(obterEstado()).map((r) => r.questao_id);
  if (!ids.length) return;
  await criarSimulado({ modo: 'revisao', ids: [...new Set(ids)], titulo: tituloDoSimulado('revisao', {}) });
}

async function refazerErradas() {
  const s = simuladoAberto();
  if (!s) return;
  const ids = (s.questoes || []).filter((id) => !s.respostas?.[id]?.correta && questaoPeloId(obterEstado(), id));
  if (!ids.length) return;
  await criarSimulado({ modo: s.modo, ids, titulo: `Refazer: ${s.titulo}`.slice(0, 140), disciplina_id: s.disciplina_id, area_id: s.area_id });
}

// ---------------------------------------------------------------------------
// Gerar com a IA
// ---------------------------------------------------------------------------

async function paraPng(arquivo) {
  const bmp = await createImageBitmap(arquivo);
  const escala = Math.min(1, MAX_IMAGEM / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * escala);
  canvas.height = Math.round(bmp.height * escala);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  return new Promise((resolver) => canvas.toBlob(resolver, 'image/png'));
}

async function enviarGerar(form) {
  const estado = obterEstado();
  const el = form.elements;
  const fonte = form.dataset.fonte;
  const disciplina = el.disciplina.value || null;
  const area = el.area.value || null;
  const modo = el.modo.value === 'fixacao' ? 'fixacao' : 'prova';
  const tipos = [...form.querySelectorAll('[name="tipos"]:checked')].map((c) => c.value);
  const pedido = {
    quantidade: Math.max(1, Math.min(20, Number(el.quantidade.value) || 5)),
    dificuldade: el.dificuldade.value,
    modo,
    tipos: tipos.length ? tipos : ['multipla'],
    alternativas: Number(el.alternativas.value) === 5 ? 5 : 4,
    disciplina: nomeDaDisciplina(estado, disciplina) || nomeDaArea(estado, area) || '',
    pesquisar: Boolean(el.pesquisar?.checked),
  };
  const ligado = { disciplina_id: disciplina, area_id: area, modo, tags: [] };
  let arquivo = null;
  let rotulo;
  mostrarErro(form, '');
  try {
    if (fonte === 'tema') {
      const tema = el.tema.value.trim();
      if (tema.length < 3) throw new Error('Escreva o tema.');
      Object.assign(pedido, { fonte: 'tema', tema });
      rotulo = tema;
      ligado.origem = { tipo: 'tema', titulo: tema };
    } else if (fonte === 'artigo') {
      const a = el.artigo && artigoPeloId(estado, el.artigo.value);
      if (!a) throw new Error('Escolha a leitura.');
      Object.assign(pedido, { fonte: 'texto', texto: textoParaQuestoes(a) });
      rotulo = a.titulo;
      ligado.origem = { tipo: 'artigo', id: a.id, titulo: a.titulo };
      ligado.tags = a.tags || [];
    } else if (fonte === 'texto') {
      const texto = el.texto.value.trim();
      if (texto.length < 80) throw new Error('Cole um texto um pouco maior (pelo menos um parágrafo).');
      Object.assign(pedido, { fonte: 'texto', texto: texto.slice(0, 100000) });
      rotulo = `Texto: ${texto.slice(0, 50)}…`;
      ligado.origem = { tipo: 'texto' };
    } else {
      const preset = estado.questoesImagem;
      if (preset?.blob) {
        arquivo = preset.blob;
        rotulo = preset.rotulo || 'Página do caderno';
        ligado.origem = { tipo: 'caderno', id: preset.caderno_id || null, titulo: rotulo };
      } else {
        const foto = el.imagem?.files?.[0];
        if (!foto) throw new Error('Escolha a foto ou a imagem.');
        arquivo = await paraPng(foto);
        rotulo = foto.name || 'Imagem';
        ligado.origem = { tipo: 'imagem', titulo: rotulo };
      }
      Object.assign(pedido, { fonte: 'imagem', pesquisar: false });
    }
    form.querySelector('[type="submit"]').disabled = true;
    await iniciarTrabalho({ tipo: 'questoes', pedido, arquivo, extensao: 'png', rotulo, ligado });
    atualizarEstado({ questoesPreset: null });
    if (estado.questoesImagem?.url) URL.revokeObjectURL(estado.questoesImagem.url);
    atualizarEstado({ questoesImagem: null });
    app.renderizar();
  } catch (erro) {
    mostrarErro(form, erro.message || 'Não deu certo agora.');
    form.querySelector('[type="submit"]').disabled = false;
  }
}

async function salvarGeradas(form) {
  const t = trabalho(form.dataset.id);
  const qs = t?.resultado?.questoes || [];
  const incluir = [...form.querySelectorAll('[name="incluir"]:checked')].map((c) => Number(c.value));
  if (!incluir.length) {
    app.avisoCurto('Marque pelo menos uma questão (ou descarte).');
    return;
  }
  const tags = lerTags(form.elements.tags.value);
  const ids = [];
  for (const i of incluir) {
    const q = qs[i];
    if (!q) continue;
    const salva = await gravar('questoes', 'questoes', {
      tipo: q.tipo, enunciado: q.enunciado, alternativas: q.alternativas || [], resposta_correta: q.resposta_correta,
      explicacao: q.explicacao || null, fontes: q.fontes || [], nivel: q.nivel || 'medio', tags,
      origem: t.ligado?.origem || {}, acertos: 0, erros: 0,
      disciplina_id: t.ligado?.disciplina_id || null, area_id: t.ligado?.area_id || null,
    });
    ids.push(salva.id);
  }
  await encerrarTrabalho(t.id);
  app.avisoCurto(`${ids.length} ${ids.length === 1 ? 'questão salva' : 'questões salvas'} no banco.`);
  if (form.dataset.enviadoPor === 'fazer') {
    const modo = t.ligado?.modo === 'fixacao' ? 'fixacao' : 'prova';
    await criarSimulado({ modo, ids, titulo: `${MODOS.find((m) => m.id === modo).nome} · ${t.rotulo || 'novas questões'}`, disciplina_id: t.ligado?.disciplina_id, area_id: t.ligado?.area_id });
  } else {
    location.hash = '#questoes';
  }
}

// ---------------------------------------------------------------------------
// Banco: escrever e editar à mão
// ---------------------------------------------------------------------------

async function salvarQuestao(form) {
  const el = form.elements;
  const tipo = el.tipo.value;
  const enunciado = el.enunciado.value.trim();
  const alternativas = el.alternativas.value.split('\n').map((l) => l.trim().replace(/^[A-Ea-e][).:-]\s*/, '')).filter(Boolean).slice(0, 5);
  let resposta = el.resposta.value.trim();
  if (!enunciado) return mostrarErro(form, 'Escreva o enunciado.');
  if (tipo === 'multipla') {
    resposta = resposta.charAt(0).toUpperCase();
    if (alternativas.length < 2) return mostrarErro(form, 'Escreva pelo menos duas alternativas, uma por linha.');
    if (LETRAS.indexOf(resposta) < 0 || LETRAS.indexOf(resposta) >= alternativas.length) return mostrarErro(form, `A resposta certa precisa ser uma letra de A a ${LETRAS[alternativas.length - 1]}.`);
  } else if (tipo === 'vf') {
    resposta = /^v/i.test(resposta) ? 'V' : /^f/i.test(resposta) ? 'F' : '';
    if (!resposta) return mostrarErro(form, 'Responda V ou F.');
  } else if (!resposta) return mostrarErro(form, 'Escreva a resposta esperada.');
  const atual = form.dataset.id ? questaoPeloId(obterEstado(), form.dataset.id) : null;
  await gravar('questoes', 'questoes', {
    ...(atual || { acertos: 0, erros: 0, fontes: [], origem: { tipo: 'manual' } }),
    tipo, enunciado, alternativas: tipo === 'multipla' ? alternativas : [], resposta_correta: resposta,
    explicacao: el.explicacao.value.trim() || null, nivel: el.nivel.value, tags: lerTags(el.tags.value),
    disciplina_id: el.disciplina.value || null, area_id: el.area.value || null,
  });
  fecharFolha();
  app.renderizar();
  app.avisoCurto(atual ? 'Questão atualizada.' : 'Questão guardada no banco.');
  return null;
}

// ---------------------------------------------------------------------------

export function cliqueQuestoes(alvo) {
  const acao = alvo.dataset.acao;
  if (!acao?.startsWith('q-')) return false;
  const estado = obterEstado();
  switch (acao) {
    case 'q-visao':
      atualizarEstado({ qVisao: alvo.dataset.valor });
      app.renderizar();
      break;
    case 'q-fonte':
      atualizarEstado({ qFonte: alvo.dataset.valor });
      app.renderizar();
      break;
    case 'q-tirar-imagem':
      if (estado.questoesImagem?.url) URL.revokeObjectURL(estado.questoesImagem.url);
      atualizarEstado({ questoesImagem: null });
      app.renderizar();
      break;
    case 'q-descartar':
      encerrarTrabalho(alvo.dataset.id).then(() => app.renderizar());
      break;
    case 'q-simulado-novo':
      abrirFolha('Fazer simulado', renderFormSimulado(estado, { filtros: alvo.dataset.filtrado ? (estado.qFiltros || {}) : null }));
      break;
    case 'q-revisar':
      revisarHoje();
      break;
    case 'q-nova':
      abrirFolha('Escrever uma questão', renderFormQuestao(estado));
      break;
    case 'q-editar':
      abrirFolha('Editar questão', renderFormQuestao(estado, questaoPeloId(estado, alvo.dataset.id)));
      break;
    case 'q-excluir': {
      const q = questaoPeloId(estado, alvo.dataset.id);
      if (q && window.confirm('Excluir esta questão do banco?')) {
        gravar('questoes', 'questoes', { ...q, excluido_em: new Date().toISOString() }).then(() => {
          app.renderizar();
          app.avisoCurto('Questão excluída.');
        });
      }
      break;
    }
    case 'q-revisar-amanha': {
      const q = questaoPeloId(estado, alvo.dataset.id);
      if (q) {
        gravar('revisoes', 'revisoes', { questao_id: q.id, etapa: 0, proxima_em: somarDias(chaveDia(new Date()), 1), concluida_em: null }).then(() => {
          app.renderizar();
          app.avisoCurto('Ela entra na revisão de amanhã.');
        });
      }
      break;
    }
    case 'q-responder':
      responder(alvo.dataset.valor);
      break;
    case 'q-autoavaliar':
      autoavaliar(alvo.dataset.valor === '1');
      break;
    case 'q-ir': {
      const s = simuladoAberto();
      if (s) {
        const { indice, questoes } = questaoAtual(s);
        irPara(s, Math.max(0, Math.min(questoes.length - 1, indice + Number(alvo.dataset.passo))));
      }
      break;
    }
    case 'q-ir-para': {
      const s = simuladoAberto();
      if (s) irPara(s, Number(alvo.dataset.valor));
      break;
    }
    case 'q-terminar':
      terminar();
      break;
    case 'q-refazer-erradas':
      refazerErradas();
      break;
    case 'q-abandonar': {
      const s = simuladoAberto();
      if (s && window.confirm('Desistir deste simulado? As respostas dele não entram na sua nota.')) {
        gravar('simulados', 'simulados', { ...s, excluido_em: new Date().toISOString() }).then(() => {
          location.hash = '#questoes';
        });
      }
      break;
    }
    default:
      return false;
  }
  return true;
}

export function mudancaQuestoes(alvo, tipo) {
  if (alvo.dataset?.filtrarLista === 'q-lista') {
    atualizarEstado({ qFiltros: { ...(obterEstado().qFiltros || {}), busca: alvo.value } });
    filtrarListaNaTela('q-lista', alvo.value);
    return true;
  }
  if (alvo.dataset?.acaoMudar === 'q-filtro') {
    if (tipo === 'change') {
      atualizarEstado({ qFiltros: { ...(obterEstado().qFiltros || {}), [alvo.dataset.campo]: alvo.value } });
      app.renderizar();
    }
    return true;
  }
  if (alvo.name === 'resposta' && alvo.closest('[data-form="q-dissertativa"]')) {
    const id = alvo.closest('form').dataset.id;
    atualizarEstado({ qRascunho: { ...(obterEstado().qRascunho || {}), [id]: alvo.value } });
    return true;
  }
  if (alvo.name === 'modo' && alvo.closest('[data-form="q-gerar"]')) {
    const prova = alvo.value === 'prova';
    alvo.closest('form').querySelector('[data-so-prova]').hidden = !prova;
    return true;
  }
  return false;
}

export function filtrarListaNaTela(idLista, valor) {
  const termo = String(valor || '').trim().toLowerCase();
  let visiveis = 0;
  document.querySelectorAll(`#${idLista} > li`).forEach((li) => {
    const mostra = !termo || String(li.dataset.busca || '').includes(termo);
    li.hidden = !mostra;
    if (mostra) visiveis += 1;
  });
  const vazio = document.querySelector(`[data-lista-vazia="${idLista}"]`);
  if (vazio) vazio.hidden = visiveis > 0;
}

export function enviarQuestoes(form) {
  switch (form.dataset.form) {
    case 'q-gerar': enviarGerar(form); break;
    case 'q-salvar-geradas': salvarGeradas(form); break;
    case 'q-simulado': enviarSimulado(form); break;
    case 'q-dissertativa': enviarDissertativa(form); break;
    case 'q-editar': salvarQuestao(form); break;
    default: return false;
  }
  return true;
}
