// Cliques, formulários e campos da Biblioteca (lista, adicionar e leitor).

import { obterEstado, atualizarEstado } from './estado.js';
import { chamar } from './funcoes.js';
import { enviarArquivo, baixarArquivo, idDaUsuaria } from './nuvem.js';
import { iniciarTrabalho, trabalhosDoTipo, encerrarTrabalho } from './trabalhos-ia.js';
import { gravar, criarGravador } from './gravacao.js';
import { artigoPeloId, lerTags, fichamentoEmTexto, paragrafos, STATUS } from './dados-biblioteca.js';
import { lerLivro, guardarLivro } from './livros.js';

let app; // { renderizar, avisoCurto }
const gravador = criarGravador('artigos', 'artigos');
const TAMANHOS = [0.9, 1, 1.15, 1.3, 1.5];
const MAX_PDF = 25 * 1024 * 1024;
let selecao = ''; // último trecho selecionado no leitor (o toque no botão apaga a seleção)

export function ligarBiblioteca(funcoes) {
  app = funcoes;
  document.addEventListener('selectionchange', () => {
    const s = document.getSelection();
    const texto = String(s?.toString() || '').replace(/\s+/g, ' ').trim();
    const leitor = document.getElementById('leitor-texto');
    if (texto && leitor && s.anchorNode && leitor.contains(s.anchorNode)) selecao = texto;
  });
  // Quando a IA termina de ler um PDF, o texto entra na leitura (mesmo fora da tela).
  window.addEventListener('hub:trabalho', (e) => {
    const t = e.detail;
    if (t?.tipo === 'artigo' && t.status === 'pronto') aplicarLeituraDoPdf(t);
    else if (t?.tipo === 'artigo' && obterEstado().rota === 'biblioteca') app.renderizar();
  });
}

function artigoAberto() {
  const base = artigoPeloId(obterEstado(), obterEstado().parametro);
  return base ? gravador.vigente(base) : null;
}

async function mudarArtigo(campos, { redesenhar = true } = {}) {
  const base = artigoPeloId(obterEstado(), obterEstado().parametro);
  if (!base) return null;
  const salvo = await gravador.ja(base, campos);
  if (redesenhar) app.renderizar();
  return salvo;
}

async function aplicarLeituraDoPdf(t) {
  const id = t.ligado?.artigo_id;
  const base = id && artigoPeloId(obterEstado(), id);
  if (base) {
    const r = t.resultado || {};
    const v = gravador.vigente(base);
    await gravador.ja(base, {
      texto: r.texto || v.texto,
      resumo: v.resumo || r.resumo || null,
      autor: v.autor || r.autor || null,
      titulo: t.ligado?.trocarTitulo && r.titulo ? r.titulo : v.titulo,
    });
    app.avisoCurto(`Texto do PDF pronto: ${base.titulo}`);
  }
  await encerrarTrabalho(t.id);
  if (obterEstado().rota === 'biblioteca') app.renderizar();
}

async function lerPdfComIa(artigo, { trocarTitulo = false } = {}) {
  try {
    await iniciarTrabalho({ tipo: 'artigo', caminho: artigo.pdf_path, rotulo: artigo.titulo, ligado: { artigo_id: artigo.id, trocarTitulo } });
    app.avisoCurto('A IA está lendo o PDF. Pode sair da tela; o texto chega sozinho.');
  } catch (erro) {
    app.avisoCurto(erro.message);
  }
  app.renderizar();
}

// Destaca o trecho selecionado (precisa estar inteiro dentro de um parágrafo).
async function destacar(cor) {
  const a = artigoAberto();
  const trecho = selecao.slice(0, 1500);
  selecao = '';
  if (!a || trecho.length < 2) {
    app.avisoCurto('Selecione um trecho do texto primeiro (segure e arraste).');
    return;
  }
  if (!paragrafos(a.texto).some((p) => p.includes(trecho))) {
    app.avisoCurto('Selecione dentro de um parágrafo só.');
    return;
  }
  const destaques = [...(a.destaques || []), { id: crypto.randomUUID().slice(0, 8), texto: trecho, cor, nota: '', criado_em: new Date().toISOString() }];
  document.getSelection()?.removeAllRanges();
  await mudarArtigo({ destaques, status: a.status === 'ler' ? 'lendo' : a.status });
  app.avisoCurto('Trecho destacado.');
}

async function copiar(texto, aviso) {
  try {
    await navigator.clipboard.writeText(texto);
    app.avisoCurto(aviso);
  } catch {
    app.avisoCurto('Não deu para copiar neste navegador.');
  }
}

async function abrirPdf(a) {
  const janela = window.open('', '_blank');
  try {
    const blob = await baixarArquivo(a.pdf_path);
    const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
    if (janela) janela.location.href = url;
    else location.assign(url);
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
  } catch (erro) {
    janela?.close();
    app.avisoCurto(erro.message || 'Não foi possível abrir o PDF.');
  }
}

function filtro(campo, valor) {
  atualizarEstado({ bibFiltros: { ...(obterEstado().bibFiltros || {}), [campo]: valor } });
  app.renderizar();
}

export function cliqueBiblioteca(alvo) {
  const acao = alvo.dataset.acao;
  if (!acao?.startsWith('bib-')) return false;
  const a = artigoAberto();
  switch (acao) {
    case 'bib-filtro':
      filtro(alvo.dataset.campo, alvo.dataset.valor);
      break;
    case 'bib-fonte':
      atualizarEstado({ bibFonte: alvo.dataset.valor });
      if (alvo.dataset.ir === 'novo' && location.hash !== '#biblioteca/novo') location.hash = '#biblioteca/novo';
      else app.renderizar();
      break;
    case 'bib-aba':
      gravador.agora().then(() => {
        atualizarEstado({ bibAba: alvo.dataset.valor, bibEditando: null });
        app.renderizar();
      });
      break;
    case 'bib-letra': {
      const atual = TAMANHOS.indexOf(Number(obterEstado().bibTamanho) || 1);
      const novo = TAMANHOS[Math.max(0, Math.min(TAMANHOS.length - 1, (atual < 0 ? 1 : atual) + Number(alvo.dataset.passo)))];
      atualizarEstado({ bibTamanho: novo });
      try { localStorage.setItem('hub.leitura.tamanho', String(novo)); } catch { /* só nesta sessão */ }
      document.getElementById('leitor-texto')?.style.setProperty('--leitura', novo);
      break;
    }
    case 'bib-destacar':
      destacar(alvo.dataset.cor);
      break;
    case 'bib-marca':
      gravador.agora().then(() => {
        atualizarEstado({ bibAba: 'destaques' });
        app.renderizar();
        document.querySelector(`[data-bib-nota-destaque="${CSS.escape(alvo.dataset.destaque)}"]`)?.focus();
      });
      break;
    case 'bib-destaque-remover':
      if (a) mudarArtigo({ destaques: (a.destaques || []).filter((d) => d.id !== alvo.dataset.id) });
      break;
    case 'bib-destaque-ficha': {
      const d = a?.destaques?.find((x) => x.id === alvo.dataset.id);
      if (!d) break;
      const atual = a.fichamento?.citacoes || '';
      mudarArtigo({ fichamento: { ...(a.fichamento || {}), citacoes: `${atual ? `${atual}\n` : ''}“${d.texto}”${d.nota ? ` (${d.nota})` : ''}` } }, { redesenhar: false })
        .then(() => app.avisoCurto('Levado para as citações do fichamento.'));
      break;
    }
    case 'bib-favorito':
      if (a) mudarArtigo({ favorito: !a.favorito });
      break;
    case 'bib-status':
      if (a) mudarArtigo({ status: alvo.dataset.valor, lido_em: a.lido_em || new Date().toISOString() }).then(() => app.avisoCurto('Marcado como fichado.'));
      break;
    case 'bib-abrir-pdf':
      if (a?.pdf_path) abrirPdf(a);
      break;
    case 'bib-ler-pdf':
      if (a?.pdf_path) lerPdfComIa(a);
      break;
    case 'bib-copiar-ficha':
      if (a) copiar(fichamentoEmTexto(a), 'Fichamento copiado.');
      break;
    case 'bib-questoes':
      if (!a) break;
      if (!String(a.texto || '').trim()) {
        app.avisoCurto('Esta leitura ainda não tem texto para gerar questões.');
        break;
      }
      atualizarEstado({ questoesPreset: { fonte: 'artigo', artigo: a.id, disciplina: a.disciplina_id || '', area: a.area_id || '' } });
      location.hash = '#questoes/gerar';
      break;
    case 'bib-substack':
      if (!a) break;
      atualizarEstado({ substackReferencia: a.id });
      location.hash = '#substack';
      app.avisoCurto('Abra uma pauta (ou crie uma) para ligar esta leitura.');
      break;
    case 'bib-editar':
      gravador.agora().then(() => {
        atualizarEstado({ bibEditando: a?.id || null });
        app.renderizar();
      });
      break;
    case 'bib-editar-fechar':
      atualizarEstado({ bibEditando: null });
      app.renderizar();
      break;
    case 'bib-excluir':
      if (a && window.confirm(`Excluir "${a.titulo}"? Os destaques e o fichamento vão junto.`)) {
        mudarArtigo({ excluido_em: new Date().toISOString() }, { redesenhar: false }).then(() => {
          location.hash = '#biblioteca';
          app.avisoCurto('Leitura excluída.');
        });
      }
      break;
    default:
      return false;
  }
  return true;
}

// Campos que mudam (tipo: 'input' ou 'change').
export function mudancaBiblioteca(alvo, tipo) {
  if (alvo.dataset?.filtrarLista === 'bib-lista') {
    filtrarNaTela(alvo.value);
    return true;
  }
  if (alvo.dataset?.acaoMudar === 'bib-filtro') {
    if (tipo !== 'change') return true;
    filtro(alvo.dataset.campo, alvo.type === 'checkbox' ? alvo.checked : alvo.value);
    return true;
  }
  if (alvo.dataset?.acaoMudar === 'bib-status') {
    if (tipo !== 'change') return true;
    const a = artigoAberto();
    if (a) mudarArtigo({ status: alvo.value, lido_em: (alvo.value === 'lido' || alvo.value === 'fichado') ? (a.lido_em || new Date().toISOString()) : a.lido_em });
    return true;
  }
  const base = artigoPeloId(obterEstado(), obterEstado().parametro);
  if (!base) return false;
  if (alvo.dataset?.bibCampo) {
    gravador.adiar(base, { [alvo.dataset.bibCampo]: alvo.value });
    return true;
  }
  if (alvo.dataset?.bibFicha) {
    const v = gravador.vigente(base);
    gravador.adiar(base, { fichamento: { ...(v.fichamento || {}), [alvo.dataset.bibFicha]: alvo.value } });
    return true;
  }
  if (alvo.dataset?.bibNotaDestaque) {
    const v = gravador.vigente(base);
    gravador.adiar(base, { destaques: (v.destaques || []).map((d) => (d.id === alvo.dataset.bibNotaDestaque ? { ...d, nota: alvo.value } : d)) });
    return true;
  }
  return false;
}

function filtrarNaTela(valor) {
  atualizarEstado({ bibFiltros: { ...(obterEstado().bibFiltros || {}), busca: valor } });
  const termo = valor.trim().toLowerCase();
  let visiveis = 0;
  document.querySelectorAll('#bib-lista > li').forEach((li) => {
    const mostra = !termo || li.dataset.busca.includes(termo);
    li.hidden = !mostra;
    if (mostra) visiveis += 1;
  });
  const vazio = document.querySelector('[data-lista-vazia="bib-lista"]');
  if (vazio) vazio.hidden = visiveis > 0;
}

// Depois de redesenhar a lista, reaplica a busca digitada.
export function reaplicarBusca() {
  const campo = document.getElementById('bib-busca');
  if (campo?.value) filtrarNaTela(campo.value);
}

function mostrarErro(form, texto) {
  const caixa = form.querySelector('[data-erro]');
  caixa.textContent = texto;
  caixa.hidden = !texto;
}

async function adicionar(form) {
  const fonte = form.dataset.fonte;
  const el = form.elements;
  const botao = form.querySelector('[type="submit"]');
  const comum = {
    titulo: el.titulo.value.trim(),
    autor: el.autor.value.trim() || null,
    tags: lerTags(el.tags.value),
    status: STATUS.some((s) => s.id === el.status.value) ? el.status.value : 'ler',
    disciplina_id: el.disciplina.value || null,
    area_id: el.area.value || null,
    fonte,
    destaques: [],
    fichamento: {},
    favorito: false,
  };
  mostrarErro(form, '');
  botao.disabled = true;
  try {
    let artigo;
    if (fonte === 'link') {
      const url = el.url.value.trim();
      if (!/^https?:\/\/[^\s/]+\S*$/i.test(url)) throw new Error('Cole um link que comece com http:// ou https://.');
      if (!navigator.onLine) throw new Error('Sem internet agora. Para ler o link, o app precisa de conexão (ou cole o texto).');
      botao.textContent = 'Lendo o link…';
      const r = await chamar('biblioteca-extrair', { url });
      if (!r.ok) throw new Error(r.erro || 'Não foi possível ler esse link.');
      const x = r.artigo || {};
      artigo = { ...comum, url: x.url || url, titulo: comum.titulo || x.titulo || url, autor: comum.autor || x.autor || null, resumo: x.resumo || null, texto: x.texto || '' };
    } else if (fonte === 'livro') {
      const arquivo = el.livro.files?.[0];
      if (!arquivo) throw new Error('Escolha o arquivo do livro (PDF ou EPUB).');
      if (!idDaUsuaria()) throw new Error('Entre no app para guardar livros.');
      if (!navigator.onLine) throw new Error('Sem internet agora. O livro precisa subir para a nuvem uma vez (depois lê sem internet).');
      botao.textContent = 'Abrindo o livro…';
      const info = await lerLivro(arquivo);
      botao.textContent = `Enviando o livro (${Math.max(1, Math.round(arquivo.size / 1024 / 1024))} MB)…`;
      const id = crypto.randomUUID();
      const caminho = `${idDaUsuaria()}/biblioteca/${id}.${info.formato}`;
      await guardarLivro(caminho, arquivo, info.formato);
      artigo = {
        ...comum, id, fonte: 'livro', pdf_path: caminho, texto: '',
        titulo: comum.titulo || info.titulo || 'Livro sem título', autor: comum.autor || info.autor || null,
        dados: { formato: info.formato, capa: info.capa, tamanho: arquivo.size, paginas: info.paginas || null },
      };
    } else if (fonte === 'pdf') {
      const arquivo = el.pdf.files?.[0];
      if (!arquivo) throw new Error('Escolha o PDF.');
      if (!/pdf$/i.test(arquivo.type || arquivo.name)) throw new Error('O arquivo precisa ser PDF.');
      if (arquivo.size > MAX_PDF) throw new Error('O PDF passa de 25 MB.');
      if (!idDaUsuaria()) throw new Error('Entre no app para guardar PDFs.');
      if (!navigator.onLine) throw new Error('Sem internet agora. O PDF precisa subir para a nuvem.');
      botao.textContent = 'Enviando o PDF…';
      const id = crypto.randomUUID();
      const caminho = `${idDaUsuaria()}/biblioteca/${id}.pdf`;
      await enviarArquivo(caminho, arquivo);
      const nome = arquivo.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
      artigo = { ...comum, id, pdf_path: caminho, titulo: comum.titulo || nome || 'PDF sem título', texto: '' };
    } else {
      const texto = el.texto.value.trim();
      if (!comum.titulo) throw new Error('Dê um título para o texto.');
      if (texto.length < 20) throw new Error('Cole o texto (pelo menos uma frase).');
      artigo = { ...comum, texto };
    }
    const salvo = await gravar('artigos', 'artigos', artigo);
    atualizarEstado({ bibPreenchido: null, bibAba: 'ler' });
    if (fonte === 'pdf' && el.ia?.checked) await lerPdfComIa(salvo, { trocarTitulo: !comum.titulo }).catch(() => {});
    location.hash = fonte === 'livro' ? `#livro/${salvo.id}` : `#biblioteca/${salvo.id}`;
    app.avisoCurto(fonte === 'livro' ? 'Livro na estante. Boa leitura!' : 'Salvo na Biblioteca.');
  } catch (erro) {
    mostrarErro(form, erro.message || 'Não deu certo agora.');
    botao.disabled = false;
    botao.textContent = 'Salvar na Biblioteca';
  }
}

async function editar(form) {
  const base = artigoPeloId(obterEstado(), form.dataset.id);
  if (!base) return;
  const el = form.elements;
  const titulo = el.titulo.value.trim();
  if (!titulo) {
    el.titulo.focus();
    return;
  }
  const url = el.url.value.trim();
  const texto = el.texto.value;
  const v = gravador.vigente(base);
  const pars = paragrafos(texto);
  await gravador.ja(base, {
    titulo,
    autor: el.autor.value.trim() || null,
    url: /^https?:\/\//i.test(url) ? url : null,
    disciplina_id: el.disciplina.value || null,
    area_id: el.area.value || null,
    tags: lerTags(el.tags.value),
    resumo: el.resumo.value.trim() || null,
    texto,
    // Destaque de livro (com capítulo) fica sempre; o de texto só se o trecho continua lá.
    destaques: (v.destaques || []).filter((d) => Number.isFinite(d.capitulo) || pars.some((p) => p.includes(d.texto))),
  });
  atualizarEstado({ bibEditando: null });
  app.renderizar();
  app.avisoCurto('Leitura atualizada.');
}

export function enviarBiblioteca(form) {
  if (form.dataset.form === 'bib-novo') adicionar(form);
  else if (form.dataset.form === 'bib-editar') editar(form);
  else return false;
  return true;
}

// Ao abrir o app: a letra do leitor volta ao tamanho escolhido e os PDFs em leitura seguem.
export function iniciarBiblioteca() {
  try {
    const t = Number(localStorage.getItem('hub.leitura.tamanho'));
    if (TAMANHOS.includes(t)) atualizarEstado({ bibTamanho: t });
  } catch {
    // sem armazenamento
  }
  for (const t of trabalhosDoTipo('artigo')) if (t.status === 'pronto') aplicarLeituraDoPdf(t);
}
