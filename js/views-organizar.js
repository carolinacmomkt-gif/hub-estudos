// "Organizar minhas demandas": a chamada no card Demandas, a prévia da semana (dia por dia, com o
// que não cabe e a mensagem para o cliente) e os ajustes de cada bloco. Os dados vêm de
// js/dados-organizar.js; quem salva é js/eventos-organizar.js.

import { esc } from './utilidades.js';
import { prefsDoDia } from './dados-dia.js';
import { valorMeuDia, dataLocal, minutoAgora } from './views-dia.js';
import { entradaDaSemana, prefsOrganizar, pedeReorganizar, textoDoDia, somarDias } from './dados-organizar.js';
import { protegidosDe, protegidosDoDia } from './dados-protegidos.js';

const NOMES_DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
// "na sexta", "no sábado"
const naDia = (data) => { const d = textoDoDia(data).split(',')[0]; return `${/^(s[aá]bado|domingo)/.test(d) ? 'no' : 'na'} ${d}`; };
const maiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const horas = (min) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}`);

export const valorOrganizar = (estado) => (estado.config || []).find((c) => c.chave === 'organizar' && !c.excluido_em)?.valor || {};

// Proposta guardada (config "organizar"): vale só no dia em que foi feita.
export function propostaDeHoje(estado, hoje = dataLocal()) {
  const p = valorOrganizar(estado).proposta;
  return p?.plano && p.plano.hoje === hoje ? p : null;
}

// Tudo o que o organizador precisa, a partir do que está no aparelho.
export function montarEntradaSemana(estado, agora = Date.now()) {
  const hoje = dataLocal(agora);
  const eventos = (estado.eventos || []).filter((e) => !e.excluido_em && e.inicio && !e.dia_inteiro && e.status !== 'entregue')
    .map((e) => {
      const ini = new Date(e.inicio);
      const fim = e.fim ? new Date(e.fim) : null;
      const data = dataLocal(ini.getTime());
      return { data, inicio: minutoAgora(ini.getTime()), fim: fim && dataLocal(fim.getTime()) === data ? minutoAgora(fim.getTime()) : null, titulo: e.titulo };
    });
  // Horas protegidas: ocupadas em cada dia do horizonte, como compromissos.
  const protegidos = protegidosDe(estado.config);
  for (let i = 0; i < 14; i += 1) {
    const data = somarDias(hoje, i);
    for (const b of protegidosDoDia(protegidos, data)) eventos.push({ data, inicio: b.inicio, fim: b.fim, titulo: b.titulo });
  }
  return entradaDaSemana({
    demandas: estado.demandas || [], tarefas: estado.tarefas || [], eventos, hoje, agoraMin: minutoAgora(agora),
    horario: prefsDoDia(valorMeuDia(estado)), prefs: valorOrganizar(estado).prefs,
  });
}

// A chamada no card Demandas: montar a semana, ver a proposta ou reorganizar.
export function chamadaOrganizar(estado, abertas, agora = Date.now()) {
  const hoje = dataLocal(agora);
  const proposta = propostaDeHoje(estado, hoje);
  const ocupado = estado.organizando ? ' disabled aria-busy="true"' : '';
  if (estado.organizando) {
    return '<div class="org-chamada" role="status"><span>Montando a sua semana…</span></div>';
  }
  if (proposta) {
    const n = proposta.plano.blocos.length;
    const dias = new Set(proposta.plano.blocos.map((b) => b.data)).size;
    return `
      <div class="org-chamada">
        <span>Sua semana está montada: ${n} ${n === 1 ? 'demanda' : 'demandas'} em ${dias} ${dias === 1 ? 'dia' : 'dias'}${proposta.plano.naoCabe.length ? `, ${proposta.plano.naoCabe.length} sem espaço` : ''}.</span>
        <button class="botao botao-primario botao-pequeno" type="button" data-acao="org-ver">Ver a proposta</button>
      </div>`;
  }
  const reorganizar = pedeReorganizar({ demandas: estado.demandas, tarefas: estado.tarefas, hoje });
  if (reorganizar) {
    return `
      <div class="org-chamada org-chamada--alerta">
        <span>${esc(reorganizar.motivo)} Quer reorganizar a semana?</span>
        <button class="botao botao-primario botao-pequeno" type="button" data-acao="org-montar"${ocupado}>Reorganizar</button>
      </div>`;
  }
  // Uma só já vale a chamada se for urgente (vence em até 2 dias).
  const urgente = abertas.some((d) => !d.dados?.tipo && d.prazo && d.prazo <= somarDias(hoje, 2));
  if (abertas.length < 2 && !urgente) return '';
  return `
    <div class="org-chamada">
      <span>${abertas.length === 1 ? '1 demanda esperando' : `${abertas.length} demandas esperando`}. Quer que eu monte a sua semana com ${abertas.length === 1 ? 'ela' : 'elas'}?</span>
      <button class="botao botao-primario botao-pequeno" type="button" data-acao="org-montar"${ocupado}>Organizar minha semana</button>
    </div>`;
}

function linhaBloco(b, entrada, editando) {
  const mudou = b.atual && (b.atual.data !== b.data || (b.atual.hora || '') !== b.inicio);
  const antes = mudou ? `antes: ${textoDoDia(b.atual.data).split(',')[0]}${b.atual.hora ? ` ${b.atual.hora}` : ''}` : '';
  return `
    <li class="org-bloco${editando ? ' editando' : ''}">
      <span class="org-hora">${esc(b.inicio)}<small>${esc(b.fim)}</small></span>
      <button class="org-texto" type="button" data-acao="org-editar" data-item="${esc(b.item_id)}" aria-expanded="${editando}" aria-label="Mudar: ${esc(b.titulo)}">
        <strong>${esc(b.titulo)}</strong>
        <small>${[b.quem && esc(b.quem), b.motivo && esc(b.motivo), antes && `<span class="org-antes">${esc(antes)}</span>`].filter(Boolean).join(' · ')}</small>
      </button>
      ${editando ? formMover(b, entrada) : ''}
    </li>`;
}

function formMover(b, entrada) {
  return `
    <form class="org-mover" data-form="org-mover" data-item="${esc(b.item_id)}" novalidate>
      <label class="campo"><span class="campo-rotulo">Dia</span>
        <select name="data">${entrada.dias.map((d) => `<option value="${d.data}"${d.data === b.data ? ' selected' : ''}>${esc(textoDoDia(d.data))}</option>`).join('')}</select></label>
      <label class="campo"><span class="campo-rotulo">Hora</span><input name="inicio" type="time" step="900" value="${esc(b.inicio)}"></label>
      <div class="acoes">
        <button class="botao botao-primario botao-pequeno" type="submit">Mudar</button>
        <button class="botao botao-secundario botao-pequeno" type="button" data-acao="org-tirar" data-item="${esc(b.item_id)}">Tirar do plano</button>
      </div>
    </form>`;
}

function itemNaoCabe(n) {
  return `
    <li class="org-nao-cabe">
      <strong>${esc(n.titulo)}</strong>
      <small>${[n.quem && esc(n.quem), n.prazo ? `prazo ${esc(textoDoDia(n.prazo))}` : 'sem prazo', `~${esc(horas(n.minutos))}`].filter(Boolean).join(' · ')}</small>
      <label class="visualmente-oculto" for="org-msg-${esc(n.item_id)}">Mensagem para pedir um novo prazo</label>
      <textarea id="org-msg-${esc(n.item_id)}" class="org-mensagem" rows="3" readonly>${esc(n.mensagem)}</textarea>
      <div class="acoes">
        <button class="botao botao-secundario botao-pequeno" type="button" data-acao="org-copiar" data-item="${esc(n.item_id)}">Copiar mensagem</button>
        ${n.sugestao ? `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="org-por" data-item="${esc(n.item_id)}" data-data="${esc(n.sugestao)}">Pôr ${esc(naDia(n.sugestao))}</button>` : ''}
      </div>
    </li>`;
}

// A prévia: um bloco por dia, o que não coube e os botões de aceitar.
export function previaSemana(estado) {
  const proposta = propostaDeHoje(estado);
  if (!proposta) return '<p class="texto-suave">Nenhuma proposta agora. Toque em "Organizar minha semana" no card Demandas.</p>';
  const { plano, entrada, fonte } = proposta;
  const editando = estado.orgEditando;
  const porDia = new Map();
  for (const b of plano.blocos) {
    if (!porDia.has(b.data)) porDia.set(b.data, []);
    porDia.get(b.data).push(b);
  }
  const capacidade = new Map(entrada.dias.map((d) => [d.data, d]));
  const dias = [...porDia.entries()].map(([data, blocos]) => {
    const d = capacidade.get(data);
    const total = (d?.usado || 0) + blocos.reduce((s, b) => s + b.minutos, 0);
    return `
      <section class="org-dia" aria-label="${esc(textoDoDia(data))}">
        <h3 class="org-dia-titulo">${esc(maiuscula(textoDoDia(data)))}${data === entrada.hoje ? ' <span class="selo">hoje</span>' : ''}
          <small>${esc(horas(total))} de ${esc(horas(d?.capacidade || entrada.prefs.horasPorDia * 60))}</small></h3>
        <ol class="org-blocos">${blocos.map((b) => linhaBloco(b, entrada, editando === b.item_id)).join('')}</ol>
      </section>`;
  }).join('');
  const n = plano.blocos.length;
  return `
    <div class="org-previa">
      ${plano.resumo ? `<p class="org-resumo">${esc(plano.resumo)}</p>` : ''}
      <p class="campo-ajuda">${fonte === 'ia' ? 'Montado pela IA' : 'Montado sem IA'} com o seu horário (${esc(entrada.horario.inicio)} às ${esc(entrada.horario.fim)}, até ${esc(horas(entrada.prefs.horasPorDia * 60))} por dia). Toque num bloco para mudar o dia ou a hora. Nada vira tarefa até você aceitar.</p>
      ${dias || '<p class="texto-suave">Nenhuma demanda coube nos próximos dias.</p>'}
      ${plano.naoCabe.length ? `
        <section class="org-dia org-sem-espaco" aria-labelledby="org-sem-espaco">
          <h3 class="org-dia-titulo" id="org-sem-espaco">Sem espaço até o prazo</h3>
          <p class="campo-ajuda">Peça um novo prazo (a mensagem já está pronta) ou ponha mesmo assim no primeiro dia com espaço.</p>
          <ul class="org-blocos">${plano.naoCabe.map(itemNaoCabe).join('')}</ul>
        </section>` : ''}
      <div class="acoes org-outras">
        <button class="botao botao-secundario botao-pequeno" type="button" data-acao="org-montar" data-modo="${fonte === 'ia' ? 'simples' : 'ia'}">${fonte === 'ia' ? 'Montar de novo sem IA' : 'Montar de novo com IA'}</button>
        <button class="botao botao-secundario botao-pequeno botao-perigo" type="button" data-acao="org-descartar">Descartar a proposta</button>
      </div>
      <div class="org-acoes">
        <button class="botao botao-primario" type="button" data-acao="org-aceitar"${n ? '' : ' disabled'}>${n ? `Aceitar e pôr na agenda (${n})` : 'Nada para aceitar'}</button>
      </div>
    </div>`;
}

// Configurações: horas por dia, dias de trabalho e a proposta automática de manhã.
export function formPrefsOrganizar(estado) {
  const p = prefsOrganizar(valorOrganizar(estado).prefs);
  return `
    <h3 class="ava-subtitulo">Organizar a semana</h3>
    <form class="formulario" data-form="org-prefs" novalidate>
      <label class="campo campo-curto"><span class="campo-rotulo">Horas por dia para as demandas</span>
        <input name="horas" type="number" min="1" max="12" step="0.5" inputmode="decimal" value="${p.horasPorDia}"></label>
      <fieldset class="grupo-marcar grupo-marcar-linha">
        <legend class="campo-rotulo">Dias de trabalho</legend>
        ${NOMES_DIAS.map((nome, i) => `<label class="campo-marcar"><input type="checkbox" name="dia" value="${i}"${p.dias.includes(i) ? ' checked' : ''}><span>${nome}</span></label>`).join('')}
      </fieldset>
      <label class="campo-marcar"><input type="checkbox" name="automatico"${p.automatico ? ' checked' : ''}><span>Montar uma proposta sozinha toda manhã (você ainda aceita antes)</span></label>
      <p class="campo-ajuda">O horário do dia (início, fim e almoço) é o mesmo do "Planejar meu dia".</p>
    </form>`;
}
