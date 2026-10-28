// Captura por voz no "+": o microfone do navegador (quando existe), "Organizar" com a IA
// (sem internet, o jeito simples), a prévia para conferir e o "Salvar" com Desfazer.

import { obterEstado } from './estado.js';
import { salvar } from './persistencia.js';
import { chamar } from './funcoes.js';
import { CATEGORIAS_PADRAO } from './dados-financas.js';
import { capturaSimples, registroDoItem, resumoDaCaptura, DESTINOS_CAPTURA } from './dados-captura.js';
import { previaCaptura } from './views-captura.js';
import { dataLocal } from './views-dia.js';

let app; // { renderizar, avisoCurto }
let itens = [];
let ouvindo = null;

export function ligarCaptura(funcoes) {
  app = funcoes;
  // Fechou o "+": o microfone para de ouvir.
  document.getElementById('folha-criar')?.addEventListener('close', () => { pararDeOuvir(); modoPrevia(false); });
}

const categorias = () => (obterEstado().config || []).find((c) => c.chave === 'financas' && !c.excluido_em)?.valor?.categorias || CATEGORIAS_PADRAO;
const campo = () => document.getElementById('captura-texto');
const previa = () => document.getElementById('captura-previa');

// Na prévia, só os itens ficam à vista (os atalhos de "Criar" voltam depois).
function modoPrevia(ligado) {
  document.getElementById('folha-criar-conteudo')?.classList.toggle('captura-ativa', ligado);
}

function pararDeOuvir() {
  if (ouvindo) ouvindo.stop();
}

function falar(botao) {
  const Reconhecer = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Reconhecer) return;
  if (ouvindo) {
    ouvindo.stop();
    return;
  }
  const rec = new Reconhecer();
  rec.lang = 'pt-BR';
  rec.interimResults = true;
  rec.continuous = true;
  const antes = campo().value.trim();
  let final = '';
  rec.onresult = (e) => {
    let agora = '';
    for (let i = e.resultIndex; i < e.results.length; i += 1) {
      if (e.results[i].isFinal) final += `${e.results[i][0].transcript} `;
      else agora += e.results[i][0].transcript;
    }
    const c = campo();
    if (c) c.value = [antes, `${final}${agora}`.trim()].filter(Boolean).join(' ');
  };
  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') app.avisoCurto('Libere o microfone para a Bússola nas configurações do aparelho, ou use o microfone do teclado.');
    else if (e.error === 'network') app.avisoCurto('O ditado precisa de internet. Use o microfone do teclado.');
  };
  rec.onend = () => {
    ouvindo = null;
    botao.setAttribute('aria-pressed', 'false');
    botao.textContent = '🎙️ Falar';
    botao.classList.remove('ouvindo');
  };
  try {
    rec.start();
  } catch {
    return;
  }
  ouvindo = rec;
  botao.setAttribute('aria-pressed', 'true');
  botao.textContent = '■ Parar';
  botao.classList.add('ouvindo');
}

async function organizar(form) {
  pararDeOuvir();
  const texto = form.elements.texto.value.trim();
  if (!texto) {
    form.elements.texto.focus();
    return;
  }
  const botao = form.querySelector('[type="submit"]');
  if (botao?.disabled) return; // já está organizando (toque duplo)
  if (botao) botao.disabled = true;
  const hoje = dataLocal();
  let simples = false;
  if (navigator.onLine) {
    previa().innerHTML = '<p class="dia-pensando" role="status"><span class="dia-pensando-ponto" aria-hidden="true"></span>Organizando…</p>';
    const r = await chamar('capturar', { texto, hoje, categorias: categorias().map((c) => ({ id: c.id, nome: c.nome })) });
    if (r.ok) itens = r.itens;
    else { itens = capturaSimples(texto, hoje, { categorias: categorias() }); simples = true; }
  } else {
    itens = capturaSimples(texto, hoje, { categorias: categorias() });
    simples = true;
  }
  if (botao) botao.disabled = false;
  previa().innerHTML = previaCaptura(itens, { simples });
  form.hidden = true;
  modoPrevia(true);
  previa().querySelector('select')?.focus({ preventScroll: true });
}

// Lê da prévia o que a Carol mudou (destino e título) antes de salvar.
function lerPrevia(form) {
  const ids = DESTINOS_CAPTURA.map((d) => d.id);
  return itens.map((x, i) => {
    const destino = form.elements[`destino-${i}`]?.value;
    const titulo = String(form.elements[`titulo-${i}`]?.value || '').trim();
    return { ...x, destino: ids.includes(destino) ? destino : x.destino, titulo: titulo || x.titulo };
  });
}

async function salvarTudo(form) {
  const lista = lerPrevia(form);
  if (!lista.length) return;
  const hoje = dataLocal();
  const criados = [];
  for (const x of lista) {
    const { tabela, dados } = registroDoItem(x, hoje);
    criados.push({ tabela, registro: await salvar(tabela, dados) });
  }
  itens = [];
  document.getElementById('folha-criar')?.close();
  app.avisoCurto(`Salvo: ${resumoDaCaptura(lista)}.`, {
    rotulo: 'Desfazer',
    fn: async () => {
      for (const c of criados) await salvar(c.tabela, { ...c.registro, excluido_em: new Date().toISOString() });
    },
  });
}

export function cliqueCaptura(alvo) {
  const { acao } = alvo.dataset;
  if (!acao?.startsWith('captura-')) return false;
  if (acao === 'captura-falar') falar(alvo);
  else if (acao === 'captura-caixa') {
    const texto = campo()?.value.trim();
    if (!texto) campo()?.focus();
    else {
      pararDeOuvir();
      salvar('caixa_entrada', { texto }).then(() => {
        document.getElementById('folha-criar')?.close();
        app.avisoCurto('Guardado na caixa de entrada.');
      });
    }
  } else if (acao === 'captura-tirar') {
    const form = alvo.closest('form');
    itens = lerPrevia(form).filter((_, i) => i !== Number(alvo.dataset.i));
    previa().innerHTML = previaCaptura(itens);
  } else if (acao === 'captura-voltar') {
    itens = [];
    previa().innerHTML = '';
    modoPrevia(false);
    const form = document.querySelector('[data-form="captura"]');
    if (form) { form.hidden = false; form.elements.texto.focus(); }
  }
  return true;
}

export function enviarCaptura(form) {
  if (form.dataset.form === 'captura') {
    organizar(form);
    return true;
  }
  if (form.dataset.form === 'captura-salvar') {
    salvarTudo(form);
    return true;
  }
  return false;
}
