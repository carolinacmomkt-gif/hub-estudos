// Ações do "Colar demandas": organizar o texto (IA ou do jeito simples), distribuir nos dias,
// ajustar e criar as tarefas (e os eventos do Calendário marcados), com Desfazer.

import { obterEstado } from './estado.js';
import { salvar } from './persistencia.js';
import { chamar } from './funcoes.js';
import { pararDitado } from './ditado.js';
import { dataLocal } from './views-dia.js';
import { montarEntradaSemana } from './views-organizar.js';
import { separarSimples, distribuir, conferirDemandas, somaHora } from './dados-colar.js';
import { instanteLocal } from './dados-calendario.js';
import { formColarTexto, previaColar } from './views-colar.js';

let app; // { renderizar, avisoCurto }
let rascunho = { texto: '', itens: null, fonte: 'ia', aviso: '', ocupado: false };

export function ligarColar(funcoes) {
  app = funcoes;
}

const folha = () => document.getElementById('folha-evento');
const conteudo = () => document.getElementById('folha-evento-conteudo');
const aberta = () => folha()?.open && folha().dataset.conteudo === 'colar';

function desenhar() {
  if (!aberta()) return;
  conteudo().innerHTML = rascunho.itens ? previaColar(rascunho.itens, rascunho) : formColarTexto(rascunho.texto, rascunho.ocupado);
  folha().scrollTop = 0;
}

export function abrirColar() {
  const f = folha();
  if (!f) return;
  document.getElementById('folha-criar')?.close();
  if (f.open) f.close();
  document.getElementById('folha-evento-titulo').textContent = 'Colar demandas';
  f.dataset.conteudo = 'colar';
  f.showModal();
  f.addEventListener('close', () => { delete f.dataset.conteudo; pararDitado(); }, { once: true });
  desenhar();
  if (!rascunho.itens) document.getElementById('colar-texto')?.focus();
}

async function organizar(comIa) {
  const texto = document.getElementById('colar-texto')?.value.trim() || '';
  if (!texto) { document.getElementById('colar-texto')?.focus(); app.avisoCurto('Cole o texto com as demandas.'); return; }
  pararDitado();
  const hoje = dataLocal();
  rascunho = { ...rascunho, texto, ocupado: true, aviso: '' };
  let itens = null;
  let fonte = 'simples';
  if (comIa) {
    desenhar();
    const r = await chamar('capturar', { modo: 'demandas', texto: texto.slice(0, 8000), hoje });
    if (r.ok) { itens = conferirDemandas(r.itens); fonte = 'ia'; } else rascunho.aviso = `${r.erro || 'A IA não respondeu.'}`;
  }
  if (!itens) itens = separarSimples(texto, hoje);
  rascunho = { ...rascunho, ocupado: false, fonte, itens: distribuir(itens, montarEntradaSemana(obterEstado())) };
  desenhar();
}

async function criar(form) {
  const el = form.elements;
  const usar = [...form.querySelectorAll('[name="usar"]:checked')].map((c) => Number(c.value));
  if (!usar.length) { app.avisoCurto('Marque pelo menos uma tarefa.'); return; }
  const criados = [];
  let noCalendario = 0;
  for (const i of usar) {
    const x = rascunho.itens[i];
    const titulo = el[`t-${i}`].value.trim().slice(0, 140) || x.titulo;
    const data = el[`d-${i}`].value || null;
    const hora = el[`h-${i}`].value || null;
    const minutos = Number(el[`m-${i}`].value) || x.minutos;
    const tarefa = await salvar('tarefas', {
      titulo, area: el[`a-${i}`].value || 'trabalho', data, hora, prazo: x.prazo || null,
      prioridade: Number(el[`p-${i}`].value) || 0, notas: x.trecho ? `Do texto colado: “${x.trecho}”` : null,
      dados: { origem: 'colar', minutos, ...(x.quem ? { quem: x.quem } : {}) },
    });
    criados.push(['tarefas', tarefa]);
    if (el[`c-${i}`].checked && data) {
      const evento = await salvar('eventos', {
        titulo, tipo: 'pessoal', disciplina_id: null, descricao: x.trecho ? `Do texto colado: “${x.trecho}”` : null,
        dia_inteiro: !hora, inicio: instanteLocal(data, hora || ''), fim: hora ? instanteLocal(data, somaHora(hora, minutos)) : null,
        status: null, origem: 'manual', link: '#tarefas',
      });
      criados.push(['eventos', evento]);
      noCalendario += 1;
      await salvar('tarefas', { ...tarefa, dados: { ...tarefa.dados, evento_id: evento.id } });
    }
  }
  rascunho = { texto: '', itens: null, fonte: 'ia', aviso: '', ocupado: false };
  folha().close();
  app.renderizar();
  const n = usar.length;
  app.avisoCurto(`${n} ${n === 1 ? 'tarefa criada' : 'tarefas criadas'}${noCalendario ? `, ${noCalendario} no calendário` : ''}.`, {
    rotulo: 'Desfazer',
    fn: async () => {
      const agora = new Date().toISOString();
      for (const [tabela, r] of criados) await salvar(tabela, { ...r, excluido_em: agora });
      app.renderizar();
      app.avisoCurto('Desfeito.');
    },
  });
}

export function cliqueColar(alvo) {
  switch (alvo.dataset.acao) {
    case 'colar-abrir': abrirColar(); return true;
    case 'colar-simples': organizar(false); return true;
    case 'colar-voltar':
      rascunho = { ...rascunho, itens: null };
      desenhar();
      return true;
    case 'colar-cal-todas': {
      const caixas = [...document.querySelectorAll('[data-form="colar-salvar"] [name^="c-"]')];
      const marcar = caixas.some((c) => !c.checked);
      caixas.forEach((c) => { c.checked = marcar; });
      alvo.textContent = marcar ? 'Tirar todas do calendário' : 'Pôr todas no calendário';
      return true;
    }
    case 'colar-copiar': {
      const msg = rascunho.itens?.[Number(alvo.dataset.i)]?.semEspaco?.mensagem || '';
      navigator.clipboard?.writeText(msg).then(() => app.avisoCurto('Mensagem copiada.'), () => app.avisoCurto(msg));
      return true;
    }
    default:
      return false;
  }
}

export function enviarColar(form) {
  if (form.dataset.form === 'colar-texto') { organizar(true); return true; }
  if (form.dataset.form === 'colar-salvar') { criar(form); return true; }
  return false;
}
