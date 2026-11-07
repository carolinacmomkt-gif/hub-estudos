// Ações do Radar do nicho: criar e editar nichos, atualizar (chama a radar-background e acompanha
// a linha da config até chegar o resultado), atualizar sozinho quando o da semana está velho e
// levar um item para o Criar.

import { obterEstado, atualizarEstado } from './estado.js';
import { listar, salvar, puxarTabela } from './persistencia.js';
import { dispararSegundoPlano } from './funcoes.js';
import { confirmar } from './confirmar.js';
import { FORMATOS } from './dados-trabalho.js';
import { nichosDoRadar, sugerirNichos, conferirNicho, idDoNicho, radarVelho } from './dados-radar.js';
import { resultadoDoRadar } from './views-radar.js';

let app; // { renderizar, avisoCurto }
const pedidos = new Map(); // nicho → quando pediu (para acompanhar)
const jaAtualizados = new Set(); // atualização automática: uma vez por nicho em cada abertura do app

export function ligarRadar(funcoes) {
  app = funcoes;
}

async function gravarNichos(fn) {
  const atual = (await listar('config', { incluirExcluidos: true })).find((c) => c.chave === 'radar');
  const valor = { ...(atual?.excluido_em ? {} : atual?.valor || {}) };
  valor.nichos = fn(nichosDoRadar([{ chave: 'radar', valor }]));
  await salvar('config', { ...(atual || {}), excluido_em: null, chave: 'radar', valor });
  atualizarEstado({ config: await listar('config') });
}

function marcarPedido(id, ligado) {
  if (ligado) pedidos.set(id, Date.now()); else pedidos.delete(id);
  atualizarEstado({ radarPedido: Object.fromEntries(pedidos) });
}

export async function atualizarRadar(id, { silencioso = false } = {}) {
  if (pedidos.has(id)) return;
  if (!navigator.onLine) { if (!silencioso) app.avisoCurto('Sem internet agora. O radar precisa de conexão.'); return; }
  marcarPedido(id, true);
  app.renderizar();
  const nicho = nichosDoRadar(obterEstado().config).find((n) => n.id === id);
  if (!nicho) { marcarPedido(id, false); return; }
  const r = await dispararSegundoPlano('radar-background', { nicho });
  if (!r.ok) {
    marcarPedido(id, false);
    app.renderizar();
    if (!silencioso) app.avisoCurto(r.erro || 'Não consegui pedir o radar agora.');
    return;
  }
  acompanhar(id);
}

// Puxa a config a cada 4 s até a função gravar o resultado (no máximo 4 minutos).
async function acompanhar(id) {
  const desde = pedidos.get(id);
  const fim = desde + 4 * 60e3;
  while (Date.now() < fim && pedidos.has(id)) {
    await new Promise((ok) => { setTimeout(ok, 4000); });
    await puxarTabela('config').catch(() => {});
    atualizarEstado({ config: await listar('config') });
    const v = resultadoDoRadar(obterEstado(), id);
    const terminou = v && v.status !== 'lendo' && Date.parse(v.gerado_em || v.pedido_em || 0) >= desde - 1000;
    if (terminou || (v?.status === 'erro' && Date.parse(v.pedido_em || 0) >= desde - 1000)) {
      marcarPedido(id, false);
      app.renderizar();
      if (v.status === 'erro') app.avisoCurto(v.erro || 'O radar não ficou pronto.');
      else if (obterEstado().rota !== 'radar') app.avisoCurto('O radar do nicho ficou pronto.');
      return;
    }
  }
  if (pedidos.has(id)) {
    marcarPedido(id, false);
    app.renderizar();
    app.avisoCurto('O radar está demorando. Ele aparece aqui quando ficar pronto.');
  }
}

// Ao abrir um nicho: se o radar é de antes desta segunda (ou tem mais de 3 dias), atualiza sozinho.
export function montarRadar(parametro) {
  const estado = obterEstado();
  const nichos = nichosDoRadar(estado.config);
  const nicho = nichos.find((n) => n.id === parametro) || (!parametro ? nichos[0] : null);
  if (!nicho || jaAtualizados.has(nicho.id) || pedidos.has(nicho.id)) return;
  const r = resultadoDoRadar(estado, nicho.id);
  if (r?.status === 'lendo' && Date.now() - Date.parse(r.pedido_em || 0) < 5 * 60e3) return;
  jaAtualizados.add(nicho.id);
  if (radarVelho(r)) atualizarRadar(nicho.id, { silencioso: true });
}

const FORMATO_DO_CRIAR = { reels: 'Reels falado', carrossel: 'Carrossel de conteúdo', stories: 'Stories de venda', post: 'Legenda' };

function levarParaCriar(id, i) {
  const estado = obterEstado();
  const x = resultadoDoRadar(estado, id)?.itens?.[i];
  if (!x) return;
  const clientes = (estado.clientesTrabalho || []).filter((c) => !c.excluido_em);
  const cliente = clientes.find((c) => x.serve_para?.includes(c.nome))
    || clientes.find((c) => nichosDoRadar(estado.config).find((n) => n.id === id)?.clientes.includes(c.nome));
  const formato = FORMATO_DO_CRIAR[String(x.formato || '').toLowerCase().split(' ')[0]] || FORMATOS[0];
  const tema = [x.tema, x.gancho ? `Gancho: ${x.gancho}` : '', x.porque ? `Por que agora: ${x.porque}` : ''].filter(Boolean).join('\n');
  atualizarEstado({ criar: { cliente: cliente?.chave || '', formato, objetivo: 'Educação', tema, titulo: x.tema, texto: '' }, criarStatus: '' });
  location.hash = '#criar';
}

async function salvarNicho(form) {
  const erro = form.querySelector('[data-erro]');
  const el = form.elements;
  const antigo = form.dataset.id || '';
  const nicho = conferirNicho({ id: antigo || idDoNicho(el.nome.value), nome: el.nome.value, palavras: el.palavras.value, clientes: [...form.querySelectorAll('[name="clientes"]:checked')].map((c) => c.value) });
  if (!nicho.nome) { erro.textContent = 'Dê um nome ao nicho.'; erro.hidden = false; return; }
  let id = nicho.id;
  await gravarNichos((lista) => {
    if (!antigo) {
      while (lista.some((n) => n.id === id)) id = `${nicho.id}-${Math.random().toString(36).slice(2, 5)}`;
      return [...lista, { ...nicho, id }];
    }
    return lista.map((n) => (n.id === antigo ? { ...nicho, id: antigo } : n));
  });
  location.hash = `#radar/${id}`;
  if (!antigo) atualizarRadar(id);
  else app.avisoCurto('Nicho salvo. Toque em Atualizar para buscar com as palavras novas.');
}

export function cliqueRadar(alvo) {
  switch (alvo.dataset.acao) {
    case 'radar-atualizar': atualizarRadar(alvo.dataset.id); return true;
    case 'radar-aba': location.hash = `#radar/${alvo.dataset.id}`; return true;
    case 'radar-criar': levarParaCriar(alvo.dataset.id, Number(alvo.dataset.i)); return true;
    case 'radar-sugestao':
    case 'radar-sugestoes-todas': {
      const estado = obterEstado();
      const ja = nichosDoRadar(estado.config);
      const todas = sugerirNichos((estado.clientesTrabalho || []).filter((c) => !c.excluido_em), ja);
      const escolhidas = alvo.dataset.acao === 'radar-sugestao' ? [todas[Number(alvo.dataset.i)]].filter(Boolean) : todas;
      if (!escolhidas.length) return true;
      gravarNichos((lista) => [...lista, ...escolhidas]).then(() => {
        location.hash = `#radar/${escolhidas[0].id}`;
        escolhidas.forEach((n) => atualizarRadar(n.id, { silencioso: true }));
      });
      return true;
    }
    case 'radar-excluir':
      confirmar('Excluir este nicho? O radar dele some junto. As clientes e o resto do Trabalho não mudam.', { perigo: true }).then(async (ok) => {
        if (!ok) return;
        const id = alvo.dataset.id;
        await gravarNichos((lista) => lista.filter((n) => n.id !== id));
        const linha = (await listar('config')).find((c) => c.chave === `radar:${id}`);
        if (linha) await salvar('config', { ...linha, excluido_em: new Date().toISOString() });
        location.hash = '#radar';
        app.avisoCurto('Nicho excluído.');
      });
      return true;
    default:
      return false;
  }
}

export function enviarRadar(form) {
  if (form.dataset.form !== 'radar-nicho') return false;
  salvarNicho(form);
  return true;
}
