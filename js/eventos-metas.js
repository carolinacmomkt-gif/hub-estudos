// Cliques e formulários de Metas e lazer (quadro dos sonhos, metas, lazer, trilha do Spotify).

import { obterEstado, atualizarEstado } from './estado.js';
import { gravar } from './gravacao.js';
import { listar, salvar } from './persistencia.js';
import { lerLazer, sortearLazer, spotifyEmbed, TIPOS_LAZER } from './dados-metas.js';
import { formMeta, detalheMeta, formLazer } from './views-metas.js';
import { reduzirImagem, carregarThumbsDaTela, apagarThumb, guardarImagemLocal } from './thumbs-youtube.js';
import { enviarArquivo, idDaUsuaria } from './nuvem.js';
import { recompensasDe, RECOMPENSAS_PADRAO } from './dados-recompensas.js';
import { celebrar } from './celebracao.js';

let app; // { renderizar, avisoCurto }
let fotoEscolhida = null; // arquivo da foto do formulário aberto

export function ligarMetas(funcoes) {
  app = funcoes;
  // Fotos dos sonhos: carregam depois de cada desenho da tela (no quadro e no Hoje).
  new MutationObserver(() => {
    if (['metas', 'inicio'].includes(obterEstado().rota)) carregarThumbsDaTela();
  }).observe(document.getElementById('conteudo'), { childList: true });
}

const meta = (id) => (obterEstado().metas || []).find((m) => m.id === id);
const itemLazer = (id) => (obterEstado().lazer || []).find((l) => l.id === id);
const salvarMeta = (dados) => gravar('metas', 'metas', dados);
const salvarLazer = (dados) => gravar('lazer', 'lazer', dados);
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function abrirFolha(titulo, html) {
  document.getElementById('folha-criar')?.close();
  document.getElementById('folha-evento-titulo').textContent = titulo;
  const caixa = document.getElementById('folha-evento-conteudo');
  caixa.innerHTML = html;
  carregarThumbsDaTela(caixa);
  const folha = document.getElementById('folha-evento');
  if (!folha.open) folha.showModal();
}
const fecharFolha = () => document.getElementById('folha-evento')?.close();

function erro(form, texto) {
  const caixa = form.querySelector('[data-erro]');
  caixa.textContent = texto;
  caixa.hidden = false;
  return true;
}

async function mudarPrefs(fn) {
  const atual = (await listar('config')).find((c) => c.chave === 'metas');
  const valor = { ...(atual?.valor || {}) };
  fn(valor);
  await salvar('config', { ...(atual || {}), chave: 'metas', valor });
  atualizarEstado({ config: await listar('config') });
}

function abrirFormMeta(m = {}) {
  fotoEscolhida = null;
  abrirFolha(m.id ? 'Editar' : 'Novo sonho ou meta', formMeta(m, obterEstado()));
}

async function enviarFoto(metaId, arquivo) {
  if (!/^image\//.test(arquivo.type || '')) throw new Error('Escolha uma imagem (JPG, PNG ou WebP).');
  const usuaria = idDaUsuaria();
  if (!usuaria) throw new Error('Entre no app para colocar fotos.');
  const blob = await reduzirImagem(arquivo);
  const caminho = `${usuaria}/sonhos/${metaId}/${crypto.randomUUID()}.jpg`;
  await enviarArquivo(caminho, new File([blob], 'sonho.jpg', { type: 'image/jpeg' }));
  guardarImagemLocal(caminho, blob);
  return caminho;
}

// Pontos de uma recompensa a partir do custo: cerca de 2 pontos por real, de 10 em 10, no mínimo 50.
const pontosDoCusto = (custo) => Math.max(50, Math.round((Number(custo) * 2) / 10) * 10);

async function virarRecompensa(l) {
  const atual = (await listar('config')).find((c) => c.chave === 'recompensas');
  const v = atual?.valor || {};
  const itens = Array.isArray(v.itens) ? [...v.itens] : RECOMPENSAS_PADRAO.map((r) => ({ ...r }));
  if (recompensasDe(obterEstado().config).itens.some((r) => r.lazer_id === l.id)) {
    app.avisoCurto('Isso já está nas suas recompensas.');
    return;
  }
  const t = TIPOS_LAZER.find((x) => x.id === l.tipo);
  const custo = pontosDoCusto(l.dados?.custo);
  itens.push({ id: crypto.randomUUID(), emoji: t?.emoji || '🎁', nome: l.titulo.slice(0, 60), custo, valor: Number(l.dados?.custo) || 0, lazer_id: l.id });
  await salvar('config', { ...(atual || {}), chave: 'recompensas', valor: { ...v, itens, resgates: Array.isArray(v.resgates) ? v.resgates : [] } });
  atualizarEstado({ config: await listar('config') });
  fecharFolha();
  app.renderizar();
  app.avisoCurto(`${l.titulo} virou recompensa de ${custo} pontos.`, { rotulo: 'Ver', fn: () => { location.hash = '#financas/recompensas'; } });
}

export function cliqueMetas(alvo) {
  const { acao, id } = alvo.dataset;
  if (!acao || !(acao.startsWith('meta-') || acao.startsWith('metas-') || acao.startsWith('lazer-'))) return false;
  switch (acao) {
    case 'meta-nova':
      abrirFormMeta();
      break;
    case 'meta-abrir': {
      const m = meta(id);
      if (m) abrirFolha(m.titulo, detalheMeta(m, obterEstado()));
      break;
    }
    case 'meta-editar': {
      const m = meta(id);
      if (m) abrirFormMeta(m);
      break;
    }
    case 'meta-realizar': {
      const m = meta(id);
      if (!m) break;
      salvarMeta({ ...m, status: 'realizada', dados: { ...(m.dados || {}), realizada_em: new Date().toISOString() } }).then(() => {
        fecharFolha();
        app.renderizar();
        celebrar('✦', 'Sonho realizado!', m.titulo);
      });
      break;
    }
    case 'meta-reabrir': {
      const m = meta(id);
      if (!m) break;
      const { realizada_em, ...resto } = m.dados || {};
      salvarMeta({ ...m, status: 'ativa', dados: resto }).then(() => {
        fecharFolha();
        app.renderizar();
      });
      break;
    }
    case 'meta-excluir': {
      const m = meta(id);
      if (!m) break;
      salvarMeta({ ...m, excluido_em: new Date().toISOString() }).then(() => {
        fecharFolha();
        app.renderizar();
        app.avisoCurto(`${m.titulo} saiu do quadro.`, {
          rotulo: 'Desfazer',
          fn: async () => {
            await salvarMeta({ ...meta(id), excluido_em: null });
            app.renderizar();
          },
        });
      });
      break;
    }
    case 'metas-jeito':
      mudarPrefs((v) => { v.jeito = alvo.dataset.valor; }).then(() => app.renderizar());
      break;
    case 'metas-spotify-trocar':
      mudarPrefs((v) => { v.spotify = ''; }).then(() => app.renderizar());
      break;
    case 'lazer-ver':
      atualizarEstado({ statusLazer: alvo.dataset.valor });
      app.renderizar();
      break;
    case 'lazer-filtro':
      atualizarEstado({ filtroLazer: alvo.dataset.valor });
      app.renderizar();
      break;
    case 'lazer-editar': {
      const l = itemLazer(id);
      if (l) abrirFolha(l.titulo, formLazer(l));
      break;
    }
    case 'lazer-status': {
      const l = itemLazer(id);
      if (!l) break;
      const valor = alvo.dataset.valor;
      alvo.closest('.lazer-item')?.classList.add('marcando');
      navigator.vibrate?.(valor === 'feito' ? 18 : 8);
      salvarLazer({ ...l, status: valor, data: valor === 'feito' ? hoje() : l.data }).then(() => {
        app.renderizar();
        if (valor === 'feito') {
          app.avisoCurto(`${l.titulo}: feito! Quer dar uma nota?`, { rotulo: 'Dar nota', fn: () => abrirFolha(l.titulo, formLazer(itemLazer(id))) });
        }
      });
      break;
    }
    case 'lazer-sortear': {
      const s = sortearLazer(obterEstado().lazer, obterEstado().filtroLazer || '');
      if (!s) {
        app.avisoCurto('Anote algumas ideias em "Quero" para sortear.');
        break;
      }
      const t = TIPOS_LAZER.find((x) => x.id === s.tipo);
      celebrar('🎲', s.titulo, `${t?.emoji || ''} ${t?.nome || ''}`.trim());
      break;
    }
    case 'lazer-recompensa': {
      const l = itemLazer(id);
      if (l) virarRecompensa(l);
      break;
    }
    case 'lazer-excluir': {
      const l = itemLazer(id);
      if (!l) break;
      salvarLazer({ ...l, excluido_em: new Date().toISOString() }).then(() => {
        fecharFolha();
        app.renderizar();
        app.avisoCurto(`${l.titulo} excluído.`, {
          rotulo: 'Desfazer',
          fn: async () => {
            await salvarLazer({ ...itemLazer(id), excluido_em: null });
            app.renderizar();
          },
        });
      });
      break;
    }
    default:
      return false;
  }
  return true;
}

export function mudancaMetas(alvo, tipo) {
  const acao = alvo.dataset?.acaoMudar;
  if (!['meta-foto', 'meta-ligacao', 'meta-marco'].includes(acao)) return false;
  if (tipo !== 'change') return true;
  if (acao === 'meta-ligacao') {
    const form = alvo.closest('form');
    const v = alvo.value;
    form.querySelectorAll('[data-lig]').forEach((el) => {
      el.hidden = el.dataset.lig === 'alvo' ? !['habito', 'lazer', 'manual'].includes(v) : el.dataset.lig !== v;
    });
  } else if (acao === 'meta-foto') {
    fotoEscolhida = alvo.files?.[0] || null;
    const caixa = alvo.closest('.meta-foto');
    caixa.querySelector('[data-foto-nome]').textContent = fotoEscolhida ? fotoEscolhida.name : '';
    if (fotoEscolhida) {
      let img = caixa.querySelector('img');
      if (!img) {
        img = document.createElement('img');
        img.alt = 'Foto do sonho';
        caixa.prepend(img);
      }
      img.removeAttribute('data-thumb');
      img.src = URL.createObjectURL(fotoEscolhida);
    }
  } else {
    const m = meta(alvo.dataset.id);
    if (!m) return true;
    const marcos = (m.dados?.marcos || []).map((x, i) => (i === Number(alvo.dataset.indice) ? { ...x, feito: alvo.checked } : x));
    navigator.vibrate?.(alvo.checked ? 12 : 6);
    salvarMeta({ ...m, dados: { ...m.dados, marcos } }).then(() => {
      app.renderizar();
      if (marcos.length && marcos.every((x) => x.feito)) celebrar('🏁', 'Todas as etapas feitas!', m.titulo);
    });
  }
  return true;
}

function enviarMeta(form) {
  const f = new FormData(form);
  const titulo = String(f.get('titulo') || '').trim();
  if (!titulo) return erro(form, 'Dê um nome ao sonho.');
  const tipo = f.get('ligacao') || 'nenhuma';
  const atual = form.dataset.id ? meta(form.dataset.id) : null;
  const ligacao = { tipo };
  if (['caixinha', 'habito', 'projeto'].includes(tipo)) {
    ligacao.id = f.get(tipo);
    if (!ligacao.id) return erro(form, 'Escolha com o que ligar.');
  }
  if (tipo === 'lazer') ligacao.lazerTipo = f.get('lazerTipo') || '';
  const alvoNum = Number(f.get('alvo'));
  if (tipo === 'manual' && !(alvoNum > 0)) return erro(form, 'Diga quanto quer alcançar.');
  const antigos = atual?.dados?.marcos || [];
  const marcos = tipo === 'marcos' ? String(f.get('marcos') || '').split('\n').map((t) => t.trim()).filter(Boolean).slice(0, 30)
    .map((texto) => ({ texto, feito: antigos.find((x) => x.texto === texto)?.feito || false })) : antigos;
  if (tipo === 'marcos' && !marcos.length) return erro(form, 'Escreva pelo menos uma etapa.');
  const id = atual?.id || crypto.randomUUID();
  const foto = fotoEscolhida;
  const botao = form.querySelector('[type="submit"]');
  botao.disabled = true;
  (async () => {
    let imagem = atual?.dados?.imagem || null;
    if (foto) {
      try {
        const nova = await enviarFoto(id, foto);
        if (imagem) apagarThumb(imagem).catch(() => {});
        imagem = nova;
      } catch (e) {
        botao.disabled = false;
        erro(form, e.message || 'Não deu para enviar a foto agora.');
        return;
      }
    }
    const cores = (obterEstado().metas || []).length;
    await salvarMeta({
      ...(atual || { id, status: 'ativa' }),
      titulo: titulo.slice(0, 80), area: f.get('area') || null, prazo: f.get('prazo') || null,
      alvo: ['habito', 'lazer', 'manual'].includes(tipo) && alvoNum > 0 ? alvoNum : tipo === 'caixinha' ? atual?.alvo ?? null : null,
      unidade: String(f.get('unidade') || '').trim().slice(0, 20) || null,
      dados: {
        ...(atual?.dados || { inicio: hoje(), cor: (cores % 6) + 1 }), ligacao, marcos, imagem, tamanho: f.get('tamanho') || 'm',
      },
    });
    fotoEscolhida = null;
    fecharFolha();
    app.renderizar();
    if (!atual) app.avisoCurto('✨ No quadro. Que venha!');
  })();
  return true;
}

export function enviarMetas(form) {
  const tipo = form.dataset.form;
  if (tipo === 'meta') return enviarMeta(form);
  if (tipo === 'meta-atual') {
    const m = meta(form.dataset.id);
    const valor = Number(new FormData(form).get('atual'));
    if (!m || !Number.isFinite(valor)) return true;
    const chegou = (Number(m.atual) || 0) < m.alvo && valor >= m.alvo;
    salvarMeta({ ...m, atual: valor }).then(() => {
      app.renderizar();
      document.getElementById('folha-evento-conteudo').innerHTML = detalheMeta(meta(m.id), obterEstado());
      carregarThumbsDaTela(document.getElementById('folha-evento-conteudo'));
      if (chegou) celebrar('🎯', 'Meta alcançada!', m.titulo);
    });
    return true;
  }
  if (tipo === 'metas-spotify') {
    const link = String(new FormData(form).get('link') || '').trim();
    if (!spotifyEmbed(link)) return erro(form, 'Cole um link do Spotify (playlist, álbum ou música).');
    mudarPrefs((v) => { v.spotify = link; }).then(() => app.renderizar());
    return true;
  }
  if (tipo === 'lazer-rapido') {
    const campo = form.querySelector('input[name="texto"]');
    const l = lerLazer(campo.value);
    if (!l.titulo) return true;
    campo.value = '';
    salvarLazer({ tipo: l.tipo, titulo: l.titulo.slice(0, 120), status: 'quero', dados: l.custo ? { custo: l.custo } : {} }).then(() => {
      atualizarEstado({ statusLazer: 'quero' });
      app.renderizar();
      document.getElementById('lazer-rapido')?.focus();
    });
    return true;
  }
  if (tipo === 'lazer') {
    const f = new FormData(form);
    const titulo = String(f.get('titulo') || '').trim();
    if (!titulo) return erro(form, 'Escreva o que é.');
    const atual = form.dataset.id ? itemLazer(form.dataset.id) : null;
    const status = f.get('status') || 'quero';
    const nota = Math.round(Number(f.get('nota')));
    const custo = Number(f.get('custo'));
    salvarLazer({
      ...(atual || {}), titulo: titulo.slice(0, 120), tipo: f.get('tipo') || 'outro', status,
      nota: nota >= 1 && nota <= 5 ? nota : null,
      data: status === 'feito' ? atual?.data || hoje() : atual?.data || null,
      dados: { ...(atual?.dados || {}), custo: custo > 0 ? custo : null, notas: String(f.get('notas') || '').trim().slice(0, 1000) || null },
    }).then(() => {
      fecharFolha();
      app.renderizar();
    });
    return true;
  }
  return false;
}
