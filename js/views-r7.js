// Telas da R7 (quarta casa do Trabalho; Carol, 16/11/2026): a lista de clientes com o contador do
// contrato e a ficha completa de cada um (identificação, briefing, rotina, voz, equipe, links,
// acessos e memória). Só desenha; as ações ficam em eventos-r7.js.
// Rotas: #r7 (ou #r7/clientes), #r7/novo, #r7/cliente:<chave> e #r7/cronograma:<chave>[:<início>].

import { esc } from './utilidades.js';
import { cabecalho } from './componentes.js';
import { ESPECIALIDADES, GRUPOS_ESPECIALIDADE, especialidade } from './especialidades.js';
import {
  DIAS, FORMATOS, TIPOS_VIDEO, MODELOS_STORY, ESTILO_VISUAL, ESTILO_CONTEUDO, CAMPOS_VOZ, LISTAS_VOZ,
  conferirFichaR7, contadorR7, configR7, fontesDaVoz, checarVoz,
} from './dados-r7.js';
import { telaCronograma, linhaDoCronograma } from './views-cronograma.js';
import { cardSemanaR7, telaVideos, linhaDoTrello, cardRobo } from './views-robo.js';
import { chaveDoTrello, configPublica } from './nuvem.js';

export const ABAS_R7 = [
  ['identificacao', 'Identificação'], ['briefing', 'Briefing'], ['rotina', 'Rotina'], ['voz', 'Voz'],
  ['equipe', 'Equipe e contato'], ['links', 'Links'], ['acessos', 'Acessos'], ['memoria', 'Memória'],
];

export const clientesR7 = (estado) => (estado.clientesTrabalho || []).filter((c) => !c.excluido_em && c.casa === 'r7')
  .sort((a, z) => String(a.nome).localeCompare(String(z.nome), 'pt-BR'));
export const fichaDe = (c) => conferirFichaR7(c?.dados?.r7 || {});

export function renderR7(estado) {
  const p = estado.parametro || '';
  if (p === 'novo') return telaNovo(estado);
  if (p === 'videos') return telaVideos(estado, clientesR7(estado), fichaDe);
  if (p.startsWith('cronograma:')) {
    const [chave, inicio] = p.slice(11).split(':');
    const c = clientesR7(estado).find((x) => x.chave === chave);
    return c ? telaCronograma(estado, c, fichaDe(c), inicio) : `${cabecalho('Cliente não encontrado', 'Ele pode ter sido apagado.', '<a class="botao botao-secundario" href="#r7">← Clientes da R7</a>')}`;
  }
  if (p.startsWith('cliente:')) {
    const c = clientesR7(estado).find((x) => x.chave === p.slice(8));
    return c ? telaFicha(estado, c) : `${cabecalho('Cliente não encontrado', 'Ele pode ter sido apagado.', '<a class="botao botao-secundario" href="#r7">← Clientes da R7</a>')}`;
  }
  return telaLista(estado);
}

function datalistEspecialidades() {
  const grupo = Object.fromEntries(GRUPOS_ESPECIALIDADE.map((g) => [g.id, g.nome]));
  return `<datalist id="r7-especialidades">${ESPECIALIDADES.map((e) => `<option value="${esc(e.nome)}" label="${esc(grupo[e.grupo] || '')}"></option>`).join('')}</datalist>`;
}

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------

function telaLista(estado) {
  const cfg = configR7(estado.config);
  const todos = (estado.clientesTrabalho || []).filter((c) => !c.excluido_em);
  const lista = clientesR7(estado);
  const conta = contadorR7(todos, cfg.limite);
  const extras = new Set(conta.extras);
  const DIA = (n) => DIAS.find((d) => d.n === Number(n))?.curto || '';
  return `
    ${cabecalho('R7', 'Os clientes da R7 Estratégias Digitais: ficha completa, rotina de postagem, voz de cada um e os acessos guardados com segurança.', '<a class="botao botao-primario" href="#r7/novo">+ Novo cliente</a>')}
    ${lista.length ? cardSemanaR7(estado, lista, fichaDe) : ''}
    <section class="card r7-contador" aria-label="Clientes do contrato">
      <div>
        <p class="r7-numero"><strong class="num">${conta.total}</strong> <span>de ${conta.limite} clientes</span></p>
        <p class="campo-ajuda">${conta.extras.length ? `${conta.extras.length} ${conta.extras.length === 1 ? 'cliente passa' : 'clientes passam'} do contrato e ${conta.extras.length === 1 ? 'conta' : 'contam'} como extra.` : 'O contrato prevê até ' + conta.limite + '. Do ' + (conta.limite + 1) + 'º em diante, o cliente conta como extra.'}</p>
      </div>
      <div class="r7-barra" role="img" aria-label="${conta.dentro} de ${conta.limite}"><span style="width:${Math.min(100, Math.round((conta.dentro / conta.limite) * 100))}%"></span></div>
    </section>
    ${lista.length ? `
      <ul class="r7-clientes">${lista.map((c) => {
        const f = fichaDe(c);
        const esp = especialidade(f.identificacao.especialidade);
        const feed = f.rotina.feed.map((x) => DIA(x.dia)).join(', ');
        return `
        <li><a class="card r7-cliente" href="#r7/cliente:${esc(c.chave)}">
          <span class="r7-cliente-topo"><strong>${esc(c.nome)}</strong>${extras.has(c.chave) ? '<span class="selo r7-extra">Extra</span>' : ''}</span>
          <span class="campo-ajuda">${esc([esp?.nome, f.identificacao.instagram].filter(Boolean).join(' · ') || 'Especialidade a definir')}</span>
          <span class="r7-cliente-linha">${esc([f.equipe.designer && `Design: ${f.equipe.designer}`, feed && `Feed: ${feed}`, f.rotina.grupo ? `Grupo ${f.rotina.grupo}` : 'Rodízio a definir'].filter(Boolean).join(' · '))}</span>
          <span class="r7-cliente-cron">${esc(linhaDoCronograma(estado, c, f))}</span>
          ${linhaDoTrello(estado, c, f) ? `<span class="r7-cliente-linha">Trello: ${esc(linhaDoTrello(estado, c, f))}</span>` : ''}
        </a></li>`;
      }).join('')}</ul>`
    : `<section class="card"><p class="texto-suave">Nenhum cliente da R7 ainda. Toque em "+ Novo cliente" para começar o cadastro.</p></section>`}
    <details class="card r7-config">
      <summary class="card-titulo">Ajustes da R7</summary>
      <form class="formulario" data-form="r7-config" novalidate>
        <label class="campo"><span class="campo-rotulo">Clientes no contrato</span>
          <input name="limite" type="number" min="1" max="50" value="${esc(String(cfg.limite))}"></label>
        <label class="campo"><span class="campo-rotulo">Quadros dos designers no Trello (um por linha)</span>
          <textarea name="quadros" rows="4" placeholder="O nome de cada quadro, igual ao do Trello">${esc(cfg.quadros.join('\n'))}</textarea>
          <span class="campo-ajuda">Ficam só no seu banco, nunca no código do app.</span></label>
        <label class="campo"><span class="campo-rotulo">Grupo de gestão (para onde vai a demanda de vídeos)</span>
          <input name="grupoGestao" type="text" maxlength="120" value="${esc(cfg.grupoGestao)}" placeholder="Nome do grupo no WhatsApp"></label>
        <div class="acoes"><button class="botao botao-primario" type="submit">Salvar ajustes</button></div>
      </form>
      ${cardRobo(estado, { supabaseUrl: configPublica().supabaseUrl, chaveTrello: chaveDoTrello() })}
    </details>`;
}

function telaNovo() {
  return `
    ${cabecalho('Novo cliente da R7', 'Comece pelo nome e pela especialidade; o resto da ficha você completa depois.', '<a class="botao botao-secundario" href="#r7">← Clientes da R7</a>')}
    <form class="card formulario r7-novo" data-form="r7-novo" novalidate>
      <label class="campo"><span class="campo-rotulo">Nome do cliente</span>
        <input name="nome" type="text" maxlength="100" required placeholder="Ex.: Dra. Cliente Exemplo"></label>
      <label class="campo"><span class="campo-rotulo">Especialidade</span>
        <input name="especialidade" type="search" list="r7-especialidades" autocomplete="off" placeholder="Digite: derma…"></label>
      ${datalistEspecialidades()}
      <p class="campo-ajuda" data-erro hidden></p>
      <div class="acoes"><button class="botao botao-primario" type="submit">Criar a ficha</button></div>
    </form>`;
}

// ---------------------------------------------------------------------------
// Ficha
// ---------------------------------------------------------------------------

const abaAtual = (estado) => (ABAS_R7.some(([id]) => id === estado.r7Aba) ? estado.r7Aba : 'identificacao');

function telaFicha(estado, c) {
  const f = fichaDe(c);
  const esp = especialidade(f.identificacao.especialidade);
  const aba = abaAtual(estado);
  return `
    ${cabecalho(c.nome, [esp?.nome, f.identificacao.instagram].filter(Boolean).join(' · ') || 'Cliente da R7', `<a class="botao botao-secundario" href="#r7">← Clientes</a><a class="botao botao-primario" href="#r7/cronograma:${esc(c.chave)}">Cronograma</a>`)}
    <div class="segmentado r7-abas" role="tablist" aria-label="Partes da ficha">${ABAS_R7.map(([id, nome]) => `
      <button type="button" role="tab" class="segmentado-opcao${aba === id ? ' ativo' : ''}" data-acao="r7-aba" data-valor="${id}" aria-selected="${aba === id}" aria-pressed="${aba === id}">${esc(nome)}</button>`).join('')}</div>
    <section class="card r7-secao" data-cliente="${esc(c.chave)}">
      ${({ identificacao: abaIdentificacao, briefing: abaBriefing, rotina: abaRotina, voz: abaVoz, equipe: abaEquipe, links: abaLinks, acessos: abaAcessos, memoria: abaMemoria })[aba](estado, c, f)}
    </section>`;
}

const campo = (rotulo, html, ajuda = '') => `<label class="campo"><span class="campo-rotulo">${esc(rotulo)}</span>${html}${ajuda ? `<span class="campo-ajuda">${esc(ajuda)}</span>` : ''}</label>`;
const entrada = (nome, valor, extra = '') => `<input name="${nome}" type="text" value="${esc(valor || '')}" ${extra}>`;
const area = (nome, valor, linhas = 3, extra = '') => `<textarea name="${nome}" rows="${linhas}" ${extra}>${esc(valor || '')}</textarea>`;
const formSecao = (secao, c, corpo, botao = 'Salvar') => `
  <form class="formulario r7-form" data-form="r7-secao" data-secao="${secao}" data-cliente="${esc(c.chave)}" novalidate>
    ${corpo}
    <div class="acoes"><button class="botao botao-primario" type="submit">${esc(botao)}</button></div>
  </form>`;

function abaIdentificacao(estado, c, f) {
  const id = f.identificacao;
  return formSecao('identificacao', c, `
    <div class="r7-grade">
      ${campo('Nome do cliente', entrada('nome', c.nome, 'maxlength="100" required'))}
      ${campo('Como assina', entrada('assinatura', id.assinatura, 'maxlength="160" placeholder="Nome | CRM-UF 00000 RQE 0000"'), 'Vai no fim de cada legenda.')}
      ${campo('Especialidade', `<input name="especialidade" type="search" list="r7-especialidades" autocomplete="off" value="${esc(especialidade(id.especialidade)?.nome || '')}" placeholder="Digite: derma…">`, 'Vale para as datas da saúde, o CTA e os cuidados do conselho.')}
      ${campo('Instagram', entrada('instagram', id.instagram, 'maxlength="60" placeholder="@perfil"'))}
      ${campo('Cidade', entrada('cidade', id.cidade, 'maxlength="80"'))}
      ${campo('Link do perfil', `<input name="perfil" type="url" value="${esc(id.perfil)}" placeholder="https://instagram.com/…">`)}
    </div>
    ${datalistEspecialidades()}`);
}

function abaBriefing(estado, c, f) {
  const b = f.briefing;
  return formSecao('briefing', c, `
    <div class="r7-grade">
      ${campo('Público', area('publico', b.publico))}
      ${campo('Tom de voz (como a R7 descreve)', area('tom', b.tom))}
      ${campo('Temas que pode falar', area('pode', b.pode))}
      ${campo('Temas que não pode falar', area('naoPode', b.naoPode))}
      ${campo('Diferenciais', area('diferenciais', b.diferenciais))}
      ${campo('Procedimentos e métodos', area('procedimentos', b.procedimentos))}
      ${campo('CTA', entrada('cta', b.cta, 'maxlength="200" placeholder="Agende sua avaliação"'))}
      ${campo('Link do agendamento (WhatsApp)', `<input name="agendamento" type="url" value="${esc(b.agendamento)}" placeholder="https://wa.me/…">`)}
      ${campo('Inspirações (um link por linha)', area('inspiracoes', b.inspiracoes.join('\n'), 3))}
      ${campo('ID visual (pasta do Drive)', `<input name="idVisual" type="url" value="${esc(b.idVisual)}" placeholder="https://drive.google.com/…">`)}
    </div>
    ${campo('Observações', area('observacoes', b.observacoes, 4))}`);
}

function abaRotina(estado, c, f) {
  const r = f.rotina;
  const feed = new Map(r.feed.map((x) => [x.dia, x]));
  const marcado = (lista, v) => (lista.includes(v) ? ' checked' : '');
  return formSecao('rotina', c, `
    <fieldset class="r7-bloco"><legend class="campo-rotulo">Feed: dias, formato e quantidade</legend>
      <div class="r7-dias">${DIAS.map((d) => {
        const x = feed.get(d.n);
        return `<div class="r7-dia${x ? ' ligado' : ''}">
          <label class="campo-marcar"><input type="checkbox" name="feed-dia" value="${d.n}"${x ? ' checked' : ''}><span>${esc(d.nome)}</span></label>
          <select name="feed-formato-${d.n}" aria-label="Formato de ${esc(d.nome)}">${FORMATOS.map((fm) => `<option value="${fm.id}"${(x?.formato || 'post') === fm.id ? ' selected' : ''}>${esc(fm.nome)}</option>`).join('')}</select>
          <input name="feed-qtd-${d.n}" type="number" min="1" max="5" value="${x?.qtd || 1}" aria-label="Quantos posts na ${esc(d.nome)}">
        </div>`;
      }).join('')}</div>
    </fieldset>
    <fieldset class="r7-bloco"><legend class="campo-rotulo">Stories</legend>
      <label class="campo-marcar"><input type="checkbox" name="stories-tem" value="1"${r.stories.tem ? ' checked' : ''}><span>Este cliente tem stories</span></label>
      <div class="r7-dias">${DIAS.map((d) => `<label class="campo r7-dia-story"><span class="campo-rotulo">${esc(d.nome)}</span>
        <select name="story-${d.n}"><option value="">Sem stories</option>${MODELOS_STORY.map((m) => `<option value="${m.id}"${r.stories.dias[d.n] === m.id ? ' selected' : ''}>${esc(m.nome)}</option>`).join('')}</select></label>`).join('')}</div>
      <p class="campo-ajuda">Cada modelo tem os campos dele (texto, enquete, caixinha, repost). O cronograma cria os stories por este padrão.</p>
    </fieldset>
    <fieldset class="r7-bloco"><legend class="campo-rotulo">Formatos que o cliente prefere</legend>
      <div class="r7-marcas">${FORMATOS.filter((fm) => fm.id !== 'post').map((fm) => `<label class="campo-marcar"><input type="checkbox" name="formatosPreferidos" value="${fm.id}"${marcado(r.formatosPreferidos, fm.id)}><span>${esc(fm.nome)}</span></label>`).join('')}</div>
      ${campo('O que ele não gosta', area('naoGosta', r.naoGosta, 2, 'placeholder="Ex.: carrossel muito longo"'))}
    </fieldset>
    <fieldset class="r7-bloco"><legend class="campo-rotulo">Vídeos</legend>
      <p class="campo-ajuda">Tipos que ele usa e, marcados em "prefere", os favoritos.</p>
      <div class="r7-videos">${TIPOS_VIDEO.map((t) => `<div class="r7-video">
        <label class="campo-marcar"><input type="checkbox" name="videos-tipos" value="${t.id}"${marcado(r.videos.tipos, t.id)}><span>${esc(t.nome)}</span></label>
        <label class="campo-marcar r7-prefere"><input type="checkbox" name="videos-preferidos" value="${t.id}"${marcado(r.videos.preferidos, t.id)}><span>prefere</span></label></div>`).join('')}</div>
      ${campo('Vídeos por semana', `<input name="videos-porSemana" type="number" min="0" max="10" value="${r.videos.porSemana}">`)}
    </fieldset>
    <fieldset class="r7-bloco"><legend class="campo-rotulo">Estilo</legend>
      <p class="campo-ajuda">Visual</p>
      <div class="r7-marcas">${ESTILO_VISUAL.map((e) => `<label class="campo-marcar"><input type="checkbox" name="estilo-visual" value="${esc(e)}"${marcado(r.estilo.visual, e)}><span>${esc(e)}</span></label>`).join('')}</div>
      <p class="campo-ajuda">Conteúdo</p>
      <div class="r7-marcas">${ESTILO_CONTEUDO.map((e) => `<label class="campo-marcar"><input type="checkbox" name="estilo-conteudo" value="${esc(e)}"${marcado(r.estilo.conteudo, e)}><span>${esc(e)}</span></label>`).join('')}</div>
      ${campo('Cor de destaque da ID visual', `<input name="estilo-cor" type="color" value="${esc(r.estilo.corDestaque || '#888888')}">`, 'Vai para o cronograma em PDF.')}
    </fieldset>
    <div class="r7-grade">
      ${campo('Grupo do rodízio', `<select name="grupo"><option value="">A definir</option><option value="A"${r.grupo === 'A' ? ' selected' : ''}>Semana A</option><option value="B"${r.grupo === 'B' ? ' selected' : ''}>Semana B</option></select>`)}
      ${campo('Observações de aprovação', area('aprovacao', r.aprovacao, 2, 'placeholder="Ex.: a secretária aprova; demora a responder"'))}
    </div>`);
}

function abaEquipe(estado, c, f) {
  const cfg = configR7(estado.config);
  const e = f.equipe, ct = f.contato;
  const quadros = [...new Set([...cfg.quadros, e.quadro].filter(Boolean))];
  return formSecao('equipe', c, `
    <div class="r7-grade">
      ${campo('Quadro do designer no Trello', quadros.length
        ? `<select name="quadro"><option value="">Escolha</option>${quadros.map((q) => `<option${q === e.quadro ? ' selected' : ''}>${esc(q)}</option>`).join('')}</select>`
        : entrada('quadro', e.quadro, 'maxlength="80" placeholder="Nome do quadro"'), quadros.length ? '' : 'Cadastre os quadros em "Ajustes da R7", na lista de clientes.')}
      ${campo('Designer', entrada('designer', e.designer, 'maxlength="60"'))}
      ${campo('Lista do cliente no quadro', entrada('lista', e.lista, 'maxlength="120"'), 'O nome da lista, igual ao do Trello.')}
      ${campo('Grupo de WhatsApp do cliente', entrada('grupo', ct.grupo, 'maxlength="120"'))}
      ${campo('Quem aprova', entrada('aprova', ct.aprova, 'maxlength="120" placeholder="Ex.: a secretária"'))}
    </div>`);
}

function abaLinks(estado, c, f) {
  const l = f.links;
  return formSecao('links', c, `
    <div class="r7-grade">
      ${campo('Pasta do Drive do cliente', `<input name="drive" type="url" value="${esc(l.drive)}" placeholder="https://drive.google.com/…">`)}
      ${campo('Pasta de vídeos', `<input name="videos" type="url" value="${esc(l.videos)}" placeholder="https://drive.google.com/…">`)}
      ${campo('Último cronograma', `<input name="ultimoCronograma" type="url" value="${esc(l.ultimoCronograma)}" placeholder="https://…">`)}
    </div>
    <p class="campo-ajuda">Só links https. Os links abrem do aparelho; a Bússola não mexe nas pastas.</p>`);
}

// Acessos: a lista vem da função (só os nomes); a senha aparece por 30 s quando ela toca em "Mostrar".
function abaAcessos(estado, c) {
  const st = estado.r7Acessos?.[c.chave];
  const visivel = estado.r7AcessoVisivel;
  return `
    <p class="campo-ajuda">Senhas e códigos de reserva ficam criptografados no servidor. Não vão para o backup, a busca, a IA, o relatório nem a pauta. Toque em "Mostrar" para ver por 30 segundos.</p>
    ${!st ? '<p class="texto-suave">Lendo os acessos…</p>' : st.erro ? `<p class="campo-ajuda rel-erro">${esc(st.erro)}</p>` : st.lista.length ? `
      <ul class="lista-simples r7-acessos">${st.lista.map((a) => `
        <li>
          <span class="r7-acesso-nome"><strong>${esc(a.rotulo)}</strong></span>
          ${visivel?.id === a.id ? `<span class="r7-acesso-valor">
              ${visivel.usuario ? `<span>Usuário: <code>${esc(visivel.usuario)}</code> <button class="botao-icone" type="button" data-acao="r7-copiar" data-valor="usuario" aria-label="Copiar o usuário">⧉</button></span>` : ''}
              ${visivel.senha ? `<span>Senha: <code>${esc(visivel.senha)}</code> <button class="botao-icone" type="button" data-acao="r7-copiar" data-valor="senha" aria-label="Copiar a senha">⧉</button></span>` : ''}
              ${visivel.observacao ? `<span class="campo-ajuda">${esc(visivel.observacao)}</span>` : ''}
            </span>
            <button class="botao botao-secundario botao-pequeno" type="button" data-acao="r7-esconder">Esconder</button>`
          : `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="r7-mostrar" data-id="${esc(a.id)}">Mostrar</button>`}
          <button class="botao-icone" type="button" data-acao="r7-apagar-acesso" data-id="${esc(a.id)}" aria-label="Excluir ${esc(a.rotulo)}">×</button>
        </li>`).join('')}</ul>` : '<p class="texto-suave">Nenhum acesso guardado ainda.</p>'}
    <form class="formulario r7-form" data-form="r7-acesso" data-cliente="${esc(c.chave)}" novalidate autocomplete="off">
      <h3 class="ava-subtitulo">Guardar um acesso</h3>
      <div class="r7-grade">
        ${campo('Nome do acesso', '<input name="rotulo" type="text" maxlength="80" required placeholder="Ex.: Instagram, Códigos de reserva">')}
        ${campo('Usuário ou e-mail', '<input name="usuario" type="text" maxlength="200" autocomplete="off">')}
        ${campo('Senha ou código', '<input name="senha" type="password" maxlength="500" autocomplete="new-password">')}
        ${campo('Observação', '<input name="observacao" type="text" maxlength="1000">')}
      </div>
      <div class="acoes"><button class="botao botao-primario" type="submit">Guardar com segurança</button></div>
    </form>`;
}

function abaMemoria(estado, c) {
  const memoria = c.dados?.memoria || [];
  return `
    <p class="campo-ajuda">O que o cliente e a R7 aprovaram ou pediram para mudar. Toda IA que escreve para este cliente lê esta lista.</p>
    ${memoria.length ? `<ul class="lista-simples r7-memoria">${memoria.map((m) => `<li><span>${esc(m.texto)}</span>
      <button class="botao-icone" type="button" data-acao="r7-tirar-memoria" data-cliente="${esc(c.chave)}" data-id="${esc(m.id)}" aria-label="Tirar da memória">×</button></li>`).join('')}</ul>` : '<p class="texto-suave">Nada guardado ainda.</p>'}
    <form class="formulario r7-form" data-form="r7-memoria" data-cliente="${esc(c.chave)}" novalidate>
      ${campo('Guardar na memória', '<textarea name="texto" rows="2" maxlength="300" required placeholder="Ex.: não gosta de carrossel com mais de 6 lâminas"></textarea>')}
      <div class="acoes"><button class="botao botao-primario" type="submit">Guardar</button></div>
    </form>`;
}

// ---------------------------------------------------------------------------
// Voz: fontes, leitura com a IA, perfil editável e o checador local.
// ---------------------------------------------------------------------------

function abaVoz(estado, c) {
  const voz = c.dados?.voz || null;
  const leitura = estado.r7Voz?.chave === c.chave ? estado.r7Voz : null;
  const coladas = c.dados?.vozFontes || [];
  const rascunhos = (estado.rascunhos || []).filter((r) => !r.excluido_em && r.cliente === c.chave);
  const fontes = fontesDaVoz({ rascunhos, memoria: c.dados?.memoria || [], coladas });
  const marcadas = new Set(estado.r7VozFontes?.[c.chave] || fontes.map((x) => x.id));
  const perfil = leitura?.perfil || voz;
  const teste = estado.r7VozTeste?.[c.chave] || '';
  const resultado = teste ? checarVoz(teste, voz || {}, fichaDe(c)) : null;
  return `
    <div class="r7-voz">
      <div class="r7-voz-fontes">
        <h3 class="ava-subtitulo">De onde ler a voz</h3>
        <p class="campo-ajuda">Escolha os textos (até 30, os mais recentes primeiro). Os cronogramas do Drive entram quando o Drive for conectado.</p>
        ${fontes.length ? `<ul class="lista-simples r7-fontes">${fontes.map((x) => `<li><label class="campo-marcar"><input type="checkbox" data-acao-mudar="r7-fonte" data-cliente="${esc(c.chave)}" value="${esc(x.id)}"${marcadas.has(x.id) ? ' checked' : ''}><span><strong>${esc(x.fonte)}</strong><small>${esc(x.texto.slice(0, 110))}${x.texto.length > 110 ? '…' : ''}</small></span></label>
          ${x.id.startsWith('colado:') ? `<button class="botao-icone" type="button" data-acao="r7-tirar-fonte" data-cliente="${esc(c.chave)}" data-id="${esc(x.id)}" aria-label="Tirar este texto">×</button>` : ''}</li>`).join('')}</ul>` : '<p class="texto-suave">Nenhum texto ainda. Cole legendas aprovadas abaixo.</p>'}
        <form class="formulario" data-form="r7-colar-voz" data-cliente="${esc(c.chave)}" novalidate>
          ${campo('Colar um texto aprovado (legenda, copy, áudio transcrito)', '<textarea name="texto" rows="4" maxlength="4000" required></textarea>')}
          ${campo('De onde veio', '<input name="fonte" type="text" maxlength="80" placeholder="Ex.: legenda do Instagram de outubro">')}
          <div class="acoes"><button class="botao botao-secundario" type="submit">Acrescentar</button></div>
        </form>
        <div class="acoes">
          <button class="botao botao-primario" type="button" data-acao="r7-ler-voz" data-cliente="${esc(c.chave)}"${leitura?.status === 'lendo' || leitura?.status === 'enviando' ? ' disabled' : ''}>${leitura?.status === 'lendo' || leitura?.status === 'enviando' ? 'Lendo a voz…' : voz ? 'Atualizar a voz' : 'Ler a voz com a IA'}</button>
        </div>
        ${leitura?.erro ? `<p class="campo-ajuda rel-erro" role="alert">${esc(leitura.erro)}</p>` : ''}
        ${leitura?.mudou?.length ? `<p class="campo-ajuda">Mudou: ${esc(leitura.mudou.join(', '))}. Confira e salve.</p>` : ''}
      </div>
      <div class="r7-voz-perfil">
        <h3 class="ava-subtitulo">${leitura?.perfil ? 'Perfil lido (confira antes de salvar)' : 'Perfil de voz'}</h3>
        ${perfil ? formPerfil(c, perfil, Boolean(leitura?.perfil)) : '<p class="texto-suave">Ainda sem perfil. Escolha os textos e toque em "Ler a voz com a IA".</p>'}
        ${voz?.atualizado_em ? `<p class="campo-ajuda">Salvo em ${esc(new Date(voz.atualizado_em).toLocaleDateString('pt-BR'))}, com ${voz.fontes?.length || 0} textos.</p>` : ''}
        <h3 class="ava-subtitulo">Testar uma copy</h3>
        <label class="campo"><span class="campo-rotulo">Cole uma copy para ver se combina com a voz</span>
          <textarea rows="4" data-acao-mudar="r7-testar-voz" data-cliente="${esc(c.chave)}">${esc(teste)}</textarea></label>
        <div data-r7-resultado>${resultadoVoz(resultado, Boolean(voz))}</div>
      </div>
    </div>`;
}

export function resultadoVoz(r, temPerfil) {
  if (!r || r.estado === 'vazio') return `<p class="campo-ajuda">${temPerfil ? 'Roda aqui no aparelho, sem IA.' : 'Sem perfil salvo, o teste usa só a ficha (assinatura e CTA).'}</p>`;
  if (r.estado === 'combina') return '<p class="r7-voz-ok">✓ Combina com a voz do cliente.</p>';
  return `<div class="r7-voz-atencao"><p><strong>Atenção</strong></p><ul>${r.avisos.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>`;
}

function formPerfil(c, p, novo) {
  const linha = (id, nome, x) => `<label class="campo"><span class="campo-rotulo">${esc(nome)}${x?.fonte ? ` <small class="r7-fonte">de ${esc(x.fonte)}</small>` : ''}</span>
    <input name="${id}" type="text" maxlength="300" value="${esc(x?.valor || '')}"><input type="hidden" name="${id}-fonte" value="${esc(x?.fonte || '')}"></label>`;
  return `
    <form class="formulario r7-form" data-form="r7-perfil" data-cliente="${esc(c.chave)}" novalidate>
      ${CAMPOS_VOZ.map((cv) => linha(cv.id, cv.nome, p[cv.id])).join('')}
      ${LISTAS_VOZ.map((l) => `<label class="campo"><span class="campo-rotulo">${esc(l.nome)} <small>(um por linha)</small></span>
        <textarea name="${l.id}" rows="${l.id === 'exemplos' ? 4 : 2}">${esc((p[l.id] || []).map((x) => x.valor).join('\n'))}</textarea></label>`).join('')}
      <div class="r7-marcas">
        <label class="campo-marcar"><input type="checkbox" name="usaEmoji" value="1"${p.usaEmoji !== false ? ' checked' : ''}><span>Usa emoji</span></label>
        <label class="campo-marcar"><input type="checkbox" name="usaHashtag" value="1"${p.usaHashtag ? ' checked' : ''}><span>Usa hashtag</span></label>
      </div>
      ${campo('Palavras por frase (média)', `<input name="palavrasPorFrase" type="number" min="0" max="60" value="${p.palavrasPorFrase || ''}">`)}
      <div class="acoes"><button class="botao botao-primario" type="submit">${novo ? 'Salvar o perfil' : 'Salvar as mudanças'}</button></div>
    </form>`;
}
