// Tela Hábitos e rotinas (#habitos e #habitos/mapa), formulários, o passo a passo das rotinas
// e o card do Hoje.

import { cabecalho, barraProgresso } from './componentes.js';
import { esc } from './utilidades.js';
import {
  PERIODOS, SUGESTOES, iso, somarDias, ehRotina, ativos, textoFrequencia, valorNoDia, feitoNoDia,
  semanaDoHabito, sequenciaDoHabito, mapaDoHabito, taxa, habitosDoDia,
} from './dados-habitos.js';

const NOMES_DIA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const fmtDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
export const hojeIso = () => iso(new Date());
const deIso = (s) => new Date(`${s}T12:00:00`);
const meta = (h) => Math.max(1, Number(h.meta) || 1);

// Faixa dos últimos 7 dias: dá para marcar um dia que passou ("esqueci de marcar ontem").
function faixaDeDias(dia) {
  const hoje = hojeIso();
  return `
    <div class="hab-dias" role="group" aria-label="Escolher o dia">
      ${Array.from({ length: 7 }, (_, i) => somarDias(hoje, i - 6)).map((d) => `
        <button class="hab-dia" type="button" data-acao="hab-dia" data-valor="${d}" aria-pressed="${d === dia}" aria-label="${esc(fmtDia.format(deIso(d)))}">
          <small>${d === hoje ? 'hoje' : NOMES_DIA[deIso(d).getDay()]}</small><strong>${deIso(d).getDate()}</strong>
        </button>`).join('')}
    </div>`;
}

export function itemHabito(h, registros, dia, { compacto = false } = {}) {
  const v = valorNoDia(registros, h, dia);
  const m = meta(h);
  const feito = v >= m;
  const seq = sequenciaDoHabito(registros, h, hojeIso());
  const semana = semanaDoHabito(registros, h, dia);
  const quantidade = m > 1;
  const rotina = ehRotina(h);
  const detalhe = [
    quantidade && `${v} de ${m}${h.unidade ? ` ${esc(h.unidade)}` : ''}`,
    rotina && `${h.dados.passos.length} passos`,
    h.frequencia?.tipo === 'vezes' && `${semana.feitos} de ${semana.alvo} na semana`,
    seq.valor > 1 && `🔥 ${seq.valor} ${seq.unidade}`,
  ].filter(Boolean).join(' · ');
  return `
    <li class="habito${feito ? ' feito' : ''}${v > 0 && !feito ? ' parcial' : ''}" data-habito="${esc(h.id)}" style="--fracao: ${Math.min(1, v / m)}">
      <button class="habito-marcar" type="button" data-acao="${rotina && !feito ? 'hab-rotina' : quantidade && !feito ? 'hab-mais' : 'hab-marcar'}" data-id="${esc(h.id)}"
        aria-pressed="${feito}" aria-label="${feito ? 'Desmarcar' : rotina ? 'Começar' : quantidade ? 'Mais um' : 'Marcar'}: ${esc(h.nome)}">
        <span class="habito-anel" aria-hidden="true"></span><span class="habito-icone" aria-hidden="true">${esc(h.icone || '✓')}</span>
      </button>
      <button class="habito-corpo" type="button" data-acao="hab-editar" data-id="${esc(h.id)}">
        <span class="habito-nome">${esc(h.nome)}</span>
        ${detalhe ? `<small class="habito-detalhe">${detalhe}</small>` : ''}
      </button>
      ${quantidade && !compacto ? `<span class="habito-qtd">
        <button class="botao-icone botao-icone-p" type="button" data-acao="hab-menos" data-id="${esc(h.id)}" aria-label="Um a menos: ${esc(h.nome)}"${v > 0 ? '' : ' disabled'}>−</button>
        <button class="botao-icone botao-icone-p" type="button" data-acao="hab-mais" data-id="${esc(h.id)}" aria-label="Mais um: ${esc(h.nome)}">+</button></span>` : ''}
      ${!compacto ? `<span class="habito-semana" aria-hidden="true">${semana.dias.map((d) => `<i class="${feitoNoDia(registros, h, d) ? 'sim' : d > hojeIso() ? 'futuro' : 'nao'}"></i>`).join('')}</span>` : ''}
    </li>`;
}

function listaDoDia(estado, dia) {
  const d = habitosDoDia(estado.habitos, estado.habitoRegistros, dia);
  if (!ativos(estado.habitos).length) return '';
  if (!d.total) return '<section class="card"><p class="texto-suave">Nenhum hábito previsto para este dia.</p></section>';
  return d.porPeriodo.map((p) => `
    <section class="card">
      <h2 class="card-titulo hab-periodo"><span aria-hidden="true">${p.icone}</span> ${esc(p.nome)}</h2>
      <ul class="habitos">${p.itens.map((h) => itemHabito(h, estado.habitoRegistros, dia)).join('')}</ul>
    </section>`).join('');
}

function sugestoes(estado) {
  const nomes = new Set(ativos(estado.habitos).map((h) => h.nome));
  const lista = SUGESTOES.map((s, i) => ({ ...s, i })).filter((s) => !nomes.has(s.nome));
  if (!lista.length) return '';
  return `
    <section class="card">
      <h2 class="card-titulo">${ativos(estado.habitos).length ? 'Mais ideias' : 'Comece com um destes'}</h2>
      <p class="campo-ajuda">Um toque e ele entra. Dá para mudar tudo depois.</p>
      <div class="hab-sugestoes">${lista.map((s) => `
        <button class="chip-filtro" type="button" data-acao="hab-sugestao" data-valor="${s.i}">${esc(s.icone)} ${esc(s.nome)}</button>`).join('')}</div>
    </section>`;
}

function telaMapa(estado) {
  const hoje = hojeIso();
  const lista = ativos(estado.habitos);
  if (!lista.length) return '<section class="card"><p class="texto-suave">Crie um hábito para ver o mapa dos dias.</p></section>';
  return `<div class="hab-mapas">${lista.map((h) => {
    const mapa = mapaDoHabito(estado.habitoRegistros, h, hoje, 35);
    const t = taxa(estado.habitoRegistros, h, hoje, 30);
    const seq = sequenciaDoHabito(estado.habitoRegistros, h, hoje);
    return `
      <section class="card hab-mapa">
        <div class="card-topo"><h2 class="card-titulo">${esc(h.icone || '')} ${esc(h.nome)}</h2><span class="campo-ajuda">${esc(textoFrequencia(h.frequencia))}</span></div>
        <div class="hab-grade" role="img" aria-label="Últimos 35 dias de ${esc(h.nome)}">${mapa.map((m) => `<i class="m-${m.estado}" title="${esc(m.dia.split('-').reverse().slice(0, 2).join('/'))}"></i>`).join('')}</div>
        <p class="campo-ajuda">${t === null ? 'Começou agora.' : `${Math.round(t * 100)}% nos últimos 30 dias`}${seq.valor ? ` · 🔥 ${seq.valor} ${seq.unidade} seguidos` : ''}</p>
      </section>`;
  }).join('')}</div>`;
}

export function renderHabitos(estado) {
  const dia = estado.diaHabitos && estado.diaHabitos <= hojeIso() ? estado.diaHabitos : hojeIso();
  const aba = estado.parametro === 'mapa' ? 'mapa' : 'dia';
  const d = habitosDoDia(estado.habitos, estado.habitoRegistros, dia);
  const sub = d.total ? `${dia === hojeIso() ? 'Hoje' : fmtDia.format(deIso(dia))}: ${d.feitos} de ${d.total} feitos` : 'Pequenas coisas, todo dia';
  return `
    ${cabecalho('Hábitos e rotinas', esc(sub))}
    <div class="acoes">
      <button class="botao botao-primario" type="button" data-acao="hab-novo">Novo hábito</button>
      <button class="botao botao-secundario" type="button" data-acao="hab-nova-rotina">Nova rotina</button>
    </div>
    <nav class="segmentado tarefa-abas" aria-label="Visões dos hábitos">
      <a href="#habitos" aria-current="${aba === 'dia' ? 'page' : 'false'}">Dia</a>
      <a href="#habitos/mapa" aria-current="${aba === 'mapa' ? 'page' : 'false'}">Mapa</a>
    </nav>
    ${aba === 'dia' ? faixaDeDias(dia) : ''}
    ${d.total && aba === 'dia' ? barraProgresso(d.feitos / d.total, 'Hábitos feitos no dia') : ''}
    <div class="tarefa-visao">
      ${aba === 'dia' ? listaDoDia(estado, dia) : telaMapa(estado)}
      ${aba === 'dia' ? sugestoes(estado) : ''}
    </div>`;
}

// ---------------------------------------------------------------------------
// Formulários
// ---------------------------------------------------------------------------

const opcao = (v, atual, nome) => `<option value="${esc(v)}"${String(v) === String(atual ?? '') ? ' selected' : ''}>${esc(nome)}</option>`;

export function formHabito(h = {}, { rotina = false } = {}) {
  const f = h.frequencia || { tipo: 'diario' };
  const ehR = rotina || ehRotina(h);
  return `
    <form class="formulario" data-form="hab-item" data-id="${esc(h.id || '')}" data-rotina="${ehR ? '1' : ''}" novalidate>
      <div class="cal-form-linha">
        <label class="campo"><span class="campo-rotulo">Emoji</span><input name="icone" type="text" maxlength="4" value="${esc(h.icone || (ehR ? '🌅' : '✓'))}"></label>
        <label class="campo"><span class="campo-rotulo">Período</span><select name="periodo">${PERIODOS.map((p) => opcao(p.id, h.periodo || 'qualquer', p.nome)).join('')}</select></label>
      </div>
      <label class="campo"><span class="campo-rotulo">${ehR ? 'Nome da rotina' : 'Hábito'}</span><input name="nome" type="text" maxlength="60" required value="${esc(h.nome || '')}" placeholder="${ehR ? 'Ex.: Rotina da manhã' : 'Ex.: Beber água'}"></label>
      ${ehR ? `<label class="campo"><span class="campo-rotulo">Passos (um por linha, na ordem)</span>
        <textarea name="passos" rows="5" maxlength="2000" placeholder="Beber água&#10;Arrumar a cama&#10;Alongar">${esc((h.dados?.passos || []).join('\n'))}</textarea></label>`
        : `<div class="cal-form-linha">
        <label class="campo"><span class="campo-rotulo">Meta por dia</span><input name="meta" type="number" min="1" max="999" value="${esc(h.meta || 1)}"></label>
        <label class="campo"><span class="campo-rotulo">Unidade (opcional)</span><input name="unidade" type="text" maxlength="20" value="${esc(h.unidade || '')}" placeholder="copos, páginas, min"></label>
      </div>
      <p class="campo-ajuda">Meta 1 é só marcar feito. Mais que 1 vira contador (+ e −).</p>`}
      <label class="campo"><span class="campo-rotulo">Quando</span>
        <select name="freq" data-acao-mudar="hab-freq">${opcao('diario', f.tipo, 'Todo dia')}${opcao('dias', f.tipo, 'Em alguns dias da semana')}${opcao('vezes', f.tipo, 'Algumas vezes por semana')}</select></label>
      <fieldset class="campo" data-freq="dias"${f.tipo === 'dias' ? '' : ' hidden'}><legend class="campo-rotulo">Dias</legend>
        <div class="grupo-marcar grupo-marcar-linha">${NOMES_DIA.map((n, i) => `<label class="campo-marcar"><input type="checkbox" name="dias" value="${i}"${(f.dias || [1, 2, 3, 4, 5]).includes(i) ? ' checked' : ''}><span>${n}</span></label>`).join('')}</div></fieldset>
      <label class="campo" data-freq="vezes"${f.tipo === 'vezes' ? '' : ' hidden'}><span class="campo-rotulo">Vezes por semana</span><input name="vezes" type="number" min="1" max="7" value="${esc(f.vezes || 3)}"></label>
      <p class="ava-alerta" role="alert" data-erro hidden></p>
      <div class="acoes">
        <button class="botao botao-primario" type="submit">${h.id ? 'Salvar' : 'Criar'}</button>
        ${h.id ? `<button class="botao botao-secundario" type="button" data-acao="hab-pausar" data-id="${esc(h.id)}">Pausar</button>
          <button class="botao botao-secundario botao-perigo" type="button" data-acao="hab-excluir" data-id="${esc(h.id)}">Excluir</button>` : ''}
      </div>
    </form>`;
}

// Passo a passo da rotina: um passo grande por vez.
export function telaRotina(h, passo) {
  const passos = h.dados?.passos || [];
  const atual = passos[passo];
  return `
    <div class="rotina" data-rotina="${esc(h.id)}">
      ${barraProgresso(passo / passos.length, 'Progresso da rotina')}
      <p class="proximo-rotulo">Passo ${passo + 1} de ${passos.length}</p>
      <p class="rotina-passo">${esc(atual)}</p>
      ${passos[passo + 1] ? `<p class="campo-ajuda">Depois: ${esc(passos[passo + 1])}</p>` : '<p class="campo-ajuda">É o último!</p>'}
      <div class="acoes">
        <button class="botao botao-primario" type="button" data-acao="hab-passo" data-id="${esc(h.id)}" data-passo="${passo + 1}">${passos[passo + 1] ? 'Feito, próximo' : 'Terminar a rotina'}</button>
        <button class="botao botao-secundario" type="button" data-acao="hab-passo" data-id="${esc(h.id)}" data-passo="${passo + 1}" data-pular="1">Pular</button>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Card do Hoje
// ---------------------------------------------------------------------------

export function cardHabitosHoje(estado) {
  const hoje = hojeIso();
  const d = habitosDoDia(estado.habitos, estado.habitoRegistros, hoje);
  if (!d.total) {
    return `
      <section class="card" aria-labelledby="hab-hoje-titulo">
        <div class="card-topo"><h2 class="card-titulo" id="hab-hoje-titulo">Hábitos de hoje</h2><a class="card-link" href="#habitos">Hábitos</a></div>
        <p class="texto-suave">Beber água, ler, se mexer: comece com um hábito pequeno.</p>
        <a class="botao botao-secundario botao-pequeno" href="#habitos">Escolher um hábito</a>
      </section>`;
  }
  return `
    <section class="card" aria-labelledby="hab-hoje-titulo">
      <div class="card-topo"><h2 class="card-titulo" id="hab-hoje-titulo">Hábitos de hoje <span class="selo">${d.feitos}/${d.total}</span></h2><a class="card-link" href="#habitos">Hábitos</a></div>
      ${barraProgresso(d.feitos / d.total, 'Hábitos feitos hoje')}
      <ul class="habitos compactos">${d.lista.map((h) => itemHabito(h, estado.habitoRegistros, hoje, { compacto: true })).join('')}</ul>
    </section>`;
}
