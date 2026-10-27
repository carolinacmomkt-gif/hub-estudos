// Tela Hoje: resumo do dia no topo, "Agenda de hoje" (linha do tempo) e "Como estou hoje"
// (humor, energia e uma linha sobre o dia, guardados no diário).

import { obterEstado } from './estado.js';
import { esc, DIA } from './utilidades.js';
import { gravar, criarGravador } from './gravacao.js';
import { tarefasNaAgenda } from './views-tarefas.js';

const fmtHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const NOME_TIPO = {
  prova: 'Prova', trabalho: 'Trabalho', atividade: 'Atividade', aula: 'Aula', feriado: 'Feriado',
  pessoal: 'Pessoal', revisao: 'Revisão', youtube: 'YouTube', substack: 'Substack', tarefa: 'Tarefa',
};
export const HUMORES = [
  { valor: 1, rosto: '😞', nome: 'Difícil' },
  { valor: 2, rosto: '🙁', nome: 'Pra baixo' },
  { valor: 3, rosto: '😐', nome: 'Normal' },
  { valor: 4, rosto: '🙂', nome: 'Bem' },
  { valor: 5, rosto: '😄', nome: 'Ótimo' },
];
const ENERGIAS = ['Sem energia', 'Pouca', 'Média', 'Boa', 'Cheia'];

// AAAA-MM-DD no fuso do aparelho.
export function dataLocal(momento = Date.now()) {
  const d = new Date(momento);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const inicioDoDia = (agora) => new Date(new Date(agora).setHours(0, 0, 0, 0)).getTime();

// Eventos que tocam o dia de hoje (inclusive os de dia inteiro e os que começaram antes).
export function eventosDeHoje(eventos, agora = Date.now()) {
  const ini = inicioDoDia(agora);
  const fim = ini + DIA;
  return (eventos || [])
    .filter((e) => !e.excluido_em && e.inicio)
    .map((e) => ({ ...e, t0: Date.parse(e.inicio), t1: e.fim ? Date.parse(e.fim) : Date.parse(e.inicio) }))
    .filter((e) => e.t0 < fim && Math.max(e.t1, e.t0) >= ini)
    .sort((a, b) => (b.dia_inteiro - a.dia_inteiro) || a.t0 - b.t0);
}

// Linha curta embaixo da saudação: "2 compromissos hoje · prova em 3 dias".
export function resumoDoDia(estado, agora = Date.now()) {
  const partes = [];
  const hoje = eventosDeHoje(estado.eventos, agora).filter((e) => e.tipo !== 'feriado');
  const feriado = eventosDeHoje(estado.eventos, agora).find((e) => e.tipo === 'feriado');
  if (feriado) partes.push(`hoje é ${feriado.titulo}`);
  const restantes = hoje.filter((e) => e.dia_inteiro || e.t1 >= agora);
  if (restantes.length) partes.push(`${restantes.length} ${restantes.length === 1 ? 'compromisso' : 'compromissos'} hoje`);
  else if (!feriado) partes.push('agenda livre hoje');
  const prova = (estado.eventos || [])
    .filter((e) => !e.excluido_em && e.tipo === 'prova' && Date.parse(e.inicio) > agora)
    .sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio))[0];
  if (prova) {
    const dias = Math.round((inicioDoDia(Date.parse(prova.inicio)) - inicioDoDia(agora)) / DIA);
    partes.push(dias === 0 ? 'prova hoje' : dias === 1 ? 'prova amanhã' : `próxima prova em ${dias} dias`);
  }
  return partes.join(' · ');
}

export function cardAgendaHoje(estado, agora = Date.now()) {
  const itens = eventosDeHoje([...(estado.eventos || []), ...tarefasNaAgenda(estado.tarefas, dataLocal(agora))], agora);
  let marcouAgora = false;
  const linhas = itens.map((e) => {
    const passou = !e.dia_inteiro && e.t1 < agora;
    const acontecendo = !e.dia_inteiro && e.t0 <= agora && e.t1 >= agora && e.t1 > e.t0;
    let marca = '';
    if (!marcouAgora && !e.dia_inteiro && e.t0 > agora) {
      marcouAgora = true;
      marca = `<li class="agenda-agora" aria-hidden="true"><span>agora · ${esc(fmtHora.format(agora))}</span></li>`;
    }
    const hora = e.dia_inteiro ? 'Dia todo' : e.t0 < inicioDoDia(agora) ? 'Desde antes' : fmtHora.format(e.t0);
    return `${marca}
      <li class="agenda-item tipo-${esc(e.tipo)}${passou ? ' passou' : ''}${acontecendo ? ' acontecendo' : ''}">
        <span class="agenda-hora">${esc(hora)}</span>
        <span class="agenda-ponto" aria-hidden="true"></span>
        <span class="agenda-texto">
          <span class="agenda-titulo">${esc(e.titulo)}</span>
          <small class="campo-ajuda">${esc(NOME_TIPO[e.tipo] || '')}${acontecendo ? ' · agora' : ''}${passou ? ' · já foi' : ''}</small>
        </span>
      </li>`;
  }).join('');
  return `
    <section class="card" aria-labelledby="agenda-titulo">
      <div class="card-topo">
        <h2 class="card-titulo" id="agenda-titulo">Agenda de hoje</h2>
        <a class="card-link" href="#calendario">Calendário</a>
      </div>
      ${itens.length ? `<ol class="agenda-hoje">${linhas}</ol>`
        : '<p class="texto-suave">Nada marcado para hoje. Um dia com espaço também é bom.</p>'}
    </section>`;
}

const registroDoDia = (estado, data) => (estado.diario || [])
  .filter((d) => !d.excluido_em && d.data === data)
  .sort((a, b) => String(b.atualizado_em).localeCompare(String(a.atualizado_em)))[0];

export function cardHumor(estado, agora = Date.now()) {
  const hoje = registroDoDia(estado, dataLocal(agora)) || {};
  const ontem = registroDoDia(estado, dataLocal(agora - DIA));
  const rostoOntem = HUMORES.find((h) => h.valor === ontem?.humor);
  return `
    <section class="card humor" aria-labelledby="humor-titulo">
      <div class="card-topo">
        <h2 class="card-titulo" id="humor-titulo">Como estou hoje</h2>
        ${rostoOntem ? `<span class="campo-ajuda">Ontem: ${rostoOntem.rosto} ${esc(rostoOntem.nome)}</span>` : ''}
      </div>
      <div class="humor-escala" role="group" aria-label="Humor">${HUMORES.map((h) => `
        <button class="humor-opcao" type="button" data-acao="hoje-humor" data-campo="humor" data-valor="${h.valor}" aria-pressed="${hoje.humor === h.valor}" title="${esc(h.nome)}">
          <span class="humor-rosto" aria-hidden="true">${h.rosto}</span><small>${esc(h.nome)}</small>
        </button>`).join('')}
      </div>
      <p class="proximo-rotulo">Energia</p>
      <div class="energia-escala" role="group" aria-label="Energia">${ENERGIAS.map((nome, i) => `
        <button class="energia-opcao${hoje.energia >= i + 1 ? ' cheia' : ''}" type="button" data-acao="hoje-humor" data-campo="energia" data-valor="${i + 1}" aria-pressed="${hoje.energia === i + 1}" aria-label="Energia: ${esc(nome)}" title="${esc(nome)}"></button>`).join('')}
        <span class="campo-ajuda">${hoje.energia ? esc(ENERGIAS[hoje.energia - 1]) : ''}</span>
      </div>
      <label class="visualmente-oculto" for="hoje-linha">Uma linha sobre o dia</label>
      <textarea id="hoje-linha" class="hoje-linha" rows="2" maxlength="500" placeholder="Uma linha sobre o dia (opcional)" data-acao-mudar="hoje-linha">${esc(hoje.texto || '')}</textarea>
    </section>`;
}

// ---------------------------------------------------------------------------
// Gravação
// ---------------------------------------------------------------------------

const gravador = criarGravador('diario', 'diario', { atraso: 800 });
let criando = null;

// A linha do diário de hoje; cria na primeira vez (uma só, mesmo com dois toques seguidos).
async function linhaDeHoje() {
  const data = dataLocal();
  const existente = registroDoDia(obterEstado(), data);
  if (existente) return gravador.vigente(existente);
  if (!criando) criando = gravar('diario', 'diario', { data }).finally(() => { criando = null; });
  return criando;
}

export function cliqueHoje(alvo) {
  if (alvo.dataset.acao !== 'hoje-humor') return false;
  const campo = alvo.dataset.campo;
  const valor = Number(alvo.dataset.valor);
  // Resposta na hora; o salvamento vem logo depois.
  const grupo = alvo.parentElement;
  const desmarcar = alvo.getAttribute('aria-pressed') === 'true';
  grupo.querySelectorAll('[aria-pressed]').forEach((b) => {
    const v = Number(b.dataset.valor);
    b.setAttribute('aria-pressed', String(!desmarcar && v === valor));
    if (campo === 'energia') b.classList.toggle('cheia', !desmarcar && v <= valor);
  });
  linhaDeHoje().then((linha) => gravador.ja(linha, { [campo]: desmarcar ? null : valor }));
  return true;
}

export function mudancaHoje(alvo, tipo) {
  if (alvo.dataset?.acaoMudar !== 'hoje-linha') return false;
  const texto = alvo.value.slice(0, 500);
  linhaDeHoje().then((linha) => (tipo === 'change' ? gravador.ja(linha, { texto }) : gravador.adiar(linha, { texto })));
  return true;
}
