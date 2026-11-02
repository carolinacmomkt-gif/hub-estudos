// Telas do "Com as mãos" (#cantinho/maos e #cantinho/maos:<tipo>[:<id>]): colorir, desenhar, escrever
// à mão, caligrafia, crochê e outras ideias. Visual do Meu cantinho; regras e modelos em dados-maos.js.

import { esc } from './utilidades.js';
import {
  TIPOS_MAOS, tipoMaos, MODELOS_COLORIR, modeloColorir, svgColorir, RISCOS, PASSO_A_PASSO, passoAPasso, svgPassoAPasso, ideiaDoDia,
  FOLHAS_ESCREVER, MODELOS_CALIGRAFIA, modeloCaligrafia, TOTAL_TINTAS, NOMES_TINTAS, projetoDe, linkSeguro, IDEIAS_PADRAO, vivosMaos,
  lerParametroMaos,
} from './dados-maos.js';

const fmtDia = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
const quandoFoi = (m) => fmtDia.format(new Date(m.atualizado_em || m.criado_em || Date.now()));
const rota = (...partes) => `#cantinho/${['maos', ...partes].filter(Boolean).join(':')}`;

export function telaMaos(estado, topo, parametro, hoje) {
  const { tipo, id } = lerParametroMaos(parametro);
  if (!tipo) return hub(estado, topo);
  if (tipo === 'croche') return id ? telaProjeto(estado, topo, id) : listaCroche(estado, topo);
  if (tipo === 'ideia') return telaIdeias(estado, topo);
  if (id) {
    const linha = vivosMaos(estado).find((m) => m.id === id);
    if (!linha) return `${topo('Com as mãos', { voltar: true, voltarPara: rota(tipo) })}<section class="ct-card"><p class="texto-suave">Esse trabalho não está mais aqui.</p></section>`;
    return linha.tipo === 'colorir' ? telaPintar(estado, topo, linha) : telaFolha(estado, topo, linha);
  }
  if (tipo === 'colorir') return escolherColorir(estado, topo);
  if (tipo === 'desenhar') return escolherDesenhar(estado, topo, hoje);
  if (tipo === 'escrever') return escolherEscrever(estado, topo);
  if (tipo === 'caligrafia') return escolherCaligrafia(estado, topo);
  return hub(estado, topo);
}

// ---------------------------------------------------------------------------
// Entrada e galeria
// ---------------------------------------------------------------------------

export function miniatura(m) {
  if (m.tipo === 'colorir') return svgColorir(m.modelo, m.dados?.cores, { classe: 'maos-mini-svg', rotulo: m.titulo || '' });
  if (m.tipo === 'croche') return m.dados?.foto ? `<img src="${esc(m.dados.foto)}" alt="">` : '<span class="maos-mini-emoji" aria-hidden="true">🧶</span>';
  return m.dados?.miniatura ? `<img src="${esc(m.dados.miniatura)}" alt="">` : `<span class="maos-mini-emoji" aria-hidden="true">${tipoMaos(m.tipo)?.emoji || '✏️'}</span>`;
}

function galeria(estado, limite = 12) {
  const lista = vivosMaos(estado).filter((m) => m.tipo !== 'ideia').slice(0, limite);
  if (!lista.length) return '<p class="texto-suave">Nada ainda. Escolha um cantinho acima e comece por onde der vontade.</p>';
  return `<div class="maos-galeria">${lista.map((m) => `
    <a class="maos-mini" href="${rota(m.tipo, m.id)}">
      <span class="maos-mini-arte">${miniatura(m)}</span>
      <span class="maos-mini-texto"><b>${esc(m.titulo || tipoMaos(m.tipo)?.nome || '')}</b><small>${esc(tipoMaos(m.tipo)?.nome || '')} · ${esc(quandoFoi(m))}</small></span>
    </a>`).join('')}</div>`;
}

function hub(estado, topo) {
  return `
    ${topo('Com as mãos', { voltar: true, sub: 'Para desligar a cabeça. Sem meta, sem pontos, sem pressa.' })}
    <div class="maos-tipos">${TIPOS_MAOS.map((t) => `
      <a class="ct-card ct-canto" href="${rota(t.id)}">
        <span class="ct-disco" aria-hidden="true">${t.emoji}</span>
        <span class="ct-canto-texto"><b>${esc(t.nome)}</b><small>${esc(t.texto)}</small></span>
      </a>`).join('')}</div>
    <section class="ct-card maos-secao">
      <p class="ct-rotulo">Seus trabalhos</p>
      ${galeria(estado)}
    </section>`;
}

function continuar(estado, tipo) {
  const lista = vivosMaos(estado, tipo).slice(0, 8);
  if (!lista.length) return '';
  return `<section class="ct-card maos-secao"><p class="ct-rotulo">Continuar</p>
    <div class="maos-galeria">${lista.map((m) => `
      <a class="maos-mini" href="${rota(m.tipo, m.id)}">
        <span class="maos-mini-arte">${miniatura(m)}</span>
        <span class="maos-mini-texto"><b>${esc(m.titulo || '')}</b><small>${esc(quandoFoi(m))}</small></span>
      </a>`).join('')}</div></section>`;
}

// ---------------------------------------------------------------------------
// Colorir
// ---------------------------------------------------------------------------

function escolherColorir(estado, topo) {
  const grupos = [...new Set(MODELOS_COLORIR.map((m) => m.grupo))];
  return `
    ${topo('Colorir', { voltar: true, voltarPara: rota(), sub: 'Escolha um desenho. Toque na cor e depois nas partes do desenho.' })}
    ${continuar(estado, 'colorir')}
    ${grupos.map((g) => `
      <section class="ct-card maos-secao"><p class="ct-rotulo">${esc(g)}</p>
        <div class="maos-modelos">${MODELOS_COLORIR.filter((m) => m.grupo === g).map((m) => `
          <button class="maos-modelo" type="button" data-acao="maos-novo" data-tipo="colorir" data-modelo="${esc(m.id)}" data-titulo="${esc(m.nome)}">
            <span class="maos-mini-arte">${svgColorir(m.id, {}, { classe: 'maos-mini-svg' })}</span><span>${esc(m.nome)}</span>
          </button>`).join('')}</div>
      </section>`).join('')}`;
}

export function paletaDeTintas(estado, { borracha = true } = {}) {
  const atual = Number(estado.maosTinta ?? 6);
  return `<div class="maos-paleta" role="radiogroup" aria-label="Cores">
    ${Array.from({ length: TOTAL_TINTAS }, (_, i) => i + 1).map((n) => `<button class="maos-tinta" type="button" role="radio" aria-checked="${atual === n}" aria-label="${esc(NOMES_TINTAS[n - 1])}" title="${esc(NOMES_TINTAS[n - 1])}" data-acao="maos-tinta" data-valor="${n}" style="--cor: var(--pinta-${n})"></button>`).join('')}
    ${borracha ? `<button class="maos-tinta maos-tinta-borracha" type="button" role="radio" aria-checked="${atual === 0}" aria-label="Apagar a cor" title="Apagar a cor" data-acao="maos-tinta" data-valor="0">⌫</button>` : ''}
  </div>`;
}

function telaPintar(estado, topo, linha) {
  const m = modeloColorir(linha.modelo);
  const pintadas = Object.keys(linha.dados?.cores || {}).length;
  return `
    ${topo(linha.titulo || m?.nome || 'Colorir', { voltar: true, voltarPara: rota('colorir'), sub: 'Toque numa cor e depois nas partes do desenho.', acoes: `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="maos-desfazer-cor" data-id="${esc(linha.id)}"${linha.dados?.historico?.length ? '' : ' disabled'}>Desfazer</button><button class="botao botao-secundario botao-pequeno" type="button" data-acao="maos-excluir" data-id="${esc(linha.id)}">Excluir</button>` })}
    <div class="maos-pintar">
      <div class="maos-pintar-arte" data-maos-pintar="${esc(linha.id)}">${svgColorir(linha.modelo, linha.dados?.cores)}</div>
      <aside class="ct-card maos-pintar-cores"><p class="ct-rotulo">Cores</p>${paletaDeTintas(estado)}<p class="ct-dica-pequena"><span data-maos-contagem>${pintadas} ${pintadas === 1 ? 'parte pintada' : 'partes pintadas'}</span> · "⌫" tira a cor.</p></aside>
    </div>`;
}

// ---------------------------------------------------------------------------
// Desenhar, escrever e caligrafia (folha com a caneta)
// ---------------------------------------------------------------------------

function escolherDesenhar(estado, topo, hoje) {
  const ideia = ideiaDoDia(hoje);
  return `
    ${topo('Desenhar', { voltar: true, voltarPara: rota(), sub: 'Riscos para cobrir, passo a passo ou uma ideia para hoje.' })}
    ${continuar(estado, 'desenhar')}
    <section class="ct-card maos-secao"><p class="ct-rotulo">Ideia do dia</p>
      <div class="ct-faixa"><div><strong>${esc(ideia)}</strong><small>sem certo nem errado</small></div>
        <button class="botao botao-primario" type="button" data-acao="maos-novo" data-tipo="desenhar" data-modelo="ideia" data-titulo="${esc(ideia)}">Desenhar</button></div>
      <div class="acoes"><button class="botao botao-secundario botao-pequeno" type="button" data-acao="maos-novo" data-tipo="desenhar" data-modelo="livre" data-titulo="Desenho livre">Folha em branco</button></div>
    </section>
    <section class="ct-card maos-secao"><p class="ct-rotulo">Passo a passo</p>
      <div class="maos-modelos">${PASSO_A_PASSO.map((p) => `
        <button class="maos-modelo" type="button" data-acao="maos-novo" data-tipo="desenhar" data-modelo="passo:${esc(p.id)}" data-titulo="${esc(p.nome)}">
          <span class="maos-mini-arte maos-mini-passo">${svgPassoAPasso(p.id, p.passos.length - 1)}</span><span>${esc(p.nome)} · ${p.passos.length} passos</span>
        </button>`).join('')}</div>
    </section>
    <section class="ct-card maos-secao"><p class="ct-rotulo">Riscos para cobrir</p>
      <div class="maos-modelos">${RISCOS.map((r) => `
        <button class="maos-modelo" type="button" data-acao="maos-novo" data-tipo="desenhar" data-modelo="risco:${esc(r.id)}" data-titulo="${esc(r.nome)}">
          <span class="maos-mini-arte maos-mini-risco">${svgColorir(r.id, {}, { classe: 'maos-mini-svg' })}</span><span>${esc(r.nome)}</span>
        </button>`).join('')}</div>
    </section>`;
}

function escolherEscrever(estado, topo) {
  return `
    ${topo('Escrever à mão', { voltar: true, voltarPara: rota(), sub: 'Uma folha só sua. Ninguém lê, nada vira tarefa.' })}
    <section class="ct-card maos-secao"><p class="ct-rotulo">Folha nova</p>
      <div class="acoes">${FOLHAS_ESCREVER.map((f) => `<button class="botao botao-secundario" type="button" data-acao="maos-novo" data-tipo="escrever" data-modelo="${esc(f.id)}" data-titulo="Escrito em ${esc(fmtDia.format(new Date()))}">${esc(f.nome)}</button>`).join('')}</div>
    </section>
    ${continuar(estado, 'escrever')}`;
}

function escolherCaligrafia(estado, topo) {
  return `
    ${topo('Caligrafia', { voltar: true, voltarPara: rota(), sub: 'Cubra as letras de guia devagar. A mão aprende sozinha.' })}
    ${continuar(estado, 'caligrafia')}
    <section class="ct-card maos-secao"><p class="ct-rotulo">Folhas de treino</p>
      <div class="maos-lista-botoes">${MODELOS_CALIGRAFIA.map((m) => `
        <button class="maos-linha-botao" type="button" data-acao="maos-novo" data-tipo="caligrafia" data-modelo="${esc(m.id)}" data-titulo="${esc(m.nome)}">
          <b class="maos-cal-amostra maos-cal-${esc(m.fonte)}">${esc(m.linhas[0])}</b><small>${esc(m.nome)}</small>
        </button>`).join('')}</div>
    </section>`;
}

const FERRAMENTAS = [['tinteiro', 'Caneta'], ['lapis', 'Lápis'], ['pincel', 'Pincel'], ['borracha', 'Borracha']];
const TAMANHOS = [[2, 'Fino'], [4, 'Médio'], [8, 'Grosso']];

function barraDaCaneta(estado) {
  const f = estado.maosCaneta || {};
  const ferramenta = f.ferramenta || 'tinteiro';
  const tamanho = Number(f.tamanho) || 4;
  const tinta = Number(f.tinta) || 0;
  return `<div class="maos-barra" role="toolbar" aria-label="Caneta">
    <div class="segmentado maos-seg" role="radiogroup" aria-label="Ferramenta">${FERRAMENTAS.map(([id, nome]) => `<button type="button" role="radio" aria-checked="${ferramenta === id}" aria-pressed="${ferramenta === id}" data-acao="maos-ferramenta" data-valor="${id}">${nome}</button>`).join('')}</div>
    <div class="segmentado maos-seg" role="radiogroup" aria-label="Espessura">${TAMANHOS.map(([n, nome]) => `<button type="button" role="radio" aria-checked="${tamanho === n}" aria-pressed="${tamanho === n}" data-acao="maos-tamanho" data-valor="${n}">${nome}</button>`).join('')}</div>
    <div class="maos-paleta maos-paleta-curta" role="radiogroup" aria-label="Cor da caneta">
      <button class="maos-tinta maos-tinta-padrao" type="button" role="radio" aria-checked="${tinta === 0}" aria-label="Tinta do tema" title="Tinta do tema" data-acao="maos-cor-caneta" data-valor="0" style="--cor: var(--tinta-tinta)"></button>
      ${[6, 7, 8, 10, 11, 12, 14, 4, 9, 16].map((n) => `<button class="maos-tinta" type="button" role="radio" aria-checked="${tinta === n}" aria-label="${esc(NOMES_TINTAS[n - 1])}" title="${esc(NOMES_TINTAS[n - 1])}" data-acao="maos-cor-caneta" data-valor="${n}" style="--cor: var(--pinta-${n})"></button>`).join('')}
    </div>
    <span class="maos-barra-fim">
      <button class="botao-icone" type="button" data-acao="maos-voltar-traco" aria-label="Desfazer" title="Desfazer">↶</button>
      <button class="botao-icone" type="button" data-acao="maos-avancar-traco" aria-label="Refazer" title="Refazer">↷</button>
      <label class="campo-marcar maos-dedo"><input type="checkbox" data-acao-mudar="maos-dedo"${estado.maosDedo ? ' checked' : ''}> Dedo desenha</label>
    </span>
  </div>`;
}

function telaFolha(estado, topo, linha) {
  const [tipoModelo, alvo] = String(linha.modelo || '').split(':');
  const passo = passoAPasso(alvo);
  const n = Math.min(Number(linha.dados?.passo) || 0, (passo?.passos.length || 1) - 1);
  const voltarPara = rota(linha.tipo);
  const sub = linha.tipo === 'caligrafia' ? 'Cubra as letras clarinhas.' : tipoModelo === 'risco' ? 'Passe a caneta por cima do risco.' : tipoModelo === 'passo' ? `Passo ${n + 1} de ${passo.passos.length}` : quandoFoi(linha);
  return `
    ${topo(linha.titulo || tipoMaos(linha.tipo)?.nome || '', { voltar: true, voltarPara, sub, acoes: `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="maos-excluir" data-id="${esc(linha.id)}">Excluir</button>` })}
    ${barraDaCaneta(estado)}
    <div class="maos-folha-area${passo ? ' com-passo' : ''}">
      ${passo ? `<aside class="ct-card maos-passo">
        <p class="ct-rotulo">Passo ${n + 1} de ${passo.passos.length}</p>
        ${svgPassoAPasso(passo.id, n)}
        <p class="maos-passo-texto">${esc(passo.passos[n].texto)}</p>
        <div class="acoes"><button class="botao botao-secundario botao-pequeno" type="button" data-acao="maos-passo" data-id="${esc(linha.id)}" data-valor="-1"${n ? '' : ' disabled'}>‹ Anterior</button>
          <button class="botao botao-primario botao-pequeno" type="button" data-acao="maos-passo" data-id="${esc(linha.id)}" data-valor="1"${n < passo.passos.length - 1 ? '' : ' disabled'}>Próximo ›</button></div>
        <label class="campo-marcar"><input type="checkbox" data-acao-mudar="maos-guia" data-id="${esc(linha.id)}"${linha.dados?.semGuia ? '' : ' checked'}> Mostrar o passo clarinho na folha</label>
      </aside>` : ''}
      <div class="maos-folha" data-maos-folha="${esc(linha.id)}"></div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Crochê
// ---------------------------------------------------------------------------

function listaCroche(estado, topo) {
  const lista = vivosMaos(estado, 'croche');
  return `
    ${topo('Crochê', { voltar: true, voltarPara: rota(), sub: 'Um contador grande, para tocar sem tirar os olhos da linha.' })}
    ${lista.length ? `<div class="maos-galeria">${lista.map((m) => { const p = projetoDe(m); return `
      <a class="maos-mini" href="${rota('croche', m.id)}">
        <span class="maos-mini-arte">${miniatura(m)}</span>
        <span class="maos-mini-texto"><b>${esc(m.titulo || 'Projeto')}</b><small>carreira ${p.carreira}${p.metaCarreiras ? ` de ${p.metaCarreiras}` : ''} · ${esc(quandoFoi(m))}</small></span>
      </a>`; }).join('')}</div>` : ''}
    <section class="ct-card maos-secao">
      <p class="ct-rotulo">Projeto novo</p>
      <form class="formulario ct-form" data-form="maos-croche-novo" novalidate>
        <label class="campo"><span class="campo-rotulo">Nome</span><input name="titulo" type="text" maxlength="80" placeholder="Ex.: manta de inverno" required></label>
        <div class="acoes"><button class="botao botao-primario" type="submit">Começar</button></div>
        <p class="campo-ajuda" data-erro hidden></p>
      </form>
    </section>`;
}

function contador(id, campo, valor, rotulo) {
  return `<div class="maos-contador">
    <p class="ct-rotulo">${esc(rotulo)}</p>
    <button class="maos-contador-mais" type="button" data-acao="maos-contar" data-id="${esc(id)}" data-campo="${campo}" data-valor="1" aria-label="Mais um em ${esc(rotulo.toLowerCase())}">
      <b data-maos-valor="${campo}">${valor}</b><small>toque para somar</small>
    </button>
    <div class="maos-contador-pe">
      <button class="botao botao-secundario botao-pequeno" type="button" data-acao="maos-contar" data-id="${esc(id)}" data-campo="${campo}" data-valor="-1" aria-label="Menos um em ${esc(rotulo.toLowerCase())}">−1</button>
      <button class="botao botao-secundario botao-pequeno" type="button" data-acao="maos-zerar" data-id="${esc(id)}" data-campo="${campo}">Zerar</button>
    </div>
  </div>`;
}

function telaProjeto(estado, topo, id) {
  const linha = vivosMaos(estado, 'croche').find((m) => m.id === id);
  if (!linha) return `${topo('Crochê', { voltar: true, voltarPara: rota('croche') })}<section class="ct-card"><p class="texto-suave">Esse projeto não está mais aqui.</p></section>`;
  const p = projetoDe(linha);
  const receita = linkSeguro(p.receita);
  const falta = p.metaCarreiras ? Math.max(0, p.metaCarreiras - p.carreira) : 0;
  return `
    ${topo(linha.titulo || 'Projeto', { voltar: true, voltarPara: rota('croche'), sub: p.metaCarreiras ? (falta ? `faltam ${falta} carreiras` : 'chegou na meta de carreiras 🎉') : 'onde você parou fica guardado', acoes: `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="maos-excluir" data-id="${esc(linha.id)}">Excluir</button>` })}
    <div class="maos-croche">
      <section class="ct-card maos-contadores">
        ${contador(linha.id, 'carreira', p.carreira, 'Carreira')}
        ${contador(linha.id, 'pontos', p.pontos, 'Pontos')}
        <label class="campo-marcar"><input type="checkbox" data-acao-mudar="maos-zerar-pontos" data-id="${esc(linha.id)}"${p.zerarPontos !== false ? ' checked' : ''}> Zerar os pontos a cada carreira nova</label>
      </section>
      <section class="ct-card">
        ${p.foto ? `<img class="maos-foto" src="${esc(p.foto)}" alt="Foto do projeto">` : ''}
        <form class="formulario ct-form" data-form="maos-croche" data-id="${esc(linha.id)}" novalidate>
          <div class="cal-form-linha">
            <label class="campo"><span class="campo-rotulo">Linha</span><input name="linha" type="text" maxlength="80" value="${esc(p.linha)}" placeholder="Ex.: Amigurumi, cor creme"></label>
            <label class="campo"><span class="campo-rotulo">Agulha</span><input name="agulha" type="text" maxlength="20" value="${esc(p.agulha)}" placeholder="Ex.: 3,5 mm"></label>
          </div>
          <div class="cal-form-linha">
            <label class="campo"><span class="campo-rotulo">Receita (link)</span><input name="receita" type="url" value="${esc(p.receita)}" placeholder="https://"></label>
            <label class="campo"><span class="campo-rotulo">Meta de carreiras</span><input name="metaCarreiras" type="number" min="0" max="9999" inputmode="numeric" value="${p.metaCarreiras || ''}"></label>
          </div>
          <label class="campo"><span class="campo-rotulo">Anotações</span><textarea name="notas" rows="3" maxlength="2000" placeholder="Ex.: na carreira 12, aumentar 6 pontos">${esc(p.notas)}</textarea></label>
          <label class="campo"><span class="campo-rotulo">Foto</span><input name="foto" type="file" accept="image/*" data-acao-mudar="maos-foto" data-id="${esc(linha.id)}"></label>
          <div class="acoes"><button class="botao botao-primario" type="submit">Guardar</button>${receita ? `<a class="botao botao-secundario" href="${esc(receita)}" target="_blank" rel="noopener">Abrir a receita</a>` : ''}</div>
          <p class="campo-ajuda" data-erro hidden></p>
        </form>
      </section>
    </div>`;
}

// ---------------------------------------------------------------------------
// Outras ideias (com cronômetro opcional)
// ---------------------------------------------------------------------------

const textoMin = (n) => (n >= 60 ? `${Math.floor(n / 60)}h${n % 60 ? String(n % 60).padStart(2, '0') : ''}` : `${n} min`);

function telaIdeias(estado, topo) {
  const lista = vivosMaos(estado, 'ideia');
  const tem = new Set(lista.map((m) => (m.titulo || '').toLowerCase()));
  const crono = estado.maosCrono;
  return `
    ${topo('Outras coisas com as mãos', { voltar: true, voltarPara: rota(), sub: 'A sua lista. O cronômetro é opcional, só para saber quanto tempo foi seu.' })}
    <div class="ct-grade">
      <section class="ct-card">
        <p class="ct-rotulo">Minha lista</p>
        ${lista.length ? `<ul class="ct-lista">${lista.map((m) => { const rodando = crono?.id === m.id; return `
          <li class="ct-item">
            <span class="ct-quando">${rodando ? '⏱' : '🪡'}</span>
            <span class="ct-item-texto"><b>${esc(m.titulo)}</b><small>${m.dados?.minutos ? `${esc(textoMin(m.dados.minutos))} no total` : 'ainda sem tempo marcado'}${rodando ? ` · <span data-maos-crono>começou agora</span>` : ''}</small></span>
            <span class="ct-item-acoes">
              ${rodando ? `<button class="botao botao-primario botao-pequeno" type="button" data-acao="maos-crono-parar" data-id="${esc(m.id)}">Parar</button>`
    : `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="maos-crono" data-id="${esc(m.id)}"${crono ? ' disabled' : ''}>Começar</button>`}
              <button class="botao-icone botao-icone-p" type="button" data-acao="maos-excluir" data-id="${esc(m.id)}" aria-label="Tirar da lista" title="Tirar">×</button>
            </span>
          </li>`; }).join('')}</ul>` : '<p class="texto-suave">Nada ainda. Escolha nas sugestões ou escreva a sua.</p>'}
        <form class="formulario ct-form" data-form="maos-ideia" novalidate>
          <label class="campo"><span class="campo-rotulo">Quero fazer…</span><input name="titulo" type="text" maxlength="80" placeholder="Ex.: bordar uma flor na camiseta" required></label>
          <div class="acoes"><button class="botao botao-primario" type="submit">Pôr na lista</button></div>
          <p class="campo-ajuda" data-erro hidden></p>
        </form>
      </section>
      <section class="ct-card">
        <p class="ct-rotulo">Sugestões</p>
        <div class="maos-sugestoes">${IDEIAS_PADRAO.filter((x) => !tem.has(x.toLowerCase())).map((x) => `<button class="ct-chip" type="button" data-acao="maos-ideia-pronta" data-valor="${esc(x)}">+ ${esc(x)}</button>`).join('') || '<p class="texto-suave">Todas já estão na sua lista.</p>'}</div>
      </section>
    </div>`;
}

// Atalhos da Mesinha (uma fileira embaixo do relógio).
export function atalhosDaMesinha() {
  return `<div class="ct-card ct-mesinha-card"><p class="ct-rotulo">Com as mãos</p><nav class="ct-mesinha-maos" aria-label="Com as mãos">${TIPOS_MAOS.map((t) => `<a class="ct-chip" href="${rota(t.id)}"><span aria-hidden="true">${t.emoji}</span> ${esc(t.nome.replace(' à mão', '').replace('Outras ideias', 'Ideias'))}</a>`).join('')}</nav></div>`;
}
