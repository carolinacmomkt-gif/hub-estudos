// Editor de um caderno (#cadernos/<id>): ferramentas, favoritos, páginas e salvamento.
// O motor de tinta está em editor-tinta.js; aqui fica só a tela em volta dele.

import { EditorDeTinta, novaPaginaVazia, ADESIVOS_SIMPLES, fonteDoTexto } from './editor-tinta.js';
import { grupoLinha, grupoTexto, grupoLaco, painelInserir, painelCamadas, barraDaSelecao } from './views-editor-extras.js';
import { dimensoes, opcoesDeModelo, modeloComData } from './folhas.js';
import { listar, salvar, obter } from './persistencia.js';
import { imagemDoFundo, modelosProprios, imagemParaModelo } from './fundos.js';
import { renderPainelPaginas, renderAbasSecoes } from './views-paginas.js';
import { pngDaPagina, pdfDasPaginas, baixar, nomeDeArquivo } from './exportar-caderno.js';
import { somarPeriodo, segundaDaSemana, primeiroDoMes } from './dados-cadernos.js';
import { esc } from './utilidades.js';
import { obterEstado, atualizarEstado } from './estado.js';

const CHAVE_PREFS = 'hub.editor.prefs';

const FERRAMENTAS = [
  { id: 'tinteiro', nome: 'Tinteiro' },
  { id: 'esferografica', nome: 'Esferográfica' },
  { id: 'pincel', nome: 'Pincel' },
  { id: 'lapis', nome: 'Lápis' },
  { id: 'marca-texto', nome: 'Marca-texto' },
  { id: 'texto', nome: 'Texto' },
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
let sujo = false; // a página mudou desde o último salvamento
let favoritos = FAVORITOS_PADRAO;
let configFavoritos = null;
let selecionados = 0;
let prefs = lerPrefs();
let toqueFavorito = null;
let montagem = 0; // cada abertura do editor ganha um número; uma abertura antiga para no meio
let configAdesivos = null; // config "adesivos": { lista: [{ id, nome, largura, altura, itens, previa }] }
let caixaTexto = null; // edição de texto aberta: { el, item, camadaId, x, y }
let secoes = [];
let lixeira = null; // páginas excluídas (carregadas quando a Carol abre a lixeira do painel)
const CRESCER_INFINITO = 700; // unidades que o quadro infinito ganha quando a escrita chega perto do fim

function lerPrefs() {
  const padrao = {
    ferramenta: 'tinteiro', tinta: 'tinta', tintaMarca: 'amarelo', tamanho: 4, tamanhoMarca: 24, raioBorracha: 16,
    tipoBorracha: 'traco', suavizacao: 'leve', dedo: false, marcaReta: false, formasAuto: true,
    linha: 'continua', fonteTexto: 'sistema', tamTexto: 26, negritoTexto: false, fundoTexto: 'nenhum',
    filtroLaco: 'tudo', todasCamadas: false, marcaPropria: false,
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

// O seletor de cor (input type=color) precisa de um #rrggbb: pega a cor do tema.
function corDoTema(variavel) {
  const valor = getComputedStyle(document.documentElement).getPropertyValue(variavel).trim();
  return /^#[0-9a-f]{6}$/i.test(valor) ? valor : '#000000';
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
          <button type="button" class="ferramenta-botao" data-ed="painel" aria-controls="editor-painel">Páginas</button>
          <button type="button" class="ferramenta-botao" data-ed="gerar-questoes" aria-label="Gerar questões desta página" title="Manda a imagem desta página para o gerador de questões">Gerar questões</button>
        </div>
      </header>
      <div class="secoes-abas" id="editor-secoes" role="group" aria-label="Divisórias"></div>
      <div id="editor-barra"></div>
      <div class="selecao-barra" id="editor-selecao" hidden></div>
      <div class="caneta-area" id="caneta-area"></div>
      <aside class="editor-painel" id="editor-painel" aria-label="Páginas do caderno" hidden></aside>
    </div>`;
}

// Páginas com fundo de imagem (PDF ou modelo próprio) são claras: a tinta usa as cores do papel claro.
function prefixoDaTinta() {
  const modelo = String(paginas[indice]?.modelo_folha || '');
  return modelo === 'pdf' || modelo.startsWith('proprio:') ? '--impressao-tinta-' : '--tinta-';
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
  if (ehCaneta(f) || f === 'marca-texto' || f === 'texto' || (f === 'laco' && selecionados)) {
    const lista = f === 'marca-texto' ? MARCAS : TINTAS;
    const atual = f === 'marca-texto' ? prefs.tintaMarca : prefs.tinta;
    const propria = atual?.startsWith('#') ? atual : corDoTema('--tinta-azul');
    cores = `
      <div class="ferramenta-grupo" role="group" aria-label="Cor">
        ${lista.map((c) => `<button type="button" class="ferramenta-cor" data-ed="cor" data-valor="${c.id}" aria-pressed="${atual === c.id}"
          aria-label="${c.nome}" title="${c.nome}" style="--cor: var(${prefixoDaTinta()}${c.id})"></button>`).join('')}
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
      ${f === 'texto' ? grupoTexto(prefs, cores) : cores}
      ${espessuras}
      ${extraBorracha}
      ${ehCaneta(f) ? grupoLinha(prefs.linha) : ''}
      ${f === 'laco' ? grupoLaco(prefs.filtroLaco, Boolean(editor?.area?.length)) : ''}
      ${painelInserir(adesivosProprios())}
      ${editor ? painelCamadas(editor.pagina.camadas, editor.camadaAtiva()?.id, { todas: prefs.todasCamadas, marcaPropria: prefs.marcaPropria }) : ''}
      <div class="ferramenta-grupo" role="group" aria-label="Histórico">
        <button type="button" class="ferramenta-botao" data-ed="desfazer" aria-label="Desfazer" title="Desfazer (ou toque com dois dedos)">↶</button>
        <button type="button" class="ferramenta-botao" data-ed="refazer" aria-label="Refazer" title="Refazer (ou toque com três dedos)">↷</button>
      </div>
      <details class="ferramenta-mais" data-painel="ajustes">
        <summary class="ferramenta-botao">Ajustes</summary>
        <div class="ferramenta-painel">
          <label class="ferramenta-select"><span>Folha desta página</span>
            <select data-ed="modelo">${opcoesDeModelo(pagina?.modelo_folha, modelosProprios())}</select></label>
          ${modeloComData(pagina?.modelo_folha) ? `<label class="ferramenta-select"><span>${modeloComData(pagina.modelo_folha) === 'mes' ? 'Mês do planner' : 'Semana que começa em'}</span>
            <input type="date" data-ed="fundo-data" value="${esc(editor?.pagina?.fundo?.data || '')}"></label>` : ''}
          <label class="botao botao-secundario botao-pequeno">Importar modelo próprio (imagem ou PDF)
            <input type="file" class="visualmente-oculto" accept="image/*,application/pdf,.pdf" data-ed="modelo-importar"></label>
          ${String(pagina?.modelo_folha || '').startsWith('proprio:') ? '<button type="button" class="botao botao-secundario botao-pequeno botao-perigo" data-ed="modelo-excluir">Excluir este modelo</button>' : ''}
          <label class="ferramenta-select"><span>Estabilizador</span>
            <select data-ed="suavizacao">${SUAVES.map((s) => `<option value="${s.id}"${prefs.suavizacao === s.id ? ' selected' : ''}>${s.nome}</option>`).join('')}</select></label>
          <label class="campo-marcar"><input type="checkbox" data-ed="formas"${prefs.formasAuto ? ' checked' : ''}><span>Segurar no fim do traço vira forma</span></label>
          <label class="campo-marcar"><input type="checkbox" data-ed="marca-reta"${prefs.marcaReta ? ' checked' : ''}><span>Marca-texto em linha reta</span></label>
          <label class="campo-marcar"><input type="checkbox" data-ed="dedo"${prefs.dedo ? ' checked' : ''}><span>Desenhar com o dedo</span></label>
          <button type="button" class="botao botao-secundario botao-pequeno" data-ed="zoom-normal">Zoom: <span id="editor-zoom">${Math.round((editor?.zoom || 1) * 100)}%</span> · voltar a 100%</button>
          <button type="button" class="botao botao-secundario botao-pequeno" data-ed="painel-pronto">Pronto</button>
          <p class="campo-ajuda">Pinça dá zoom. Toque com dois dedos desfaz; com três, refaz. O botão da S Pen vira borracha. Segure um favorito para guardar a caneta atual nele.</p>
        </div>
      </details>
    </div>`;
}

function barraSelecao() {
  const cores = TINTAS.map((c) => `<button type="button" class="ferramenta-cor" data-ed="selecao-cor" data-valor="${c.id}" aria-label="Mudar para ${c.nome}" style="--cor: var(${prefixoDaTinta()}${c.id})"></button>`).join('');
  const itens = editor?.itensSelecionados() || [];
  return barraDaSelecao({ quantos: selecionados, cores, temTraco: itens.some((i) => !i.tipo || i.tipo === 'traco') });
}

function atualizarBarra() {
  const el = document.getElementById('editor-barra');
  if (!el) return;
  const abertos = [...el.querySelectorAll('details')].map((d) => d.open);
  el.innerHTML = barra();
  el.querySelectorAll('details').forEach((d, i) => { if (abertos[i]) d.open = true; });
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
  editor.linha = prefs.linha;
  editor.filtroLaco = prefs.filtroLaco;
  editor.todasAsCamadas = prefs.todasCamadas;
  editor.marcaCamadaPropria = prefs.marcaPropria;
  if (prefs.ferramenta !== 'texto') fecharCaixaTexto();
  if (prefs.ferramenta !== 'laco') editor.limparSelecao();
}

function dimDoCaderno() {
  return dimensoes(caderno?.tamanho || 'A4', caderno?.orientacao || 'retrato');
}

// Cada página guarda a própria altura (páginas de PDF têm o tamanho do original; o quadro infinito cresce).
function dimDaPagina(p) {
  const base = dimDoCaderno();
  const altura = Number(p?.altura);
  return altura > 0 ? { ...base, altura } : base;
}

async function salvarAgora() {
  clearTimeout(tempoSalvar);
  tempoSalvar = null;
  // Folhear o caderno só para ler não salva nada (nem marca o caderno como editado).
  if (!sujo || !editor || !paginas[indice]) return;
  sujo = false;
  paginas[indice] = await salvar('paginas', { ...paginas[indice], tracos_json: editor.pagina, miniatura_url: editor.miniatura(), altura: editor.dim.altura });
  // O caderno sobe para o topo da lista e do Início.
  if (caderno) caderno = await salvar('cadernos', { ...caderno });
  mostrarSalvo('Salvo');
}

// Quadro infinito: quando a escrita chega perto do fim da folha, ela cresce.
function crescerSePrecisar() {
  if (caderno?.tipo !== 'infinito') return;
  let maior = 0;
  for (const c of editor.pagina.camadas) for (const item of c.itens || []) for (const [, y] of item.pontos) if (y > maior) maior = y;
  if (maior > editor.dim.altura - 250) editor.definirPapel({ ...editor.dim, altura: Math.ceil((maior + CRESCER_INFINITO) / 100) * 100 });
}

function aoMudar() {
  crescerSePrecisar();
  sujo = true;
  mostrarSalvo('Salvando…');
  atualizarHistorico();
  clearTimeout(tempoSalvar);
  tempoSalvar = setTimeout(salvarAgora, 900);
}

function abrirPagina(n) {
  fecharCaixaTexto();
  indice = Math.max(0, Math.min(paginas.length - 1, n));
  const p = paginas[indice];
  const json = p.tracos_json?.camadas?.length ? p.tracos_json : novaPaginaVazia(p.modelo_folha);
  json.modelo = p.modelo_folha || json.modelo;
  editor.carregar(json, dimDaPagina(p));
  document.getElementById('caneta-area').scrollTop = 0;
  atualizarPaginacao();
  atualizarBarra();
  atualizarSecoes();
  if (!document.getElementById('editor-painel')?.hidden) atualizarPainel();
  carregarFundo(p);
}

function carregarFundo(p) {
  const minha = montagem;
  imagemDoFundo(p).then((img) => {
    if (minha === montagem && paginas[indice]?.id === p.id && editor) editor.definirImagemDeFundo(img);
    if (!img && (p.modelo_folha === 'pdf' || String(p.modelo_folha).startsWith('proprio:'))) avisar('O fundo desta página não abriu (sem internet?). A escrita continua salva.');
  });
}

// ---------------------------------------------------------------------------
// Divisórias, painel de páginas e ordem
// ---------------------------------------------------------------------------

function atualizarSecoes() {
  const el = document.getElementById('editor-secoes');
  if (!el) return;
  el.innerHTML = renderAbasSecoes(secoes, paginas[indice]?.secao_id);
  el.hidden = !secoes.length;
}

function atualizarPainel() {
  const el = document.getElementById('editor-painel');
  if (!el || !caderno) return;
  const rolagem = el.scrollTop;
  el.innerHTML = renderPainelPaginas({ caderno, paginas, indice, secoes, lixeira });
  el.scrollTop = rolagem;
}

// Grava a ordem atual (0, 1, 2…) só nas páginas em que ela mudou.
async function renumerar() {
  for (let i = 0; i < paginas.length; i += 1) {
    if (paginas[i].ordem !== i) paginas[i] = await salvar('paginas', { ...paginas[i], ordem: i });
  }
}

// Páginas de uma divisória ficam juntas, na ordem das divisórias.
function ordenarPorSecao() {
  if (!secoes.length) return;
  const posicao = new Map(secoes.map((s, i) => [s.id, i]));
  paginas = paginas.map((p, i) => ({ p, i })).sort((a, b) => (posicao.get(a.p.secao_id) ?? secoes.length) - (posicao.get(b.p.secao_id) ?? secoes.length) || a.i - b.i).map((x) => x.p);
}

const posicaoDe = (id) => paginas.findIndex((p) => p.id === id);

async function moverPagina(de, para) {
  if (para < 0 || para >= paginas.length || de === para) return;
  await salvarAgora();
  const atualId = paginas[indice]?.id;
  const [p] = paginas.splice(de, 1);
  paginas.splice(para, 0, p);
  // Passou para outra divisória: a página passa a ser dela.
  if (secoes.length) {
    const nova = (para > de ? paginas[para - 1] : paginas[para + 1])?.secao_id ?? p.secao_id;
    if ((nova || null) !== (p.secao_id || null)) paginas[para] = await salvar('paginas', { ...p, secao_id: nova || null });
  }
  await renumerar();
  indice = posicaoDe(atualId);
  atualizarPaginacao();
  atualizarSecoes();
  atualizarPainel();
}

async function duplicarPagina(i) {
  await salvarAgora();
  const p = paginas[i];
  const copia = structuredClone({ ...p.tracos_json, modelo: p.modelo_folha });
  for (const c of copia.camadas || []) {
    if (c.tipo === 'desenho') {
      c.id = crypto.randomUUID();
      for (const item of c.itens || []) item.id = crypto.randomUUID();
    }
  }
  const nova = await salvar('paginas', {
    caderno_id: caderno.id, ordem: i + 1, modelo_folha: p.modelo_folha, tracos_json: copia, largura: p.largura, altura: p.altura,
    secao_id: p.secao_id || null, pdf_path: p.pdf_path || null, pdf_pagina: p.pdf_pagina || null, miniatura_url: p.miniatura_url || null,
  });
  paginas.splice(i + 1, 0, nova);
  await renumerar();
  abrirPagina(i + 1);
  avisar('Página duplicada.');
}

async function excluirPagina(i) {
  await salvarAgora();
  const p = paginas[i];
  if (!p || !window.confirm(`Mandar a página ${i + 1} para a lixeira? Dá para restaurar no painel de páginas.`)) return;
  await salvar('paginas', { ...p, excluido_em: new Date().toISOString() });
  paginas.splice(i, 1);
  lixeira = null;
  if (!paginas.length) {
    const dim = dimDoCaderno();
    paginas.push(await salvar('paginas', { caderno_id: caderno.id, ordem: 0, modelo_folha: p.modelo_folha === 'pdf' ? 'branco' : p.modelo_folha, tracos_json: novaPaginaVazia('branco'), largura: dim.largura, altura: dim.altura }));
  }
  await renumerar();
  abrirPagina(Math.min(i, paginas.length - 1));
  avisar('Página na lixeira.');
}

async function abrirLixeira() {
  lixeira = (await listar('paginas', { incluirExcluidos: true })).filter((p) => p.caderno_id === caderno.id && p.excluido_em)
    .sort((a, b) => String(b.excluido_em).localeCompare(String(a.excluido_em)));
  atualizarPainel();
}

async function restaurarPagina(id) {
  const p = (lixeira || []).find((x) => x.id === id);
  if (!p) return;
  await salvarAgora();
  const restaurada = await salvar('paginas', { ...p, excluido_em: null, ordem: paginas.length });
  paginas.push(restaurada);
  ordenarPorSecao();
  await renumerar();
  await abrirLixeira();
  abrirPagina(posicaoDe(restaurada.id));
  avisar('Página restaurada.');
}

async function mudarSecaoDaPagina(i, secaoId) {
  await salvarAgora();
  const atualId = paginas[indice]?.id;
  paginas[i] = await salvar('paginas', { ...paginas[i], secao_id: secaoId || null });
  ordenarPorSecao();
  await renumerar();
  indice = posicaoDe(atualId);
  atualizarPaginacao();
  atualizarSecoes();
  atualizarPainel();
}

async function novaSecao() {
  const titulo = window.prompt('Nome da divisória', `Matéria ${secoes.length + 1}`);
  if (!titulo?.trim()) return;
  await salvarAgora();
  const secao = await salvar('secoes', { caderno_id: caderno.id, titulo: titulo.trim().slice(0, 60), ordem: secoes.length, cor: String((secoes.length % 6) + 1) });
  secoes.push(secao);
  const dim = dimDoCaderno();
  const modelo = paginas[indice]?.modelo_folha === 'pdf' ? 'pautada-media' : (paginas[indice]?.modelo_folha || 'pautada-media');
  const nova = await salvar('paginas', { caderno_id: caderno.id, ordem: paginas.length, modelo_folha: modelo, tracos_json: novaPaginaVazia(modelo), largura: dim.largura, altura: dim.altura, secao_id: secao.id });
  paginas.push(nova);
  await renumerar();
  abrirPagina(paginas.length - 1);
}

async function moverSecao(id) {
  const i = secoes.findIndex((s) => s.id === id);
  if (i <= 0) return;
  [secoes[i - 1], secoes[i]] = [secoes[i], secoes[i - 1]];
  for (let k = 0; k < secoes.length; k += 1) if (secoes[k].ordem !== k) secoes[k] = await salvar('secoes', { ...secoes[k], ordem: k });
  await salvarAgora();
  const atualId = paginas[indice]?.id;
  ordenarPorSecao();
  await renumerar();
  indice = posicaoDe(atualId);
  atualizarPaginacao();
  atualizarSecoes();
  atualizarPainel();
}

async function excluirSecao(id) {
  const s = secoes.find((x) => x.id === id);
  if (!s || !window.confirm(`Excluir a divisória "${s.titulo}"? As páginas dela continuam no caderno, sem divisória.`)) return;
  await salvarAgora();
  await salvar('secoes', { ...s, excluido_em: new Date().toISOString() });
  secoes = secoes.filter((x) => x.id !== id);
  for (let i = 0; i < paginas.length; i += 1) if (paginas[i].secao_id === id) paginas[i] = await salvar('paginas', { ...paginas[i], secao_id: null });
  const atualId = paginas[indice]?.id;
  ordenarPorSecao();
  await renumerar();
  indice = posicaoDe(atualId);
  atualizarSecoes();
  atualizarPainel();
}

let tempoSecao = null;
function renomearSecao(id, titulo) {
  clearTimeout(tempoSecao);
  tempoSecao = setTimeout(async () => {
    const i = secoes.findIndex((x) => x.id === id);
    if (i < 0 || !titulo.trim()) return;
    secoes[i] = await salvar('secoes', { ...secoes[i], titulo: titulo.trim().slice(0, 60) });
    atualizarSecoes();
  }, 600);
}

// ---------------------------------------------------------------------------
// Exportar e modelos próprios
// ---------------------------------------------------------------------------

async function exportar(tipo) {
  await salvarAgora();
  const nome = nomeDeArquivo(caderno.titulo);
  try {
    if (tipo === 'png') {
      baixar(await pngDaPagina(paginas[indice], dimDaPagina(paginas[indice])), `${nome}-pagina-${indice + 1}.png`);
    } else {
      const lista = (tipo === 'pdf' ? paginas : [paginas[indice]]).map((p) => ({ pagina: p, dim: dimDaPagina(p) }));
      const pdf = await pdfDasPaginas(lista, (n, total) => { if (total > 1) mostrarSalvo(`Exportando ${n} de ${total}…`); });
      baixar(pdf, tipo === 'pdf' ? `${nome}.pdf` : `${nome}-pagina-${indice + 1}.pdf`);
    }
    mostrarSalvo('Salvo');
    avisar('Arquivo pronto. Ele vai para os downloads do aparelho.');
  } catch (erro) {
    console.warn('Exportar:', erro);
    mostrarSalvo('Salvo');
    avisar('Não deu para exportar agora. Tente de novo.');
  }
}

async function importarModelo(input) {
  const arquivo = input.files?.[0];
  input.value = '';
  if (!arquivo) return;
  if (arquivo.size > 25 * 1024 * 1024) {
    avisar('O arquivo passa de 25 MB.');
    return;
  }
  const nome = window.prompt('Nome do modelo', arquivo.name.replace(/\.[^.]+$/, '').slice(0, 60));
  if (nome === null) return;
  try {
    mostrarSalvo('Preparando o modelo…');
    const { dataUrl } = await imagemParaModelo(arquivo);
    const id = crypto.randomUUID().slice(0, 12);
    await salvar('config', { chave: `modelo_folha:${id}`, valor: { nome: (nome || 'Meu modelo').trim().slice(0, 60), imagem: dataUrl } });
    atualizarEstado({ config: await listar('config') });
    await mudarModelo(`proprio:${id}`);
    mostrarSalvo('Salvo');
    avisar('Modelo importado. Ele aparece em "Meus modelos" para qualquer página.');
  } catch (erro) {
    console.warn('Modelo próprio:', erro);
    mostrarSalvo('Salvo');
    avisar('Não deu para ler esse arquivo. Tente uma imagem (JPG ou PNG) ou um PDF.');
  }
}

async function excluirModelo() {
  const modelo = paginas[indice]?.modelo_folha || '';
  const m = modelosProprios().find((x) => `proprio:${x.id}` === modelo);
  if (!m || !window.confirm(`Excluir o modelo "${m.nome}"? As páginas que usam ele ficam em branco.`)) return;
  await salvar('config', { ...m.linha, excluido_em: new Date().toISOString() });
  atualizarEstado({ config: await listar('config') });
  await mudarModelo('branco');
}

// Página nova logo depois da atual, com a mesma folha e na mesma divisória.
// No planner, já com a semana (ou o mês) seguinte; depois de uma página de PDF, uma folha pautada.
async function novaPagina() {
  await salvarAgora();
  const atual = paginas[indice];
  const modelo = !atual || atual.modelo_folha === 'pdf' ? 'pautada-media' : atual.modelo_folha;
  const dim = caderno.tipo === 'infinito' || atual?.modelo_folha === 'pdf' ? dimDoCaderno() : dimDaPagina(atual);
  const tracos = novaPaginaVazia(modelo);
  const periodo = modeloComData(modelo);
  if (periodo) {
    const ultima = paginas.filter((p) => p.modelo_folha === modelo && p.tracos_json?.fundo?.data).map((p) => p.tracos_json.fundo.data).sort().pop();
    if (ultima) tracos.fundo = { data: somarPeriodo(ultima, periodo, 1) };
  }
  const nova = await salvar('paginas', {
    caderno_id: caderno.id, ordem: indice + 1, modelo_folha: modelo, tracos_json: tracos, largura: dim.largura, altura: dim.altura,
    secao_id: atual?.secao_id || null,
  });
  paginas.splice(indice + 1, 0, nova);
  await renumerar();
  abrirPagina(indice + 1);
  avisar(`Página ${indice + 1} criada.`);
}

// ---------------------------------------------------------------------------
// Texto digitado, imagens e adesivos
// ---------------------------------------------------------------------------

function estiloDoTexto() {
  return { fonte: prefs.fonteTexto, tamTexto: Number(prefs.tamTexto) || 26, negrito: Boolean(prefs.negritoTexto), tinta: prefs.tinta, fundo: prefs.fundoTexto };
}

// Caixa de digitar por cima da página (some ao tocar fora; Esc cancela).
function abrirCaixaTexto({ item = null, camadaId, x, y }) {
  fecharCaixaTexto();
  const folha = document.querySelector('.folha-tinta');
  if (!folha || !editor) return;
  const estilo = item ? { fonte: item.fonte, tamTexto: item.tamTexto, negrito: item.negrito, tinta: item.tinta, fundo: item.fundo } : estiloDoTexto();
  const r = item ? editor.retanguloNaTela(item) : { x: x * editor.escala, y: y * editor.escala, largura: Math.min(420, editor.dim.largura - x) * editor.escala, altura: 0, escala: editor.escala };
  const el = document.createElement('textarea');
  el.className = 'caixa-texto-edicao';
  el.value = item?.texto || '';
  el.setAttribute('aria-label', 'Texto da caixa');
  el.style.left = `${r.x}px`;
  el.style.top = `${r.y}px`;
  el.style.width = `${Math.max(120, r.largura + 12)}px`;
  el.style.minHeight = `${Math.max(r.altura, (estilo.tamTexto || 26) * 1.4 * r.escala)}px`;
  el.style.font = fonteDoTexto({ ...estilo, tamTexto: (estilo.tamTexto || 26) * r.escala });
  el.style.lineHeight = '1.3';
  el.style.color = `var(${prefixoDaTinta()}${/^#/.test(estilo.tinta) ? 'tinta' : estilo.tinta})`;
  if (/^#/.test(estilo.tinta)) el.style.color = estilo.tinta;
  folha.append(el);
  caixaTexto = { el, item, camadaId, x, y, estilo };
  // O texto que está sendo editado some do canvas até terminar.
  if (item) {
    editor.arrastando = null;
    editor.selecao = null;
  }
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      fecharCaixaTexto({ salvar: false });
    }
  });
  el.addEventListener('blur', () => setTimeout(() => fecharCaixaTexto(), 0));
  setTimeout(() => el.focus(), 0);
}

function fecharCaixaTexto({ salvar: guardar = true } = {}) {
  if (!caixaTexto) return;
  const { el, item, camadaId, x, y, estilo } = caixaTexto;
  caixaTexto = null;
  el.remove();
  if (guardar && editor && (el.value.trim() || item)) {
    editor.salvarTexto({ item, camadaId, x, y, texto: el.value, estilo: item ? {} : estilo });
  }
}

function adesivosProprios() {
  return Array.isArray(configAdesivos?.valor?.lista) ? configAdesivos.valor.lista : [];
}

async function guardarAdesivos(lista) {
  configAdesivos = await salvar('config', { ...(configAdesivos || {}), chave: 'adesivos', valor: { lista } });
}

// Imagem reduzida (até 1400 px) em data URL; PNG pequeno continua PNG (mantém o fundo transparente).
async function imagemParaInserir(arquivo) {
  const bmp = await createImageBitmap(arquivo);
  const escala = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * escala));
  c.height = Math.max(1, Math.round(bmp.height * escala));
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  const png = /png/i.test(arquivo.type) && arquivo.size < 700 * 1024;
  return { src: png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.82), largura: c.width, altura: c.height };
}

async function inserirImagem(input) {
  const arquivo = input.files?.[0];
  input.value = '';
  if (!arquivo || !editor) return;
  if (!/^image\//.test(arquivo.type)) {
    avisar('Escolha uma imagem (JPG, PNG…).');
    return;
  }
  try {
    const { src, largura, altura } = await imagemParaInserir(arquivo);
    const w = Math.min(500, editor.dim.largura * 0.6, largura);
    editor.inserirCaixa({ tipo: 'imagem', src }, w, Math.round((w * altura) / largura));
    mudarParaLaco();
    avisar('Imagem inserida. Arraste para mover; o canto muda o tamanho.');
  } catch {
    avisar('Não deu para abrir essa imagem.');
  }
}

function inserirAdesivo(i) {
  const simbolo = ADESIVOS_SIMPLES[i];
  if (!simbolo || !editor) return;
  const palavra = simbolo.length > 2;
  editor.inserirCaixa({ tipo: 'adesivo', simbolo, tinta: palavra ? 'tinta' : undefined, fundo: palavra ? 'amarelo' : undefined }, palavra ? 190 : 80, palavra ? 64 : 80);
  mudarParaLaco();
}

function inserirMeuAdesivo(id) {
  const a = adesivosProprios().find((x) => x.id === id);
  if (!a || !editor) return;
  editor.inserirItens(a.itens, a.largura, a.altura);
  mudarParaLaco();
}

async function selecaoVirarAdesivo() {
  const n = editor.selecaoNormalizada();
  if (!n) return;
  const nome = window.prompt('Nome do adesivo', 'Meu adesivo');
  if (nome === null) return;
  const blob = await editor.imagemDaSelecao(1);
  const previa = blob ? await new Promise((resolver) => { const r = new FileReader(); r.onload = () => resolver(r.result); r.readAsDataURL(blob); }) : null;
  await guardarAdesivos([...adesivosProprios(), { id: crypto.randomUUID().slice(0, 10), nome: (nome || 'Meu adesivo').trim().slice(0, 40), ...n, previa }]);
  atualizarBarra();
  avisar('Adesivo guardado. Ele fica em Inserir → Meus adesivos.');
}

async function selecaoCapturarImagem() {
  const blob = await editor.imagemDaSelecao(3);
  if (!blob) return;
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    avisar('Imagem copiada. Cole onde quiser.');
  } catch {
    baixar(blob, `${nomeDeArquivo(caderno?.titulo)}-recorte.png`);
    avisar('Imagem salva nos downloads.');
  }
}

function mudarParaLaco() {
  prefs.ferramenta = 'laco';
  guardarPrefs();
  aplicarPrefs();
  atualizarBarra();
}

// Leva a imagem da página para Questões → Gerar, já com a disciplina e o tema do caderno.
async function gerarQuestoesDaPagina() {
  if (!editor.totalDeTracos()) {
    avisar('Esta página ainda está em branco.');
    return;
  }
  await salvarAgora();
  const blob = await editor.imagemDaPagina();
  const anterior = obterEstado().questoesImagem;
  if (anterior?.url) URL.revokeObjectURL(anterior.url);
  atualizarEstado({
    questoesImagem: { blob, url: URL.createObjectURL(blob), rotulo: `${caderno.titulo} · página ${indice + 1}`, caderno_id: caderno.id },
    questoesPreset: { fonte: 'imagem', disciplina: caderno.disciplina_id || '', area: caderno.area_id || '' },
    qFonte: 'imagem',
  });
  location.hash = '#questoes/gerar';
}

async function mudarModelo(modelo) {
  const p = paginas[indice];
  if (!p) return;
  editor.pagina.modelo = modelo;
  paginas[indice] = { ...p, modelo_folha: modelo };
  // Planner novo: começa na semana (ou no mês) de hoje.
  const periodo = modeloComData(modelo);
  if (periodo && !editor.pagina.fundo?.data) {
    const hoje = new Date();
    const chave = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    editor.pagina.fundo = { data: periodo === 'mes' ? primeiroDoMes(chave) : segundaDaSemana(chave) };
  }
  editor.definirImagemDeFundo(null);
  editor.desenharTudo();
  carregarFundo(paginas[indice]);
  aoMudar();
  atualizarBarra();
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
  configAdesivos = configs.find((c) => c.chave === 'adesivos' && !c.excluido_em) || null;
  if (Array.isArray(configFavoritos?.valor?.favoritos) && configFavoritos.valor.favoritos.length === 5) favoritos = configFavoritos.valor.favoritos;

  const todas = (await listar('paginas')).filter((p) => p.caderno_id === caderno.id).sort((a, b) => a.ordem - b.ordem);
  const todasSecoes = (await listar('secoes')).filter((x) => x.caderno_id === caderno.id).sort((a, b) => a.ordem - b.ordem);
  if (minha !== montagem) return;
  paginas = todas;
  secoes = todasSecoes;
  lixeira = null;
  ordenarPorSecao();
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
    aoTexto: (pedido) => abrirCaixaTexto(pedido),
    aoZoom: (z) => {
      fecharCaixaTexto();
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
  document.addEventListener('toggle', ajustarPainel, true);
  window.addEventListener('pagehide', salvarAgora);
}

export function desmontarEditorCaderno() {
  fecharCaixaTexto();
  montagem += 1;
  document.body.classList.remove('modo-editor');
  document.removeEventListener('click', aoClicar);
  document.removeEventListener('change', aoMudarCampo);
  document.removeEventListener('input', aoMudarCampo);
  document.removeEventListener('keydown', aoTeclar);
  document.removeEventListener('pointerdown', aoApertarFavorito);
  document.removeEventListener('pointerup', aoSoltarFavorito);
  document.removeEventListener('pointercancel', aoSoltarFavorito);
  document.removeEventListener('toggle', ajustarPainel, true);
  window.removeEventListener('pagehide', salvarAgora);
  if (sujo && editor) {
    // Salva na hora o que estava esperando (sem aguardar: a tela já está saindo).
    clearTimeout(tempoSalvar);
    salvar('paginas', { ...paginas[indice], tracos_json: editor.pagina, miniatura_url: editor.miniatura(), altura: editor.dim.altura });
  }
  tempoSalvar = null;
  sujo = false;
  editor?.destruir();
  editor = null;
  caderno = null;
  paginas = [];
  secoes = [];
  lixeira = null;
  selecionados = 0;
}

// ---------------------------------------------------------------------------
// Eventos da barra
// ---------------------------------------------------------------------------

// Painéis da barra (Inserir, Camadas, Ajustes): abrem para o lado que tem espaço.
function ajustarPainel(e) {
  const det = e.target;
  if (!det?.matches?.('.ferramenta-mais') || !det.open) return;
  const painel = det.querySelector('.ferramenta-painel');
  if (!painel || getComputedStyle(painel).position === 'fixed') return;
  painel.style.left = '';
  painel.style.right = '';
  if (painel.getBoundingClientRect().left < 8) {
    painel.style.right = 'auto';
    painel.style.left = '0';
  }
}

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
    case 'painel-pronto':
      alvo.closest('details')?.removeAttribute('open');
      return;
    case 'linha':
      prefs.linha = valor;
      break;
    case 'texto-tamanho':
      prefs.tamTexto = Number(valor);
      break;
    case 'texto-negrito':
      prefs.negritoTexto = !prefs.negritoTexto;
      break;
    case 'texto-fundo':
      prefs.fundoTexto = valor;
      break;
    case 'camada-nova':
      editor.adicionarCamada();
      atualizarBarra();
      return;
    case 'camada-ver':
      editor.alternarCamada(valor, 'visivel');
      atualizarBarra();
      return;
    case 'camada-travar':
      editor.alternarCamada(valor, 'bloqueada');
      atualizarBarra();
      return;
    case 'camada-subir':
      editor.moverCamada(valor, 1);
      atualizarBarra();
      return;
    case 'camada-descer':
      editor.moverCamada(valor, -1);
      atualizarBarra();
      return;
    case 'camada-mesclar':
      if (window.confirm('Juntar esta camada com a de baixo? Os traços passam para a de baixo.')) {
        editor.mesclarComAbaixo(valor);
        atualizarBarra();
      }
      return;
    case 'camada-excluir': {
      const c = editor.camada(valor);
      if (c && window.confirm(`Excluir a camada "${c.nome}"${c.itens.length ? ` e os ${c.itens.length} itens dela` : ''}?`)) {
        editor.excluirCamada(valor);
        atualizarBarra();
      }
      return;
    }
    case 'inserir-adesivo':
      inserirAdesivo(Number(valor));
      return;
    case 'inserir-meu-adesivo':
      inserirMeuAdesivo(valor);
      return;
    case 'excluir-meu-adesivo':
      if (window.confirm('Excluir este adesivo da sua coleção? O que já está nas páginas continua.')) {
        guardarAdesivos(adesivosProprios().filter((a) => a.id !== valor)).then(atualizarBarra);
      }
      return;
    case 'selecao-espessura':
      editor.mudarEspessuraSelecao(Number(valor));
      return;
    case 'selecao-girar':
      editor.girarSelecao((Number(valor) * Math.PI) / 180);
      return;
    case 'selecao-recortar':
      avisar(`${editor.recortarSelecao()} item(ns) recortado(s). Use "Colar" no Laço para pôr em outro lugar.`);
      atualizarBarra();
      return;
    case 'selecao-imagem':
      selecaoCapturarImagem();
      return;
    case 'selecao-adesivo':
      selecaoVirarAdesivo();
      return;
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
    case 'gerar-questoes':
      gerarQuestoesDaPagina();
      return;
    case 'painel': {
      const painel = document.getElementById('editor-painel');
      painel.hidden = !painel.hidden;
      if (!painel.hidden) {
        salvarAgora().then(atualizarPainel);
        atualizarPainel();
      }
      return;
    }
    case 'painel-fechar':
      document.getElementById('editor-painel').hidden = true;
      return;
    case 'ir-pagina':
      salvarAgora().then(() => abrirPagina(Number(valor)));
      return;
    case 'ir-secao': {
      const i = paginas.findIndex((p) => p.secao_id === valor);
      if (i >= 0) salvarAgora().then(() => abrirPagina(i));
      return;
    }
    case 'pagina-subir':
      moverPagina(Number(valor), Number(valor) - 1);
      return;
    case 'pagina-descer':
      moverPagina(Number(valor), Number(valor) + 1);
      return;
    case 'pagina-duplicar':
      duplicarPagina(Number(valor));
      return;
    case 'pagina-excluir':
      excluirPagina(Number(valor));
      return;
    case 'lixeira-abrir':
      abrirLixeira();
      return;
    case 'pagina-restaurar':
      restaurarPagina(valor);
      return;
    case 'secao-nova':
      novaSecao();
      return;
    case 'secao-subir':
      moverSecao(valor);
      return;
    case 'secao-excluir':
      excluirSecao(valor);
      return;
    case 'exportar':
      exportar(valor);
      return;
    case 'modelo-excluir':
      excluirModelo();
      return;
    case 'selecao-cor':
      editor.mudarCorSelecao(valor);
      return;
    case 'selecao-duplicar':
      editor.duplicarSelecao();
      return;
    case 'selecao-copiar':
      avisar(`${editor.copiarSelecao()} item(ns) copiado(s). Use "Colar" no Laço para pôr em outra página.`);
      atualizarBarra();
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
    case 'fundo-data':
      if (evento.type === 'change' && /^\d{4}-\d{2}-\d{2}$/.test(alvo.value)) {
        const periodo = modeloComData(paginas[indice]?.modelo_folha);
        editor.pagina.fundo = { ...(editor.pagina.fundo || {}), data: periodo === 'mes' ? primeiroDoMes(alvo.value) : segundaDaSemana(alvo.value) };
        editor.desenharTudo();
        aoMudar();
        atualizarBarra();
      }
      return;
    case 'modelo-importar':
      if (evento.type === 'change') importarModelo(alvo);
      return;
    case 'inserir-imagem':
      if (evento.type === 'change') inserirImagem(alvo);
      return;
    case 'texto-fonte':
      if (evento.type !== 'change') return;
      prefs.fonteTexto = alvo.value;
      break;
    case 'filtro-laco':
      if (evento.type !== 'change') return;
      prefs.filtroLaco = alvo.value;
      editor.limparSelecao();
      break;
    case 'camada-ativa':
      if (evento.type === 'change') {
        editor.ativarCamada(alvo.value);
        atualizarBarra();
      }
      return;
    case 'camada-nome':
      if (evento.type === 'change') editor.renomearCamada(alvo.dataset.valor, alvo.value);
      return;
    case 'camada-opacidade':
      editor.opacidadeDaCamada(alvo.dataset.valor, Number(alvo.value) / 100);
      return;
    case 'camadas-todas':
      if (evento.type !== 'change') return;
      prefs.todasCamadas = alvo.checked;
      editor.limparSelecao();
      break;
    case 'marca-propria':
      if (evento.type !== 'change') return;
      prefs.marcaPropria = alvo.checked;
      break;
    case 'pagina-secao':
      if (evento.type === 'change') mudarSecaoDaPagina(Number(alvo.dataset.valor), alvo.value);
      return;
    case 'secao-nome':
      if (evento.type === 'input') renomearSecao(alvo.dataset.valor, alvo.value);
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
