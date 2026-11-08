// PDF do Radar do nicho no visual do app (cores do tema escuro ou claro em uso): páginas A4
// desenhadas em canvas e juntadas pelo pdfDeCanvases dos Cadernos.

import { pdfDeCanvases } from './exportar-caderno.js';
import { TEMPERATURAS } from './dados-radar.js';

const A4 = { w: 595.28, h: 841.89 };
const ESCALA = 2;
const MARGEM = 44;

function cores() {
  const css = getComputedStyle(document.documentElement);
  const v = (n, p) => css.getPropertyValue(n).trim() || p;
  return {
    fundo: v('--cor-fundo', '#191919'), card: v('--cor-superficie', '#242424'), texto: v('--cor-texto', '#E6D9CB'),
    suave: v('--cor-texto-suave', '#C7B6A5'), destaque: v('--cor-destaque', '#C9B7A4'), linha: v('--cor-linha', '#333333'),
  };
}

const fonte = (tam, peso = 400, estilo = '') => `${estilo} ${peso} ${tam * ESCALA}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
const fmtDia = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); };

// Blocos do documento: [{ tipo: t1|t2|t3|p|meta|li|gancho|espaco, texto }]
export function blocosDoRadar(nicho, r, { cliente = null } = {}) {
  const b = [];
  const add = (tipo, texto = '') => { if (tipo === 'espaco' || texto) b.push({ tipo, texto: String(texto) }); };
  add('t1', `Radar · ${nicho.nome}${cliente ? ` · ${cliente}` : ''}`);
  add('meta', `${r?.gerado_em ? `Análise de ${new Date(r.gerado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : ''}${nicho.palavras.length ? ` · ${nicho.palavras.join(', ')}` : ''}`);
  if (r?.briefing) { add('t2', 'Briefing da semana'); add('p', r.briefing); }
  if (r?.itens?.length) {
    add('t2', 'Vai bombar nas próximas 2 semanas');
    for (const x of r.itens) {
      add('t3', x.tema);
      add('meta', [(TEMPERATURAS.find((t) => t.id === x.temperatura) || TEMPERATURAS[1]).nome, x.janela, x.formato].filter(Boolean).join(' · '));
      add('p', x.porque);
      if (x.gancho) add('gancho', x.gancho);
    }
  }
  for (const nome of cliente ? [cliente] : Object.keys(r?.clientes || {})) {
    const lista = r?.clientes?.[nome]?.sugestoes || [];
    if (!lista.length) continue;
    add('t2', `Sugestões para ${nome}`);
    lista.forEach((x, i) => {
      add('t3', `${i + 1}. ${x.titulo}`);
      add('meta', [x.formato, x.linha, x.estrutura].filter(Boolean).join(' · '));
      if (x.noticia) add('p', `Partiu da notícia: ${x.noticia.titulo}${x.noticia.fonte ? ` (${x.noticia.fonte})` : ''} · ${x.noticia.link}`);
      if (x.caso) add('p', `O caso: ${x.caso}`);
      if (x.gancho) add('gancho', x.gancho);
      if (x.gap) add('p', `Gap: ${x.gap}`);
      x.esqueleto.forEach((e, j) => add('li', `${j + 1}. ${e}`));
      if (x.cta) add('p', `CTA: ${x.cta}`);
      if (x.cuidado) add('p', `Cuidado: ${x.cuidado}`);
      if (x.porque_agora) add('p', `Por que agora: ${x.porque_agora}`);
    });
  }
  const noticias = (r?.noticias?.length ? r.noticias : (r?.noticias_hist || [])).slice(0, 15);
  if (noticias.length) {
    add('t2', 'Notícias e fontes');
    for (const n of noticias) {
      add('li', `${n.titulo}`);
      add('meta', [n.fonte, fmtDia(n.data), n.link].filter(Boolean).join(' · '));
      if (n.porque) add('p', n.porque);
    }
  }
  return b;
}

const ESTILO = {
  t1: { tam: 22, peso: 700, antes: 0, depois: 6, cor: 'texto' },
  t2: { tam: 15, peso: 700, antes: 16, depois: 6, cor: 'destaque' },
  t3: { tam: 12.5, peso: 650, antes: 10, depois: 2, cor: 'texto' },
  p: { tam: 10.5, peso: 400, antes: 2, depois: 2, cor: 'texto' },
  li: { tam: 10.5, peso: 400, antes: 1, depois: 1, cor: 'texto', recuo: 12 },
  meta: { tam: 9, peso: 500, antes: 1, depois: 3, cor: 'suave' },
  gancho: { tam: 11, peso: 500, antes: 4, depois: 4, cor: 'texto', estilo: 'italic', recuo: 12, barra: true },
};

function quebrar(ctx, texto, largura) {
  const linhas = [];
  for (const par of texto.split('\n')) {
    let atual = '';
    for (const palavra of par.split(/\s+/)) {
      const teste = atual ? `${atual} ${palavra}` : palavra;
      if (ctx.measureText(teste).width > largura && atual) { linhas.push(atual); atual = palavra; } else atual = teste;
    }
    linhas.push(atual);
  }
  return linhas;
}

export async function pdfDoRadar(blocos) {
  const c = cores();
  const medir = document.createElement('canvas').getContext('2d');
  // Paginação: cada bloco vira linhas; as páginas guardam o que desenhar.
  const paginas = [[]];
  let y = MARGEM;
  const util = A4.w - MARGEM * 2;
  for (const bl of blocos) {
    const e = ESTILO[bl.tipo];
    if (!e) continue;
    medir.font = fonte(e.tam, e.peso, e.estilo);
    const linhas = quebrar(medir, bl.texto, (util - (e.recuo || 0)) * ESCALA);
    const alt = e.tam * 1.4;
    const precisa = e.antes + linhas.length * alt + e.depois + (bl.tipo === 't2' ? alt * 2 : 0);
    if (y + Math.min(precisa, alt * 3) > A4.h - MARGEM) { paginas.push([]); y = MARGEM; }
    y += e.antes;
    for (const linha of linhas) {
      if (y + alt > A4.h - MARGEM) { paginas.push([]); y = MARGEM; }
      paginas[paginas.length - 1].push({ e, linha, y });
      y += alt;
    }
    y += e.depois;
  }
  return pdfDeCanvases(paginas.length, async (i) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(A4.w * ESCALA);
    canvas.height = Math.round(A4.h * ESCALA);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = c.fundo;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textBaseline = 'top';
    for (const { e, linha, y: yy } of paginas[i]) {
      ctx.font = fonte(e.tam, e.peso, e.estilo);
      ctx.fillStyle = c[e.cor];
      const x = (MARGEM + (e.recuo || 0)) * ESCALA;
      if (e.barra) { ctx.fillStyle = c.destaque; ctx.fillRect((MARGEM + 2) * ESCALA, yy * ESCALA, 3 * ESCALA, e.tam * 1.4 * ESCALA); ctx.fillStyle = c[e.cor]; }
      ctx.fillText(linha, x, yy * ESCALA);
    }
    ctx.font = fonte(8);
    ctx.fillStyle = c.suave;
    ctx.fillText(`Bússola · Radar do nicho · ${i + 1}/${paginas.length}`, MARGEM * ESCALA, (A4.h - 26) * ESCALA);
    return { canvas, largura: A4.w, altura: A4.h };
  });
}
