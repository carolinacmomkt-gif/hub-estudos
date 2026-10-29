// Lista de cadernos: criar (todos os tipos), editar capa e ligações, favoritos, pastas,
// busca e lixeira. O editor (#cadernos/<id>) tem os próprios eventos em editor-caderno.js.

import { obterEstado, atualizarEstado } from './estado.js';
import { salvar, listar, apagarDeVez } from './persistencia.js';
import { enviarArquivo, apagarArquivo, idDaUsuaria } from './nuvem.js';
import { gravar } from './gravacao.js';
import { renderFormCaderno, renderFormEditarCaderno, renderFormPasta } from './views-cadernos.js';
import { dimensoes } from './folhas.js';
import { novaPaginaVazia } from './editor-tinta.js';
import { lerTags, artigoPeloId } from './dados-biblioteca.js';
import { abrirPdf, paginaDoPdf, arquivoGuardado, guardarNoAparelho, apagarDoAparelho } from './fundos.js';
import { pastaEDescendentes, segundaDaSemana, primeiroDoMes, somarPeriodo, TIPOS_CADERNO, cadernosAtivos } from './dados-cadernos.js';
import { confirmar } from './confirmar.js';

let app; // { renderizar, avisoCurto }
const MAX_PAGINAS_PDF = 200;

export function ligarCadernos(funcoes) {
  app = funcoes;
}

function abrirFolha(titulo, html) {
  document.getElementById('folha-criar')?.close();
  document.getElementById('folha-evento-titulo').textContent = titulo;
  document.getElementById('folha-evento-conteudo').innerHTML = html;
  document.getElementById('folha-evento').showModal();
  document.querySelector('#folha-evento-conteudo [name="titulo"], #folha-evento-conteudo [name="nome"]')?.focus();
}

const fecharFolha = () => document.getElementById('folha-evento').close();

function mostrarErro(form, texto) {
  const erro = form.querySelector('[data-erro]');
  if (!erro) return;
  erro.textContent = texto;
  erro.hidden = !texto;
}

const cadernoPeloId = (id) => (obterEstado().cadernos || []).find((c) => c.id === id);

async function abrirLixeira() {
  const excluidos = (await listar('cadernos', { incluirExcluidos: true })).filter((c) => c.excluido_em)
    .sort((a, b) => String(b.excluido_em).localeCompare(String(a.excluido_em)));
  atualizarEstado({ cadLixeira: excluidos });
  app.renderizar();
}

// ---------------------------------------------------------------------------
// Criar
// ---------------------------------------------------------------------------

function camposComuns(form) {
  const c = form.elements;
  return {
    titulo: c.titulo.value.trim().slice(0, 80),
    disciplina_id: c.disciplina?.value || null,
    area_id: c.area?.value || null,
    pasta_id: c.pasta?.value || null,
    tags: lerTags(c.tags?.value || ''),
    capa: { cor: Number(c.capa?.value) || 1, estilo: form.querySelector('[name="estilo"]:checked')?.value || 'lisa' },
  };
}

async function novaPagina(caderno, ordem, { modelo, dim, secao = null, fundo = null, pdf = null }) {
  const tracos = novaPaginaVazia(modelo);
  if (fundo) tracos.fundo = fundo;
  return salvar('paginas', {
    caderno_id: caderno.id, ordem, modelo_folha: modelo, tracos_json: tracos, largura: dim.largura, altura: dim.altura,
    secao_id: secao, pdf_path: pdf?.caminho || null, pdf_pagina: pdf?.n || null,
  });
}

async function blobDoPdf(form) {
  const arquivo = form.elements.pdf?.files?.[0];
  if (arquivo) {
    if (!/pdf$/i.test(arquivo.type || arquivo.name)) throw new Error('O arquivo precisa ser PDF.');
    return arquivo;
  }
  const artigo = form.elements.artigo?.value && artigoPeloId(obterEstado(), form.elements.artigo.value);
  if (artigo?.pdf_path) return arquivoGuardado(artigo.pdf_path);
  throw new Error('Escolha o PDF (do aparelho ou da Biblioteca).');
}

// Cada página do PDF vira uma imagem no Storage (e no aparelho) e uma página do caderno.
async function criarPaginasDoPdf(caderno, blob, aoAndar) {
  const usuaria = idDaUsuaria();
  if (!usuaria) throw new Error('Entre no app para importar PDFs.');
  if (!navigator.onLine) throw new Error('Sem internet agora. As páginas do PDF precisam subir para a nuvem.');
  const doc = await abrirPdf(blob);
  const total = Math.min(doc.numPages, MAX_PAGINAS_PDF);
  try {
    for (let n = 1; n <= total; n += 1) {
      aoAndar(n, total);
      const { blob: imagem, largura, altura } = await paginaDoPdf(doc, n);
      const caminho = `${usuaria}/cadernos/${caderno.id}/p${String(n).padStart(3, '0')}.jpg`;
      await enviarArquivo(caminho, imagem);
      await guardarNoAparelho(caminho, imagem);
      const dim = { largura: 1000, altura: Math.round((1000 * altura) / largura) };
      await novaPagina(caderno, n - 1, { modelo: 'pdf', dim, pdf: { caminho, n } });
    }
  } finally {
    doc.destroy();
  }
  return { total, cortou: doc.numPages > total };
}

async function criar(form) {
  const el = form.elements;
  const tipo = TIPOS_CADERNO.some((t) => t.id === el.tipo.value) ? el.tipo.value : 'comum';
  const comuns = camposComuns(form);
  if (!comuns.titulo) {
    mostrarErro(form, 'Dê um título ao caderno.');
    el.titulo.focus();
    return;
  }
  const botao = form.querySelector('[type="submit"]');
  botao.disabled = true;
  mostrarErro(form, '');
  let caderno = null;
  try {
    const pdfBlob = tipo === 'pdf' ? await blobDoPdf(form) : null;
    const tamanho = el.tamanho?.value || 'A4';
    const orientacao = el.orientacao?.value || 'retrato';
    caderno = await gravar('cadernos', 'cadernos', { ...comuns, tipo, tamanho, orientacao, favorito: false, ordem: 0 });
    const dim = dimensoes(tamanho, orientacao);
    const modelo = el.modelo?.value || 'pautada-media';
    if (tipo === 'materia') {
      const nomes = String(el.secoes?.value || '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 30);
      const lista = nomes.length ? nomes : ['Matéria 1'];
      for (let i = 0; i < lista.length; i += 1) {
        const secao = await salvar('secoes', { caderno_id: caderno.id, titulo: lista[i].slice(0, 60), ordem: i, cor: String((i % 6) + 1) });
        await novaPagina(caderno, i, { modelo, dim, secao: secao.id });
      }
    } else if (tipo === 'planner') {
      const periodo = el.periodo.value === 'mes' ? 'mes' : 'semana';
      const base = /^\d{4}-\d{2}-\d{2}$/.test(el.inicio.value) ? el.inicio.value : new Date().toISOString().slice(0, 10);
      const inicio = periodo === 'mes' ? primeiroDoMes(base) : segundaDaSemana(base);
      const n = Math.max(1, Math.min(60, Number(el.quantidade.value) || 8));
      for (let i = 0; i < n; i += 1) {
        await novaPagina(caderno, i, { modelo: periodo === 'mes' ? 'planner-mensal' : 'planner-semanal', dim, fundo: { data: somarPeriodo(inicio, periodo, i) } });
      }
    } else if (tipo === 'pdf') {
      const r = await criarPaginasDoPdf(caderno, pdfBlob, (n, total) => { botao.textContent = `Preparando página ${n} de ${total}…`; });
      if (r.cortou) app.avisoCurto(`O PDF tem mais de ${MAX_PAGINAS_PDF} páginas: vieram as ${MAX_PAGINAS_PDF} primeiras.`);
    } else if (tipo === 'infinito') {
      const quadro = dimensoes('A4', 'retrato');
      await novaPagina(caderno, 0, { modelo, dim: quadro });
    } else {
      await novaPagina(caderno, 0, { modelo, dim });
    }
    fecharFolha();
    location.hash = `#cadernos/${caderno.id}`;
  } catch (erro) {
    // O caderno de PDF que não terminou de importar vai para a lixeira (dá para apagar de vez).
    if (caderno) await gravar('cadernos', 'cadernos', { ...caderno, excluido_em: new Date().toISOString() }).catch(() => {});
    mostrarErro(form, erro.message || 'Não deu certo agora.');
    botao.disabled = false;
    botao.textContent = 'Criar e abrir';
  }
}

// ---------------------------------------------------------------------------
// Editar, favoritos, lixeira
// ---------------------------------------------------------------------------

async function salvarEdicao(form) {
  const c = cadernoPeloId(form.dataset.id);
  if (!c) return;
  const comuns = camposComuns(form);
  if (!comuns.titulo) {
    form.elements.titulo.focus();
    return;
  }
  await gravar('cadernos', 'cadernos', { ...c, ...comuns, pasta_id: form.elements.pasta ? comuns.pasta_id : c.pasta_id });
  fecharFolha();
  app.renderizar();
  app.avisoCurto('Caderno atualizado.');
}

async function apagarCaderno(id) {
  const todos = await listar('cadernos', { incluirExcluidos: true });
  const c = todos.find((x) => x.id === id);
  if (!c) return;
  const paginas = (await listar('paginas', { incluirExcluidos: true })).filter((p) => p.caderno_id === id);
  const secoes = (await listar('secoes', { incluirExcluidos: true })).filter((s) => s.caderno_id === id);
  for (const p of paginas) {
    if (p.pdf_path) {
      await apagarArquivo(p.pdf_path).catch(() => {});
      await apagarDoAparelho(p.pdf_path);
    }
  }
  await apagarDeVez('paginas', paginas.map((p) => p.id));
  await apagarDeVez('secoes', secoes.map((s) => s.id));
  await apagarDeVez('cadernos', [id]);
}

// ---------------------------------------------------------------------------
// Pastas
// ---------------------------------------------------------------------------

async function salvarPasta(form) {
  const nome = form.elements.nome.value.trim().slice(0, 80);
  if (!nome) return;
  const atual = form.dataset.id ? (obterEstado().pastas || []).find((p) => p.id === form.dataset.id) : null;
  const salva = await gravar('pastas', 'pastas', atual ? { ...atual, nome } : { nome, pai_id: obterEstado().cadPasta || null, ordem: 0 });
  fecharFolha();
  if (!atual) atualizarEstado({ cadPasta: salva.id });
  app.renderizar();
}

async function excluirPasta(id) {
  const estado = obterEstado();
  const ids = pastaEDescendentes(estado, id);
  const agora = new Date().toISOString();
  for (const c of cadernosAtivos(estado).filter((x) => ids.has(x.pasta_id))) await gravar('cadernos', 'cadernos', { ...c, pasta_id: null });
  for (const p of (estado.pastas || []).filter((x) => ids.has(x.id))) await gravar('pastas', 'pastas', { ...p, excluido_em: agora });
  const pai = (estado.pastas || []).find((p) => p.id === id)?.pai_id || null;
  atualizarEstado({ cadPasta: pai });
  app.renderizar();
  app.avisoCurto('Pasta excluída. Os cadernos dela foram para "Todas as pastas".');
}

// ---------------------------------------------------------------------------

export function cliqueCadernos(alvo) {
  const acao = alvo.dataset.acao;
  if (!acao?.startsWith('caderno-')) return false;
  const id = alvo.dataset.id;
  switch (acao) {
    case 'caderno-novo':
      abrirFolha('Novo caderno', renderFormCaderno(obterEstado(), { area: alvo.dataset.area || '' }));
      break;
    case 'caderno-editar': {
      const c = cadernoPeloId(id);
      if (c) abrirFolha('Editar caderno', renderFormEditarCaderno(obterEstado(), c));
      break;
    }
    case 'caderno-favorito': {
      const c = cadernoPeloId(id);
      if (c) gravar('cadernos', 'cadernos', { ...c, favorito: !c.favorito }).then(() => app.renderizar());
      break;
    }
    case 'caderno-excluir': {
      const c = cadernoPeloId(id);
      if (c) confirmar(`Mandar "${c.titulo}" para a lixeira? Dá para restaurar depois.`).then((ok) => { if (!ok) return;
        gravar('cadernos', 'cadernos', { ...c, excluido_em: new Date().toISOString() }).then(() => {
          fecharFolha();
          app.renderizar();
          app.avisoCurto('Caderno na lixeira.');
        });
      });
      break;
    }
    case 'caderno-visao':
      atualizarEstado({ cadVisao: alvo.dataset.valor, cadLixeira: alvo.dataset.valor === 'lixeira' ? null : obterEstado().cadLixeira });
      app.renderizar();
      if (alvo.dataset.valor === 'lixeira') abrirLixeira();
      break;
    case 'caderno-restaurar':
      listar('cadernos', { incluirExcluidos: true }).then(async (todos) => {
        const c = todos.find((x) => x.id === id);
        if (c) await gravar('cadernos', 'cadernos', { ...c, excluido_em: null });
        app.avisoCurto('Caderno restaurado.');
        abrirLixeira();
      });
      break;
    case 'caderno-apagar':
      confirmar('Apagar de vez? O caderno e todas as páginas somem do aparelho e da nuvem. Não dá para desfazer.', { botao: 'Apagar de vez' }).then((ok) => {
        if (!ok) return;
        if (!navigator.onLine) {
          app.avisoCurto('Para apagar de vez, o app precisa de internet.');
          return;
        }
        apagarCaderno(id).then(() => {
          app.avisoCurto('Caderno apagado.');
          abrirLixeira();
        }).catch(() => app.avisoCurto('Não deu para apagar agora. Tente de novo com internet.'));
      });
      break;
    case 'caderno-pasta-abrir':
      atualizarEstado({ cadPasta: id || null });
      app.renderizar();
      break;
    case 'caderno-pasta-nova':
      abrirFolha(obterEstado().cadPasta ? 'Nova subpasta' : 'Nova pasta', renderFormPasta());
      break;
    case 'caderno-pasta-renomear':
      abrirFolha('Renomear pasta', renderFormPasta((obterEstado().pastas || []).find((p) => p.id === id)));
      break;
    case 'caderno-pasta-excluir':
      confirmar('Excluir esta pasta (e as subpastas)? Os cadernos não são apagados: voltam para fora das pastas.').then((ok) => ok && excluirPasta(id));
      break;
    default:
      return false;
  }
  return true;
}

function filtrarNaTela(valor) {
  const termo = String(valor || '').trim().toLowerCase();
  let visiveis = 0;
  document.querySelectorAll('.cad-corpo .cadernos-grade > li').forEach((li) => {
    const mostra = !termo || li.dataset.busca.includes(termo);
    li.hidden = !mostra;
    if (mostra) visiveis += 1;
  });
  document.querySelectorAll('.cad-corpo [data-estante]').forEach((s) => {
    s.hidden = Boolean(termo) && !s.querySelector('.cadernos-grade > li:not([hidden])');
  });
  const vazio = document.querySelector('[data-cadernos-vazio]');
  if (vazio) vazio.hidden = !termo || visiveis > 0;
}

export function reaplicarBuscaCadernos() {
  const campo = document.getElementById('caderno-busca');
  if (campo?.value) filtrarNaTela(campo.value);
}

export function mudancaCadernos(alvo, tipo) {
  if (alvo.dataset?.filtrarCadernos !== undefined) {
    atualizarEstado({ cadBusca: alvo.value });
    filtrarNaTela(alvo.value);
    return true;
  }
  if (alvo.dataset?.cadernoTipo !== undefined) {
    if (tipo !== 'change') return true;
    const form = alvo.closest('form');
    const titulo = form.elements.titulo.value;
    const area = form.elements.area?.value || '';
    document.getElementById('folha-evento-conteudo').innerHTML = renderFormCaderno(obterEstado(), { area, tipo: alvo.value });
    const novo = document.querySelector('[data-form="caderno-novo"]');
    novo.elements.titulo.value = titulo;
    novo.elements.tipo.focus();
    return true;
  }
  if (alvo.name === 'capa' && alvo.closest('[data-form^="caderno-"]')) {
    // A amostra dos estilos acompanha a cor escolhida.
    alvo.closest('form').querySelectorAll('[name="estilo"] + .capa-amostra').forEach((s) => {
      s.className = s.className.replace(/capa-\d/, `capa-${alvo.value}`);
    });
    return false;
  }
  return false;
}

export function enviarCadernos(form) {
  switch (form.dataset.form) {
    case 'caderno-novo': criar(form); break;
    case 'caderno-editar': salvarEdicao(form); break;
    case 'caderno-pasta': salvarPasta(form); break;
    default: return false;
  }
  return true;
}
