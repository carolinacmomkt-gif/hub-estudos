// Tela Calendário: visão de mês, semana e lista, o formulário de evento e a importação
// do calendário acadêmico (#calendario/importar).

import { cabecalho } from './componentes.js';
import { esc, contagemRegressiva, urgencia } from './utilidades.js';
import { disciplinasAtivas, nomeDaDisciplina, situacaoDoEvento } from './dados-faculdade.js';
import {
  chaveDia, dataDaChave, somarDias, eventosDoCalendario, eventosPorDia, gradeDoMes, semanaDe,
  mesmoMes, horaLocal, diasDoEvento, chaveValida,
} from './dados-calendario.js';
import { nuvemConfigurada, sessaoAtual } from './nuvem.js';
import { cursoGuardado } from './importar-calendario.js';
import { cardPlano } from './views-plano.js';

export const TIPOS_EVENTO = [
  { id: 'prova', nome: 'Prova' },
  { id: 'trabalho', nome: 'Trabalho' },
  { id: 'atividade', nome: 'Atividade' },
  { id: 'aula', nome: 'Aula' },
  { id: 'feriado', nome: 'Feriado' },
  { id: 'pessoal', nome: 'Pessoal' },
  { id: 'revisao', nome: 'Revisão' },
];
const NOME_TIPO = Object.fromEntries(TIPOS_EVENTO.map((t) => [t.id, t.nome]));
const NOME_ORIGEM = { ava: 'AVA', ics: 'AVA', lyceum: 'Lyceum', academico: 'Calendário acadêmico', manual: 'Seu evento' };
const VISOES = [
  { id: 'mes', nome: 'Mês' },
  { id: 'semana', nome: 'Semana' },
  { id: 'lista', nome: 'Lista' },
];
const DIAS_DA_LISTA = 60;
const MAX_NA_CELULA = 3;

const fmtMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const fmtDiaLongo = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtDiaCurto = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
const fmtSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });
const fmtDataCompleta = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
const INICIAIS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const NOMES_DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const maiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const linkSeguro = (url) => (/^https?:\/\//i.test(String(url || '')) ? url : null);

// Preferências da tela (visão, dia em foco e dia escolhido). A visão fica salva no aparelho.
export function situacaoCalendario(estado) {
  if (!estado.calendario) {
    let visao = 'mes';
    try {
      visao = localStorage.getItem('hub.calendario.visao') || 'mes';
    } catch {
      // sem armazenamento
    }
    const hoje = chaveDia(new Date());
    estado.calendario = { visao: VISOES.some((v) => v.id === visao) ? visao : 'mes', foco: hoje, dia: hoje };
  }
  return estado.calendario;
}

// ---------------------------------------------------------------------------
// Itens de evento
// ---------------------------------------------------------------------------

function textoHorario(evento, dia, resumido = false) {
  if (evento.dia_inteiro) {
    const dias = diasDoEvento(evento);
    if (dias.length > 1 && resumido) return `Até ${fmtDiaCurto.format(dataDaChave(dias[dias.length - 1])).replace('.', '')} (${dias.length} dias)`;
    if (dias.length > 1) return `Dia ${dias.indexOf(dia) + 1} de ${dias.length}`;
    return 'Dia todo';
  }
  const inicio = horaLocal(evento.inicio);
  return evento.fim && chaveDia(evento.fim) === chaveDia(evento.inicio) ? `${inicio}–${horaLocal(evento.fim)}` : inicio;
}

function chipSituacao(evento, agora) {
  const situacao = situacaoDoEvento(evento, agora);
  if (situacao === 'entregue') return '<span class="chip urg-futuro">Entregue</span>';
  if (!situacao) return '';
  const t = new Date(evento.inicio).getTime();
  return `<span class="chip urg-${urgencia(t, agora)}">${esc(contagemRegressiva(t, agora))}</span>`;
}

function itemEvento(estado, evento, dia, agora, resumido = false) {
  const disciplina = nomeDaDisciplina(estado, evento.disciplina_id);
  const meta = [textoHorario(evento, dia, resumido), NOME_TIPO[evento.tipo] || evento.tipo, disciplina || NOME_ORIGEM[evento.origem]]
    .filter(Boolean).join(' · ');
  return `
    <li>
      <button class="cal-evento tipo-${esc(evento.tipo)}" type="button" data-acao="cal-abrir" data-id="${esc(evento.id)}">
        <span class="cal-evento-marca" aria-hidden="true"></span>
        <span class="cal-evento-texto">
          <span class="cal-evento-titulo">${esc(evento.titulo)}</span>
          <span class="cal-evento-meta">${esc(meta)}</span>
        </span>
        ${chipSituacao(evento, agora)}
      </button>
    </li>`;
}

function listaDoDia(estado, eventos, dia, agora, resumido = false) {
  if (!eventos?.length) return '<p class="texto-suave">Nada marcado.</p>';
  return `<ul class="cal-eventos">${eventos.map((e) => itemEvento(estado, e, dia, agora, resumido)).join('')}</ul>`;
}

// ---------------------------------------------------------------------------
// Visões
// ---------------------------------------------------------------------------

function visaoMes(estado, cal, eventos, agora) {
  const semanas = gradeDoMes(cal.foco);
  const hoje = chaveDia(new Date(agora));
  const porDia = eventosPorDia(eventos, semanas[0][0], semanas[semanas.length - 1][6]);
  const dia = mesmoMes(cal.dia, cal.foco) ? cal.dia : (mesmoMes(hoje, cal.foco) ? hoje : `${cal.foco.slice(0, 7)}-01`);

  const cabecalhoDias = INICIAIS.map((l, i) => `<span class="cal-dia-semana" aria-hidden="true">${l}</span><span class="visualmente-oculto">${NOMES_DIAS[i]}</span>`).join('');
  const celulas = semanas.flat().map((chave) => {
    const doDia = porDia.get(chave) || [];
    const classes = ['cal-dia', !mesmoMes(chave, cal.foco) && 'fora', chave === hoje && 'hoje', chave === dia && 'escolhido'].filter(Boolean).join(' ');
    const pilulas = doDia.slice(0, MAX_NA_CELULA).map((e) => `<span class="cal-pilula tipo-${esc(e.tipo)}">${esc(e.titulo)}</span>`).join('');
    const extra = doDia.length > MAX_NA_CELULA ? `<span class="cal-mais">+${doDia.length - MAX_NA_CELULA}</span>` : '';
    const rotulo = `${maiuscula(fmtDiaLongo.format(dataDaChave(chave)))}${doDia.length ? `, ${doDia.length} ${doDia.length === 1 ? 'evento' : 'eventos'}` : ''}`;
    return `
      <button class="${classes}" type="button" data-acao="cal-dia" data-dia="${chave}" aria-pressed="${chave === dia}" aria-label="${esc(rotulo)}">
        <span class="cal-dia-num" aria-hidden="true">${dataDaChave(chave).getDate()}</span>
        <span class="cal-pilulas" aria-hidden="true">${pilulas}${extra}</span>
      </button>`;
  }).join('');

  return `
    <section class="card cal-mes" aria-label="${esc(maiuscula(fmtMes.format(dataDaChave(cal.foco))))}">
      <div class="cal-grade">${cabecalhoDias}${celulas}</div>
    </section>
    <section class="card" aria-labelledby="cal-dia-titulo">
      <div class="card-topo">
        <h2 class="card-titulo" id="cal-dia-titulo">${esc(maiuscula(fmtDiaLongo.format(dataDaChave(dia))))}</h2>
        <button class="card-link" type="button" data-acao="cal-novo" data-dia="${dia}">Adicionar neste dia</button>
      </div>
      ${listaDoDia(estado, porDia.get(dia), dia, agora)}
    </section>`;
}

function visaoSemana(estado, cal, eventos, agora) {
  const dias = semanaDe(cal.foco);
  const hoje = chaveDia(new Date(agora));
  const porDia = eventosPorDia(eventos, dias[0], dias[6]);
  return `
    <div class="cal-semana">${dias.map((chave) => `
      <section class="card cal-semana-dia${chave === hoje ? ' hoje' : ''}" aria-labelledby="sem-${chave}">
        <div class="card-topo">
          <h2 class="card-titulo" id="sem-${chave}">
            <span class="cal-semana-nome">${esc(fmtSemana.format(dataDaChave(chave)).replace('.', ''))}</span>
            ${esc(fmtDiaCurto.format(dataDaChave(chave)).replace('.', ''))}${chave === hoje ? ' <span class="selo">Hoje</span>' : ''}
          </h2>
          <button class="botao-icone" type="button" data-acao="cal-novo" data-dia="${chave}" aria-label="Adicionar evento em ${esc(fmtDiaLongo.format(dataDaChave(chave)))}">+</button>
        </div>
        ${listaDoDia(estado, porDia.get(chave), chave, agora)}
      </section>`).join('')}
    </div>`;
}

function visaoLista(estado, cal, eventos, agora) {
  const ate = somarDias(cal.foco, DIAS_DA_LISTA - 1);
  // Na lista, um evento de vários dias aparece uma vez só (no primeiro dia do período mostrado).
  const porDia = new Map();
  for (const [dia, doDia] of eventosPorDia(eventos, cal.foco, ate)) {
    const primeiraVez = doDia.filter((e) => dia === cal.foco || diasDoEvento(e)[0] === dia);
    if (primeiraVez.length) porDia.set(dia, primeiraVez);
  }
  const dias = [...porDia.keys()].sort();
  if (!dias.length) {
    return `<section class="card"><p class="texto-suave">Nada marcado de ${esc(fmtDataCompleta.format(dataDaChave(cal.foco)))} a ${esc(fmtDataCompleta.format(dataDaChave(ate)))}.</p></section>`;
  }
  const hoje = chaveDia(new Date(agora));
  return `
    <section class="card">
      <ol class="cal-lista">${dias.map((chave) => `
        <li class="cal-lista-dia">
          <h2 class="cal-lista-data${chave === hoje ? ' hoje' : ''}">${esc(maiuscula(fmtDiaLongo.format(dataDaChave(chave))))}${chave === hoje ? ' <span class="selo">Hoje</span>' : ''}</h2>
          ${listaDoDia(estado, porDia.get(chave), chave, agora, true)}
        </li>`).join('')}
      </ol>
    </section>`;
}

function tituloDoPeriodo(cal) {
  if (cal.visao === 'mes') return maiuscula(fmtMes.format(dataDaChave(cal.foco)));
  if (cal.visao === 'semana') {
    const dias = semanaDe(cal.foco);
    return `${fmtDiaCurto.format(dataDaChave(dias[0])).replace('.', '')} a ${fmtDiaCurto.format(dataDaChave(dias[6])).replace('.', '')}`;
  }
  return `Desde ${fmtDiaCurto.format(dataDaChave(cal.foco)).replace('.', '')}`;
}

function barra(cal) {
  const visoes = VISOES.map((v) => `
    <button type="button" data-acao="cal-visao" data-visao="${v.id}" aria-pressed="${cal.visao === v.id}">${v.nome}</button>`).join('');
  const passo = { mes: 'mês', semana: 'semana', lista: 'período' }[cal.visao];
  return `
    <div class="cal-barra">
      <div class="segmentado" role="group" aria-label="Visão do calendário">${visoes}</div>
      <div class="cal-navegar">
        <button class="botao-icone" type="button" data-acao="cal-mover" data-passo="-1" aria-label="${cal.visao === 'semana' ? 'Semana anterior' : `${maiuscula(passo)} anterior`}">‹</button>
        <h2 class="cal-periodo" aria-live="polite">${esc(tituloDoPeriodo(cal))}</h2>
        <button class="botao-icone" type="button" data-acao="cal-mover" data-passo="1" aria-label="${cal.visao === 'semana' ? 'Próxima semana' : `Próximo ${passo}`}">›</button>
        <button class="botao botao-secundario botao-pequeno" type="button" data-acao="cal-hoje">Hoje</button>
      </div>
    </div>`;
}

export function renderCalendario(estado) {
  if (estado.parametro === 'importar') return renderImportar(estado);
  const cal = situacaoCalendario(estado);
  // "#calendario/2026-10-25" (vindo de um aviso) abre naquele dia; o endereço volta a ser "#calendario".
  if (chaveValida(estado.parametro)) {
    cal.foco = estado.parametro;
    cal.dia = estado.parametro;
    estado.parametro = null;
    history.replaceState(null, '', '#calendario');
  }
  const agora = Date.now();
  const eventos = eventosDoCalendario(estado);
  const corpo = { mes: visaoMes, semana: visaoSemana, lista: visaoLista }[cal.visao](estado, cal, eventos, agora);
  const temAcademico = eventos.some((e) => e.origem === 'academico');

  return `
    ${cabecalho('Calendário', 'Prazos do AVA, calendário acadêmico e os seus eventos')}
    <div class="acoes cal-acoes">
      <button class="botao botao-primario" type="button" data-acao="cal-novo">Novo evento</button>
      <a class="botao botao-secundario" href="#calendario/importar">${temAcademico ? 'Atualizar calendário acadêmico' : 'Importar calendário acadêmico'}</a>
    </div>
    ${cardPlano(estado, { agora })}
    ${barra(cal)}
    <div class="pilha pilha-larga">${corpo}</div>`;
}

// ---------------------------------------------------------------------------
// Formulário de evento (folha #folha-evento)
// ---------------------------------------------------------------------------

function opcoes(lista, atual) {
  return lista.map((o) => `<option value="${esc(o.id)}"${o.id === atual ? ' selected' : ''}>${esc(o.nome)}</option>`).join('');
}

function detalheSomenteLeitura(estado, evento) {
  const link = linkSeguro(evento.link);
  const disciplina = nomeDaDisciplina(estado, evento.disciplina_id);
  const quando = evento.dia_inteiro
    ? maiuscula(fmtDiaLongo.format(new Date(evento.inicio)))
    : `${maiuscula(fmtDiaLongo.format(new Date(evento.inicio)))} · ${horaLocal(evento.inicio)}`;
  const situacao = situacaoDoEvento(evento);
  return `
    <div class="cal-detalhe">
      <p class="cal-detalhe-titulo">${esc(evento.titulo)}</p>
      <p class="texto-suave">${esc(quando)}</p>
      <p class="texto-suave">${esc([NOME_TIPO[evento.tipo], disciplina, situacao && { pendente: 'Pendente', entregue: 'Entregue', atrasado: 'Atrasado' }[situacao]].filter(Boolean).join(' · '))}</p>
      ${evento.descricao ? `<p class="aviso-texto">${esc(String(evento.descricao).slice(0, 600))}</p>` : ''}
      <p class="campo-ajuda">Veio do ${esc(NOME_ORIGEM[evento.origem] || 'AVA')} e se atualiza sozinho. Para mudar, altere lá.</p>
      <div class="acoes">
        ${link ? `<a class="botao botao-primario" href="${esc(link)}" target="_blank" rel="noopener">Abrir no ${esc(NOME_ORIGEM[evento.origem] || 'AVA')}</a>` : ''}
        <button class="botao botao-secundario" type="button" data-acao="cal-fechar">Fechar</button>
      </div>
    </div>`;
}

export function renderFolhaEvento(estado, { evento = null, dia = null } = {}) {
  if (evento && evento.origem !== 'manual' && evento.origem !== 'academico') return detalheSomenteLeitura(estado, evento);

  const e = evento || {};
  const data = e.inicio ? chaveDia(e.inicio) : (dia || chaveDia(new Date()));
  const diaInteiro = evento ? Boolean(e.dia_inteiro) : true;
  const dataFim = diaInteiro && e.fim ? chaveDia(e.fim) : '';
  const horaInicio = !diaInteiro && e.inicio ? horaLocal(e.inicio) : '';
  const horaFim = !diaInteiro && e.fim ? horaLocal(e.fim) : '';
  const disciplinas = disciplinasAtivas(estado).map((d) => ({ id: d.id, nome: d.nome }));
  const tipo = e.tipo || 'pessoal';

  return `
    <form class="formulario cal-form" data-form="cal-evento" data-id="${esc(e.id || '')}" novalidate>
      <label class="campo">
        <span class="campo-rotulo">Título</span>
        <input name="titulo" type="text" maxlength="140" required value="${esc(e.titulo || '')}" placeholder="Ex.: Apresentação do seminário">
      </label>
      <div class="cal-form-linha">
        <label class="campo">
          <span class="campo-rotulo">Tipo</span>
          <select name="tipo">${opcoes(TIPOS_EVENTO, tipo)}</select>
        </label>
        <label class="campo">
          <span class="campo-rotulo">Disciplina</span>
          <select name="disciplina"><option value="">Nenhuma</option>${opcoes(disciplinas, e.disciplina_id)}</select>
        </label>
      </div>
      <div class="cal-form-linha">
        <label class="campo">
          <span class="campo-rotulo">Data</span>
          <input name="data" type="date" required value="${esc(data)}">
        </label>
        <label class="campo-marcar">
          <input name="dia_inteiro" type="checkbox"${diaInteiro ? ' checked' : ''}>
          <span>Dia inteiro</span>
        </label>
      </div>
      <div class="cal-form-linha" data-com-horario${diaInteiro ? ' hidden' : ''}>
        <label class="campo">
          <span class="campo-rotulo">Começa</span>
          <input name="hora_inicio" type="time" value="${esc(horaInicio)}">
        </label>
        <label class="campo">
          <span class="campo-rotulo">Termina <small>(opcional)</small></span>
          <input name="hora_fim" type="time" value="${esc(horaFim)}">
        </label>
      </div>
      <label class="campo" data-dia-inteiro${diaInteiro ? '' : ' hidden'}>
        <span class="campo-rotulo">Até <small>(se durar mais de um dia)</small></span>
        <input name="data_fim" type="date" value="${esc(dataFim)}">
      </label>
      <label class="campo-marcar" data-com-entrega${tipo === 'trabalho' || tipo === 'atividade' ? '' : ' hidden'}>
        <input name="entregue" type="checkbox"${e.status === 'entregue' ? ' checked' : ''}>
        <span>Já entreguei</span>
      </label>
      <label class="campo">
        <span class="campo-rotulo">Anotação <small>(opcional)</small></span>
        <textarea name="descricao" rows="3" maxlength="2000" placeholder="Sala, o que levar, combinados…">${esc(e.descricao || '')}</textarea>
      </label>
      <p class="ava-alerta" role="alert" data-erro hidden></p>
      ${e.origem === 'academico' ? '<p class="campo-ajuda">Veio do calendário acadêmico importado. Se você importar de novo, as mudanças daqui podem ser substituídas.</p>' : ''}
      <div class="acoes">
        <button class="botao botao-primario" type="submit">${evento ? 'Salvar' : 'Criar evento'}</button>
        ${evento ? '<button class="botao botao-secundario" type="button" data-acao="cal-excluir">Excluir</button>' : ''}
        <button class="botao botao-secundario" type="button" data-acao="cal-fechar">Cancelar</button>
      </div>
    </form>`;
}

// ---------------------------------------------------------------------------
// Importar o calendário acadêmico (#calendario/importar)
// ---------------------------------------------------------------------------

function formImportar(curso) {
  return `
    <form class="formulario" data-form="cal-importar" novalidate>
      <label class="campo">
        <span class="campo-rotulo">PDF do calendário</span>
        <input name="arquivo" type="file" accept="application/pdf,.pdf">
        <span class="campo-ajuda">Até 20 MB. Se tiver o calendário do ano todo, tudo bem: a IA separa as datas.</span>
      </label>
      <label class="campo">
        <span class="campo-rotulo">Ou cole o texto <small>(de uma página do site, por exemplo)</small></span>
        <textarea name="texto" rows="5" maxlength="200000" placeholder="Cole aqui o texto do calendário acadêmico"></textarea>
      </label>
      <label class="campo">
        <span class="campo-rotulo">Seu curso <small>(opcional)</small></span>
        <input name="curso" type="text" maxlength="80" value="${esc(curso || '')}" placeholder="Ajuda a IA a ignorar o que é de outros cursos">
      </label>
      <p class="ava-alerta" role="alert" data-erro hidden></p>
      <button class="botao botao-primario" type="submit">Ler com a IA</button>
    </form>`;
}

function revisao(imp) {
  const selecionados = imp.eventos.filter((e) => e.selecionado).length;
  const linhas = imp.eventos.map((e, i) => `
    <li class="importado${e.selecionado ? '' : ' desmarcado'}">
      <label class="importado-marcar">
        <input type="checkbox" data-campo="selecionado" data-indice="${i}"${e.selecionado ? ' checked' : ''}>
        <span class="visualmente-oculto">Incluir ${esc(e.titulo)}</span>
      </label>
      <div class="importado-campos">
        <input class="importado-titulo" type="text" maxlength="140" value="${esc(e.titulo)}" data-campo="titulo" data-indice="${i}" aria-label="Título da data ${i + 1}">
        <div class="importado-linha">
          <label class="importado-campo">Tipo
            <select data-campo="tipo" data-indice="${i}">${opcoes(TIPOS_EVENTO.filter((t) => t.id !== 'pessoal' && t.id !== 'revisao'), e.tipo)}</select></label>
          <label class="importado-campo">Data
            <input type="date" value="${esc(e.inicio)}" data-campo="inicio" data-indice="${i}"></label>
          <label class="importado-campo">Até
            <input type="date" value="${esc(e.fim)}" data-campo="fim" data-indice="${i}"></label>
        </div>
        ${e.observacao || e.existe ? `<p class="campo-ajuda">${esc([e.existe ? 'Já está no calendário (vai ser atualizado)' : '', e.observacao].filter(Boolean).join(' · '))}</p>` : ''}
      </div>
    </li>`).join('');

  return `
    <section class="card" aria-labelledby="revisar-titulo">
      <div class="card-topo">
        <h2 class="card-titulo" id="revisar-titulo">Revise antes de salvar${imp.periodo ? ` · ${esc(imp.periodo)}` : ''}</h2>
      </div>
      <p class="texto-suave">A IA encontrou ${imp.eventos.length} ${imp.eventos.length === 1 ? 'data' : 'datas'}. Confira com o PDF, corrija o que precisar e desmarque o que não quiser. "Até" só fica preenchido quando a data dura vários dias.</p>
      ${imp.avisos ? `<div class="ava-alerta" role="note"><strong>A IA avisou:</strong> ${esc(imp.avisos)}</div>` : ''}
      <div class="acoes">
        <button class="botao botao-secundario botao-pequeno" type="button" data-acao="imp-todos" data-valor="1">Marcar todos</button>
        <button class="botao botao-secundario botao-pequeno" type="button" data-acao="imp-todos" data-valor="0">Desmarcar todos</button>
      </div>
      <form data-form="cal-revisar" novalidate>
        <ul class="importados">${linhas}</ul>
        <p class="ava-alerta" role="alert" data-erro hidden></p>
        <div class="acoes">
          <button class="botao botao-primario" type="submit" data-salvar-importacao ${selecionados ? '' : 'disabled'}>Salvar ${selecionados} ${selecionados === 1 ? 'evento' : 'eventos'}</button>
          <button class="botao botao-secundario" type="button" data-acao="imp-descartar">Descartar</button>
        </div>
      </form>
    </section>`;
}

export function renderImportar(estado) {
  const imp = estado.importacao || { status: 'inicio' };
  let corpo;
  if (!nuvemConfigurada() || !sessaoAtual()) {
    corpo = '<section class="card"><p class="texto-suave">A leitura com a IA precisa da nuvem: entre no app com o Supabase configurado.</p></section>';
  } else if (imp.status === 'enviando' || imp.status === 'lendo') {
    corpo = `
      <section class="card cal-lendo" role="status">
        <span class="carregando" aria-hidden="true"></span>
        <div>
          <h2 class="card-titulo">${imp.status === 'enviando' ? 'Enviando o calendário…' : 'A IA está lendo o calendário…'}</h2>
          <p class="texto-suave">Costuma levar de 30 segundos a 2 minutos. Pode sair desta tela: quando terminar, o resultado fica esperando aqui.</p>
        </div>
      </section>`;
  } else if (imp.status === 'pronto' && imp.eventos.length) {
    corpo = revisao(imp);
  } else {
    const aviso = imp.status === 'erro'
      ? `<div class="ava-alerta" role="alert">${esc(imp.erro || 'Não deu certo agora.')}</div>`
      : imp.status === 'pronto'
        ? `<div class="ava-alerta" role="alert">A IA não encontrou datas neste arquivo.${imp.avisos ? ` ${esc(imp.avisos)}` : ''} Tente outro PDF ou cole o texto.</div>`
        : '';
    corpo = `
      <section class="card" aria-labelledby="importar-titulo">
        <h2 class="card-titulo" id="importar-titulo">Mande o calendário da UniEVANGÉLICA</h2>
        <p class="texto-suave">A IA lê as provas, os feriados, o início e o fim do semestre e os prazos acadêmicos. Você revisa tudo antes de entrar no calendário.</p>
        ${aviso}
        ${formImportar(imp.curso ?? cursoGuardado())}
      </section>`;
  }

  return `
    <a class="voltar" href="#calendario">‹ Calendário</a>
    ${cabecalho('Calendário acadêmico', 'Importar do PDF ou do texto, com a ajuda da IA')}
    <div class="pilha">${corpo}</div>
    <p class="campo-ajuda cal-rodape">O PDF é usado só para esta leitura e é apagado logo depois.</p>`;
}
