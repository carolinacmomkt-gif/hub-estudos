// Tela Faculdade: painel geral com as disciplinas e um painel por disciplina.

import { cabecalho, barraProgresso } from './componentes.js';
import { icone } from './icones.js';
import { enderecoDoAva } from './nuvem.js';
import {
  esc, diaEHora, contagemRegressiva, urgencia, haQuantoTempo, numeroNota,
} from './utilidades.js';
import {
  disciplinasAtivas, eventosDaDisciplina, frequenciaDaDisciplina, situacaoFaltas, textoFaltas, urgenciaFaltas,
  notasLyceumDaDisciplina, notasAvaDaDisciplina, provasDaCalculadora, calcularMedia, situacaoDoEvento, avisosRecentes,
} from './dados-faculdade.js';

const NOMES_TIPO = { prova: 'Prova', trabalho: 'Trabalho', atividade: 'Atividade', aula: 'Aula', feriado: 'Feriado', pessoal: 'Pessoal' };
const NOMES_STATUS = { entregue: 'Entregue', atrasado: 'Atrasado', pendente: 'Pendente' };
const NOMES_MATERIAL = { resource: 'Arquivo', url: 'Link', page: 'Página', folder: 'Pasta', book: 'Livro' };

// Só links http(s) vindos dos dados viram href.
function linkSeguro(url) {
  return /^https?:\/\//i.test(String(url || '')) ? url : null;
}

function botaoSincronizar(estado) {
  const s = estado.faculdade || {};
  const rodando = s.estado === 'sincronizando';
  return `
    <div class="faculdade-sinc">
      <button class="botao botao-secundario" type="button" data-acao="sincronizar-faculdade" ${rodando ? 'disabled' : ''}>
        ${rodando ? 'Sincronizando…' : 'Sincronizar agora'}
      </button>
      <span class="texto-suave" data-situacao-faculdade>${esc(textoSituacaoFaculdade(estado))}</span>
    </div>`;
}

export function textoSituacaoFaculdade(estado) {
  const s = estado.faculdade || {};
  if (s.estado === 'sincronizando') return s.passo || 'Sincronizando…';
  if (s.estado === 'erro' && s.erros?.length) return s.erros[0];
  const ultimas = (estado.conexoes || []).map((c) => c.ultima_sincronizacao).filter(Boolean).sort();
  const ultima = ultimas[ultimas.length - 1];
  return ultima ? `Atualizado ${haQuantoTempo(new Date(ultima).getTime())}` : 'Ainda não sincronizado';
}

function semConexao() {
  return `
    <section class="card vazio">
      <div class="vazio-icone">${icone('faculdade')}</div>
      <h2>Conecte o AVA e o Lyceum</h2>
      <p class="texto-suave">Com as duas conexões, suas disciplinas, prazos, notas e faltas aparecem aqui e se atualizam sozinhos.</p>
      <a class="botao botao-primario" href="#configuracoes">Ir para Configurações</a>
    </section>`;
}

function cardDisciplina(estado, d, indice, agora) {
  const faltas = situacaoFaltas(frequenciaDaDisciplina(estado, d.id));
  const proximo = eventosDaDisciplina(estado, d.id).find((e) => new Date(e.inicio).getTime() >= agora && situacaoDoEvento(e, agora) !== 'entregue');
  const media = d.dados?.media;
  const linhaMedia = [media !== null && media !== undefined ? `Média ${numeroNota(media)}` : null, d.dados?.situacao].filter(Boolean).join(' · ');
  return `
    <li>
      <a class="disciplina-card" href="#faculdade/${esc(d.id)}">
        <span class="numerado-num">${String(indice + 1).padStart(2, '0')}</span>
        <span class="disciplina-nome">${esc(d.nome)}</span>
        ${d.professor ? `<span class="disciplina-meta">${esc(d.professor)}</span>` : ''}
        ${linhaMedia ? `<span class="disciplina-meta">${esc(linhaMedia)}</span>` : ''}
        <span class="chip urg-${urgenciaFaltas(faltas)}">${esc(textoFaltas(faltas))}</span>
        ${proximo ? `<span class="disciplina-meta">Próximo: ${esc(proximo.titulo)} · ${esc(contagemRegressiva(new Date(proximo.inicio).getTime(), agora))}</span>` : ''}
        ${faltas?.presenca !== null && faltas?.presenca !== undefined ? barraProgresso(Number(faltas.presenca) / 100, `Presença em ${d.nome}`) : ''}
      </a>
    </li>`;
}

function listaAvisos(avisos, agora) {
  if (!avisos.length) return '<p class="texto-suave">Nenhum aviso por enquanto.</p>';
  return `<ul class="avisos">${avisos.map((a) => {
    const link = linkSeguro(a.link);
    return `
      <li class="aviso-item">
        <p class="aviso-titulo">${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(a.titulo)}</a>` : esc(a.titulo)}</p>
        <p class="nota-meta">${a.origem === 'lyceum' ? 'Lyceum' : 'AVA'}${a.data ? ` · ${esc(haQuantoTempo(new Date(a.data).getTime(), agora))}` : ''}</p>
        ${a.texto ? `<p class="aviso-texto">${esc(a.texto.slice(0, 280))}${a.texto.length > 280 ? '…' : ''}</p>` : ''}
      </li>`;
  }).join('')}</ul>`;
}

function painelGeral(estado) {
  const agora = Date.now();
  const conectadas = (estado.conexoes || []).filter((c) => c.status === 'conectado' || c.status === 'reconectar');
  const disciplinas = disciplinasAtivas(estado);
  const sub = disciplinas.length ? `${disciplinas.length} ${disciplinas.length === 1 ? 'disciplina' : 'disciplinas'} neste semestre` : 'UniEVANGÉLICA';

  let corpo;
  if (!conectadas.length) corpo = semConexao();
  else if (!disciplinas.length) {
    corpo = `<section class="card vazio"><div class="vazio-icone">${icone('faculdade')}</div><h2>Buscando suas disciplinas</h2>
      <p class="texto-suave">A primeira sincronização leva alguns segundos. Se demorar, toque em "Sincronizar agora".</p></section>`;
  } else {
    corpo = `
      <ul class="disciplinas">${disciplinas.map((d, i) => cardDisciplina(estado, d, i, agora)).join('')}</ul>
      <section class="card" aria-labelledby="avisos-faculdade">
        <div class="card-topo"><h2 class="card-titulo" id="avisos-faculdade">Avisos recentes</h2></div>
        ${listaAvisos(avisosRecentes(estado, 6), agora)}
      </section>`;
  }

  const alertas = (estado.conexoes || []).filter((c) => c.status === 'reconectar').map((c) => `
    <div class="ava-alerta" role="alert">${esc(c.detalhe?.mensagem || `O ${c.servico === 'ava' ? 'AVA' : 'Lyceum'} pediu para conectar de novo.`)}
      <a class="card-link" href="#configuracoes">Conectar de novo</a></div>`).join('');

  // Disciplinas do AVA que o app considerou de outros semestres (a Carol pode trazer de volta).
  const foraDoSemestre = (estado.disciplinas || [])
    .filter((d) => d.ava_course_id && d.arquivada && !d.excluido_em)
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  const blocoFora = foraDoSemestre.length ? `
    <details class="detalhes card">
      <summary>Disciplinas do AVA fora deste semestre <span class="selo">${foraDoSemestre.length}</span></summary>
      <p class="texto-suave">Se alguma delas é deste semestre, toque em "É deste semestre" e ela passa a aparecer com as atividades e os materiais.</p>
      <ul class="materiais">${foraDoSemestre.map((d) => `
        <li class="material material-acao">
          <span>${esc(d.nome_ava || d.nome)}</span>
          <button class="botao botao-secundario botao-pequeno" type="button" data-acao="ava-curso-ativo" data-curso="${esc(d.ava_course_id)}">É deste semestre</button>
        </li>`).join('')}</ul>
    </details>` : '';

  return `
    ${cabecalho('Faculdade', esc(sub))}
    <div class="pilha pilha-larga">
      ${conectadas.length ? botaoSincronizar(estado) : ''}
      ${alertas}
      ${corpo}
      ${blocoFora}
    </div>`;
}

function cardFrequencia(estado, d) {
  const freq = frequenciaDaDisciplina(estado, d.id);
  const s = situacaoFaltas(freq);
  if (!freq) {
    return `<section class="card l-5 t-6"><h2 class="card-titulo">Frequência</h2>
      <p class="texto-suave">A frequência desta disciplina ainda não veio do Lyceum.</p></section>`;
  }
  return `
    <section class="card l-5 t-6" aria-labelledby="freq-titulo">
      <div class="card-topo"><h2 class="card-titulo" id="freq-titulo">Frequência</h2></div>
      <p class="frequencia-numero"><strong>${s.total}</strong><span class="texto-suave">${s.permitidas !== null ? ` de ${s.permitidas} faltas permitidas` : ' faltas'}</span></p>
      <span class="chip urg-${urgenciaFaltas(s)}">${esc(textoFaltas(s))}</span>
      ${s.presenca !== null && s.presenca !== undefined ? barraProgresso(Number(s.presenca) / 100, 'Presença') : ''}
      ${s.marcadas ? `<p class="campo-ajuda">Inclui ${s.marcadas} ${s.marcadas === 1 ? 'falta marcada' : 'faltas marcadas'} por você que o Lyceum ainda não registrou.</p>` : ''}
      <div class="acoes">
        <button class="botao botao-secundario" type="button" data-acao="faltei-hoje" data-id="${esc(freq.id)}">Faltei hoje</button>
        ${s.marcadas ? `<button class="botao botao-secundario" type="button" data-acao="desfazer-falta" data-id="${esc(freq.id)}">Desfazer</button>` : ''}
      </div>
    </section>`;
}

function cardNotas(estado, d, agora) {
  const lyceum = notasLyceumDaDisciplina(estado, d.id);
  const ava = notasAvaDaDisciplina(estado, d.id);
  const media = d.dados?.media;
  const linhas = (lista, origem) => lista.map((n) => `
    <li class="nota">
      <div>
        <p class="nota-item">${esc(origem === 'lyceum' ? n.prova : n.item)}</p>
        <p class="nota-meta">${origem === 'lyceum' ? 'Lyceum' : 'AVA'}${(n.data_nota || n.data) ? ` · ${esc(haQuantoTempo(new Date(n.data_nota || n.data).getTime(), agora))}` : ''}</p>
      </div>
      <span class="nota-valor">${n.nota !== null && n.nota !== undefined ? numeroNota(Number(n.nota)) : '—'}${n.nota_maxima ? `<small>/${numeroNota(Number(n.nota_maxima))}</small>` : ''}</span>
    </li>`).join('');
  const vazio = !lyceum.length && !ava.length;
  return `
    <section class="card l-7 t-12" aria-labelledby="notas-disc">
      <div class="card-topo">
        <h2 class="card-titulo" id="notas-disc">Notas</h2>
        ${media !== null && media !== undefined ? `<span class="selo">Média ${numeroNota(media)}${d.dados?.situacao ? ` · ${esc(d.dados.situacao)}` : ''}</span>` : ''}
      </div>
      ${vazio ? '<p class="texto-suave">Nenhuma nota lançada ainda.</p>' : `<ul class="notas">${linhas(lyceum, 'lyceum')}${linhas(ava, 'ava')}</ul>`}
    </section>`;
}

function resultadoMedia(r, meta) {
  if (!r) return 'Sem provas para calcular ainda.';
  if (r.final !== undefined) {
    return r.aprovada
      ? `Média final ${numeroNota(r.final)}: você passou da média ${numeroNota(meta)}.`
      : `Média final ${numeroNota(r.final)}: abaixo da média ${numeroNota(meta)}.`;
  }
  const quais = r.faltam === 1 ? 'na prova que falta' : `em cada uma das ${r.faltam} provas que faltam`;
  if (r.garantida) return `Você já garantiu a média ${numeroNota(meta)}, mesmo tirando zero ${quais}.`;
  if (!r.possivel) return `Mesmo com 10 ${quais}, não chega à média ${numeroNota(meta)}. Converse com o professor sobre recuperação.`;
  return `Você precisa de ${numeroNota(Math.ceil(r.necessaria * 10) / 10)} ${quais} para chegar à média ${numeroNota(meta)}.`;
}

function cardCalculadora(estado, d) {
  const provas = provasDaCalculadora(estado, d.id);
  const pesos = d.pesos?.pesos || {};
  const meta = Number(d.pesos?.meta ?? 7);
  const r = calcularMedia(provas, pesos, meta);
  return `
    <section class="card l-7 t-12" aria-labelledby="calc-titulo">
      <div class="card-topo"><h2 class="card-titulo" id="calc-titulo">Calculadora de média</h2></div>
      ${provas.length ? `
        <form class="calculadora" data-form="calculadora" data-id="${esc(d.id)}" novalidate>
          <label class="campo campo-curto">
            <span class="campo-rotulo">Média para aprovar</span>
            <input name="meta" type="number" inputmode="decimal" min="0" max="10" step="0.1" value="${esc(meta)}">
          </label>
          <div class="calculadora-provas">
            ${provas.map((p) => `
              <label class="campo campo-curto">
                <span class="campo-rotulo">${esc(p.nome)} <small>${p.nota !== null && p.nota !== undefined ? `nota ${numeroNota(Number(p.nota))}` : 'sem nota'}</small></span>
                <input name="peso" data-chave="${esc(p.chave)}" type="number" inputmode="decimal" min="0" step="0.5" value="${esc(pesos[p.chave] ?? 1)}" aria-label="Peso de ${esc(p.nome)}">
              </label>`).join('')}
          </div>
          <p class="campo-ajuda">Os números são os pesos de cada prova (1 = peso normal). Confira no plano de ensino da disciplina.</p>
        </form>
        <p class="calculadora-resultado" id="calc-resultado" aria-live="polite">${esc(resultadoMedia(r, meta))}</p>`
        : '<p class="texto-suave">As provas aparecem aqui quando o Lyceum ou o AVA tiverem notas desta disciplina.</p>'}
    </section>`;
}

export function atualizarResultadoCalculadora(estado, disciplina) {
  const el = document.getElementById('calc-resultado');
  if (!el) return;
  const meta = Number(disciplina.pesos?.meta ?? 7);
  el.textContent = resultadoMedia(calcularMedia(provasDaCalculadora(estado, disciplina.id), disciplina.pesos?.pesos || {}, meta), meta);
}

function cardPrazos(estado, d, agora) {
  const eventos = eventosDaDisciplina(estado, d.id);
  // Em cima: o que está atrasado e o que vem pela frente. Embaixo ("Anteriores"): o resto do que já passou.
  const atrasados = eventos.filter((e) => new Date(e.inicio).getTime() < agora && situacaoDoEvento(e, agora) === 'atrasado');
  const futuros = [...atrasados, ...eventos.filter((e) => new Date(e.inicio).getTime() >= agora)];
  const passados = eventos.filter((e) => new Date(e.inicio).getTime() < agora && !atrasados.includes(e)).reverse().slice(0, 5);
  const item = (e) => {
    const t = new Date(e.inicio).getTime();
    const situacao = situacaoDoEvento(e, agora);
    const nivel = situacao === 'entregue' ? 'futuro' : urgencia(t, agora);
    const link = linkSeguro(e.link);
    return `
      <li class="prazo urg-${nivel}">
        <span class="prazo-marca" aria-hidden="true"></span>
        <div>
          <p class="prazo-titulo">${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(e.titulo)}</a>` : esc(e.titulo)}</p>
          <p class="prazo-meta">${esc(NOMES_TIPO[e.tipo] || e.tipo)}${situacao ? ` · ${esc(NOMES_STATUS[situacao] || situacao)}` : ''}</p>
        </div>
        <div class="prazo-tempo">
          ${situacao !== 'entregue' ? `<span class="chip">${esc(contagemRegressiva(t, agora))}</span>` : '<span class="chip">Entregue</span>'}
          <span class="prazo-data">${esc(diaEHora(t))}</span>
        </div>
      </li>`;
  };
  return `
    <section class="card" aria-labelledby="prazos-disc">
      <div class="card-topo"><h2 class="card-titulo" id="prazos-disc">Atividades e prazos</h2></div>
      ${futuros.length ? `<ul class="prazos">${futuros.map(item).join('')}</ul>` : '<p class="texto-suave">Nenhum prazo pela frente.</p>'}
      ${passados.length ? `<details class="detalhes"><summary>Anteriores</summary><ul class="prazos">${passados.map(item).join('')}</ul></details>` : ''}
    </section>`;
}

function cardMateriais(estado, d) {
  const materiais = (estado.materiais || []).filter((m) => m.disciplina_id === d.id && !m.excluido_em);
  if (!materiais.length) {
    return '<section class="card"><h2 class="card-titulo">Materiais</h2><p class="texto-suave">Os materiais aparecem aqui depois da sincronização com o AVA.</p></section>';
  }
  const porSecao = new Map();
  for (const m of materiais) {
    const secao = m.dados?.secao || 'Geral';
    if (!porSecao.has(secao)) porSecao.set(secao, []);
    porSecao.get(secao).push(m);
  }
  const grupos = [...porSecao].map(([secao, itens]) => `
    <details class="detalhes" ${porSecao.size <= 2 ? 'open' : ''}>
      <summary>${esc(secao)} <span class="selo">${itens.length}</span></summary>
      <ul class="materiais">${itens.map((m) => {
        const link = linkSeguro(m.dados?.linkExterno) || linkSeguro(m.url);
        return `
          <li class="material">
            <span class="selo">${esc(NOMES_MATERIAL[m.tipo] || m.tipo)}</span>
            ${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(m.titulo)}</a>` : `<span>${esc(m.titulo)}</span>`}
          </li>`;
      }).join('')}</ul>
    </details>`).join('');
  return `<section class="card" aria-labelledby="materiais-disc"><h2 class="card-titulo" id="materiais-disc">Materiais</h2>${grupos}</section>`;
}

function cardJuntar(estado, d) {
  const outras = disciplinasAtivas(estado).filter((x) => x.id !== d.id);
  if (!outras.length) return '';
  return `
    <details class="detalhes card">
      <summary>Esta disciplina apareceu duplicada?</summary>
      <p class="texto-suave">Às vezes o nome no AVA e no Lyceum é diferente e a mesma matéria aparece duas vezes. Escolha a outra para juntar as duas em uma só.</p>
      <form class="formulario" data-form="juntar-disciplina" data-id="${esc(d.id)}">
        <label class="campo">
          <span class="campo-rotulo">Juntar com</span>
          <select name="outra">${outras.map((o) => `<option value="${esc(o.id)}">${esc(o.nome)}</option>`).join('')}</select>
        </label>
        <div><button class="botao botao-secundario" type="submit">Juntar</button></div>
      </form>
    </details>`;
}

function painelDisciplina(estado, id) {
  const d = (estado.disciplinas || []).find((x) => x.id === id && !x.excluido_em);
  if (!d) {
    return `${cabecalho('Disciplina')}<section class="card"><p class="texto-suave">Essa disciplina não foi encontrada.</p><a class="botao botao-secundario" href="#faculdade">Voltar para a Faculdade</a></section>`;
  }
  const agora = Date.now();
  const base = enderecoDoAva();
  const linkAva = d.ava_course_id && base ? `${base}/course/view.php?id=${encodeURIComponent(d.ava_course_id)}` : null;
  const sub = [d.professor, d.turma ? `Turma ${d.turma}` : null, d.ano ? `${d.ano}/${d.semestre}` : null].filter(Boolean).map(esc).join(' · ');
  const avisos = (estado.avisos || []).filter((a) => a.disciplina_id === d.id && !a.excluido_em)
    .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));

  return `
    <a class="voltar" href="#faculdade">← Faculdade</a>
    ${cabecalho(d.nome, sub)}
    <div class="acoes acoes-topo">
      ${linkAva ? `<a class="botao botao-secundario" href="${esc(linkAva)}" target="_blank" rel="noopener">Abrir no AVA</a>` : ''}
      ${d.ava_course_id ? `<button class="botao botao-secundario" type="button" data-acao="ava-curso-esconder" data-curso="${esc(d.ava_course_id)}">Não é deste semestre</button>` : ''}
    </div>
    <div class="painel">
      ${cardFrequencia(estado, d)}
      ${cardNotas(estado, d, agora)}
      ${cardCalculadora(estado, d)}
      <section class="card l-5 t-12" aria-labelledby="avisos-disc">
        <div class="card-topo"><h2 class="card-titulo" id="avisos-disc">Avisos</h2></div>
        ${listaAvisos(avisos.slice(0, 5), agora)}
      </section>
      ${cardPrazos(estado, d, agora)}
      ${cardMateriais(estado, d)}
      ${cardJuntar(estado, d)}
    </div>`;
}

export function renderFaculdade(estado) {
  return estado.parametro ? painelDisciplina(estado, estado.parametro) : painelGeral(estado);
}
