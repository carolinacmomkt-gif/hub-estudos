// Card "Planejar meu dia" no Hoje: pedir o plano (com IA ou sem), ajustar os blocos e aceitar.
// Aceito, o plano aparece na Agenda de hoje e cada bloco avisa quando começa.

import { esc } from './utilidades.js';
import { protegidosDe, protegidosComoEventos } from './dados-protegidos.js';
import { tarefasDeHoje } from './dados-tarefas.js';
import { situacaoDasContas, mesDe } from './dados-financas.js';
import { habitosDoDia, feitoNoDia } from './dados-habitos.js';
import { entradaDoDia, prefsDoDia, planoDeHoje, paraMin, blocoAgora } from './dados-dia.js';

const NOME_BLOCO = { foco: 'Foco', tarefa: 'Tarefa', estudo: 'Estudo', pausa: 'Pausa', refeicao: 'Refeição', habito: 'Hábito', compromisso: 'Compromisso' };
const DIA_MS = 864e5;

export function dataLocal(momento = Date.now()) {
  const d = new Date(momento);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const minutoAgora = (agora = Date.now()) => { const d = new Date(agora); return d.getHours() * 60 + d.getMinutes(); };

export function valorMeuDia(estado) {
  return (estado.config || []).find((c) => c.chave === 'meu_dia' && !c.excluido_em)?.valor || {};
}

// O resumo do dia que vai para a IA (ou para o planejador simples).
export function montarEntrada(estado, { nota = '', agora = Date.now() } = {}) {
  const hoje = dataLocal(agora);
  const t = tarefasDeHoje(estado.tarefas || [], hoje);
  const ini = new Date(`${hoje}T00:00:00`).getTime();
  const fim = ini + DIA_MS;
  const eventosHoje = (estado.eventos || []).filter((e) => !e.excluido_em && e.inicio && e.status !== 'entregue')
    .filter((e) => { const a = Date.parse(e.inicio); const b = e.fim ? Date.parse(e.fim) : a; return a < fim && b >= ini; });
  const minutoDoEvento = (iso) => {
    const x = Date.parse(iso);
    if (x < ini) return 0;
    if (x >= fim) return 24 * 60;
    return minutoAgora(x);
  };
  const prazos = (estado.eventos || []).filter((e) => !e.excluido_em && ['prova', 'trabalho', 'atividade'].includes(e.tipo) && e.status !== 'entregue')
    .map((e) => ({ e, dias: Math.round((new Date(`${dataLocal(Date.parse(e.inicio))}T12:00:00`) - new Date(`${hoje}T12:00:00`)) / DIA_MS) }))
    .filter((x) => x.dias >= 1 && x.dias <= 5).sort((a, b) => a.dias - b.dias)
    .map((x) => ({ titulo: x.e.titulo, tipo: x.e.tipo, em_dias: x.dias }));
  const contas = situacaoDasContas(estado.financas || [], mesDe(hoje), hoje).filter((x) => x.estado !== 'paga' && x.vence === hoje).map((x) => x.conta.descricao);
  const registros = estado.habitoRegistros || [];
  const habitos = habitosDoDia(estado.habitos || [], registros, hoje).lista.filter((h) => !feitoNoDia(registros, h, hoje))
    .map((h) => ({ nome: h.nome, periodo: h.periodo || 'qualquer' }));
  const diario = (estado.diario || []).filter((d) => !d.excluido_em && d.data === hoje)
    .sort((a, b) => String(b.atualizado_em).localeCompare(String(a.atualizado_em)))[0];
  const protegidos = protegidosComoEventos(protegidosDe(estado.config), hoje);
  return entradaDoDia({
    tarefas: [...t.atrasadas, ...t.hoje], eventos: [...eventosHoje, ...protegidos], contas, habitos, prazos,
    energia: diario?.energia || null, humor: diario?.humor || null, nota, hoje, minutoDoEvento,
  });
}

function linhaBloco(b, { editar = false, agoraMin = -1 } = {}) {
  const ini = paraMin(b.inicio);
  const fim = paraMin(b.fim);
  const agora = agoraMin >= ini && agoraMin < fim;
  const passou = agoraMin >= fim;
  return `
    <li class="dia-bloco tipo-${esc(b.tipo)}${agora ? ' agora' : ''}${passou ? ' passou' : ''}">
      <span class="dia-hora">${esc(b.inicio)}<small>${esc(b.fim)}</small></span>
      ${editar && b.tipo !== 'compromisso'
        ? `<button class="dia-texto" type="button" data-acao="dia-editar" data-id="${esc(b.id)}" aria-label="Ajustar: ${esc(b.titulo)}">`
        : '<span class="dia-texto">'}
        <strong>${esc(b.titulo)}</strong>
        <small class="campo-ajuda">${esc(NOME_BLOCO[b.tipo] || '')}${b.motivo ? ` · ${esc(b.motivo)}` : ''}${agora ? ' · agora' : ''}</small>
      ${editar && b.tipo !== 'compromisso' ? '</button>' : '</span>'}
      ${!editar && b.tarefa_id && !passou ? `<button class="botao-icone botao-icone-p" type="button" data-acao="tarefa-feita" data-id="${esc(b.tarefa_id)}" aria-label="Marcar como feita: ${esc(b.titulo)}" title="Feita">✓</button>` : ''}
    </li>`;
}

export function cardMeuDia(estado, agora = Date.now()) {
  const valor = valorMeuDia(estado);
  const prefs = prefsDoDia(valor);
  const hoje = dataLocal(agora);
  const plano = planoDeHoje(valor, hoje);
  const agoraMin = minutoAgora(agora);
  const trabalhando = estado.planejandoDia;
  let corpo;
  if (trabalhando) {
    corpo = `<div class="dia-pensando" role="status"><span class="dia-pensando-ponto" aria-hidden="true"></span>Pensando no seu dia…</div>`;
  } else if (plano && plano.aceito) {
    const atual = blocoAgora(plano.blocos, agoraMin);
    const restantes = plano.blocos.filter((b) => paraMin(b.fim) > agoraMin);
    corpo = `
      ${atual ? `<p class="dia-agora-linha">${paraMin(atual.inicio) <= agoraMin ? 'Agora' : `Às ${esc(atual.inicio)}`}: <strong>${esc(atual.titulo)}</strong></p>` : '<p class="texto-suave">Os blocos de hoje terminaram. Bom descanso.</p>'}
      ${restantes.length ? `<ol class="dia-blocos">${restantes.map((b) => linhaBloco(b, { agoraMin })).join('')}</ol>` : ''}
      <div class="acoes"><button class="botao botao-secundario botao-pequeno" type="button" data-acao="dia-refazer">Refazer o dia</button></div>`;
  } else if (plano) {
    corpo = `
      ${plano.dica ? `<p class="dia-dica">${esc(plano.dica)}</p>` : ''}
      <p class="campo-ajuda">Toque num bloco para mudar o horário, o nome ou tirar.</p>
      <ol class="dia-blocos">${plano.blocos.map((b) => linhaBloco(b, { editar: true, agoraMin })).join('')}</ol>
      <div class="acoes">
        <button class="botao botao-primario" type="button" data-acao="dia-aceitar">Aceitar o plano</button>
        <button class="botao botao-secundario" type="button" data-acao="dia-refazer">Refazer</button>
        <button class="botao botao-secundario" type="button" data-acao="dia-descartar">Descartar</button>
      </div>`;
  } else {
    const entrada = montarEntrada(estado, { agora });
    const resumo = [
      entrada.tarefas.length && `${entrada.tarefas.length} ${entrada.tarefas.length === 1 ? 'tarefa' : 'tarefas'}`,
      entrada.compromissos.length && `${entrada.compromissos.length} ${entrada.compromissos.length === 1 ? 'compromisso' : 'compromissos'}`,
      entrada.prazos.length && `${entrada.prazos.length} ${entrada.prazos.length === 1 ? 'prazo chegando' : 'prazos chegando'}`,
      entrada.habitos.length && `${entrada.habitos.length} ${entrada.habitos.length === 1 ? 'hábito' : 'hábitos'}`,
    ].filter(Boolean).join(', ');
    corpo = `
      <p class="texto-suave">${resumo ? `Para hoje: ${esc(resumo)}${entrada.energia ? '' : '. Marque a energia em "Como estou hoje" para um plano mais certeiro'}.` : 'Nada marcado para hoje ainda. Dá para planejar mesmo assim.'}</p>
      <form class="formulario dia-form" data-form="dia-pedir" novalidate>
        <div class="cal-form-linha">
          <label class="campo"><span class="campo-rotulo">Meu dia vai das</span><input name="inicio" type="time" value="${esc(prefs.inicio)}"></label>
          <label class="campo"><span class="campo-rotulo">até</span><input name="fim" type="time" value="${esc(prefs.fim)}"></label>
          <label class="campo"><span class="campo-rotulo">Almoço</span><input name="almoco" type="time" value="${esc(prefs.almoco)}"></label>
        </div>
        <label class="campo"><span class="campo-rotulo">Algo para considerar hoje? (opcional)</span>
          <input name="nota" type="text" maxlength="300" placeholder='Ex.: "dentista às 15h", "quero sair às 17h"'></label>
        ${estado.erroDia ? `<p class="ava-alerta" role="alert">${esc(estado.erroDia)}</p>` : ''}
        <div class="acoes">
          <button class="botao botao-primario" type="button" data-acao="dia-planejar" data-modo="ia">✨ Planejar com IA</button>
          <button class="botao botao-secundario" type="button" data-acao="dia-planejar" data-modo="simples">Planejar sem IA</button>
        </div>
      </form>`;
  }
  return `
    <section class="card meu-dia" aria-labelledby="meudia-titulo">
      <div class="card-topo"><h2 class="card-titulo" id="meudia-titulo">${plano?.aceito ? 'Meu dia' : 'Planejar meu dia'}</h2>
        ${plano?.aceito ? `<span class="selo">${plano.blocos.filter((b) => paraMin(b.fim) <= agoraMin).length} de ${plano.blocos.length}</span>` : ''}</div>
      ${corpo}
    </section>`;
}

export function formBloco(b) {
  return `
    <form class="formulario" data-form="dia-bloco" data-id="${esc(b.id)}" novalidate>
      <label class="campo"><span class="campo-rotulo">O quê</span><input name="titulo" type="text" maxlength="80" required value="${esc(b.titulo)}"></label>
      <div class="cal-form-linha">
        <label class="campo"><span class="campo-rotulo">Das</span><input name="inicio" type="time" required value="${esc(b.inicio)}"></label>
        <label class="campo"><span class="campo-rotulo">Até</span><input name="fim" type="time" required value="${esc(b.fim)}"></label>
      </div>
      <p class="ava-alerta" role="alert" data-erro hidden></p>
      <div class="acoes">
        <button class="botao botao-primario" type="submit">Salvar</button>
        <button class="botao botao-secundario botao-perigo" type="button" data-acao="dia-bloco-excluir" data-id="${esc(b.id)}">Tirar do plano</button>
      </div>
    </form>`;
}

// Blocos aceitos de hoje como itens da Agenda de hoje (os compromissos já estão lá).
export function blocosNaAgenda(estado, agora = Date.now()) {
  const hoje = dataLocal(agora);
  const plano = planoDeHoje(valorMeuDia(estado), hoje);
  if (!plano?.aceito) return [];
  return plano.blocos.filter((b) => b.tipo !== 'compromisso').map((b) => ({
    id: `bloco-${b.id}`, titulo: b.titulo, tipo: 'bloco', inicio: new Date(`${hoje}T${b.inicio}:00`).toISOString(), fim: new Date(`${hoje}T${b.fim}:00`).toISOString(),
  }));
}
