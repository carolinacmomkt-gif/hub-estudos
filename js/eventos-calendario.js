// Cliques e formulários do Calendário (chamados pela delegação de eventos.js).

import { obterEstado } from './estado.js';
import { salvar, excluir, obter } from './persistencia.js';
import { renderFolhaEvento, situacaoCalendario } from './views-calendario.js';
import { chaveDia, chaveValida, instanteLocal, moverFoco } from './dados-calendario.js';
import {
  iniciarImportacao, mudarItemImportado, marcarTodosImportados, descartarImportacao, salvarImportacao,
} from './importar-calendario.js';

let app; // { renderizar, avisoCurto }

export function ligarCalendario(funcoes) {
  app = funcoes;
}

function guardarVisao(visao) {
  try {
    localStorage.setItem('hub.calendario.visao', visao);
  } catch {
    // sem armazenamento
  }
}

const folha = () => document.getElementById('folha-evento');

export function abrirFolhaEvento({ id = null, dia = null } = {}) {
  const estado = obterEstado();
  const evento = id ? (estado.eventos || []).find((e) => e.id === id) : null;
  if (id && !evento) return;
  document.getElementById('folha-evento-titulo').textContent = evento ? (evento.origem === 'manual' || evento.origem === 'academico' ? 'Editar evento' : 'Evento') : 'Novo evento';
  document.getElementById('folha-evento-conteudo').innerHTML = renderFolhaEvento(estado, { evento, dia });
  folha().dataset.id = evento?.id || '';
  folha().showModal();
  if (!evento) folha().querySelector('input[name="titulo"]')?.focus();
}

function mostrarErro(form, texto) {
  const caixa = form.querySelector('[data-erro]');
  caixa.textContent = texto;
  caixa.hidden = !texto;
}

// Devolve true se tratou o clique.
export function cliqueCalendario(alvo) {
  const cal = situacaoCalendario(obterEstado());
  switch (alvo.dataset.acao) {
    case 'cal-visao':
      cal.visao = alvo.dataset.visao;
      guardarVisao(cal.visao);
      app.renderizar();
      return true;
    case 'cal-mover':
      cal.foco = moverFoco(cal.foco, cal.visao, Number(alvo.dataset.passo));
      app.renderizar();
      return true;
    case 'cal-hoje':
      cal.foco = chaveDia(new Date());
      cal.dia = cal.foco;
      app.renderizar();
      return true;
    case 'cal-dia':
      cal.dia = alvo.dataset.dia;
      app.renderizar();
      document.getElementById('cal-dia-titulo')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return true;
    case 'cal-novo':
      document.getElementById('folha-criar')?.close();
      abrirFolhaEvento({ dia: alvo.dataset.dia || (cal.dia && obterEstado().rota === 'calendario' ? cal.dia : null) });
      return true;
    case 'cal-abrir':
      abrirFolhaEvento({ id: alvo.dataset.id });
      return true;
    case 'cal-fechar':
      folha().close();
      return true;
    case 'cal-excluir':
      excluirEvento(folha().dataset.id);
      return true;
    case 'imp-todos':
      marcarTodosImportados(alvo.dataset.valor === '1');
      return true;
    case 'imp-descartar':
      if (window.confirm('Descartar esta leitura? Nada entra no calendário.')) descartarImportacao();
      return true;
    default:
      return false;
  }
}

async function excluirEvento(id) {
  const evento = await obter('eventos', id);
  if (!evento || !window.confirm(`Excluir "${evento.titulo}"?`)) return;
  await excluir('eventos', id);
  folha().close();
  app.avisoCurto('Evento excluído.');
}

async function salvarEvento(form) {
  const campos = form.elements;
  const titulo = campos.titulo.value.trim();
  const data = campos.data.value;
  const diaInteiro = campos.dia_inteiro.checked;
  const dataFim = campos.data_fim.value;
  const horaInicio = campos.hora_inicio.value;
  const horaFim = campos.hora_fim.value;
  const tipo = campos.tipo.value;

  if (!titulo) return mostrarErro(form, 'Dê um título ao evento.');
  if (!chaveValida(data)) return mostrarErro(form, 'Escolha a data.');
  if (diaInteiro && dataFim && (!chaveValida(dataFim) || dataFim < data)) return mostrarErro(form, 'A data final precisa ser depois da data de início.');
  if (!diaInteiro && !horaInicio) return mostrarErro(form, 'Diga a hora em que começa (ou marque "Dia inteiro").');
  if (!diaInteiro && horaFim && horaFim <= horaInicio) return mostrarErro(form, 'A hora de término precisa ser depois do início.');

  const atual = form.dataset.id ? await obter('eventos', form.dataset.id) : null;
  const comEntrega = tipo === 'trabalho' || tipo === 'atividade';
  await salvar('eventos', {
    ...(atual || {}),
    titulo: titulo.slice(0, 140),
    tipo,
    disciplina_id: campos.disciplina.value || null,
    descricao: campos.descricao.value.trim() || null,
    dia_inteiro: diaInteiro,
    inicio: instanteLocal(data, diaInteiro ? '' : horaInicio),
    fim: diaInteiro ? (dataFim && dataFim > data ? instanteLocal(dataFim) : null) : (horaFim ? instanteLocal(data, horaFim) : null),
    status: comEntrega ? (campos.entregue.checked ? 'entregue' : 'pendente') : null,
    origem: atual?.origem || 'manual',
  });
  folha().close();
  const cal = situacaoCalendario(obterEstado());
  cal.foco = data;
  cal.dia = data;
  if (obterEstado().rota === 'calendario') app.renderizar();
  app.avisoCurto(atual ? 'Evento atualizado.' : 'Evento criado.');
  return null;
}

async function importar(form) {
  const arquivo = form.elements.arquivo.files?.[0] || null;
  const texto = form.elements.texto.value.trim();
  const curso = form.elements.curso.value.trim();
  form.querySelector('[type="submit"]').disabled = true;
  const erro = await iniciarImportacao({ arquivo, texto, curso });
  if (erro) {
    form.querySelector('[type="submit"]').disabled = false;
    mostrarErro(form, erro);
  }
}

async function salvarRevisao(form) {
  form.querySelector('[type="submit"]').disabled = true;
  const r = await salvarImportacao();
  if (r.erro) {
    form.querySelector('[type="submit"]').disabled = false;
    mostrarErro(form, r.erro);
    return;
  }
  const cal = situacaoCalendario(obterEstado());
  if (r.primeiro) {
    cal.foco = r.primeiro;
    cal.dia = r.primeiro;
  }
  location.hash = '#calendario';
  app.avisoCurto(`${r.salvos} ${r.salvos === 1 ? 'evento salvo' : 'eventos salvos'} no calendário.`);
}

// Devolve true se tratou o envio.
export function enviarCalendario(form) {
  switch (form.dataset.form) {
    case 'cal-evento':
      salvarEvento(form);
      return true;
    case 'cal-importar':
      importar(form);
      return true;
    case 'cal-revisar':
      salvarRevisao(form);
      return true;
    default:
      return false;
  }
}

// Mudanças nos campos (sem redesenhar a tela, para não perder o foco).
export function mudancaCalendario(alvo) {
  const formEvento = alvo.closest('[data-form="cal-evento"]');
  if (formEvento) {
    if (alvo.name === 'dia_inteiro') {
      formEvento.querySelector('[data-com-horario]').hidden = alvo.checked;
      formEvento.querySelector('[data-dia-inteiro]').hidden = !alvo.checked;
    }
    if (alvo.name === 'tipo') {
      formEvento.querySelector('[data-com-entrega]').hidden = !(alvo.value === 'trabalho' || alvo.value === 'atividade');
    }
    return true;
  }
  const campo = alvo.dataset?.campo;
  if (campo && alvo.closest('[data-form="cal-revisar"]')) {
    const indice = Number(alvo.dataset.indice);
    mudarItemImportado(indice, campo, campo === 'selecionado' ? alvo.checked : alvo.value);
    if (campo === 'selecionado') {
      alvo.closest('.importado')?.classList.toggle('desmarcado', !alvo.checked);
      const total = (obterEstado().importacao?.eventos || []).filter((e) => e.selecionado).length;
      const botao = alvo.closest('form').querySelector('[data-salvar-importacao]');
      botao.disabled = !total;
      botao.textContent = `Salvar ${total} ${total === 1 ? 'evento' : 'eventos'}`;
    }
    return true;
  }
  return false;
}
