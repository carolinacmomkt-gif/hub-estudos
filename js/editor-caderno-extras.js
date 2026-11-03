// Cadernos, parte 2: a tela das ferramentas novas do editor (painéis Letra e Ver, índice e marcadores,
// abas dos cadernos abertos, links, converter em texto e ortografia com a IA, digitalizar documento).
// O motor fica em editor-extras.js; aqui, só os botões e as folhas.

import { esc } from './utilidades.js';
import { listar } from './persistencia.js';
import { chamar } from './funcoes.js';
import { perguntarTexto } from './confirmar.js';
import { passoDaPauta } from './folhas.js';

export const INTENSIDADES = [{ id: 0.35, nome: 'Leve' }, { id: 0.6, nome: 'Média' }, { id: 0.9, nome: 'Forte' }];
const CHAVE_ABAS = 'hub.cadernos.abas';

const b = (acao, rotulo, extra = '') => `<button type="button" class="botao botao-secundario botao-pequeno" data-ed="${acao}" ${extra}>${rotulo}</button>`;

// ---------------------------------------------------------------------------
// Painéis da barra
// ---------------------------------------------------------------------------
export function painelLetra(prefs, editor) {
  const temPauta = Boolean(passoDaPauta(editor?.pagina?.modelo || 'branco', editor?.dim || { mm: 4.76 }));
  return `
    <details class="ferramenta-mais" data-painel="letra">
      <summary class="ferramenta-botao">Letra</summary>
      <div class="ferramenta-painel">
        <label class="ferramenta-select"><span>Intensidade</span>
          <select data-ed="letra-intensidade">${INTENSIDADES.map((i) => `<option value="${i.id}"${Number(prefs.letraIntensidade) === i.id ? ' selected' : ''}>${i.nome}</option>`).join('')}</select></label>
        <div class="ferramenta-grupo">
          ${b('letra-pagina', 'Melhorar a página')}
          ${temPauta ? b('letra-pauta', 'Alinhar à pauta') : ''}
          ${b('letra-original', 'Voltar ao original')}
        </div>
        <label class="campo-marcar"><input type="checkbox" data-ed="letra-auto"${prefs.letraAuto ? ' checked' : ''}><span>Melhorar sozinho depois de uma pausa</span></label>
        ${b('janela', editor?.janela ? 'Fechar a janela de zoom' : 'Janela de zoom', `aria-pressed="${Boolean(editor?.janela)}"`)}
        <p class="campo-ajuda">Melhorar endireita a linha, iguala o tamanho, a inclinação e o espaço entre as palavras, sem perder o seu jeito. O traço de antes fica guardado: "Voltar ao original" desfaz. Com o laço, vale só para a seleção (e lá também tem converter em texto e ortografia).</p>
      </div>
    </details>`;
}

export function painelVer(editor) {
  const temFitas = (editor?.pagina?.fitas || []).length > 0;
  return `
    <details class="ferramenta-mais" data-painel="ver">
      <summary class="ferramenta-botao">Ver</summary>
      <div class="ferramenta-painel">
        <div class="ferramenta-grupo">
          ${b('regua', editor?.regua ? 'Guardar a régua' : 'Régua', `aria-pressed="${Boolean(editor?.regua)}"`)}
          ${editor?.regua ? `${b('regua-girar', '↺ 45°', 'data-valor="-45"')}${b('regua-girar', '↻ 45°', 'data-valor="45"')}` : ''}
        </div>
        ${temFitas ? `<div class="ferramenta-grupo">${b('fitas-cobrir', 'Cobrir as fitas de novo')}${b('fitas-tirar', 'Tirar todas as fitas')}</div>` : ''}
        <div class="ferramenta-grupo">
          ${b('leitura', 'Modo leitura')}
          ${b('apresentar', 'Apresentar')}
          ${b('indice', 'Índice e marcadores')}
        </div>
        <p class="campo-ajuda">Régua: dois dedos em cima dela movem e giram; o traço que começa na borda sai reto. Fita de estudo (na barra): arraste para cobrir um trecho e toque para revelar. Laser: risca e some.</p>
      </div>
    </details>`;
}

// ---------------------------------------------------------------------------
// Abas dos cadernos abertos (no aparelho)
// ---------------------------------------------------------------------------
function lerAbas() {
  try { return JSON.parse(localStorage.getItem(CHAVE_ABAS) || '[]').filter((a) => a?.id); } catch { return []; }
}
function guardarAbas(lista) {
  try { localStorage.setItem(CHAVE_ABAS, JSON.stringify(lista.slice(0, 6))); } catch { /* só nesta sessão */ }
}
export function lembrarAba(caderno) {
  const lista = lerAbas().filter((a) => a.id !== caderno.id);
  guardarAbas([{ id: caderno.id, titulo: caderno.titulo }, ...lista]);
}
export function fecharAba(id) {
  guardarAbas(lerAbas().filter((a) => a.id !== id));
}
export function renderAbas(atualId) {
  const abas = lerAbas();
  if (abas.length < 2) return '';
  return abas.map((a) => `<span class="caderno-aba${a.id === atualId ? ' atual' : ''}">
    <a href="#cadernos/${esc(a.id)}"${a.id === atualId ? ' aria-current="page"' : ''}>${esc(a.titulo)}</a>
    ${a.id === atualId ? '' : `<button type="button" data-ed="aba-fechar" data-valor="${esc(a.id)}" aria-label="Fechar a aba ${esc(a.titulo)}">×</button>`}
  </span>`).join('');
}

// ---------------------------------------------------------------------------
// Folha simples (dialog) para mostrar resultados e listas
// ---------------------------------------------------------------------------
export function abrirFolhaSimples(titulo, html, aoClicar) {
  document.getElementById('folha-caderno')?.remove();
  const d = document.createElement('dialog');
  d.className = 'folha folha-caderno';
  d.id = 'folha-caderno';
  d.innerHTML = `<div class="folha-alca" aria-hidden="true"></div><h2 class="folha-titulo">${esc(titulo)}</h2><div class="folha-caderno-corpo">${html}</div>
    <button type="button" class="botao botao-secundario folha-fechar" data-folha="fechar">Fechar</button>`;
  document.body.append(d);
  d.addEventListener('click', (e) => {
    if (e.target === d) { d.close(); return; }
    const alvo = e.target.closest('[data-folha]');
    if (!alvo) return;
    if (alvo.dataset.folha === 'fechar') { d.close(); return; }
    aoClicar?.(alvo, d);
  });
  d.addEventListener('close', () => d.remove());
  d.showModal();
  return d;
}

// ---------------------------------------------------------------------------
// Índice e marcadores
// ---------------------------------------------------------------------------
export function abrirIndice({ paginas, editor, indice, abrirPagina, aoMudar }) {
  const marcada = (p, i) => (i === indice ? editor.pagina.marcador : p.tracos_json?.marcador);
  const itens = paginas.map((p, i) => ({ i, m: marcada(p, i) })).filter((x) => x.m);
  const atual = editor.pagina.marcador;
  const html = `
    <div class="ferramenta-grupo">
      ${atual ? `<button type="button" class="botao botao-secundario botao-pequeno" data-folha="desmarcar">Tirar o marcador desta página</button>`
        : `<button type="button" class="botao botao-primario botao-pequeno" data-folha="marcar">🔖 Marcar esta página</button>`}
    </div>
    ${itens.length ? `<ol class="caderno-indice">${itens.map((x) => `<li><button type="button" data-folha="ir" data-valor="${x.i}"><span>🔖 ${esc(x.m.titulo || `Página ${x.i + 1}`)}</span><small>pág. ${x.i + 1}</small></button></li>`).join('')}</ol>`
      : '<p class="texto-suave">Nenhuma página marcada ainda. Marque as páginas importantes para elas virarem o índice do caderno.</p>'}`;
  abrirFolhaSimples('Índice do caderno', html, (alvo, d) => {
    if (alvo.dataset.folha === 'ir') { d.close(); abrirPagina(Number(alvo.dataset.valor)); return; }
    if (alvo.dataset.folha === 'desmarcar') { delete editor.pagina.marcador; aoMudar(); d.close(); return; }
    if (alvo.dataset.folha === 'marcar') {
      d.close();
      perguntarTexto('Nome do marcador (aparece no índice)', { padrao: `Página ${indice + 1}`, maximo: 80 }).then((titulo) => {
        if (titulo === null || titulo === undefined) return;
        editor.pagina.marcador = { titulo: String(titulo).trim() || `Página ${indice + 1}` };
        aoMudar();
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------
export async function pedirLink(editor, avisar) {
  const resp = await perguntarTexto('Link para onde? Número da página, endereço de um site ou nome de outro caderno', { maximo: 300 });
  const v = String(resp || '').trim();
  if (!v) return;
  let destino = null;
  if (/^\d{1,4}$/.test(v)) destino = { tipo: 'pagina', n: Number(v) };
  else if (/^(https?:\/\/|www\.)\S+$/i.test(v)) destino = { tipo: 'site', url: /^www\./i.test(v) ? `https://${v}` : v };
  else {
    const alvo = v.toLowerCase();
    const cadernos = (await listar('cadernos')).filter((c) => !c.excluido_em);
    const achado = cadernos.find((c) => c.titulo.toLowerCase() === alvo) || cadernos.find((c) => c.titulo.toLowerCase().includes(alvo));
    if (achado) destino = { tipo: 'caderno', id: achado.id, titulo: achado.titulo };
  }
  if (!destino) { avisar('Não achei esse caderno. Escreva o número da página, um site ou o nome do caderno.'); return; }
  editor.criarLinkDaSelecao(destino);
  avisar(destino.tipo === 'pagina' ? `Link para a página ${destino.n}. Toque com o dedo para abrir.` : destino.tipo === 'site' ? 'Link para o site criado. Toque com o dedo para abrir.' : `Link para "${destino.titulo}" criado.`);
}

export function seguirLink(destino, { paginas, abrirPagina, avisar }) {
  if (destino.tipo === 'pagina') {
    if (destino.n < 1 || destino.n > paginas.length) { avisar(`Este caderno não tem a página ${destino.n}.`); return; }
    abrirPagina(destino.n - 1);
  } else if (destino.tipo === 'site') window.open(destino.url, '_blank', 'noopener');
  else if (destino.tipo === 'caderno') location.hash = `#cadernos/${destino.id}`;
}

// ---------------------------------------------------------------------------
// IA: converter em texto e ortografia (só quando ela pede)
// ---------------------------------------------------------------------------
const paraDataUrl = (blob) => new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });

export async function converterSelecao(editor, { avisar, estiloDoTexto }) {
  const blob = await editor.imagemDaSelecao(2.5);
  if (!blob) { avisar('Selecione a escrita com o laço.'); return; }
  avisar('Lendo a sua letra…');
  const r = await chamar('caderno-ia', { acao: 'texto', imagem: await paraDataUrl(blob) });
  if (!r?.ok) { avisar(r?.erro || 'Não consegui ler agora.'); return; }
  const caixa = { ...editor.selecao.caixa };
  const camadaId = editor.camadaAtiva()?.id;
  abrirFolhaSimples('Sua letra em texto', `
    <textarea class="campo-texto folha-caderno-texto" rows="8" aria-label="Texto convertido">${esc(r.texto)}</textarea>
    ${r.duvidas?.length ? `<p class="campo-ajuda">Confira: ${r.duvidas.map(esc).join(', ')}</p>` : ''}
    <div class="ferramenta-grupo">
      <button type="button" class="botao botao-primario botao-pequeno" data-folha="trocar">Trocar a letra pelo texto</button>
      <button type="button" class="botao botao-secundario botao-pequeno" data-folha="lado">Pôr embaixo</button>
      <button type="button" class="botao botao-secundario botao-pequeno" data-folha="copiar">Copiar</button>
    </div>`, (alvo, d) => {
    const texto = d.querySelector('textarea').value;
    if (alvo.dataset.folha === 'copiar') { navigator.clipboard?.writeText(texto).then(() => avisar('Copiado.')); return; }
    if (alvo.dataset.folha === 'trocar') {
      editor.excluirSelecao();
      editor.salvarTexto({ camadaId, x: caixa.x0, y: caixa.y0, texto, estilo: estiloDoTexto() });
    } else editor.salvarTexto({ camadaId, x: caixa.x0, y: caixa.y1 + 12, texto, estilo: estiloDoTexto() });
    d.close();
    avisar('Texto na página. Toque nele com a ferramenta Texto para editar.');
  });
}

export async function ortografiaDaSelecao(editor, { avisar }) {
  const blob = await editor.imagemDaSelecao(2.5);
  if (!blob) { avisar('Selecione a escrita com o laço.'); return; }
  avisar('Conferindo a ortografia…');
  const r = await chamar('caderno-ia', { acao: 'ortografia', imagem: await paraDataUrl(blob) });
  if (!r?.ok) { avisar(r?.erro || 'Não consegui conferir agora.'); return; }
  abrirFolhaSimples('Ortografia', r.erros?.length
    ? `<ul class="caderno-erros">${r.erros.map((e) => `<li><s>${esc(e.escrito)}</s> → <b>${esc(e.certo)}</b>${e.porque ? `<small>${esc(e.porque)}</small>` : ''}</li>`).join('')}</ul>`
    : '<p>Nenhum erro de ortografia. 🎉</p>');
}

// ---------------------------------------------------------------------------
// Digitalizar documento: foto → quatro cantos → recorte reto (perspectiva) → imagem na página
// ---------------------------------------------------------------------------
// Homografia que leva o retângulo de saída (0..W, 0..H) aos quatro cantos da foto.
function homografia(cantos, W, H) {
  const dst = [[0, 0], [W, 0], [W, H], [0, H]];
  const A = []; const v = [];
  for (let i = 0; i < 4; i += 1) {
    const [x, y] = dst[i]; const [u, w] = cantos[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); v.push(u);
    A.push([0, 0, 0, x, y, 1, -w * x, -w * y]); v.push(w);
  }
  // Eliminação de Gauss com pivô.
  for (let c = 0; c < 8; c += 1) {
    let piv = c;
    for (let r = c + 1; r < 8; r += 1) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]]; [v[c], v[piv]] = [v[piv], v[c]];
    for (let r = 0; r < 8; r += 1) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 8; k += 1) A[r][k] -= f * A[c][k];
      v[r] -= f * v[c];
    }
  }
  return v.map((x, i) => x / A[i][i]);
}

export function endireitar(imagem, cantos, maxLado = 1600) {
  const d = (a, b2) => Math.hypot(a[0] - b2[0], a[1] - b2[1]);
  let W = Math.max(d(cantos[0], cantos[1]), d(cantos[3], cantos[2]));
  let H = Math.max(d(cantos[0], cantos[3]), d(cantos[1], cantos[2]));
  const f = Math.min(1, maxLado / Math.max(W, H));
  W = Math.max(10, Math.round(W * f)); H = Math.max(10, Math.round(H * f));
  const src = document.createElement('canvas');
  src.width = imagem.width; src.height = imagem.height;
  const sx = src.getContext('2d');
  sx.drawImage(imagem, 0, 0);
  const s = sx.getImageData(0, 0, src.width, src.height).data;
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const ox = out.getContext('2d');
  const img = ox.createImageData(W, H);
  const [a, b1, c, d1, e, f1, g, h] = homografia(cantos, W, H);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const z = g * x + h * y + 1;
      const u = Math.min(src.width - 1, Math.max(0, Math.round((a * x + b1 * y + c) / z)));
      const w = Math.min(src.height - 1, Math.max(0, Math.round((d1 * x + e * y + f1) / z)));
      const si = (w * src.width + u) * 4; const oi = (y * W + x) * 4;
      img.data[oi] = s[si]; img.data[oi + 1] = s[si + 1]; img.data[oi + 2] = s[si + 2]; img.data[oi + 3] = 255;
    }
  }
  ox.putImageData(img, 0, 0);
  return out;
}

export async function digitalizar(arquivo, { inserirCanvas, avisar }) {
  let bmp;
  try { bmp = await createImageBitmap(arquivo); } catch { avisar('Não deu para abrir essa foto.'); return; }
  const esc1 = Math.min(1, 2200 / Math.max(bmp.width, bmp.height));
  const base = document.createElement('canvas');
  base.width = Math.round(bmp.width * esc1); base.height = Math.round(bmp.height * esc1);
  base.getContext('2d').drawImage(bmp, 0, 0, base.width, base.height);
  bmp.close?.();
  const m = 0.06;
  const cantos = [[base.width * m, base.height * m], [base.width * (1 - m), base.height * m], [base.width * (1 - m), base.height * (1 - m)], [base.width * m, base.height * (1 - m)]];
  const d = abrirFolhaSimples('Digitalizar documento', `
    <p class="campo-ajuda">Arraste as quatro bolinhas até os cantos do papel.</p>
    <div class="digitalizar-palco"><canvas class="digitalizar-foto"></canvas></div>
    <label class="campo-marcar"><input type="checkbox" class="digitalizar-limpar" checked><span>Clarear o papel (bom para folhas escritas)</span></label>
    <div class="ferramenta-grupo"><button type="button" class="botao botao-primario botao-pequeno" data-folha="pronto">Recortar e pôr na página</button></div>`, (alvo, dlg) => {
    if (alvo.dataset.folha !== 'pronto') return;
    const reto = endireitar(base, cantos);
    if (dlg.querySelector('.digitalizar-limpar')?.checked) clarear(reto);
    dlg.close();
    inserirCanvas(reto);
  });
  const c = d.querySelector('.digitalizar-foto');
  const ctx = c.getContext('2d');
  c.width = base.width; c.height = base.height;
  const desenhar = () => {
    ctx.drawImage(base, 0, 0);
    ctx.save();
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--cor-destaque').trim() || '#C9B7A4';
    ctx.lineWidth = Math.max(3, base.width / 300);
    ctx.beginPath();
    cantos.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    for (const p of cantos) { ctx.beginPath(); ctx.arc(p[0], p[1], Math.max(14, base.width / 70), 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  };
  desenhar();
  let arrastando = -1;
  const ponto = (e) => { const r = c.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * c.width, ((e.clientY - r.top) / r.height) * c.height]; };
  c.addEventListener('pointerdown', (e) => {
    const p = ponto(e);
    let melhor = -1; let dist = Infinity;
    cantos.forEach((q, i) => { const dd = Math.hypot(q[0] - p[0], q[1] - p[1]); if (dd < dist) { dist = dd; melhor = i; } });
    if (dist < c.width / 6) { arrastando = melhor; c.setPointerCapture(e.pointerId); e.preventDefault(); }
  });
  c.addEventListener('pointermove', (e) => { if (arrastando < 0) return; cantos[arrastando] = ponto(e); desenhar(); });
  c.addEventListener('pointerup', () => { arrastando = -1; });
}

// Clareia o fundo do papel e escurece a escrita (ajuste de níveis simples).
function clarear(canvas) {
  const x = canvas.getContext('2d');
  const img = x.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    const k = l > 165 ? 255 / Math.max(1, l) : l < 90 ? 0.7 : 1;
    d[i] = Math.min(255, d[i] * k); d[i + 1] = Math.min(255, d[i + 1] * k); d[i + 2] = Math.min(255, d[i + 2] * k);
  }
  x.putImageData(img, 0, 0);
}
