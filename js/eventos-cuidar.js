// Cliques e formulários de Cuidar de mim, Lista de desejos e Pessoas (Meu cantinho, parte 2).

import { obterEstado, atualizarEstado } from './estado.js';
import { listar, salvar } from './persistencia.js';
import { gravar } from './gravacao.js';
import { SUGESTOES } from './dados-habitos.js';
import { definirValorDoHabito } from './eventos-habitos.js';
import { dataLocal } from './views-dia.js';
import { instanteLocal } from './dados-calendario.js';
import {
  novoRemedio, marcarDose, novaConsulta, novoExame, novoPassoPele, marcarPele, lerCiclo, gravarCiclo, horasDe,
} from './dados-cuidar.js';
import { novoDesejoDaLista } from './dados-desejos.js';
import { novaPessoa, lerAniversario } from './dados-pessoas.js';
import { habitoAgua } from './views-cuidar.js';
import { confirmar } from './confirmar.js';

let app;
export function ligarCuidar(funcoes) { app = funcoes; }

// Muda uma linha de config { chave → valor } e redesenha.
async function mudarConfig(chave, padrao, fn) {
  const atual = (await listar('config', { incluirExcluidos: true })).find((c) => c.chave === chave);
  const valor = { ...padrao, ...(atual && !atual.excluido_em ? atual.valor : {}) };
  fn(valor);
  await salvar('config', { ...(atual || {}), excluido_em: null, chave, valor });
  atualizarEstado({ config: await listar('config') });
  app.renderizar();
}

const mudarCuidar = (fn) => mudarConfig('cuidar', { remedios: [], consultas: [], exames: [], pele: [] }, fn);
const mudarDesejos = (fn) => mudarConfig('lista_desejos', { lista: [] }, fn);
const mudarPessoas = (fn) => mudarConfig('pessoas', { lista: [] }, fn);

function mostrarErro(form, texto) {
  const caixa = form.querySelector('[data-erro]');
  if (!caixa) return;
  caixa.textContent = texto;
  caixa.hidden = !texto;
}

const diasDoForm = (form, nome) => [...form.querySelectorAll(`[name="${nome}"]:checked`)].map((i) => Number(i.value)).filter((d) => d >= 0 && d <= 6);

// A consulta vira um evento do Calendário (tipo pessoal), para aparecer na agenda e nos avisos.
async function eventoDaConsulta(c) {
  const inicio = instanteLocal(c.data, c.hora || '');
  const fim = new Date(new Date(inicio).getTime() + 60 * 60 * 1000).toISOString();
  const descricao = [c.local ? `Onde: ${c.local}` : '', c.levar ? `Levar: ${c.levar}` : ''].filter(Boolean).join('\n') || null;
  const salvo = await gravar('eventos', 'eventos', { titulo: c.nome, tipo: 'pessoal', inicio, fim, dia_inteiro: !c.hora, origem: 'manual', descricao, disciplina_id: null, status: null, link: null });
  return salvo?.id || null;
}

async function apagarEvento(id) {
  if (!id) return;
  const e = (obterEstado().eventos || []).find((x) => x.id === id);
  if (e && !e.excluido_em) await gravar('eventos', 'eventos', { ...e, excluido_em: new Date().toISOString() });
}

export function cliqueCuidar(alvo) {
  const { acao, id } = alvo.dataset;
  if (!acao || !/^(cu|ds|ps)-/.test(acao)) return false;
  const hoje = dataLocal();
  switch (acao) {
    case 'cu-agua-criar': {
      const s = SUGESTOES.find((x) => /água/i.test(x.nome));
      gravar('habitos', 'habitos', { nome: s.nome, icone: s.icone, periodo: s.periodo, meta: s.meta, unidade: s.unidade, frequencia: { tipo: 'diario' }, ativo: true, ordem: (obterEstado().habitos || []).length, dados: {} })
        .then(() => { app.renderizar(); app.avisoCurto('💧 Beber água entrou nos seus hábitos.'); });
      return true;
    }
    case 'cu-agua': {
      const agua = habitoAgua(obterEstado(), hoje);
      if (!agua) return true;
      const alvoValor = Number(alvo.dataset.valor);
      const novo = alvoValor === agua.valor ? alvoValor - 1 : alvoValor; // tocar no último copo cheio desfaz
      navigator.vibrate?.(8);
      definirValorDoHabito(agua.habito, hoje, novo).then(() => { app.renderizar(); if (novo >= agua.meta && agua.valor < agua.meta) app.avisoCurto('Água do dia completa.'); });
      return true;
    }
    case 'cu-remedio-tomei': {
      const hora = alvo.dataset.hora;
      const tomado = alvo.getAttribute('aria-pressed') !== 'true';
      navigator.vibrate?.(8);
      mudarCuidar((v) => { v.remedios = v.remedios.map((r) => (r.id === id ? marcarDose(r, hoje, hora, tomado) : r)); });
      return true;
    }
    case 'cu-remedio-remover':
      confirmar('Tirar este remédio da lista? O histórico de doses vai junto.', { botao: 'Tirar', perigo: true }).then((ok) => { if (ok) mudarCuidar((v) => { v.remedios = v.remedios.filter((r) => r.id !== id); }); });
      return true;
    case 'cu-consulta-feita':
      mudarCuidar((v) => { v.consultas = v.consultas.map((c) => (c.id === id ? { ...c, feita: true } : c)); }).then(() => app.avisoCurto('Consulta feita. Se for de rotina, marque "Fiz hoje" no exame.'));
      return true;
    case 'cu-consulta-remover': {
      const c = (obterEstado().config || []).find((x) => x.chave === 'cuidar')?.valor?.consultas?.find((x) => x.id === id);
      confirmar('Desmarcar esta consulta? Ela sai daqui e do Calendário.', { botao: 'Desmarcar', perigo: true }).then(async (ok) => {
        if (!ok) return;
        await apagarEvento(c?.evento_id);
        await mudarCuidar((v) => { v.consultas = v.consultas.filter((x) => x.id !== id); });
      });
      return true;
    }
    case 'cu-exame-feito':
      mudarCuidar((v) => { v.exames = v.exames.map((e) => (e.id === id ? { ...e, ultima: hoje } : e)); });
      return true;
    case 'cu-exame-remover':
      mudarCuidar((v) => { v.exames = v.exames.filter((e) => e.id !== id); });
      return true;
    case 'cu-pele-feito': {
      const feito = alvo.getAttribute('aria-pressed') !== 'true';
      navigator.vibrate?.(8);
      mudarCuidar((v) => { v.pele = v.pele.map((p) => (p.id === id ? marcarPele(p, hoje, feito) : p)); });
      return true;
    }
    case 'cu-pele-remover':
      mudarCuidar((v) => { v.pele = v.pele.filter((p) => p.id !== id); });
      return true;
    case 'cu-ciclo-hoje': {
      const c = lerCiclo() || { duracao: 28 };
      gravarCiclo({ ...c, inicio: hoje });
      app.renderizar();
      app.avisoCurto('Ciclo recomeçou hoje. Fica só neste aparelho.');
      return true;
    }
    case 'cu-ciclo-desligar':
      confirmar('Parar de acompanhar o ciclo? Os dados somem deste aparelho.', { botao: 'Parar', perigo: true }).then((ok) => { if (ok) { gravarCiclo(null); app.renderizar(); } });
      return true;
    case 'ds-ganhei':
      mudarDesejos((v) => { v.lista = v.lista.map((d) => (d.id === id ? { ...d, estado: 'ganhei', decidido_em: new Date().toISOString() } : d)); }).then(() => app.avisoCurto('Que bom. Aproveita.'));
      return true;
    case 'ds-deixei':
      mudarDesejos((v) => { v.lista = v.lista.map((d) => (d.id === id ? { ...d, estado: 'deixei', decidido_em: new Date().toISOString() } : d)); }).then(() => app.avisoCurto('Saiu da lista. Menos uma coisa na cabeça.'));
      return true;
    case 'ds-remover':
      mudarDesejos((v) => { v.lista = v.lista.filter((d) => d.id !== id); });
      return true;
    case 'ps-falei':
      mudarPessoas((v) => { v.lista = v.lista.map((p) => (p.id === id ? { ...p, ultimoContato: hoje } : p)); });
      return true;
    case 'ps-remover':
      confirmar('Tirar esta pessoa da lista?', { botao: 'Tirar', perigo: true }).then((ok) => { if (ok) mudarPessoas((v) => { v.lista = v.lista.filter((p) => p.id !== id); }); });
      return true;
    default:
      return false;
  }
}

export function enviarCuidar(form) {
  const tipo = form.dataset.form;
  if (!tipo || !/^(cu|ds|ps)-/.test(tipo)) return false;
  const c = form.elements;
  const nome = c.nome?.value.trim();
  mostrarErro(form, '');
  switch (tipo) {
    case 'cu-remedio': {
      if (!nome) return mostrarErro(form, 'Qual é o remédio ou a vitamina?'), true;
      if (c.horas.value.trim() && !horasDe(c.horas.value).length) return mostrarErro(form, 'Horários no formato 08:00, 21:00.'), true;
      const dias = diasDoForm(form, 'dias');
      mudarCuidar((v) => { v.remedios.push(novoRemedio({ nome, horas: c.horas.value, dias: dias.length === 7 ? [] : dias, dose: c.dose.value })); }).then(() => app.avisoCurto(`${nome} guardado${horasDe(c.horas.value).length ? ', com aviso na hora' : ''}.`));
      return true;
    }
    case 'cu-consulta': {
      if (!nome) return mostrarErro(form, 'O que é a consulta?'), true;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(c.data.value)) return mostrarErro(form, 'Escolha o dia.'), true;
      const consulta = novaConsulta({ nome, data: c.data.value, hora: c.hora.value, local: c.local.value, levar: c.levar.value });
      eventoDaConsulta(consulta).then((eventoId) => mudarCuidar((v) => { v.consultas.push({ ...consulta, evento_id: eventoId }); })).then(() => app.avisoCurto(`${nome} marcada e no Calendário.`));
      return true;
    }
    case 'cu-exame': {
      if (!nome) return mostrarErro(form, 'Qual é o exame?'), true;
      mudarCuidar((v) => { v.exames.push(novoExame({ nome, meses: c.meses.value, ultima: c.ultima.value || null })); });
      return true;
    }
    case 'cu-pele': {
      if (!nome) return mostrarErro(form, 'Qual é o passo?'), true;
      const dias = diasDoForm(form, 'dias');
      mudarCuidar((v) => { v.pele.push(novoPassoPele({ nome, periodo: c.periodo.value, dias: dias.length === 7 ? [] : dias })); });
      return true;
    }
    case 'cu-ciclo': {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(c.inicio.value)) return mostrarErro(form, 'Qual foi o primeiro dia do último ciclo?'), true;
      gravarCiclo({ inicio: c.inicio.value, duracao: Math.max(20, Math.min(45, Number(c.duracao.value) || 28)) });
      app.renderizar();
      return true;
    }
    case 'ds-novo': {
      if (!nome) return mostrarErro(form, 'O que você quer?'), true;
      mudarDesejos((v) => { v.lista.push(novoDesejoDaLista({ nome, porque: c.porque.value, link: c.link.value })); }).then(() => app.avisoCurto('Na lista. Deixa descansar um pouco.'));
      return true;
    }
    case 'ps-novo': {
      if (!nome) return mostrarErro(form, 'Quem é?'), true;
      if (c.aniversario.value.trim() && !lerAniversario(c.aniversario.value)) return mostrarErro(form, 'Aniversário no formato DD/MM ou DD/MM/AAAA.'), true;
      mudarPessoas((v) => { v.lista.push(novaPessoa({ nome, aniversario: c.aniversario.value, gosta: c.gosta.value, lembrar: c.lembrar.value, presentes: c.presentes.value })); }).then(() => app.avisoCurto(`${nome} entrou nas suas pessoas.`));
      return true;
    }
    default:
      return false;
  }
}
