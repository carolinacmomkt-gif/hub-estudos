// Menu lateral (tablet/computador), barra inferior e folha "Mais" (celular), e a tela "Editar menu".
// Grupos com título que abrem e fecham, favoritos no topo; o menu pode ficar aberto, só com
// os ícones ou escondido (o botão ☰ traz de volta).

import { icone } from './icones.js';
import { ROTAS, ROTA_CONFIGURACOES } from './rotas.js';
import { esc } from './utilidades.js';
import {
  organizacaoDoMenu, mudarMenu, modoDoMenu, definirModoDoMenu, proximoModo, rotaPeloId, MODOS_MENU, MAX_CELULAR,
} from './menu.js';

function link(rota, { rotulo = true, curto = false } = {}) {
  return `
    <li>
      <a class="nav-link" href="#${rota.id}" data-rota="${rota.id}" data-rotulo="${esc(rota.titulo)}" title="${esc(rota.titulo)}">
        ${icone(rota.icone)}<span class="nav-nome">${rotulo ? esc(curto && rota.curto ? rota.curto : rota.titulo) : ''}</span>
      </a>
    </li>`;
}

const lista = (ids) => `<ul class="nav-lista">${ids.map(rotaPeloId).filter(Boolean).map((r) => link(r)).join('')}</ul>`;

function grupos(org) {
  return org.grupos.map((g) => {
    const itens = g.itens.filter((id) => !org.escondidos.has(id));
    if (!itens.length) return '';
    return `
      <section class="nav-grupo${g.aberto ? '' : ' fechado'}">
        <button class="nav-grupo-titulo" type="button" data-acao="menu-grupo" data-id="${esc(g.id)}" aria-expanded="${g.aberto}">
          <span>${esc(g.nome)}</span>${icone('seta')}
        </button>
        ${lista(itens)}
      </section>`;
  }).join('');
}

const situacao = '<p class="situacao-sinc" data-situacao-curta><span class="situacao-ponto" aria-hidden="true"></span><span class="situacao-texto"></span></p>';

export function montarNavegacao() {
  const org = organizacaoDoMenu();
  const modo = modoDoMenu();
  document.body.dataset.menu = modo;
  document.getElementById('nav-lateral').innerHTML = `
    <div class="nav-topo">
      <a class="marca" href="#inicio" aria-label="Bússola, ir para Hoje">
        <span class="marca-icone">${icone('marca')}</span>
        <span class="marca-texto">
          <span class="marca-nome">Bússola</span>
          <span class="marca-sub">da Carol</span>
        </span>
      </a>
      <button class="nav-recolher botao-icone" type="button" data-acao="menu-modo" aria-label="${modo === 'aberto' ? 'Mostrar só os ícones' : 'Esconder o menu'}" title="${modo === 'aberto' ? 'Mostrar só os ícones' : 'Esconder o menu'} (Ctrl + \\)">${icone('recolher')}</button>
    </div>
    ${org.favoritos.length ? `<section class="nav-grupo nav-favoritos"><p class="nav-grupo-titulo nav-grupo-fixo">${icone('estrela')}<span>Favoritos</span></p>${lista(org.favoritos)}</section>` : ''}
    <div class="nav-grupos">${grupos(org)}</div>
    <div class="nav-rodape">
      ${situacao}
      <ul class="nav-lista">
        ${link(ROTA_CONFIGURACOES)}
        <li><button class="nav-link" type="button" data-acao="menu-editar" data-rotulo="Editar menu" title="Editar menu">${icone('editar')}<span class="nav-nome">Editar menu</span></button></li>
      </ul>
    </div>`;

  let voltar = document.getElementById('menu-voltar');
  if (!voltar) {
    // Girar o tablet troca de "tipo de tela": cada um lembra o seu jeito de menu.
    let ultimo = window.innerWidth >= 1100;
    window.addEventListener('resize', () => {
      if ((window.innerWidth >= 1100) !== ultimo) {
        ultimo = !ultimo;
        montarNavegacao();
        marcarRotaAtiva(location.hash.replace(/^#\/?/, '').split('/')[0] || 'inicio');
      }
    });
    voltar = document.createElement('button');
    voltar.id = 'menu-voltar';
    voltar.className = 'menu-voltar botao-icone';
    voltar.type = 'button';
    voltar.dataset.acao = 'menu-mostrar';
    voltar.setAttribute('aria-label', 'Mostrar o menu');
    voltar.title = 'Mostrar o menu (Ctrl + \\)';
    voltar.innerHTML = icone('menu');
    document.body.append(voltar);
  }

  document.getElementById('nav-inferior').innerHTML = `
    <ul class="nav-lista">
      ${org.celular.map(rotaPeloId).filter(Boolean).map((r) => link(r, { curto: true })).join('')}
      <li>
        <button class="nav-link" type="button" data-acao="abrir-mais" aria-haspopup="dialog" title="Todas as áreas">
          ${icone('mais')}<span class="nav-nome">Mais</span>
        </button>
      </li>
    </ul>`;

  // Folha "⋯" (celular): todas as áreas, em grupos, com o nome ao lado do ícone.
  const resto = { ...org, grupos: org.grupos.map((g) => ({ ...g, aberto: true })) };
  document.getElementById('folha-mais-lista').innerHTML = `
    ${grupos(resto).replaceAll('data-acao="menu-grupo"', 'disabled')}
    <ul class="nav-lista">${link(ROTA_CONFIGURACOES)}
      <li><button class="nav-link" type="button" data-acao="menu-editar">${icone('editar')}<span class="nav-nome">Editar menu</span></button></li></ul>
    ${situacao}`;
}

const TEXTO_CURTO = {
  local: 'Modo local',
  offline: 'Sem internet',
  sincronizando: 'Sincronizando…',
  erro: 'Erro ao sincronizar',
  aviso: 'Falta atualizar o banco',
  ok: 'Sincronizado',
  ocioso: 'Sincronizado',
  sair: 'Entre para sincronizar',
};

// Indicador pequeno no menu e na folha "Mais".
export function atualizarIndicadorSincronizacao(s) {
  let estado = s.estado;
  if (!s.nuvem) estado = 'local';
  else if (!s.logada) estado = 'sair';
  else if (!s.online) estado = 'offline';
  document.querySelectorAll('[data-situacao-curta]').forEach((el) => {
    el.dataset.estado = estado;
    const texto = TEXTO_CURTO[estado] || '';
    el.querySelector('.situacao-texto').textContent = s.pendentes && estado !== 'sincronizando' ? `${texto} · ${s.pendentes} na fila` : texto;
    el.title = texto;
  });
  document.getElementById('faixa-offline').hidden = s.online !== false || !s.nuvem;
}

export function marcarRotaAtiva(id) {
  document.querySelectorAll('[data-rota]').forEach((el) => {
    if (el.dataset.rota === id) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
  const naBarra = organizacaoDoMenu().celular;
  document.querySelector('[data-acao="abrir-mais"]')?.setAttribute('data-ativo', naBarra.includes(id) ? 'nao' : 'sim');
}

// ---------------------------------------------------------------------------
// Editar menu (folha)
// ---------------------------------------------------------------------------

export function renderEditarMenu() {
  const org = organizacaoDoMenu();
  const opcoesGrupo = (atual) => org.grupos.map((g) => `<option value="${esc(g.id)}"${g.id === atual ? ' selected' : ''}>${esc(g.nome)}</option>`).join('');
  return `
    <div class="editar-menu">
      <p class="campo-ajuda">Junte as áreas nos grupos que quiser, mude a ordem, esconda o que não usa e marque ★ para fixar no topo.</p>
      ${org.grupos.map((g, gi) => `
        <section class="editar-grupo">
          <div class="editar-grupo-topo">
            <label class="visualmente-oculto" for="grupo-${esc(g.id)}">Nome do grupo</label>
            <input id="grupo-${esc(g.id)}" type="text" maxlength="30" value="${esc(g.nome)}" data-acao-mudar="menu-grupo-nome" data-id="${esc(g.id)}">
            <button class="botao-icone botao-icone-p" type="button" data-acao="menu-grupo-mover" data-id="${esc(g.id)}" data-passo="-1" aria-label="Subir o grupo ${esc(g.nome)}"${gi === 0 ? ' disabled' : ''}>↑</button>
            <button class="botao-icone botao-icone-p" type="button" data-acao="menu-grupo-mover" data-id="${esc(g.id)}" data-passo="1" aria-label="Descer o grupo ${esc(g.nome)}"${gi === org.grupos.length - 1 ? ' disabled' : ''}>↓</button>
            <button class="botao-icone botao-icone-p" type="button" data-acao="menu-grupo-excluir" data-id="${esc(g.id)}" aria-label="Excluir o grupo ${esc(g.nome)}"${org.grupos.length <= 1 ? ' disabled' : ''}>×</button>
          </div>
          ${g.itens.length ? `<ul class="editar-itens">${g.itens.map((id, i) => {
            const r = rotaPeloId(id);
            const escondido = org.escondidos.has(id);
            return `
            <li class="editar-item${escondido ? ' escondido' : ''}">
              ${icone(r.icone)}<span class="editar-item-nome">${esc(r.titulo)}</span>
              <button class="botao-icone botao-icone-p" type="button" data-acao="menu-favorito" data-id="${id}" aria-pressed="${org.favoritos.includes(id)}" aria-label="${org.favoritos.includes(id) ? 'Tirar dos favoritos' : 'Fixar no topo'}: ${esc(r.titulo)}">${org.favoritos.includes(id) ? '★' : '☆'}</button>
              <button class="botao-icone botao-icone-p" type="button" data-acao="menu-item-mover" data-id="${id}" data-passo="-1" aria-label="Subir ${esc(r.titulo)}"${i === 0 ? ' disabled' : ''}>↑</button>
              <button class="botao-icone botao-icone-p" type="button" data-acao="menu-item-mover" data-id="${id}" data-passo="1" aria-label="Descer ${esc(r.titulo)}"${i === g.itens.length - 1 ? ' disabled' : ''}>↓</button>
              ${id === 'inicio' ? '' : `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="menu-esconder" data-id="${id}">${escondido ? 'Mostrar' : 'Esconder'}</button>`}
              <label class="visualmente-oculto" for="grupo-de-${id}">Grupo de ${esc(r.titulo)}</label>
              <select id="grupo-de-${id}" data-acao-mudar="menu-item-grupo" data-id="${id}">${opcoesGrupo(g.id)}</select>
            </li>`;
          }).join('')}</ul>` : '<p class="campo-ajuda">Grupo vazio. Escolha este grupo no campo de uma área para pôr ela aqui.</p>'}
        </section>`).join('')}
      <button class="botao botao-secundario botao-pequeno" type="button" data-acao="menu-grupo-novo">+ Grupo</button>
      <h3 class="ava-subtitulo">Barra de baixo do celular (até ${MAX_CELULAR})</h3>
      <div class="grupo-marcar grupo-marcar-linha">${ROTAS.filter((r) => !org.escondidos.has(r.id)).map((r) => `
        <label class="campo-marcar"><input type="checkbox" data-acao-mudar="menu-celular" value="${r.id}"${org.celular.includes(r.id) ? ' checked' : ''}><span>${esc(r.titulo)}</span></label>`).join('')}
      </div>
      <h3 class="ava-subtitulo">Jeito do menu neste aparelho</h3>
      <div class="segmentado">${MODOS_MENU.map((m) => `<button type="button" data-acao="menu-definir-modo" data-valor="${m.id}" aria-pressed="${modoDoMenu() === m.id}">${esc(m.nome)}</button>`).join('')}</div>
      <div class="acoes"><button class="botao botao-primario" type="button" data-acao="cal-fechar">Pronto</button></div>
    </div>`;
}

function abrirEditor() {
  document.getElementById('folha-mais')?.close();
  document.getElementById('folha-evento-titulo').textContent = 'Editar menu';
  document.getElementById('folha-evento-conteudo').innerHTML = renderEditarMenu();
  const folha = document.getElementById('folha-evento');
  if (!folha.open) folha.showModal();
}

async function mudarERedesenhar(fn) {
  await mudarMenu(fn);
  const { atualizarEstado } = await import('./estado.js');
  atualizarEstado({ config: await (await import('./persistencia.js')).listar('config') });
  montarNavegacao();
  marcarRotaAtiva(location.hash.replace(/^#\/?/, '').split('/')[0] || 'inicio');
  const conteudo = document.getElementById('folha-evento-conteudo');
  if (document.getElementById('folha-evento').open && conteudo.querySelector('.editar-menu')) {
    const rolagem = conteudo.scrollTop;
    conteudo.innerHTML = renderEditarMenu();
    conteudo.scrollTop = rolagem;
  }
}

const mover = (lista, i, passo) => {
  const j = i + passo;
  if (i < 0 || j < 0 || j >= lista.length) return;
  [lista[i], lista[j]] = [lista[j], lista[i]];
};

export function alternarMenu() {
  const modo = modoDoMenu();
  definirModoDoMenu(modo === 'oculto' ? 'aberto' : 'oculto');
  montarNavegacao();
}

export function cliqueMenu(alvo) {
  const { acao, id } = alvo.dataset;
  if (!acao?.startsWith('menu-')) return false;
  switch (acao) {
    case 'menu-modo':
      definirModoDoMenu(proximoModo(modoDoMenu()));
      montarNavegacao();
      break;
    case 'menu-mostrar':
      definirModoDoMenu('aberto');
      montarNavegacao();
      document.querySelector('#nav-lateral .nav-link')?.focus();
      break;
    case 'menu-definir-modo':
      definirModoDoMenu(alvo.dataset.valor);
      montarNavegacao();
      abrirEditor();
      break;
    case 'menu-editar':
      abrirEditor();
      break;
    case 'menu-grupo':
      // Abre e fecha na hora; a escolha fica guardada.
      alvo.closest('.nav-grupo')?.classList.toggle('fechado');
      alvo.setAttribute('aria-expanded', String(!alvo.closest('.nav-grupo')?.classList.contains('fechado')));
      mudarMenu((v) => { const g = v.grupos.find((x) => x.id === id); if (g) g.aberto = !g.aberto; });
      break;
    case 'menu-grupo-mover':
      mudarERedesenhar((v) => mover(v.grupos, v.grupos.findIndex((g) => g.id === id), Number(alvo.dataset.passo)));
      break;
    case 'menu-grupo-excluir':
      mudarERedesenhar((v) => {
        const i = v.grupos.findIndex((g) => g.id === id);
        if (i < 0 || v.grupos.length <= 1) return;
        const [g] = v.grupos.splice(i, 1);
        v.grupos[Math.max(0, i - 1)].itens.push(...g.itens);
      });
      break;
    case 'menu-grupo-novo':
      mudarERedesenhar((v) => v.grupos.push({ id: `g${Date.now().toString(36)}`, nome: 'Novo grupo', aberto: true, itens: [] }));
      break;
    case 'menu-item-mover':
      mudarERedesenhar((v) => {
        const g = v.grupos.find((x) => x.itens.includes(id));
        if (g) mover(g.itens, g.itens.indexOf(id), Number(alvo.dataset.passo));
      });
      break;
    case 'menu-esconder':
      mudarERedesenhar((v) => {
        v.escondidos = v.escondidos.includes(id) ? v.escondidos.filter((x) => x !== id) : [...v.escondidos, id];
      });
      break;
    case 'menu-favorito':
      mudarERedesenhar((v) => {
        v.favoritos = v.favoritos.includes(id) ? v.favoritos.filter((x) => x !== id) : [...v.favoritos, id];
      });
      break;
    default:
      return false;
  }
  return true;
}

export function mudancaMenu(alvo, tipo) {
  const acao = alvo.dataset?.acaoMudar;
  if (!acao?.startsWith('menu-')) return false;
  if (tipo !== 'change') return true;
  const id = alvo.dataset.id;
  if (acao === 'menu-grupo-nome') {
    const nome = alvo.value.trim().slice(0, 30);
    if (nome) mudarERedesenhar((v) => { const g = v.grupos.find((x) => x.id === id); if (g) g.nome = nome; });
  } else if (acao === 'menu-item-grupo') {
    mudarERedesenhar((v) => {
      for (const g of v.grupos) g.itens = g.itens.filter((x) => x !== alvo.dataset.id);
      v.grupos.find((g) => g.id === alvo.value)?.itens.push(alvo.dataset.id);
    });
  } else if (acao === 'menu-celular') {
    const marcados = [...document.querySelectorAll('[data-acao-mudar="menu-celular"]:checked')].map((c) => c.value);
    if (marcados.length > MAX_CELULAR) {
      alvo.checked = false;
      return true;
    }
    mudarERedesenhar((v) => { v.celular = marcados; });
  }
  return true;
}
