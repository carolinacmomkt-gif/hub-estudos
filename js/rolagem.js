// Faixas que rolam de lado (abas, quadros por etapa): marca quando há mais conteúdo para o lado,
// para a borda ganhar um esmaecido que mostra que dá para rolar (e some quando chega ao fim).

const SELETOR = '.segmentado, .yt-quadro, .tb-quadro';

function marcar(el) {
  const rola = el.scrollWidth > el.clientWidth + 2;
  el.toggleAttribute('data-rola', rola);
  el.toggleAttribute('data-fim', !rola || el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  el.toggleAttribute('data-inicio', !rola || el.scrollLeft <= 2);
}

export function marcarRolagens(raiz = document) {
  raiz.querySelectorAll(SELETOR).forEach(marcar);
}

export function ligarRolagens() {
  document.addEventListener('scroll', (e) => {
    if (e.target instanceof Element && e.target.matches(SELETOR)) marcar(e.target);
  }, { capture: true, passive: true });
  let espera;
  window.addEventListener('resize', () => { clearTimeout(espera); espera = setTimeout(() => { marcarRolagens(); fecharLinhas(); }, 150); });
}

// Painel do Hoje (grade de 12 colunas com os tamanhos que ela escolheu): uma linha que ficou com
// buraco no fim (um card some quando não tem nada) estica o último card até a borda.
export function fecharLinhas(raiz = document) {
  for (const painel of raiz.querySelectorAll('.painel:not(.painel-editando)')) {
    const filhos = [...painel.children].filter((f) => f.offsetParent !== null);
    filhos.forEach((f) => { f.style.gridColumn = ''; });
    const cs = getComputedStyle(painel);
    const colunas = cs.gridTemplateColumns.split(' ').filter(Boolean).length;
    if (colunas < 2 || filhos.length < 2) continue;
    const gap = parseFloat(cs.columnGap) || 0;
    const caixa = painel.getBoundingClientRect();
    const trilha = (caixa.width - gap * (colunas - 1)) / colunas;
    const linhas = new Map();
    for (const f of filhos) {
      const topo = Math.round(f.getBoundingClientRect().top);
      if (!linhas.has(topo)) linhas.set(topo, []);
      linhas.get(topo).push(f);
    }
    for (const linha of linhas.values()) {
      const ultimo = linha[linha.length - 1];
      const r = ultimo.getBoundingClientRect();
      const falta = Math.round((caixa.right - r.right) / (trilha + gap));
      if (falta < 1) continue;
      const atual = Math.round((r.width + gap) / (trilha + gap));
      ultimo.style.gridColumn = `span ${Math.min(colunas, atual + falta)}`;
    }
  }
}
