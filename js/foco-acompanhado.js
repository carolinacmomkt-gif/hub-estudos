// Foco acompanhado (decisão da Carol, 04/11/2026): antes de começar, o que vai fazer e o primeiro
// passo pequeno (a IA quebra a tarefa se ela pedir); no meio, "Como está?" com Seguindo ou Travei
// (o próximo passo menor e uma pausa de 2 min); no fim, "O que ficou pronto?", que vira o próximo
// passo da tarefa. Tudo dá para pular, funciona sem IA e aceita voz.

import { obterEstado } from './estado.js';
import { salvar } from './persistencia.js';
import { esc } from './utilidades.js';
import { chamar } from './funcoes.js';
import { botaoDitado, pararDitado } from './ditado.js';
import { tarefasDeHoje } from './dados-tarefas.js';
import { dataLocal } from './views-dia.js';
import {
  sessaoCrua, mexerNaSessao, respirar, voltarDoRespiro, fimPendente, limparFimPendente, prefsFoco,
} from './foco.js';

let app; // { renderizar, avisoCurto }
const fmtHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

// Sem IA: passos pequenos pelo tipo do que ela vai fazer.
export function passosSimples(titulo = '') {
  const t = titulo.toLowerCase();
  if (/(ler|leitura|revis|estud|cap[ií]tulo|livro|artigo|aula|prova)/.test(t)) return ['Abrir o material no ponto certo', 'Ler 5 minutos sem anotar nada', 'Anotar as 3 ideias principais', 'Escrever uma pergunta para revisar depois'];
  if (/(escrev|texto|legenda|roteiro|copy|carrossel|post|artigo|substack|e-?mail|proposta)/.test(t)) return ['Abrir o documento em branco', 'Escrever uma frase feia de propósito', 'Listar os tópicos em uma linha cada', 'Escrever o primeiro tópico inteiro'];
  if (/(organiz|planej|arrum|limpar|separar|semana)/.test(t)) return ['Listar tudo o que está na cabeça', 'Escolher o que vem primeiro', 'Fazer só esse primeiro item', 'Anotar o que ficou para depois'];
  if (/(grav|v[ií]deo|edit|reel|story)/.test(t)) return ['Separar o roteiro e o material', 'Arrumar a luz e o lugar', 'Gravar só a primeira parte', 'Ver o que precisa refazer'];
  return ['Abrir o que você precisa para começar', 'Fazer só o primeiro pedacinho (5 min)', 'Ver o que falta e anotar o próximo'];
}

const passoAtual = (s) => (s?.passos || []).find((p) => !p.feito) || null;

// ---------------------------------------------------------------------------
// Telas
// ---------------------------------------------------------------------------

// Antes de começar: tarefa (opcional) e os passos pequenos, um por linha.
export function camposDoInicio(estado) {
  const pre = estado.focoPreset || {};
  const doDia = tarefasDeHoje(estado.tarefas || [], dataLocal());
  const tarefas = [...doDia.hoje, ...doDia.atrasadas].slice(0, 30);
  return `
    ${tarefas.length ? `<label class="campo"><span class="campo-rotulo">Ligar a uma tarefa <small>(opcional)</small></span>
      <select name="tarefa"><option value="">Nenhuma</option>${tarefas.map((t) => `<option value="${esc(t.id)}"${t.id === pre.tarefa ? ' selected' : ''}>${esc(t.titulo)}</option>`).join('')}</select>
      <span class="campo-ajuda">No fim, o que ficou pronto e o próximo passo vão para ela.</span></label>` : ''}
    <div class="campo fa-passos-campo">
      <label class="campo-rotulo" for="fa-passos">Primeiro passo pequeno <small>(opcional, um por linha)</small></label>
      <textarea id="fa-passos" name="passos" rows="3" maxlength="900" placeholder="Ex.: Abrir o PDF no capítulo 3">${esc(pre.passos || '')}</textarea>
      <div class="fa-ajudas">
        <button class="botao botao-secundario botao-pequeno" type="button" data-acao="fa-dividir-ia">Quebrar em passos com a IA</button>
        <button class="botao botao-secundario botao-pequeno" type="button" data-acao="fa-dividir-simples">Sugerir sem IA</button>
        ${botaoDitado('#fa-passos')}
      </div>
      <p class="campo-ajuda" data-fa-aviso hidden></p>
    </div>`;
}

// No palco: o passo de agora, a pergunta do meio, o "Travei", a pausa de 2 min e o fechamento.
export function blocoNoPalco(s) {
  const p = prefsFoco();
  const sessao = sessaoCrua();
  if (!sessao) return '';
  const atual = passoAtual(sessao);
  const total = (sessao.passos || []).length;
  const feitos = (sessao.passos || []).filter((x) => x.feito).length;
  const partes = [];

  if (sessao.respiro && s.pausado) {
    partes.push(`
      <div class="fa-card fa-respiro" role="status">
        <div class="respiracao" aria-hidden="true"><span class="respiracao-circulo"></span>
          <span class="respiracao-texto"><span class="inspira">Inspira</span><span class="solta">Solta</span></span></div>
        <p><strong>Pausa de 2 minutos.</strong> O foco volta sozinho às ${esc(fmtHora.format(sessao.respiro))}.</p>
        ${atual ? `<p class="texto-suave">Depois: ${esc(atual.t)}</p>` : ''}
        <button class="botao botao-secundario botao-pequeno" type="button" data-acao="fa-respiro-fim">Voltar agora</button>
      </div>`);
    return partes.join('');
  }

  if (s.fase === 'foco' && atual) {
    partes.push(`
      <div class="fa-passo">
        <span class="fa-passo-rotulo">Agora${total > 1 ? ` · ${feitos + 1} de ${total}` : ''}</span>
        <span class="fa-passo-texto">${esc(atual.t)}</span>
        <button class="botao botao-secundario botao-pequeno" type="button" data-acao="fa-passo-feito" aria-label="Feito: ${esc(atual.t)}">✓ Feito</button>
      </div>`);
  } else if (s.fase === 'foco' && total) {
    partes.push('<p class="fa-passo fa-passo-fim">Todos os passos feitos. Siga no embalo.</p>');
  }

  const checkin = sessao.checkin?.[sessao.ciclo];
  if (p.acompanhar && s.fase === 'foco' && s.meio && !checkin) {
    partes.push(`
      <div class="fa-card" role="group" aria-label="Como está?">
        <p class="fa-card-titulo">Como está?</p>
        <div class="fa-botoes">
          <button class="botao botao-primario" type="button" data-acao="fa-seguindo">Seguindo</button>
          <button class="botao botao-secundario" type="button" data-acao="fa-travei">Travei</button>
        </div>
      </div>`);
  }
  if (s.fase === 'foco' && checkin === 'travei') {
    partes.push(`
      <form class="fa-card formulario" data-form="fa-destravar" novalidate>
        <p class="fa-card-titulo">Tudo bem. Vamos menor.</p>
        <label class="campo"><span class="campo-rotulo">Próximo passo pequeno (5 minutos)</span>
          <input id="fa-passo" name="passo" type="text" maxlength="100" value="${esc(atual?.t || '')}" placeholder="Ex.: Escrever só o título"></label>
        <p class="campo-ajuda" data-fa-dica hidden></p>
        <div class="fa-botoes">
          <button class="botao botao-secundario botao-pequeno" type="button" data-acao="fa-destravar-ia">Pedir um passo à IA</button>
          ${botaoDitado('#fa-passo')}
        </div>
        <div class="fa-botoes">
          <button class="botao botao-primario" type="submit" name="como" value="respirar">Pausa de 2 min e volto</button>
          <button class="botao botao-secundario" type="submit" name="como" value="voltar">Voltar ao foco</button>
        </div>
      </form>`);
  }

  if (sessao.fim && s.fase !== 'foco') partes.push(formFim(sessao, 'sessao'));
  return partes.join('');
}

function formFim(origem, de) {
  const proximo = passoAtual(origem)?.t || '';
  const tarefa = origem.tarefa_id ? (obterEstado().tarefas || []).find((t) => t.id === origem.tarefa_id) : null;
  return `
    <form class="fa-card fa-fim formulario" data-form="fa-fim" data-de="${de}" novalidate>
      <p class="fa-card-titulo">O que ficou pronto?</p>
      <label class="campo"><span class="visualmente-oculto">O que ficou pronto</span>
        <textarea id="fa-feito" name="feito" rows="2" maxlength="400" placeholder="Ex.: Li o capítulo 3 e anotei as ideias"></textarea></label>
      <label class="campo"><span class="campo-rotulo">Próximo passo</span>
        <input id="fa-proximo" name="proximo" type="text" maxlength="100" value="${esc(proximo)}" placeholder="Ex.: Fazer os exercícios 1 a 5"></label>
      <div class="fa-botoes">${botaoDitado('#fa-feito')}</div>
      ${tarefa ? `<p class="campo-ajuda">Vai para a tarefa "${esc(tarefa.titulo)}".</p>`
        : '<label class="campo-marcar"><input type="checkbox" name="criar" checked><span>Criar uma tarefa para hoje com o próximo passo</span></label>'}
      <div class="fa-botoes">
        <button class="botao botao-primario" type="submit">Guardar</button>
        <button class="botao botao-secundario" type="button" data-acao="fa-fim-pular" data-de="${de}">Pular</button>
      </div>
    </form>`;
}

// Sessão encerrada: o fechamento aparece em cima do formulário de começar.
export function cardFimPendente() {
  const f = fimPendente();
  if (!f || Date.now() - (f.em || 0) > 12 * 3600e3) return '';
  return `<section class="card fa-fim-card"><p class="texto-suave">Foco em: ${esc(f.titulo || 'Estudo')}</p>${formFim(f, 'local')}</section>`;
}

// ---------------------------------------------------------------------------
// Ações
// ---------------------------------------------------------------------------

function avisoNoForm(form, texto) {
  const el = form?.querySelector('[data-fa-aviso], [data-fa-dica]');
  if (!el) { app?.avisoCurto(texto); return; }
  el.textContent = texto;
  el.hidden = !texto;
}

function preencher(campo, valor) {
  if (!campo) return;
  campo.value = valor;
  campo.dispatchEvent(new Event('input', { bubbles: true }));
}

async function dividir(alvo, comIa) {
  const form = alvo.closest('form');
  const tarefa = form?.elements.tarefa;
  const titulo = form?.elements.titulo?.value.trim() || (tarefa?.value ? tarefa.selectedOptions[0].textContent.trim() : '');
  if (!titulo) { avisoNoForm(form, 'Escreva antes o que você vai fazer.'); form?.elements.titulo?.focus(); return; }
  if (!comIa) { preencher(form.elements.passos, passosSimples(titulo).join('\n')); avisoNoForm(form, ''); return; }
  alvo.disabled = true;
  const texto = alvo.textContent;
  alvo.textContent = 'Pensando…';
  const minutos = Number(form.querySelector('[name="minutos"]:checked')?.value) || prefsFoco().foco;
  const r = await chamar('foco-ia', { acao: 'dividir', titulo, minutos });
  alvo.disabled = false;
  alvo.textContent = texto;
  if (r.ok && r.passos?.length) { preencher(form.elements.passos, r.passos.join('\n')); avisoNoForm(form, ''); } else {
    preencher(form.elements.passos, passosSimples(titulo).join('\n'));
    avisoNoForm(form, `${r.erro || 'A IA não respondeu.'} Coloquei uma sugestão simples no lugar.`);
  }
}

// Coloca um passo novo como o de agora (se for diferente do que já está).
function porComoAtual(s, texto) {
  const t = String(texto || '').trim().slice(0, 100);
  if (!t) return;
  s.passos = s.passos || [];
  const atual = s.passos.find((p) => !p.feito);
  if (atual?.t === t) return;
  const i = atual ? s.passos.indexOf(atual) : s.passos.length;
  s.passos.splice(i, 0, { t, feito: false });
}

async function guardarFim(form) {
  pararDitado();
  const de = form.dataset.de;
  const origem = de === 'local' ? fimPendente() : sessaoCrua();
  if (!origem) return;
  const feito = form.elements.feito.value.trim().slice(0, 400);
  const proximo = form.elements.proximo.value.trim().slice(0, 100);
  const tarefa = origem.tarefa_id ? (obterEstado().tarefas || []).find((t) => t.id === origem.tarefa_id && !t.excluido_em) : null;
  try {
    if (tarefa && (feito || proximo)) {
      const dia = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date());
      const notas = feito ? [tarefa.notas, `✓ ${dia}: ${feito}`].filter(Boolean).join('\n').slice(-4000) : tarefa.notas;
      await salvar('tarefas', { ...tarefa, notas, dados: { ...(tarefa.dados || {}), proximo_passo: proximo || null } });
    } else if (!tarefa && proximo && form.elements.criar?.checked) {
      await salvar('tarefas', { titulo: proximo, area: 'pessoal', data: dataLocal(), notas: feito ? `Do foco "${origem.titulo}": ${feito}` : null, dados: { origem: 'foco' } });
    }
  } catch (erro) {
    console.warn('Fechamento do foco não salvo:', erro);
  }
  if (de === 'local') {
    limparFimPendente();
    app?.renderizar();
  } else {
    mexerNaSessao((s) => {
      delete s.fim;
      if (feito) s.feitos = [...(s.feitos || []), feito].slice(-8);
      porComoAtual(s, proximo);
    });
  }
  app?.avisoCurto(tarefa ? 'Guardado na tarefa.' : proximo && form.elements.criar?.checked ? 'Próximo passo virou tarefa de hoje.' : 'Guardado.');
}

export function cliqueAcompanhado(alvo) {
  switch (alvo.dataset.acao) {
    case 'fa-dividir-ia': dividir(alvo, true); return true;
    case 'fa-dividir-simples': dividir(alvo, false); return true;
    case 'fa-passo-feito':
      mexerNaSessao((s) => { const a = passoAtual(s); if (a) a.feito = true; });
      return true;
    case 'fa-seguindo':
      mexerNaSessao((s) => { s.checkin = { ...(s.checkin || {}), [s.ciclo]: 'seguindo' }; });
      app?.avisoCurto('Boa. Segue no seu ritmo.');
      return true;
    case 'fa-travei':
      mexerNaSessao((s) => { s.checkin = { ...(s.checkin || {}), [s.ciclo]: 'travei' }; });
      return true;
    case 'fa-destravar-ia': {
      const form = alvo.closest('form');
      const s = sessaoCrua();
      if (!s) return true;
      alvo.disabled = true;
      chamar('foco-ia', { acao: 'destravar', titulo: s.titulo, passo: form.elements.passo.value, feitos: [...(s.feitos || []), ...(s.passos || []).filter((p) => p.feito).map((p) => p.t)] })
        .then((r) => {
          alvo.disabled = false;
          if (r.ok && r.passo) { preencher(form.elements.passo, r.passo); avisoNoForm(form, r.dica || ''); } else avisoNoForm(form, `${r.erro || 'A IA não respondeu.'} Tente escrever o menor pedaço possível.`);
        });
      return true;
    }
    case 'fa-respiro-fim': voltarDoRespiro(); return true;
    case 'fa-fim-pular':
      pararDitado();
      if (alvo.dataset.de === 'local') { limparFimPendente(); app?.renderizar(); } else mexerNaSessao((s) => { delete s.fim; });
      return true;
    default:
      return false;
  }
}

export function enviarAcompanhado(form) {
  if (form.dataset.form === 'fa-fim') { guardarFim(form); return true; }
  if (form.dataset.form === 'fa-destravar') {
    pararDitado();
    const passo = form.elements.passo.value;
    const como = form.dataset.enviadoPor || 'voltar';
    mexerNaSessao((s) => { porComoAtual(s, passo); s.checkin = { ...(s.checkin || {}), [s.ciclo]: 'ok' }; });
    if (como === 'respirar') respirar(2);
    return true;
  }
  return false;
}

export function ligarAcompanhado(funcoes) {
  app = funcoes;
}
