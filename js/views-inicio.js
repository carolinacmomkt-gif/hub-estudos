// Tela Início: saudação, "Próximo passo" e cards de resumo.

import { cabecalho, barraProgresso } from './componentes.js';
import { cardCaixaEntrada } from './views-criar.js';
import {
  esc, saudacao, dataLonga, diaEHora, contagemRegressiva, urgencia,
  diasAte, haQuantoTempo, numeroNota, DIA,
} from './utilidades.js';

const NOMES_TIPO = {
  prova: 'Prova', trabalho: 'Trabalho', atividade: 'Atividade',
  aula: 'Aula', feriado: 'Feriado', pessoal: 'Pessoal',
};

// Prioridade: prova próxima (7 dias) > entrega pendente > revisão pendente > leitura.
export function escolherProximoPasso(dados, agora = Date.now()) {
  const pendentes = dados.eventos
    .filter((e) => e.status !== 'entregue')
    .sort((a, b) => a.prazo - b.prazo);

  const prova = pendentes.find((e) => e.tipo === 'prova' && e.prazo > agora && e.prazo - agora <= 7 * DIA);
  if (prova) {
    const dias = diasAte(prova.prazo, agora);
    return {
      titulo: `Revisar para a ${prova.titulo} de ${prova.disciplina}`,
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
      texto: `${entrega.disciplina} · ${contagemRegressiva(entrega.prazo, agora)}.`,
      acao: 'Ver na Faculdade',
      destino: '#faculdade',
    };
  }

  const totalRevisoes = dados.revisoes.reduce((soma, r) => soma + r.quantidade, 0);
  if (totalRevisoes > 0) {
    return {
      titulo: `Revisar ${totalRevisoes} ${totalRevisoes === 1 ? 'questão' : 'questões'}`,
      texto: 'Refazer as que você errou é o que mais fixa o conteúdo.',
      acao: 'Revisar agora',
      destino: '#questoes',
    };
  }

  const leitura = dados.leituras.find((l) => l.status === 'lendo' || l.status === 'ler');
  if (leitura) {
    return {
      titulo: `Continuar a leitura: ${leitura.titulo}`,
      texto: 'Nada urgente por agora. Bom momento para ler com calma.',
      acao: 'Abrir a Biblioteca',
      destino: '#biblioteca',
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
      <a class="botao" href="${esc(passo.destino)}">${esc(passo.acao)}</a>
    </section>`;
}

function cardPrazos(dados, agora) {
  const prazos = dados.eventos
    .filter((e) => e.status !== 'entregue' && e.prazo - agora <= 7 * DIA)
    .sort((a, b) => a.prazo - b.prazo);

  const itens = prazos.map((e) => {
    const nivel = urgencia(e.prazo, agora);
    return `
      <li class="prazo urg-${nivel}">
        <span class="prazo-marca" aria-hidden="true"></span>
        <div>
          <p class="prazo-titulo">${esc(e.titulo)}</p>
          <p class="prazo-meta">${esc(e.disciplina)} · ${esc(NOMES_TIPO[e.tipo] || e.tipo)}</p>
        </div>
        <div class="prazo-tempo">
          <span class="chip">${esc(contagemRegressiva(e.prazo, agora))}</span>
          <span class="prazo-data">${esc(diaEHora(e.prazo))}</span>
        </div>
      </li>`;
  }).join('');

  return `
    <section class="card l-7 t-12" aria-labelledby="prazos-titulo">
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
          <p class="prova-titulo">${esc(p.titulo)} · ${esc(p.disciplina)}</p>
          <p class="prova-meta">${esc(diaEHora(p.prazo))}</p>
          <p class="visualmente-oculto">${dias === 0 ? 'É hoje' : `Faltam ${dias} ${rotulo}`}</p>
        </div>
      </li>`;
  }).join('');

  return `
    <section class="card l-5 t-6" aria-labelledby="provas-titulo">
      <div class="card-topo">
        <h2 class="card-titulo" id="provas-titulo">Provas</h2>
      </div>
      ${itens ? `<ul class="provas">${itens}</ul>` : '<p class="texto-suave">Nenhuma prova marcada.</p>'}
    </section>`;
}

function cardRevisoes(dados) {
  const total = dados.revisoes.reduce((soma, r) => soma + r.quantidade, 0);
  const itens = dados.revisoes.map((r) => `
    <li><span>${esc(r.disciplina)}</span><strong>${r.quantidade}</strong></li>`).join('');

  return `
    <section class="card l-5 t-6" aria-labelledby="revisoes-titulo">
      <div class="card-topo">
        <h2 class="card-titulo" id="revisoes-titulo">Revisões pendentes</h2>
      </div>
      <p class="revisao-total"><strong>${total}</strong><span class="texto-suave">${total === 1 ? 'questão para revisar hoje' : 'questões para revisar hoje'}</span></p>
      <ul class="revisao-lista">${itens}</ul>
      <a class="botao botao-secundario" href="#questoes">Revisar agora</a>
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
    <section class="card l-7 t-12" aria-labelledby="notas-titulo">
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
        <a class="caderno" href="#cadernos">
          <div class="caderno-capa capa-${Number(c.capa) || 1}">
            <span class="caderno-capa-titulo">${esc(c.titulo)}</span>
            <span class="caderno-capa-disciplina">${esc(c.disciplina)}</span>
          </div>
          <p class="caderno-info">${c.paginas} páginas · ${esc(haQuantoTempo(c.editadoEm, agora))}</p>
        </a>
      </li>`).join('');

  return `
    <section class="card" aria-labelledby="cadernos-titulo">
      <div class="card-topo">
        <h2 class="card-titulo" id="cadernos-titulo">Cadernos recentes</h2>
        <a class="card-link" href="#cadernos">Todos os cadernos</a>
      </div>
      <ul class="cadernos">${itens}</ul>
    </section>`;
}

function cardProgresso(dados) {
  const itens = dados.areas.map((a, i) => `
    <li class="numerado">
      <span class="numerado-num">${String(i + 1).padStart(2, '0')}</span>
      <p class="numerado-titulo">${esc(a.nome)}</p>
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

export function renderInicio(estado) {
  const agora = Date.now();
  const { dados } = estado;
  const sub = `<span>${esc(dataLonga(new Date(agora)))}</span>${estado.usandoExemplo ? '<span class="selo">Dados de exemplo</span>' : ''}`;

  return `
    ${cabecalho(saudacao(dados.nome, new Date(agora)), sub)}
    <div class="painel">
      ${cardProximoPasso(escolherProximoPasso(dados, agora))}
      ${cardPrazos(dados, agora)}
      ${cardProvas(dados, agora)}
      ${cardRevisoes(dados)}
      ${cardNotas(dados, agora)}
      ${cardCaixaEntrada(estado.caixa || [], agora)}
      ${cardCadernos(dados, agora)}
      ${cardProgresso(dados)}
    </div>`;
}
