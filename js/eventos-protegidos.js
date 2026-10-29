// Cliques e formulários dos blocos protegidos (Configurações) e do dia leve (Hoje).

import { obterEstado, atualizarEstado } from './estado.js';
import { listar, salvar } from './persistencia.js';
import { gravar } from './gravacao.js';
import { novoProtegido, ehValido, protegidosDe, SUGESTOES_PROTEGIDOS, paraMin } from './dados-protegidos.js';
import { diaLeveDe, tarefasParaAmanha } from './dados-dialeve.js';
import { somarDias } from './dados-tarefas.js';
import { dataLocal } from './views-dia.js';
import { confirmar } from './confirmar.js';

let app; // { renderizar, avisoCurto }

export function ligarProtegidos(funcoes) {
  app = funcoes;
}

async function mudarConfig(chave, padrao, fn) {
  const atual = (await listar('config', { incluirExcluidos: true })).find((c) => c.chave === chave);
  const valor = { ...padrao, ...(atual?.valor || {}) };
  fn(valor);
  await salvar('config', { ...(atual || {}), excluido_em: null, chave, valor });
  atualizarEstado({ config: await listar('config') });
}

const mudarProtegidos = (fn) => mudarConfig('protegidos', { lista: [] }, (v) => { v.lista = Array.isArray(v.lista) ? v.lista : []; fn(v); });
const mudarDiaLeve = (fn) => mudarConfig('dia_leve', { data: null, movidas: [], historico: [] }, fn);

export function cliqueProtegidos(alvo) {
  const { acao, id } = alvo.dataset;
  switch (acao) {
    case 'protegido-remover': {
      const b = protegidosDe(obterEstado().config).find((x) => x.id === id);
      mudarProtegidos((v) => { v.lista = v.lista.filter((x) => x.id !== id); }).then(() => {
        app.renderizar();
        if (b) app.avisoCurto(`"${b.nome}" deixou de ser protegido.`, { rotulo: 'Desfazer', fn: () => mudarProtegidos((v) => { v.lista.push(b); }).then(() => app.renderizar()) });
      });
      return true;
    }
    case 'protegido-sugestao': {
      const s = SUGESTOES_PROTEGIDOS.find((x) => x.nome === alvo.dataset.nome);
      if (!s) return true;
      mudarProtegidos((v) => { v.lista.push(novoProtegido(s)); }).then(() => { app.renderizar(); app.avisoCurto(`${s.emoji} ${s.nome} protegido.`); });
      return true;
    }
    case 'dialeve-entrar':
      entrarNoDiaLeve();
      return true;
    case 'dialeve-sair':
      mudarDiaLeve((v) => { v.data = null; v.movidas = []; }).then(() => { app.renderizar(); app.avisoCurto('Dia normal de volta. As tarefas que foram para amanhã continuam lá.'); });
      return true;
    default:
      return false;
  }
}

export function enviarProtegidos(form) {
  if (form.dataset.form !== 'protegido') return false;
  const f = new FormData(form);
  const erro = form.querySelector('[data-erro]');
  const b = novoProtegido({ nome: f.get('nome'), emoji: f.get('emoji'), dias: f.getAll('dias'), inicio: f.get('inicio'), fim: f.get('fim') });
  if (!b.nome) { erro.textContent = 'Dê um nome (ex.: Academia).'; erro.hidden = false; return true; }
  if (!b.dias.length) { erro.textContent = 'Marque pelo menos um dia.'; erro.hidden = false; return true; }
  if (!ehValido(b)) { erro.textContent = 'O fim precisa vir depois do começo.'; erro.hidden = false; return true; }
  if (paraMin(b.fim) - paraMin(b.inicio) > 16 * 60) { erro.textContent = 'Um bloco de até 16 horas. Para o dia todo, use dois.'; erro.hidden = false; return true; }
  erro.hidden = true;
  mudarProtegidos((v) => { v.lista.push(b); }).then(() => { app.renderizar(); app.avisoCurto(`${b.emoji || '🔒'} ${b.nome} protegido.`); });
  return true;
}

// Entrar no dia leve: as tarefas de hoje sem hora vão para amanhã (com Desfazer) e o Hoje encolhe.
async function entrarNoDiaLeve() {
  const estado = obterEstado();
  const hoje = dataLocal();
  const mover = tarefasParaAmanha(estado.tarefas, hoje);
  const texto = mover.length
    ? `Deixar o dia leve? ${mover.length} ${mover.length === 1 ? 'tarefa sem hora vai' : 'tarefas sem hora vão'} para amanhã; ficam só compromissos, prazos e contas de hoje. Dá para desfazer.`
    : 'Deixar o dia leve? Ficam só compromissos, prazos e contas de hoje; o resto para de te cobrar.';
  const ok = await confirmar(texto, { titulo: 'Dia leve', botao: 'Deixar leve', perigo: false });
  if (!ok) return;
  const amanha = somarDias(hoje, 1);
  const movidas = [];
  for (const t of mover) {
    movidas.push({ id: t.id, data: t.data });
    await gravar('tarefas', 'tarefas', { ...t, data: amanha });
  }
  await mudarDiaLeve((v) => { v.data = hoje; v.movidas = movidas; v.historico = [...new Set([...(v.historico || []), hoje])].slice(-90); });
  app.renderizar();
  app.avisoCurto(`Dia leve. ${movidas.length ? `${movidas.length} para amanhã.` : ''}`, movidas.length ? {
    rotulo: 'Desfazer',
    fn: async () => {
      for (const m of movidas) {
        const t = (obterEstado().tarefas || []).find((x) => x.id === m.id);
        if (t) await gravar('tarefas', 'tarefas', { ...t, data: m.data });
      }
      await mudarDiaLeve((v) => { v.movidas = []; });
      app.renderizar();
    },
  } : undefined);
}

export const diaLeveHoje = (estado) => diaLeveDe(estado.config).data === dataLocal();
