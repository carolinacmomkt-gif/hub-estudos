// Tela Hoje: saudação, "Próximo passo" e cards de resumo.

import { cardAgendaHoje, cardHumor, resumoDoDia } from './hoje.js';
import { cardTarefasHoje, cardProjetosHoje } from './views-tarefas.js';
import { cabecalho, barraProgresso } from './componentes.js';
import { cardCaixaEntrada } from './views-criar.js';
import { cardPlano } from './views-plano.js';
import { blocosDoInicio, nomeDoBloco, TAMANHOS, TIPOS_PROPRIOS } from './inicio-layout.js';
import { renderProprio } from './views-inicio-proprios.js';
import { cardYoutubeInicio } from './views-youtube.js';
import { cardLeiturasInicio } from './views-biblioteca.js';
import { cardSubstackInicio } from './views-substack.js';
import { cardFocoInicio } from './views-foco.js';
import { cardResumoInicio } from './views-resumo.js';
import { dadosReaisDoInicio, avisosRecentes, disciplinasComFaltasEmRisco, textoFaltas, urgenciaFaltas } from './dados-faculdade.js';
import {
  esc, saudacao, dataLonga, diaEHora, contagemRegressiva, urgencia,
  diasAte, haQuantoTempo, numeroNota, DIA,
} from './utilidades.js';

const NOMES_TIPO = {
  prova: 'Prova', trabalho: 'Trabalho', atividade: 'Atividade',
  aula: 'Aula', feriado: 'Feriado', pessoal: 'Pessoal', revisao: 'Revisão',
};

// Prazo de verdade: prova, trabalho ou atividade (feriados e aulas do calendário acadêmico não contam).
// Os vencidos só aparecem se ainda têm entrega pendente e venceram há menos de 14 dias.
const TIPOS_PRAZO = new Set(['prova', 'trabalho', 'atividade']);
function ehPrazoAberto(e, agora) {
  if (!TIPOS_PRAZO.has(e.tipo) || e.status === 'entregue') return false;
  return e.prazo >= agora || (Boolean(e.status) && agora - e.prazo <= 14 * DIA);
}

// Prioridade: prova próxima (7 dias) > entrega pendente > revisão pendente > leitura.
export function escolherProximoPasso(dados, agora = Date.now()) {
  const pendentes = dados.eventos
    .filter((e) => ehPrazoAberto(e, agora))
    .sort((a, b) => a.prazo - b.prazo);

  const prova = pendentes.find((e) => e.tipo === 'prova' && e.prazo > agora && e.prazo - agora <= 7 * DIA);
  if (prova) {
    const dias = diasAte(prova.prazo, agora);
    return {
      titulo: prova.semDisciplina ? `Revisar para: ${prova.titulo}` : `Revisar para a ${prova.titulo} de ${prova.disciplina}`,
      texto: `${dias <= 1 ? 'É logo' : `Faltam ${dias} dias`}. Uma sessão de 40 minutos hoje com o caderno e as questões da disciplina já ajuda bastante.`,
      acao: 'Ver no calendário',
      destino: '#calendario',
    };
  }

  const entrega = pendentes.find((e) => e.tipo !== 'prova');
  if (entrega) {
    const atrasada = entrega.prazo < agora;
    return {
      titulo: `${atrasada ? 'Entregar' : 'Adiantar'}: ${entrega.titulo}`,
      texto: `${[entrega.disciplina, contagemRegressiva(entrega.prazo, agora)].filter(Boolean).join(' · ')}.`,
      acao: 'Ver na Faculdade',
      destino: '#faculdade',
    };
  }

  const totalRevisoes = dados.revisoes.reduce((soma, r) => soma + r.quantidade, 0);
  if (totalRevisoes > 0) {
    return {
      titulo: `Revisar ${totalRevisoes} ${totalRevisoes === 1 ? 'questão' : 'questões'}`,
      texto: 'Refazer as que você errou é o que mais fixa o conteúdo.',
      acao: 'Abrir Questões',
      destino: '#questoes',
    };
  }

  const leitura = dados.leituras.find((l) => l.status === 'lendo' || l.status === 'ler');
  if (leitura) {
    return {
      titulo: `Continuar a leitura: ${leitura.titulo}`,
      texto: 'Nada urgente por agora. Bom momento para ler com calma.',
      acao: 'Abrir a leitura',
      destino: leitura.id ? `#biblioteca/${leitura.id}` : '#biblioteca',
    };
  }

  return {
    titulo: 'Tudo em dia por aqui',
    texto: 'Nenhum prazo, prova ou revisão pendente. Aproveite para descansar ou adiantar algo.',
    acao: 'Ver o calendário',
    destino: '#calendario',
  };
}

function cardProximoPasso(passo) {
  return `
    <section class="proximo" aria-labelledby="proximo-titulo">
      <div>
        <p class="proximo-rotulo">Próximo passo</p>
        <h2 class="proximo-titulo" id="proximo-titulo">${esc(passo.titulo)}</h2>
        <p class="proximo-texto">${esc(passo.texto)}</p>
      </div>
      <div class="proximo-acoes">
        <a class="botao" href="${esc(passo.destino)}">${esc(passo.acao)}</a>
        <button class="botao botao-secundario" type="button" data-acao="foco-iniciar" data-titulo="${esc(passo.titulo)}">Focar nisso</button>
      </div>
    </section>`;
}

function cardPrazos(dados, agora) {
  const prazos = dados.eventos
    .filter((e) => ehPrazoAberto(e, agora) && e.prazo - agora <= 7 * DIA)
    .sort((a, b) => a.prazo - b.prazo);

  const itens = prazos.map((e) => {
    const nivel = urgencia(e.prazo, agora);
    return `
      <li class="prazo urg-${nivel}">
        <span class="prazo-marca" aria-hidden="true"></span>
        <div>
          <p class="prazo-titulo">${esc(e.titulo)}</p>
          <p class="prazo-meta">${esc([e.disciplina, NOMES_TIPO[e.tipo] || e.tipo].filter(Boolean).join(' · '))}</p>
        </div>
        <div class="prazo-tempo">
          <span class="chip">${esc(contagemRegressiva(e.prazo, agora))}</span>
          <span class="prazo-data">${esc(diaEHora(e.prazo))}</span>
        </div>
      </li>`;
  }).join('');

  return `
    <section class="card" aria-labelledby="prazos-titulo">
      <div class="card-topo">
        <h2 class="card-titulo" id="prazos-titulo">Prazos dos próximos 7 dias</h2>
        <a class="card-link" href="#calendario">Calendário</a>
      </div>
      ${itens ? `<ul class="prazos">${itens}</ul>` : '<p class="texto-suave">Nenhum prazo nos próximos 7 dias.</p>'}
    </section>`;
}

function cardProvas(dados, agora) {
  const provas = dados.eventos
    .filter((e) => e.tipo === 'prova' && e.prazo > agora)
    .sort((a, b) => a.prazo - b.prazo)
    .slice(0, 3);

  const itens = provas.map((p) => {
    const dias = diasAte(p.prazo, agora);
    const rotulo = dias === 0 ? 'hoje' : dias === 1 ? 'dia' : 'dias';
    return `
      <li class="prova urg-${urgencia(p.prazo, agora)}">
        <div class="prova-dias" aria-hidden="true">
          <strong>${dias === 0 ? '!' : dias}</strong><span>${rotulo}</span>
        </div>
        <div>
          <p class="prova-titulo">${esc([p.titulo, p.disciplina].filter(Boolean).join(' · '))}</p>
          <p class="prova-meta">${esc(diaEHora(p.prazo))}</p>
          <p class="visualmente-oculto">${dias === 0 ? 'É hoje' : `Faltam ${dias} ${rotulo}`}</p>
        </div>
      </li>`;
  }).join('');

  return `
    <section class="card" aria-labelledby="provas-titulo">
      <div class="card-topo">
        <h2 class="card-titulo" id="provas-titulo">Provas</h2>
      </div>
      ${itens ? `<ul class="provas">${itens}</ul>` : '<p class="texto-suave">Nenhuma prova marcada.</p>'}
    </section>`;
}

function cardRevisoes(dados) {
  const total = dados.revisoes.reduce((soma, r) => soma + r.quantidade, 0);
  if (!total) {
    return `
      <section class="card" aria-labelledby="revisoes-titulo">
        <div class="card-topo"><h2 class="card-titulo" id="revisoes-titulo">Revisões pendentes</h2></div>
        <p class="texto-suave">Nenhuma questão para revisar hoje. As que você errar voltam aqui em 1, 3, 7 e 15 dias.</p>
        <a class="botao botao-secundario" href="#questoes/gerar">Gerar questões</a>
      </section>`;
  }
  const itens = dados.revisoes.map((r) => `
    <li><span>${esc(r.disciplina)}</span><strong>${r.quantidade}</strong></li>`).join('');

  return `
    <section class="card" aria-labelledby="revisoes-titulo">
      <div class="card-topo">
        <h2 class="card-titulo" id="revisoes-titulo">Revisões pendentes</h2>
      </div>
      <p class="revisao-total"><strong>${total}</strong><span class="texto-suave">${total === 1 ? 'questão para revisar hoje' : 'questões para revisar hoje'}</span></p>
      <ul class="revisao-lista">${itens}</ul>
      <button class="botao botao-secundario" type="button" data-acao="q-revisar">Revisar agora</button>
    </section>`;
}

function cardNotas(dados, agora) {
  const itens = [...dados.notas]
    .sort((a, b) => b.data - a.data)
    .map((n) => `
      <li class="nota">
        <div>
          <p class="nota-item">${esc(n.item)}</p>
          <p class="nota-meta">${esc(n.disciplina)} · ${esc(haQuantoTempo(n.data, agora))}</p>
        </div>
        <span class="nota-valor">${numeroNota(n.nota)}<small>/${numeroNota(n.maximo)}</small></span>
      </li>`).join('');

  return `
    <section class="card" aria-labelledby="notas-titulo">
      <div class="card-topo">
        <h2 class="card-titulo" id="notas-titulo">Últimas notas do AVA</h2>
        <a class="card-link" href="#faculdade">Faculdade</a>
      </div>
      ${itens ? `<ul class="notas">${itens}</ul>` : '<p class="texto-suave">Nenhuma nota nova.</p>'}
    </section>`;
}

function cardCadernos(dados, agora) {
  const itens = [...dados.cadernos]
    .sort((a, b) => b.editadoEm - a.editadoEm)
    .slice(0, 4)
    .map((c) => `
      <li>
        <a class="caderno" href="${/^c\d+$/.test(String(c.id)) ? '#cadernos' : `#cadernos/${esc(c.id)}`}">
          <div class="caderno-capa capa-${Number(c.capa) || 1} capa-estilo-${esc(c.estilo || 'lisa')}">
            <span class="caderno-capa-titulo">${esc(c.titulo)}</span>
            ${c.disciplina ? `<span class="caderno-capa-disciplina">${esc(c.disciplina)}</span>` : ''}
          </div>
          <p class="caderno-info">${c.paginas ? `${c.paginas} ${c.paginas === 1 ? 'página' : 'páginas'} · ` : ''}${esc(haQuantoTempo(c.editadoEm, agora))}</p>
        </a>
      </li>`).join('');

  return `
    <section class="card" aria-labelledby="cadernos-titulo">
      <div class="card-topo">
        <h2 class="card-titulo" id="cadernos-titulo">Cadernos recentes</h2>
        <a class="card-link" href="#cadernos">Todos os cadernos</a>
      </div>
      ${itens ? `<ul class="cadernos">${itens}</ul>` : '<p class="texto-suave">Nenhum caderno ainda. Crie o primeiro em Cadernos ou pelo botão +.</p>'}
    </section>`;
}

function cardProgresso(dados) {
  const itens = dados.areas.map((a, i) => `
    <li class="numerado">
      <span class="numerado-num">${String(i + 1).padStart(2, '0')}</span>
      <p class="numerado-titulo">${a.destino ? `<a href="${esc(a.destino)}">${esc(a.nome)}</a>` : esc(a.nome)}</p>
      <p class="numerado-detalhe">${esc(a.detalhe)}</p>
      ${barraProgresso(a.progresso, `Progresso em ${a.nome}`)}
    </li>`).join('');

  return `
    <section class="card" aria-labelledby="progresso-titulo">
      <div class="card-topo">
        <h2 class="card-titulo" id="progresso-titulo">Progresso por área</h2>
      </div>
      <ol class="numerados">${itens}</ol>
    </section>`;
}

function cardFaltas(estado) {
  const risco = disciplinasComFaltasEmRisco(estado);
  if (!risco.length) return '';
  return `
    <section class="card" aria-labelledby="faltas-titulo">
      <div class="card-topo">
        <h2 class="card-titulo" id="faltas-titulo">Atenção às faltas</h2>
        <a class="card-link" href="#faculdade">Faculdade</a>
      </div>
      <ul class="prazos">${risco.map(({ disciplina, faltas }) => `
        <li class="prazo urg-${urgenciaFaltas(faltas)}">
          <span class="prazo-marca" aria-hidden="true"></span>
          <div><p class="prazo-titulo"><a href="#faculdade/${esc(disciplina.id)}">${esc(disciplina.nome)}</a></p>
            <p class="prazo-meta">${faltas.total} de ${faltas.permitidas} faltas</p></div>
          <div class="prazo-tempo"><span class="chip">${esc(textoFaltas(faltas))}</span></div>
        </li>`).join('')}</ul>
    </section>`;
}

function cardAvisos(estado, agora) {
  const avisos = avisosRecentes(estado, 4);
  if (!avisos.length) return '';
  return `
    <section class="card" aria-labelledby="avisos-inicio">
      <div class="card-topo">
        <h2 class="card-titulo" id="avisos-inicio">Avisos da faculdade</h2>
        <a class="card-link" href="#faculdade">Faculdade</a>
      </div>
      <ul class="avisos">${avisos.map((a) => `
        <li class="aviso-item">
          <p class="aviso-titulo">${esc(a.titulo)}</p>
          <p class="nota-meta">${a.origem === 'lyceum' ? 'Lyceum' : 'AVA'}${a.data ? ` · ${esc(haQuantoTempo(new Date(a.data).getTime(), agora))}` : ''}</p>
        </li>`).join('')}</ul>
    </section>`;
}

function barraDoBloco(bloco, indice, total, proprios) {
  const proprio = Boolean(proprios[bloco.id]);
  const nome = nomeDoBloco(bloco.id, proprios);
  return `
    <div class="bloco-barra">
      <button class="bloco-alca" type="button" data-arrastar="${esc(bloco.id)}" aria-label="Arrastar ${esc(nome)}" title="Segure e arraste para mudar de lugar">
        <span class="bloco-alca-pontos" aria-hidden="true">⠿</span><span class="bloco-nome">${esc(nome)}</span>
      </button>
      <div class="bloco-controles">
        <button class="botao-icone botao-icone-p" type="button" data-acao="inicio-mover" data-id="${esc(bloco.id)}" data-passo="-1" aria-label="Subir ${esc(nome)}"${indice === 0 ? ' disabled' : ''}>↑</button>
        <button class="botao-icone botao-icone-p" type="button" data-acao="inicio-mover" data-id="${esc(bloco.id)}" data-passo="1" aria-label="Descer ${esc(nome)}"${indice === total - 1 ? ' disabled' : ''}>↓</button>
        <label class="visualmente-oculto" for="tam-${esc(bloco.id)}">Largura de ${esc(nome)}</label>
        <select id="tam-${esc(bloco.id)}" class="bloco-tamanho" data-acao-mudar="inicio-tamanho" data-id="${esc(bloco.id)}">
          ${TAMANHOS.map((t) => `<option value="${t.id}"${t.id === bloco.tamanho ? ' selected' : ''}>${t.nome}</option>`).join('')}
        </select>
        ${proprio ? `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="inicio-editar" data-id="${esc(bloco.id)}">Editar</button>` : ''}
        <button class="botao-icone botao-icone-p bloco-remover" type="button" data-acao="inicio-remover-bloco" data-id="${esc(bloco.id)}" aria-label="Remover ${esc(nome)} do Hoje" title="Tirar do Hoje">×</button>
      </div>
    </div>`;
}

function avisoVazio(nome) {
  return `<section class="card bloco-vazio"><p class="texto-suave">${esc(nome)}: nada para mostrar agora. Aparece sozinho quando tiver.</p></section>`;
}

function painelPersonalizar(blocos, proprios) {
  const fora = blocos.filter((b) => !b.visivel);
  const listaFora = fora.length ? `
    <ul class="atalhos-criar">${fora.map((b) => `
      <li class="catalogo-item">
        <span><strong>${esc(nomeDoBloco(b.id, proprios))}</strong>${proprios[b.id] ? ' <small class="campo-ajuda">· seu card</small>' : ''}</span>
        <span class="catalogo-acoes">
          <button class="botao botao-primario botao-pequeno" type="button" data-acao="inicio-adicionar" data-id="${esc(b.id)}">Adicionar</button>
          ${proprios[b.id] ? `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="inicio-remover" data-id="${esc(b.id)}">Excluir de vez</button>` : ''}
        </span>
      </li>`).join('')}</ul>` : '<p class="texto-suave">Todos os cards do app já estão no Hoje.</p>';
  return `
    <section class="card personalizar" aria-labelledby="personalizar-titulo">
      <div class="card-topo">
        <h2 class="card-titulo" id="personalizar-titulo">Personalizar o Hoje</h2>
        <button class="botao botao-primario botao-pequeno" type="button" data-acao="inicio-pronto">Pronto</button>
      </div>
      <p class="texto-suave">Segure <strong>⠿</strong> e arraste o card para onde quiser, ou use <strong>↑ ↓</strong>. No tablet e no computador, puxe o canto de baixo, à direita, para mudar a largura e a altura (dois toques no canto voltam a altura ao automático). O <strong>×</strong> tira o card do Hoje; ele fica em "Adicionar ao Hoje" para pôr de volta.</p>
      <details class="catalogo">
        <summary>Adicionar ao Hoje</summary>
        <h3 class="ava-subtitulo">Cards fora do Hoje</h3>
        ${listaFora}
        <h3 class="ava-subtitulo">Criar um card seu</h3>
        <ul class="atalhos-criar">${TIPOS_PROPRIOS.map((t) => `
          <li><button class="atalho-criar" type="button" data-acao="inicio-novo" data-tipo="${t.id}">
            <span><strong>${esc(t.nome)}</strong><small class="campo-ajuda"> · ${esc(t.descricao)}</small></span>
          </button></li>`).join('')}</ul>
      </details>
      <div class="acoes"><button class="botao botao-secundario botao-pequeno" type="button" data-acao="inicio-padrao">Voltar ao padrão</button></div>
    </section>`;
}

export function renderInicio(estado) {
  const agora = Date.now();
  const dados = estado.usandoExemplo ? estado.dados : dadosReaisDoInicio(estado, agora);
  const resumo = estado.usandoExemplo ? '' : resumoDoDia(estado, agora);
  const sub = `<span>${esc(dataLonga(new Date(agora)))}${resumo ? ` · ${esc(resumo)}` : ''}</span>${estado.usandoExemplo ? '<span class="selo">Dados de exemplo</span>' : ''}`;
  const editando = Boolean(estado.editandoInicio);
  const { blocos, proprios } = blocosDoInicio(estado);

  const doApp = {
    proximo: () => cardProximoPasso(escolherProximoPasso(dados, agora)),
    agenda: () => (estado.usandoExemplo ? '' : cardAgendaHoje(estado, agora)),
    humor: () => cardHumor(estado, agora),
    tarefas: () => cardTarefasHoje(estado),
    projetos: () => cardProjetosHoje(estado),
    prazos: () => cardPrazos(dados, agora),
    provas: () => cardProvas(dados, agora),
    plano: () => (estado.usandoExemplo ? '' : cardPlano(estado, { agora })),
    revisoes: () => cardRevisoes(dados),
    notas: () => cardNotas(dados, agora),
    faltas: () => (estado.usandoExemplo ? '' : cardFaltas(estado)),
    avisos: () => (estado.usandoExemplo ? '' : cardAvisos(estado, agora)),
    youtube: () => ((estado.videos || []).some((v) => !v.excluido_em) ? cardYoutubeInicio(estado, agora) : ''),
    foco: () => cardFocoInicio(estado),
    resumo: () => (estado.usandoExemplo ? '' : cardResumoInicio(estado)),
    leituras: () => (estado.usandoExemplo ? '' : cardLeiturasInicio(estado)),
    substack: () => (estado.usandoExemplo ? '' : cardSubstackInicio(estado, agora)),
    caixa: () => cardCaixaEntrada(estado.caixa || [], agora),
    cadernos: () => cardCadernos(dados, agora),
    progresso: () => cardProgresso(dados),
  };

  const visiveis = blocos.filter((b) => b.visivel);
  const html = visiveis.map((bloco, i) => {
    let conteudo = proprios[bloco.id] ? renderProprio(bloco.id, proprios[bloco.id], agora) : doApp[bloco.id]();
    if (!conteudo && !editando) return '';
    if (!conteudo) conteudo = avisoVazio(nomeDoBloco(bloco.id, proprios));
    const classes = ['bloco', `tam-${bloco.tamanho.replace('/', '-')}`, editando && 'editando', bloco.altura && 'com-altura'].filter(Boolean).join(' ');
    const estilo = bloco.altura ? ` style="--altura: ${bloco.altura}px"` : '';
    return `
      <div class="${classes}" data-bloco="${esc(bloco.id)}" data-tamanho="${esc(bloco.tamanho)}"${estilo}>
        ${editando ? barraDoBloco(bloco, i, visiveis.length, proprios) : ''}
        <div class="bloco-conteudo"${editando ? ' inert' : ''}>${conteudo}</div>
        ${editando ? `<span class="bloco-canto" data-redimensionar="${esc(bloco.id)}" role="presentation" title="Puxe para mudar o tamanho"></span>` : ''}
      </div>`;
  }).join('');

  return `
    ${cabecalho(saudacao(dados.nome, new Date(agora)), sub)}
    ${editando ? painelPersonalizar(blocos, proprios) : '<div class="acoes-topo"><button class="botao botao-secundario botao-pequeno" type="button" data-acao="inicio-personalizar">Personalizar</button></div>'}
    <div class="painel${editando ? ' painel-editando' : ''}">${html}</div>`;
}
