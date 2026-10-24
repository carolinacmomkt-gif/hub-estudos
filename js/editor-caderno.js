// Editor de um caderno (#cadernos/<id>): ferramentas, favoritos, páginas e salvamento.
// O motor de tinta está em editor-tinta.js; aqui fica só a tela em volta dele.

import { EditorDeTinta, novaPaginaVazia } from './editor-tinta.js';
import { dimensoes, MODELOS_BASICOS } from './folhas.js';
import { listar, salvar, obter } from './persistencia.js';
import { esc } from './utilidades.js';

const CHAVE_PREFS = 'hub.editor.prefs';

const FERRAMENTAS = [
  { id: 'tinteiro', nome: 'Tinteiro' },
  { id: 'esferografica', nome: 'Esferográfica' },
  { id: 'pincel', nome: 'Pincel' },
  { id: 'lapis', nome: 'Lápis' },
  { id: 'marca-texto', nome: 'Marca-texto' },
  { id: 'borracha', nome: 'Borracha' },
  { id: 'laco', nome: 'Laço' },
];
const TINTAS = [
  { id: 'tinta', nome: 'Tinta' },
  { id: 'azul', nome: 'Azul' },
  { id: 'vermelho', nome: 'Vermelho' },
  { id: 'verde', nome: 'Verde' },
  { id: 'roxo', nome: 'Roxo' },
];
const MARCAS = [
  { id: 'amarelo', nome: 'Amarelo' },
  { id: 'rosa', nome: 'Rosa' },
  { id: 'ciano', nome: 'Azul-claro' },
];
const ESPESSURAS = {
  caneta: [{ id: 1.6, nome: 'Extrafina' }, { id: 2.5, nome: 'Fina' }, { id: 4, nome: 'Média' }, { id: 7, nome: 'Grossa' }],
  'marca-texto': [{ id: 16, nome: 'Fina' }, { id: 24, nome: 'Média' }, { id: 36, nome: 'Grossa' }],
  borracha: [{ id: 8, nome: 'Pequena' }, { id: 16, nome: 'Média' }, { id: 32, nome: 'Grande' }],
};
const SUAVES = [
  { id: 'desligado', nome: 'Desligado' },
  { id: 'leve', nome: 'Leve' },
  { id: 'medio', nome: 'Médio' },
  { id: 'forte', nome: 'Forte' },
];
const FAVORITOS_PADRAO = [
  { ferramenta: 'tinteiro', tinta: 'tinta', tamanho: 4 },
  { ferramenta: 'esferografica', tinta: 'azul', tamanho: 2.5 },
  { ferramenta: 'pincel', tinta: 'vermelho', tamanho: 7 },
  { ferramenta: 'lapis', tinta: 'tinta', tamanho: 2.5 },
  { ferramenta: 'marca-texto', tinta: 'amarelo', tamanho: 24 },
];
const SEGURAR_FAVORITO_MS = 600;

let editor = null;
let caderno = null;
let paginas = [];
let indice = 0;
let tempoSalvar = null;
let favoritos = FAVORITOS_PADRAO;
let configFavoritos = null;
let selecionados = 0;
let prefs = lerPrefs();
let toqueFavorito = null;
let montagem = 0; // cada abertura do editor ganha um número; uma abertura antiga para no meio

function lerPrefs() {
  const padrao = {
    ferramenta: 'tinteiro', tinta: 'tinta', tintaMarca: 'amarelo', tamanho: 4, tamanhoMarca: 24, raioBorracha: 16,
    tipoBorracha: 'traco', suavizacao: 'leve', dedo: false, marcaReta: false, formasAuto: true,
  };
  try {
    return { ...padrao, ...JSON.parse(localStorage.getItem(CHAVE_PREFS) || '{}') };
  } catch {
    return padrao;
  }
}

function guardarPrefs() {
  try {
    localStorage.setItem(CHAVE_PREFS, JSON.stringify(prefs));
  } catch {
    // vale só nesta sessão
  }
}

const ehCaneta = (f) => ['tinteiro', 'esferografica', 'pincel', 'lapis'].includes(f);
const corCss = (tinta) => (tinta?.startsWith('#') ? tinta : `var(--tinta-${tinta})`);
const nomeFerramenta = (id) => FERRAMENTAS.find((f) => f.id === id)?.nome || id;
const nomeTinta = (id) => [...TINTAS, ...MARCAS].find((t) => t.id === id)?.nome || 'cor própria';

// ---------------------------------------------------------------------------
// Tela
// ---------------------------------------------------------------------------

export function renderEditorCaderno() {
  return `
    <div class="caneta editor-caderno">
      <header class="caneta-topo">
        <a class="botao botao-secundario botao-pequeno" href="#cadernos" aria-label="Voltar para os cadernos">←</a>
        <h1 tabindex="-1" id="editor-titulo">Caderno</h1>
        <span class="caneta-salvo" id="caneta-salvo" aria-live="polite"></span>
        <div class="editor-paginas" role="group" aria-label="Páginas">
          <button type="button" class="ferramenta-botao" data-ed="pagina-anterior" aria-label="Página anterior">‹</button>
          <span id="editor-pagina" aria-live="polite">…</span>
          <button type="button" class="ferramenta-botao" data-ed="pagina-proxima" aria-label="Próxima página">›</button>
          <button type="button" class="ferramenta-botao" data-ed="pagina-nova">+ Página</button>
        </div>
      </header>
      <div id="editor-barra"></div>
      <div class="selecao-barra" id="editor-selecao" hidden></div>
      <div class="caneta-area" id="caneta-area"></div>
    </div>`;
}

function botao(acao, valor, rotulo, ativo, extra = '') {
  return `<button type="button" class="ferramenta-botao" data-ed="${acao}" data-valor="${esc(valor)}" aria-pressed="${ativo}" ${extra}>${rotulo}</button>`;
}

function favoritoAtual() {
  return favoritos.findIndex((f) => f.ferramenta === prefs.ferramenta
    && f.tinta === (prefs.ferramenta === 'marca-texto' ? prefs.tintaMarca : prefs.tinta)
    && Number(f.tamanho) === Number(prefs.ferramenta === 'marca-texto' ? prefs.tamanhoMarca : prefs.tamanho));
}

function barra() {
  const f = prefs.ferramenta;
  const ferramentas = FERRAMENTAS.map((x) => botao('ferramenta', x.id, x.nome, f === x.id)).join('');
  const ativo = favoritoAtual();
  const favs = favoritos.map((fav, i) => `
    <button type="button" class="favorito" data-ed="favorito" data-valor="${i}" aria-pressed="${ativo === i}"
      style="--cor: ${corCss(fav.tinta)}; --tam: ${Math.min(18, 6 + fav.tamanho * (fav.ferramenta === 'marca-texto' ? 0.35 : 1.6))}px"
      aria-label="Favorito ${i + 1}: ${esc(nomeFerramenta(fav.ferramenta))}, ${esc(nomeTinta(fav.tinta))}. Segure para guardar a caneta atual aqui."
      title="${esc(nomeFerramenta(fav.ferramenta))} · segure para guardar a caneta atual">
      <span class="favorito-ponta${fav.ferramenta === 'marca-texto' ? ' marca' : ''}"></span>
    </button>`).join('');

  let cores = '';
  if (ehCaneta(f) || f === 'marca-texto' || (f === 'laco' && selecionados)) {
    const lista = f === 'marca-texto' ? MARCAS : TINTAS;
    const atual = f === 'marca-texto' ? prefs.tintaMarca : prefs.tinta;
    const propria = atual?.startsWith('#') ? atual : '#2c5aa6';
    cores = `
      <div class="ferramenta-grupo" role="group" aria-label="Cor">
        ${lista.map((c) => `<button type="button" class="ferramenta-cor" data-ed="cor" data-valor="${c.id}" aria-pressed="${atual === c.id}"
          aria-label="${c.nome}" title="${c.nome}" style="--cor: var(--tinta-${c.id})"></button>`).join('')}
        <label class="ferramenta-cor cor-propria" title="Cor própria" style="--cor: ${esc(propria)}" aria-pressed="${atual?.startsWith('#') || false}">
          <span class="visualmente-oculto">Cor própria</span>
          <input type="color" data-ed="cor-propria" value="${esc(propria)}">
        </label>
      </div>`;
  }
  const grupoEspessura = f === 'marca-texto' ? 'marca-texto' : f === 'borracha' ? 'borracha' : ehCaneta(f) ? 'caneta' : null;
  const espAtual = f === 'marca-texto' ? prefs.tamanhoMarca : f === 'borracha' ? prefs.raioBorracha : prefs.tamanho;
  const espessuras = grupoEspessura
    ? `<div class="ferramenta-grupo" role="group" aria-label="Espessura">${ESPESSURAS[grupoEspessura].map((e) => botao('espessura', e.id, e.nome, Number(espAtual) === e.id)).join('')}</div>`
    : '';
  const extraBorracha = f === 'borracha' ? `<div class="ferramenta-grupo" role="group" aria-label="Tipo de borracha">
    ${botao('tipo-borracha', 'traco', 'Traço inteiro', prefs.tipoBorracha === 'traco')}${botao('tipo-borracha', 'area', 'Só o pedaço', prefs.tipoBorracha === 'area')}</div>` : '';
  const pagina = paginas[indice];

  return `
    <div class="ferramentas" role="toolbar" aria-label="Ferramentas">
      <div class="ferramenta-grupo" role="group" aria-label="Ferramenta">${ferramentas}</div>
      <div class="ferramenta-grupo favoritos" role="group" aria-label="Canetas favoritas">${favs}</div>
      ${cores}
      ${espessuras}
      ${extraBorracha}
      ${f === 'laco' ? `<div class="ferramenta-grupo">${botao('colar', '', 'Colar', false)}</div>` : ''}
      <div class="ferramenta-grupo" role="group" aria-label="Histórico">
        <button type="button" class="ferramenta-botao" data-ed="desfazer" aria-label="Desfazer" title="Desfazer (ou toque com dois dedos)">↶</button>
        <button type="button" class="ferramenta-botao" data-ed="refazer" aria-label="Refazer" title="Refazer (ou toque com três dedos)">↷</button>
      </div>
      <details class="ferramenta-mais">
        <summary class="ferramenta-botao">Ajustes</summary>
        <div class="ferramenta-painel">
          <label class="ferramenta-select"><span>Folha desta página</span>
            <select data-ed="modelo">${MODELOS_BASICOS.map((m) => `<option value="${m.id}"${pagina?.modelo_folha === m.id ? ' selected' : ''}>${m.nome}</option>`).join('')}</select></label>
          <label class="ferramenta-select"><span>Estabilizador</span>
            <select data-ed="suavizacao">${SUAVES.map((s) => `<option value="${s.id}"${prefs.suavizacao === s.id ? ' selected' : ''}>${s.nome}</option>`).join('')}</select></label>
          <label class="campo-marcar"><input type="checkbox" data-ed="formas"${prefs.formasAuto ? ' checked' : ''}><span>Segurar no fim do traço vira forma</span></label>
          <label class="campo-marcar"><input type="checkbox" data-ed="marca-reta"${prefs.marcaReta ? ' checked' : ''}><span>Marca-texto em linha reta</span></label>
          <label class="campo-marcar"><input type="checkbox" data-ed="dedo"${prefs.dedo ? ' checked' : ''}><span>Desenhar com o dedo</span></label>
          <button type="button" class="botao botao-secundario botao-pequeno" data-ed="zoom-normal">Zoom: <span id="editor-zoom">${Math.round((editor?.zoom || 1) * 100)}%</span> · voltar a 100%</button>
          <p class="campo-ajuda">Pinça dá zoom. Toque com dois dedos desfaz; com três, refaz. O botão da S Pen vira borracha. Segure um favorito para guardar a caneta atual nele.</p>
        </div>
      </details>
    </div>`;
}

function barraSelecao() {
  return `
    <span>${selecionados} ${selecionados === 1 ? 'traço selecionado' : 'traços selecionados'}</span>
    <div class="ferramenta-grupo">
      ${TINTAS.map((c) => `<button type="button" class="ferramenta-cor" data-ed="selecao-cor" data-valor="${c.id}" aria-label="Mudar para ${c.nome}" style="--cor: var(--tinta-${c.id})"></button>`).join('')}
    </div>
    <div class="ferramenta-grupo">
      <button type="button" class="ferramenta-botao" data-ed="selecao-duplicar">Duplicar</button>
      <button type="button" class="ferramenta-botao" data-ed="selecao-copiar">Copiar</button>
      <button type="button" class="ferramenta-botao" data-ed="selecao-excluir">Excluir</button>
      <button type="button" class="ferramenta-botao" data-ed="selecao-pronto">Pronto</button>
    </div>
    <span class="campo-ajuda">Arraste para mover; puxe o quadradinho do canto para mudar o tamanho.</span>`;
}

function atualizarBarra() {
  const el = document.getElementById('editor-barra');
  if (!el) return;
  const aberto = el.querySelector('details')?.open;
  el.innerHTML = barra();
  if (aberto) el.querySelector('details').open = true;
  atualizarHistorico();
}

function atualizarHistorico() {
  const d = document.querySelector('[data-ed="desfazer"]');
  const r = document.querySelector('[data-ed="refazer"]');
  if (d) d.disabled = !editor?.podeDesfazer();
  if (r) r.disabled = !editor?.podeRefazer();
}

function atualizarPaginacao() {
  const texto = document.getElementById('editor-pagina');
  if (texto) texto.textContent = `Página ${indice + 1} de ${paginas.length}`;
  const ant = document.querySelector('[data-ed="pagina-anterior"]');
  const prox = document.querySelector('[data-ed="pagina-proxima"]');
  if (ant) ant.disabled = indice === 0;
  if (prox) prox.disabled = indice >= paginas.length - 1;
}

function mostrarSalvo(texto) {
  const el = document.getElementById('caneta-salvo');
  if (el) el.textContent = texto;
}

function avisar(texto) {
  const aviso = document.getElementById('aviso');
  aviso.innerHTML = `<span>${esc(texto)}</span>`;
  aviso.hidden = false;
  clearTimeout(avisar.tempo);
  avisar.tempo = setTimeout(() => { aviso.hidden = true; }, 3000);
}

// ---------------------------------------------------------------------------
// Dados
// ---------------------------------------------------------------------------

function aplicarPrefs() {
  if (!editor) return;
  editor.ferramenta = prefs.ferramenta;
  editor.tinta = prefs.tinta;
  editor.tintaMarca = prefs.tintaMarca;
  editor.tamanho = Number(prefs.tamanho);
  editor.tamanhoMarca = Number(prefs.tamanhoMarca);
  editor.raioBorracha = Number(prefs.raioBorracha);
  editor.tipoBorracha = prefs.tipoBorracha;
  editor.suavizacao = prefs.suavizacao;
  editor.dedoDesenha = prefs.dedo;
  editor.marcaReta = prefs.marcaReta;
  editor.formasAuto = prefs.formasAuto;
  if (prefs.ferramenta !== 'laco') editor.limparSelecao();
}

function dimDoCaderno() {
  return dimensoes(caderno?.tamanho || 'A4', caderno?.orientacao || 'retrato');
}

async function salvarAgora() {
  clearTimeout(tempoSalvar);
  tempoSalvar = null;
  if (!editor || !paginas[indice]) return;
  paginas[indice] = await salvar('paginas', { ...paginas[indice], tracos_json: editor.pagina });
  // O caderno sobe para o topo da lista e do Início.
  if (caderno) caderno = await salvar('cadernos', { ...caderno });
  mostrarSalvo('Salvo');
}

function aoMudar() {
  mostrarSalvo('Salvando…');
  atualizarHistorico();
  clearTimeout(tempoSalvar);
  tempoSalvar = setTimeout(salvarAgora, 900);
}

function abrirPagina(n) {
  indice = Math.max(0, Math.min(paginas.length - 1, n));
  const p = paginas[indice];
  const json = p.tracos_json?.camadas?.length ? p.tracos_json : novaPaginaVazia(p.modelo_folha);
  json.modelo = p.modelo_folha || json.modelo;
  editor.carregar(json, dimDoCaderno());
  document.getElementById('caneta-area').scrollTop = 0;
  atualizarPaginacao();
  atualizarBarra();
}

async function novaPagina() {
  await salvarAgora();
  const modelo = paginas[indice]?.modelo_folha || 'pautada-media';
  const ordem = (paginas[paginas.length - 1]?.ordem ?? -1) + 1;
  const dim = dimDoCaderno();
  const nova = await salvar('paginas', {
    caderno_id: caderno.id, ordem, modelo_folha: modelo, tracos_json: novaPaginaVazia(modelo), largura: dim.largura, altura: dim.altura,
  });
  paginas.push(nova);
  abrirPagina(paginas.length - 1);
  avisar(`Página ${paginas.length} criada.`);
}

async function mudarModelo(modelo) {
  const p = paginas[indice];
  if (!p) return;
  editor.pagina.modelo = modelo;
  paginas[indice] = { ...p, modelo_folha: modelo };
  editor.desenharTudo();
  aoMudar();
}

async function guardarFavorito(i) {
  const f = prefs.ferramenta;
  if (!ehCaneta(f) && f !== 'marca-texto') {
    avisar('Escolha uma caneta ou o marca-texto antes de guardar no favorito.');
    return;
  }
  favoritos = favoritos.map((fav, k) => (k === i ? {
    ferramenta: f,
    tinta: f === 'marca-texto' ? prefs.tintaMarca : prefs.tinta,
    tamanho: f === 'marca-texto' ? prefs.tamanhoMarca : prefs.tamanho,
  } : fav));
  configFavoritos = await salvar('config', { ...(configFavoritos || {}), chave: 'canetas', valor: { favoritos } });
  atualizarBarra();
  avisar(`Favorito ${i + 1} guardado.`);
}

function usarFavorito(i) {
  const fav = favoritos[i];
  if (!fav) return;
  prefs.ferramenta = fav.ferramenta;
  if (fav.ferramenta === 'marca-texto') {
    prefs.tintaMarca = fav.tinta;
    prefs.tamanhoMarca = fav.tamanho;
  } else {
    prefs.tinta = fav.tinta;
    prefs.tamanho = fav.tamanho;
  }
}

// ---------------------------------------------------------------------------
// Montagem (chamada pelo main.js)
// ---------------------------------------------------------------------------

export async function montarEditorCaderno(id) {
  const minha = ++montagem;
  document.body.classList.add('modo-editor');
  const encontrado = await obter('cadernos', id);
  if (minha !== montagem) return;
  caderno = encontrado;
  const area = document.getElementById('caneta-area');
  if (!caderno || caderno.excluido_em) {
    area.innerHTML = '<p class="texto-suave">Este caderno não foi encontrado. Ele pode ter sido excluído.</p>';
    return;
  }
  document.getElementById('editor-titulo').textContent = caderno.titulo;
  document.title = `${caderno.titulo} · Hub de Estudos`;
  const configs = await listar('config');
  if (minha !== montagem) return;
  configFavoritos = configs.find((c) => c.chave === 'canetas') || null;
  if (Array.isArray(configFavoritos?.valor?.favoritos) && configFavoritos.valor.favoritos.length === 5) favoritos = configFavoritos.valor.favoritos;

  const todas = (await listar('paginas')).filter((p) => p.caderno_id === caderno.id).sort((a, b) => a.ordem - b.ordem);
  if (minha !== montagem) return;
  paginas = todas;
  if (!paginas.length) {
    const dim = dimDoCaderno();
    paginas = [await salvar('paginas', { caderno_id: caderno.id, ordem: 0, modelo_folha: 'pautada-media', tracos_json: novaPaginaVazia('pautada-media'), largura: dim.largura, altura: dim.altura })];
    if (minha !== montagem) return;
  }
  editor = new EditorDeTinta(area, {
    aoMudar,
    aoSelecao: (n) => {
      selecionados = n;
      const barraSel = document.getElementById('editor-selecao');
      if (!barraSel) return;
      barraSel.hidden = !n;
      barraSel.innerHTML = n ? barraSelecao() : '';
    },
    aoZoom: (z) => {
      const el = document.getElementById('editor-zoom');
      if (el) el.textContent = `${Math.round(z * 100)}%`;
    },
  });
  aplicarPrefs();
  abrirPagina(0);
  mostrarSalvo('Salvo');
  document.addEventListener('click', aoClicar);
  document.addEventListener('change', aoMudarCampo);
  document.addEventListener('input', aoMudarCampo);
  document.addEventListener('keydown', aoTeclar);
  document.addEventListener('pointerdown', aoApertarFavorito);
  document.addEventListener('pointerup', aoSoltarFavorito);
  document.addEventListener('pointercancel', aoSoltarFavorito);
  window.addEventListener('pagehide', salvarAgora);
}

export function desmontarEditorCaderno() {
  montagem += 1;
  document.body.classList.remove('modo-editor');
  document.removeEventListener('click', aoClicar);
  document.removeEventListener('change', aoMudarCampo);
  document.removeEventListener('input', aoMudarCampo);
  document.removeEventListener('keydown', aoTeclar);
  document.removeEventListener('pointerdown', aoApertarFavorito);
  document.removeEventListener('pointerup', aoSoltarFavorito);
  document.removeEventListener('pointercancel', aoSoltarFavorito);
  window.removeEventListener('pagehide', salvarAgora);
  if (tempoSalvar && editor) {
    // Salva na hora o que estava esperando (sem aguardar: a tela já está saindo).
    clearTimeout(tempoSalvar);
    salvar('paginas', { ...paginas[indice], tracos_json: editor.pagina });
  }
  tempoSalvar = null;
  editor?.destruir();
  editor = null;
  caderno = null;
  paginas = [];
  selecionados = 0;
}

// ---------------------------------------------------------------------------
// Eventos da barra
// ---------------------------------------------------------------------------

function aoApertarFavorito(e) {
  // Tocar fora do painel "Ajustes" fecha o painel.
  const painel = document.querySelector('.ferramenta-mais[open]');
  if (painel && !painel.contains(e.target)) painel.open = false;
  const alvo = e.target.closest('[data-ed="favorito"]');
  if (!alvo) return;
  const i = Number(alvo.dataset.valor);
  toqueFavorito = { i, guardou: false, tempo: setTimeout(() => {
    toqueFavorito.guardou = true;
    guardarFavorito(i);
  }, SEGURAR_FAVORITO_MS) };
}

function aoSoltarFavorito() {
  if (toqueFavorito) clearTimeout(toqueFavorito.tempo);
}

function aoClicar(evento) {
  const alvo = evento.target.closest('[data-ed]');
  if (!alvo || !editor) return;
  const { ed: acao, valor } = alvo.dataset;
  switch (acao) {
    case 'ferramenta':
      prefs.ferramenta = valor;
      break;
    case 'favorito':
      if (toqueFavorito?.guardou) {
        toqueFavorito = null;
        return;
      }
      toqueFavorito = null;
      usarFavorito(Number(valor));
      break;
    case 'cor':
      if (prefs.ferramenta === 'marca-texto') prefs.tintaMarca = valor;
      else prefs.tinta = valor;
      if (prefs.ferramenta === 'laco' && selecionados) editor.mudarCorSelecao(valor);
      break;
    case 'espessura':
      if (prefs.ferramenta === 'marca-texto') prefs.tamanhoMarca = Number(valor);
      else if (prefs.ferramenta === 'borracha') prefs.raioBorracha = Number(valor);
      else prefs.tamanho = Number(valor);
      break;
    case 'tipo-borracha':
      prefs.tipoBorracha = valor;
      break;
    case 'desfazer':
      editor.voltar();
      atualizarHistorico();
      return;
    case 'refazer':
      editor.avancar();
      atualizarHistorico();
      return;
    case 'zoom-normal':
      editor.definirZoom(1);
      return;
    case 'pagina-anterior':
      salvarAgora().then(() => abrirPagina(indice - 1));
      return;
    case 'pagina-proxima':
      salvarAgora().then(() => abrirPagina(indice + 1));
      return;
    case 'pagina-nova':
      novaPagina();
      return;
    case 'selecao-cor':
      editor.mudarCorSelecao(valor);
      return;
    case 'selecao-duplicar':
      editor.duplicarSelecao();
      return;
    case 'selecao-copiar':
      avisar(`${editor.copiarSelecao()} traço(s) copiado(s). Use "Colar" no Laço para pôr em outra página.`);
      return;
    case 'selecao-excluir':
      editor.excluirSelecao();
      return;
    case 'selecao-pronto':
      editor.limparSelecao();
      return;
    case 'colar':
      if (!editor.colar()) avisar('Nada copiado ainda.');
      return;
    default:
      return;
  }
  guardarPrefs();
  aplicarPrefs();
  atualizarBarra();
}

function aoMudarCampo(evento) {
  const alvo = evento.target;
  if (!alvo.dataset?.ed || !editor) return;
  switch (alvo.dataset.ed) {
    case 'cor-propria':
      if (evento.type !== 'change' && evento.type !== 'input') return;
      if (prefs.ferramenta === 'marca-texto') prefs.tintaMarca = alvo.value;
      else {
        prefs.tinta = alvo.value;
        if (!ehCaneta(prefs.ferramenta) && prefs.ferramenta !== 'laco') prefs.ferramenta = 'tinteiro';
      }
      if (prefs.ferramenta === 'laco' && selecionados && evento.type === 'change') editor.mudarCorSelecao(alvo.value);
      guardarPrefs();
      aplicarPrefs();
      if (evento.type === 'change') atualizarBarra();
      return;
    case 'modelo':
      if (evento.type === 'change') mudarModelo(alvo.value);
      return;
    case 'suavizacao':
      prefs.suavizacao = alvo.value;
      break;
    case 'formas':
      prefs.formasAuto = alvo.checked;
      break;
    case 'marca-reta':
      prefs.marcaReta = alvo.checked;
      break;
    case 'dedo':
      prefs.dedo = alvo.checked;
      break;
    default:
      return;
  }
  guardarPrefs();
  aplicarPrefs();
}

function aoTeclar(evento) {
  if (!editor || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
  const tecla = evento.key.toLowerCase();
  if (tecla === 'escape') {
    document.querySelector('.ferramenta-mais[open]')?.removeAttribute('open');
    editor.limparSelecao();
    return;
  }
  if ((evento.ctrlKey || evento.metaKey) && tecla === 'z') {
    evento.preventDefault();
    if (evento.shiftKey) editor.avancar();
    else editor.voltar();
    atualizarHistorico();
  } else if ((evento.ctrlKey || evento.metaKey) && tecla === 'c' && selecionados) {
    editor.copiarSelecao();
  } else if ((evento.ctrlKey || evento.metaKey) && tecla === 'v') {
    editor.colar();
  } else if ((tecla === 'delete' || tecla === 'backspace') && selecionados) {
    evento.preventDefault();
    editor.excluirSelecao();
  }
}
