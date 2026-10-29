// Ritual de leitura (minutos lidos, meta) e Retrospectiva do mês (formulário e metas).

import { obterEstado, atualizarEstado } from './estado.js';
import { listar, salvar } from './persistencia.js';
import { gravar } from './gravacao.js';
import { leituraDe, podarDias, OPCOES_META_LEITURA } from './dados-leitura.js';
import { numerosDoMes, novaRetrospectiva, metaDaIntencao, retrospectivasDe } from './dados-retrospectiva.js';
import { dataLocal } from './views-dia.js';
import { celebrar } from './celebracao.js';
import { confirmar } from './confirmar.js';

let app; // { renderizar, avisoCurto }

export function ligarRituais(funcoes) {
  app = funcoes;
}

async function mudarConfig(chave, padrao, fn) {
  const atual = (await listar('config', { incluirExcluidos: true })).find((c) => c.chave === chave);
  const valor = { ...padrao, ...(atual?.excluido_em ? {} : atual?.valor || {}) };
  fn(valor);
  await salvar('config', { ...(atual || {}), excluido_em: null, chave, valor });
  atualizarEstado({ config: await listar('config') });
}

// Chamado pelo leitor: soma minutos lidos no dia (fração de minuto também vale).
let fila = Promise.resolve();
export function registrarLeitura(minutos, dia = dataLocal()) {
  if (!(minutos > 0)) return fila;
  fila = fila.then(() => mudarConfig('leitura', { dias: {} }, (v) => {
    v.dias = podarDias(v.dias, dia);
    v.dias[dia] = Math.round(((Number(v.dias[dia]) || 0) + minutos) * 10) / 10;
  })).catch(() => {});
  return fila;
}

export function mudancaRituais(alvo) {
  if (alvo.dataset.acaoMudar !== 'leitura-meta') return false;
  const meta = Number(alvo.value);
  if (!OPCOES_META_LEITURA.includes(meta)) return true;
  mudarConfig('leitura', { dias: {} }, (v) => { v.metaMin = meta; }).then(() => app.avisoCurto(`Meta de leitura: ${meta} min por dia.`));
  return true;
}

export function cliqueRituais(alvo) {
  if (alvo.dataset.acao !== 'retro-refazer') return false;
  const mes = alvo.dataset.mes;
  confirmar('Refazer a retrospectiva? O que você escreveu neste mês some; as metas que ela criou ficam.', { botao: 'Refazer', perigo: true }).then((ok) => {
    if (!ok) return;
    mudarConfig('retrospectivas', { lista: [] }, (v) => { v.lista = (v.lista || []).filter((r) => r.mes !== mes); }).then(() => app.renderizar());
  });
  return true;
}

export function enviarRituais(form) {
  if (form.dataset.form !== 'retrospectiva') return false;
  const f = new FormData(form);
  const mes = form.dataset.mes;
  const estado = obterEstado();
  const r = novaRetrospectiva({
    mes, numeros: numerosDoMes(estado, mes, dataLocal()),
    respostas: Object.fromEntries(['funcionou', 'pesou', 'largar'].map((k) => [k, f.get(k)])),
    intencoes: [f.get('intencao1'), f.get('intencao2'), f.get('intencao3')],
  });
  (async () => {
    for (const texto of r.intencoes) await gravar('metas', 'metas', metaDaIntencao(texto, mes));
    await mudarConfig('retrospectivas', { lista: [] }, (v) => { v.lista = [...(v.lista || []).filter((x) => x.mes !== mes), r].slice(-36); });
    app.renderizar();
    celebrar('🌙', 'Mês fechado', r.intencoes.length ? `${r.intencoes.length} ${r.intencoes.length === 1 ? 'intenção virou meta' : 'intenções viraram metas'}.` : 'Obrigada por parar dez minutos.');
  })();
  return true;
}

export const jaFezRetrospectiva = (estado, mes) => retrospectivasDe(estado.config).some((r) => r.mes === mes);
