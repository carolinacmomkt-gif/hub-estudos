// Protótipo da caneta: uma página para sentir pressão, atraso e rejeição da palma no tablet.
// Os traços ficam no caderno "Rascunho da caneta" (formato definitivo, com camadas) e sincronizam.

import { EditorDeTinta, novaPaginaVazia } from './editor-tinta.js';
import { listar, salvar } from './persistencia.js';
import { esc } from './utilidades.js';

const CHAVE_PREFS = 'hub.caneta.prefs';
const MARCA_RASCUNHO = 'rascunho-caneta';

const TINTAS = [
  { id: 'tinta', rotulo: 'Tinta' },
  { id: 'azul', rotulo: 'Azul' },
  { id: 'vermelho', rotulo: 'Vermelho' },
  { id: 'verde', rotulo: 'Verde' },
  { id: 'roxo', rotulo: 'Roxo' },
];
const MARCAS = [
  { id: 'amarelo', rotulo: 'Amarelo' },
  { id: 'rosa', rotulo: 'Rosa' },
  { id: 'ciano', rotulo: 'Azul-claro' },
];
const ESPESSURAS = {
  caneta: [{ id: 2.5, rotulo: 'Fina' }, { id: 4, rotulo: 'Média' }, { id: 7, rotulo: 'Grossa' }],
  'marca-texto': [{ id: 16, rotulo: 'Fina' }, { id: 24, rotulo: 'Média' }, { id: 36, rotulo: 'Grossa' }],
  borracha: [{ id: 8, rotulo: 'Pequena' }, { id: 16, rotulo: 'Média' }, { id: 32, rotulo: 'Grande' }],
};
const SUAVES = [
  { id: 'desligado', rotulo: 'Desligado' },
  { id: 'leve', rotulo: 'Leve' },
  { id: 'medio', rotulo: 'Médio' },
  { id: 'forte', rotulo: 'Forte' },
];

let editor = null;
let registroPagina = null;
let tempoSalvar = null;
let prefs = lerPrefs();

function lerPrefs() {
  const padrao = { ferramenta: 'caneta', tinta: 'tinta', tintaMarca: 'amarelo', tamanho: 4, tamanhoMarca: 24, raioBorracha: 16, suavizacao: 'leve', dedo: false, diagnostico: false };
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

function botao(grupo, valor, rotulo, ativo, extra = '') {
  return `<button type="button" class="ferramenta-botao" data-caneta="${grupo}" data-valor="${esc(valor)}" aria-pressed="${ativo}" ${extra}>${rotulo}</button>`;
}

function barraDeFerramentas() {
  const f = prefs.ferramenta;
  const ferramentas = [
    ['caneta', 'Caneta'],
    ['marca-texto', 'Marca-texto'],
    ['borracha', 'Borracha'],
  ].map(([id, rotulo]) => botao('ferramenta', id, rotulo, f === id)).join('');

  const listaCores = f === 'marca-texto' ? MARCAS : TINTAS;
  const corAtual = f === 'marca-texto' ? prefs.tintaMarca : prefs.tinta;
  const cores = f === 'borracha' ? '' : `
    <div class="ferramenta-grupo" role="group" aria-label="Cor">
      ${listaCores.map((c) => `
        <button type="button" class="ferramenta-cor" data-caneta="cor" data-valor="${c.id}" aria-pressed="${corAtual === c.id}"
          aria-label="${c.rotulo}" title="${c.rotulo}" style="--cor: var(--tinta-${c.id})"></button>`).join('')}
    </div>`;

  const espAtual = f === 'marca-texto' ? prefs.tamanhoMarca : f === 'borracha' ? prefs.raioBorracha : prefs.tamanho;
  const espessuras = ESPESSURAS[f].map((e) => botao('espessura', e.id, e.rotulo, Number(espAtual) === e.id)).join('');

  return `
    <div class="ferramentas" role="toolbar" aria-label="Ferramentas da caneta">
      <div class="ferramenta-grupo" role="group" aria-label="Ferramenta">${ferramentas}</div>
      ${cores}
      <div class="ferramenta-grupo" role="group" aria-label="Espessura">${espessuras}</div>
      <label class="ferramenta-select">
        <span>Estabilizador</span>
        <select data-caneta="suavizacao">
          ${SUAVES.map((s) => `<option value="${s.id}" ${prefs.suavizacao === s.id ? 'selected' : ''}>${s.rotulo}</option>`).join('')}
        </select>
      </label>
      <div class="ferramenta-grupo" role="group" aria-label="Ações">
        ${botao('dedo', 'alternar', 'Desenhar com o dedo', prefs.dedo)}
        <button type="button" class="ferramenta-botao" data-caneta="desfazer" aria-label="Desfazer" title="Desfazer">↶</button>
        <button type="button" class="ferramenta-botao" data-caneta="refazer" aria-label="Refazer" title="Refazer">↷</button>
        <button type="button" class="ferramenta-botao" data-caneta="limpar">Limpar</button>
        ${botao('diagnostico', 'alternar', 'Diagnóstico', prefs.diagnostico)}
      </div>
    </div>`;
}

export function renderCaneta() {
  return `
    <div class="caneta">
      <header class="caneta-topo">
        <a class="botao botao-secundario botao-pequeno" href="#cadernos">← Cadernos</a>
        <h1 tabindex="-1">Testar a caneta</h1>
        <span class="caneta-salvo" id="caneta-salvo" aria-live="polite"></span>
      </header>
      <div id="caneta-barra">${barraDeFerramentas()}</div>
      <p class="caneta-dica" id="caneta-dica">Escreva com a S Pen; o dedo rola a página e a palma não risca. O botão da caneta vira borracha enquanto estiver apertado.</p>
      <div class="caneta-area" id="caneta-area"></div>
      <section class="caneta-diagnostico" id="caneta-diagnostico" ${prefs.diagnostico ? '' : 'hidden'} aria-label="Diagnóstico da caneta">
        <dl id="caneta-diag-lista"></dl>
        <button type="button" class="botao botao-secundario botao-pequeno" data-caneta="copiar-diagnostico">Copiar diagnóstico</button>
      </section>
    </div>`;
}

function aplicarPrefs() {
  if (!editor) return;
  editor.ferramenta = prefs.ferramenta;
  editor.tinta = prefs.tinta;
  editor.tintaMarca = prefs.tintaMarca;
  editor.tamanho = Number(prefs.tamanho);
  editor.tamanhoMarca = Number(prefs.tamanhoMarca);
  editor.raioBorracha = Number(prefs.raioBorracha);
  editor.suavizacao = prefs.suavizacao;
  editor.dedoDesenha = prefs.dedo;
}

function atualizarBarra() {
  document.getElementById('caneta-barra').innerHTML = barraDeFerramentas();
  atualizarBotoesHistorico();
}

function atualizarBotoesHistorico() {
  const desfazer = document.querySelector('[data-caneta="desfazer"]');
  const refazer = document.querySelector('[data-caneta="refazer"]');
  if (desfazer) desfazer.disabled = !editor?.podeDesfazer();
  if (refazer) refazer.disabled = !editor?.podeRefazer();
}

function mostrarSalvo(texto) {
  const el = document.getElementById('caneta-salvo');
  if (el) el.textContent = texto;
}

async function obterPaginaDeRascunho() {
  const cadernos = await listar('cadernos');
  let caderno = cadernos.find((c) => (c.tags || []).includes(MARCA_RASCUNHO));
  if (!caderno) {
    caderno = await salvar('cadernos', { titulo: 'Rascunho da caneta', tipo: 'comum', tags: [MARCA_RASCUNHO], capa: { cor: 5 } });
  }
  const paginas = (await listar('paginas')).filter((p) => p.caderno_id === caderno.id).sort((a, b) => a.ordem - b.ordem);
  return paginas[0] || { caderno_id: caderno.id, ordem: 0, modelo_folha: 'pautada-media', tracos_json: novaPaginaVazia() };
}

function agendarSalvamento(pagina) {
  mostrarSalvo('Salvando…');
  atualizarBotoesHistorico();
  clearTimeout(tempoSalvar);
  tempoSalvar = setTimeout(async () => {
    registroPagina = await salvar('paginas', { ...registroPagina, tracos_json: pagina });
    mostrarSalvo('Salvo');
  }, 800);
}

function mostrarDiagnostico(d) {
  const lista = document.getElementById('caneta-diag-lista');
  if (!lista || document.getElementById('caneta-diagnostico').hidden) return;
  const u = d.ultimo || {};
  const linhas = [
    ['Último toque', u.tipo === 'pen' ? 'caneta' : u.tipo === 'touch' ? 'dedo/palma' : u.tipo || '—'],
    ['Caneta detectada', d.canetaVista ? 'sim' : 'ainda não'],
    ['Pressão', u.pressao != null ? u.pressao.toFixed(2) : '—'],
    ['Inclinação (X / Y)', u.inclinacaoX != null ? `${u.inclinacaoX}° / ${u.inclinacaoY}°` : '—'],
    ['Botões (32 = botão da S Pen)', u.botoes ?? '—'],
    ['Eventos por segundo', d.eventosPorSegundo],
    ['Pontos por evento', d.agrupados],
    ['Atraso da entrada', `${d.atrasoEntrada.toFixed(1)} ms`],
    ['Atraso até a tela', `${d.atrasoQuadro.toFixed(1)} ms`],
    ['Traços na página', d.tracos],
  ];
  lista.innerHTML = linhas.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(String(v))}</dd></div>`).join('');
  lista.dataset.texto = linhas.map(([k, v]) => `${k}: ${v}`).join('\n');
}

// Chamado pelo main.js depois que a tela entra no documento.
export async function montarCaneta() {
  document.body.classList.add('modo-editor');
  const area = document.getElementById('caneta-area');
  editor = new EditorDeTinta(area, { aoMudar: agendarSalvamento, aoDiagnostico: mostrarDiagnostico });
  aplicarPrefs();
  registroPagina = await obterPaginaDeRascunho();
  editor.carregar(registroPagina.tracos_json);
  atualizarBotoesHistorico();
  mostrarSalvo(registroPagina.id ? 'Salvo' : '');
  document.addEventListener('click', aoClicar);
  document.addEventListener('change', aoMudarSelect);
  document.addEventListener('keydown', aoTeclar);
}

export function desmontarCaneta() {
  document.body.classList.remove('modo-editor');
  document.removeEventListener('click', aoClicar);
  document.removeEventListener('change', aoMudarSelect);
  document.removeEventListener('keydown', aoTeclar);
  if (tempoSalvar && editor) {
    // salva na hora o que estava esperando
    clearTimeout(tempoSalvar);
    salvar('paginas', { ...registroPagina, tracos_json: editor.pagina });
  }
  tempoSalvar = null;
  editor?.destruir();
  editor = null;
}

function aoClicar(evento) {
  const alvo = evento.target.closest('[data-caneta]');
  if (!alvo || !editor) return;
  const { caneta: acao, valor } = alvo.dataset;

  switch (acao) {
    case 'ferramenta':
      prefs.ferramenta = valor;
      break;
    case 'cor':
      if (prefs.ferramenta === 'marca-texto') prefs.tintaMarca = valor;
      else prefs.tinta = valor;
      break;
    case 'espessura':
      if (prefs.ferramenta === 'marca-texto') prefs.tamanhoMarca = Number(valor);
      else if (prefs.ferramenta === 'borracha') prefs.raioBorracha = Number(valor);
      else prefs.tamanho = Number(valor);
      break;
    case 'dedo':
      prefs.dedo = !prefs.dedo;
      document.getElementById('caneta-dica').textContent = prefs.dedo
        ? 'O dedo também risca agora (e não rola a página). Desligue para a palma da mão não marcar a página.'
        : 'Escreva com a S Pen; o dedo rola a página e a palma não risca. O botão da caneta vira borracha enquanto estiver apertado.';
      break;
    case 'desfazer':
      editor.voltar();
      atualizarBotoesHistorico();
      return;
    case 'refazer':
      editor.avancar();
      atualizarBotoesHistorico();
      return;
    case 'limpar':
      if (window.confirm('Limpar a página inteira? Dá para desfazer depois.')) editor.limpar();
      atualizarBotoesHistorico();
      return;
    case 'diagnostico':
      prefs.diagnostico = !prefs.diagnostico;
      document.getElementById('caneta-diagnostico').hidden = !prefs.diagnostico;
      break;
    case 'copiar-diagnostico': {
      const texto = `Diagnóstico da caneta — ${navigator.userAgent}\n${document.getElementById('caneta-diag-lista').dataset.texto || ''}`;
      navigator.clipboard?.writeText(texto).then(() => {
        alvo.textContent = 'Copiado!';
      }).catch(() => {});
      return;
    }
    default:
      return;
  }
  guardarPrefs();
  aplicarPrefs();
  atualizarBarra();
}

function aoMudarSelect(evento) {
  if (evento.target.matches('[data-caneta="suavizacao"]')) {
    prefs.suavizacao = evento.target.value;
    guardarPrefs();
    aplicarPrefs();
  }
}

function aoTeclar(evento) {
  if (!editor || !(evento.ctrlKey || evento.metaKey) || evento.key.toLowerCase() !== 'z') return;
  evento.preventDefault();
  if (evento.shiftKey) editor.avancar();
  else editor.voltar();
  atualizarBotoesHistorico();
}
