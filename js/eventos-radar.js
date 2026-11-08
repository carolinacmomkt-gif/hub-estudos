// Ações do Radar do nicho: criar e editar nichos, atualizar (chama a radar-background e acompanha
// a linha da config até chegar o resultado), atualizar sozinho quando o da semana está velho e
// levar um item para o Criar.

import { obterEstado, atualizarEstado } from './estado.js';
import { listar, salvar, puxarTabela } from './persistencia.js';
import { dispararSegundoPlano } from './funcoes.js';
import { confirmar } from './confirmar.js';
import { FORMATOS } from './dados-trabalho.js';
import { nichosDoRadar, sugerirNichos, conferirNicho, idDoNicho, radarVelho, chaveDoVisto, textoDoRadar, nichosPelasEscolhas, especialidade, idPeloNome } from './dados-radar.js';
import { baixar } from './exportar-caderno.js';
import { resultadoDoRadar } from './views-radar.js';

let app; // { renderizar, avisoCurto }
const pedidos = new Map(); // nicho → quando pediu (para acompanhar)
const jaAtualizados = new Set(); // atualização automática: uma vez por nicho em cada abertura do app

export function ligarRadar(funcoes) {
  app = funcoes;
  try { atualizarEstado({ radarAba: localStorage.getItem('hub.radar.aba') || 'geral' }); } catch { /* fica na visão geral */ }
}

// "Clientes e especialidades": grava a especialidade na ficha de cada cliente e monta os nichos.
async function montarPelosClientes(form) {
  const escolhas = {};
  const mudadas = [];
  const naoAchei = [];
  for (const sel of form.querySelectorAll('[name="esp"]')) {
    const id = idPeloNome(sel.value);
    if (sel.value.trim() && !id) naoAchei.push(sel.value.trim());
    escolhas[sel.dataset.cliente] = id;
    const c = (obterEstado().clientesTrabalho || []).find((x) => !x.excluido_em && x.nome === sel.dataset.cliente);
    const e = especialidade(id);
    if (c && e && c.dados?.nicho !== e.nome) mudadas.push({ ...c, dados: { ...(c.dados || {}), nicho: e.nome } });
  }
  if (naoAchei.length) { app.avisoCurto(`Não achei "${naoAchei[0]}" na lista. Digite parte do nome e escolha uma das sugestões.`); return; }
  if (!Object.values(escolhas).some(Boolean)) { app.avisoCurto('Escolha a especialidade de pelo menos uma cliente.'); return; }
  for (const c of mudadas) await salvar('clientes_trabalho', c);
  let novos = [];
  let lista = [];
  await gravarNichos((existentes) => {
    const r = nichosPelasEscolhas(existentes, escolhas);
    novos = r.novos;
    lista = r.nichos;
    return r.nichos;
  });
  const primeiro = novos[0] || lista.find((n) => n.clientes.length)?.id || lista[0]?.id;
  location.hash = primeiro ? `#radar/${primeiro}` : '#radar';
  novos.forEach((id) => atualizarRadar(id, { silencioso: true }));
  app.avisoCurto(novos.length ? `${novos.length} ${novos.length === 1 ? 'nicho criado' : 'nichos criados'}. Os radares estão sendo montados.` : 'Nichos atualizados.');
}

async function gravarNichos(fn) {
  const atual = (await listar('config', { incluirExcluidos: true })).find((c) => c.chave === 'radar');
  const valor = { ...(atual?.excluido_em ? {} : atual?.valor || {}) };
  valor.nichos = fn(nichosDoRadar([{ chave: 'radar', valor }]));
  await salvar('config', { ...(atual || {}), excluido_em: null, chave: 'radar', valor });
  atualizarEstado({ config: await listar('config') });
}

function marcarPedido(id, ligado) {
  if (ligado) pedidos.set(id, Date.now()); else pedidos.delete(id);
  atualizarEstado({ radarPedido: Object.fromEntries(pedidos) });
}

export async function atualizarRadar(id, { silencioso = false } = {}) {
  if (pedidos.has(id)) return;
  if (!navigator.onLine) { if (!silencioso) app.avisoCurto('Sem internet agora. O radar precisa de conexão.'); return; }
  marcarPedido(id, true);
  app.renderizar();
  const nicho = nichosDoRadar(obterEstado().config).find((n) => n.id === id);
  if (!nicho) { marcarPedido(id, false); return; }
  const r = await dispararSegundoPlano('radar-background', { nicho });
  if (!r.ok) {
    marcarPedido(id, false);
    app.renderizar();
    if (!silencioso) app.avisoCurto(r.erro || 'Não consegui pedir o radar agora.');
    return;
  }
  acompanhar(id);
}

// Puxa a config a cada 4 s até a função gravar o resultado (no máximo 4 minutos).
async function acompanhar(id) {
  const desde = pedidos.get(id);
  const fim = desde + 4 * 60e3;
  while (Date.now() < fim && pedidos.has(id)) {
    await new Promise((ok) => { setTimeout(ok, 4000); });
    await puxarTabela('config').catch(() => {});
    atualizarEstado({ config: await listar('config') });
    const v = resultadoDoRadar(obterEstado(), id);
    const terminou = v && v.status !== 'lendo' && Date.parse(v.gerado_em || v.pedido_em || 0) >= desde - 1000;
    if (terminou || (v?.status === 'erro' && Date.parse(v.pedido_em || 0) >= desde - 1000)) {
      marcarPedido(id, false);
      app.renderizar();
      if (v.status === 'erro') app.avisoCurto(v.erro || 'O radar não ficou pronto.');
      else if (obterEstado().rota !== 'radar') app.avisoCurto('O radar do nicho ficou pronto.');
      return;
    }
  }
  if (pedidos.has(id)) {
    marcarPedido(id, false);
    app.renderizar();
    app.avisoCurto('O radar está demorando. Ele aparece aqui quando ficar pronto.');
  }
}

// Ao abrir um nicho: se o radar é de antes desta segunda (ou tem mais de 3 dias), atualiza sozinho.
export function montarRadar(parametro) {
  const estado = obterEstado();
  const nichos = nichosDoRadar(estado.config);
  const nicho = nichos.find((n) => n.id === parametro) || (!parametro ? nichos[0] : null);
  if (!nicho || jaAtualizados.has(nicho.id) || pedidos.has(nicho.id)) return;
  const r = resultadoDoRadar(estado, nicho.id);
  if (r?.status === 'lendo' && Date.now() - Date.parse(r.pedido_em || 0) < 5 * 60e3) return;
  jaAtualizados.add(nicho.id);
  if (radarVelho(r)) atualizarRadar(nicho.id, { silencioso: true });
}

const FORMATO_DO_CRIAR = { reels: 'Reels falado', carrossel: 'Carrossel de conteúdo', stories: 'Stories de venda', post: 'Legenda' };

function levarParaCriar(id, i) {
  const estado = obterEstado();
  const x = resultadoDoRadar(estado, id)?.itens?.[i];
  if (!x) return;
  const clientes = (estado.clientesTrabalho || []).filter((c) => !c.excluido_em);
  const cliente = clientes.find((c) => x.serve_para?.includes(c.nome))
    || clientes.find((c) => nichosDoRadar(estado.config).find((n) => n.id === id)?.clientes.includes(c.nome));
  const formato = FORMATO_DO_CRIAR[String(x.formato || '').toLowerCase().split(' ')[0]] || FORMATOS[0];
  const tema = [x.tema, x.gancho ? `Gancho: ${x.gancho}` : '', x.porque ? `Por que agora: ${x.porque}` : ''].filter(Boolean).join('\n');
  atualizarEstado({ criar: { cliente: cliente?.chave || '', formato, objetivo: 'Educação', tema, titulo: x.tema, texto: '' }, criarStatus: '' });
  location.hash = '#criar';
}

// Marcar a caixa da cliente como vista (o contador de notícias novas volta a zero; segue entre aparelhos).
async function marcarVisto(nichoId, cliente) {
  const atual = (await listar('config', { incluirExcluidos: true })).find((c) => c.chave === 'radar_visto');
  // Até a notícia mais nova que ela viu (o relógio do aparelho pode estar atrás do servidor).
  const hist = resultadoDoRadar(obterEstado(), nichoId)?.noticias_hist || [];
  const ultima = Math.max(Date.now(), ...hist.map((n) => Date.parse(n.primeiro_em || 0) || 0));
  const valor = { ...(atual?.excluido_em ? {} : atual?.valor || {}), [chaveDoVisto(nichoId, cliente)]: new Date(ultima).toISOString() };
  await salvar('config', { ...(atual || {}), excluido_em: null, chave: 'radar_visto', valor });
  atualizarEstado({ config: await listar('config') });
  app.renderizar();
}

const nichoPeloId = (id) => nichosDoRadar(obterEstado().config).find((n) => n.id === id);

async function exportar(id, como, cliente) {
  const nicho = nichoPeloId(id);
  const r = resultadoDoRadar(obterEstado(), id);
  if (!nicho || !r) return;
  document.querySelectorAll('.rd-exportar[open]').forEach((d) => { d.open = false; });
  if (como === 'pdf') {
    app.avisoCurto('Montando o PDF…');
    try {
      const { blocosDoRadar, pdfDoRadar } = await import('./radar-pdf.js');
      const arquivo = await pdfDoRadar(blocosDoRadar(nicho, r, { cliente: cliente || null }));
      const dia = new Date().toISOString().slice(0, 10);
      baixar(arquivo, `radar-${nicho.id}${cliente ? `-${idDoNicho(cliente)}` : ''}-${dia}.pdf`);
      app.avisoCurto('PDF baixado.');
    } catch (erro) {
      app.avisoCurto(erro?.message || 'Não deu para montar o PDF agora.');
    }
    return;
  }
  const texto = textoDoRadar(nicho, r, { formato: como, cliente: cliente || null });
  copiar(texto, como === 'notion' ? 'Copiado. No Notion, cole numa página nova: os títulos e as listas vêm junto.' : 'Copiado. É só colar no WhatsApp.');
}

function copiar(texto, aviso) {
  navigator.clipboard?.writeText(texto).then(() => app.avisoCurto(aviso), () => app.avisoCurto('Não consegui copiar. Libere a área de transferência para a Bússola.'));
}

function sugestao(id, cliente, i) {
  return resultadoDoRadar(obterEstado(), id)?.clientes?.[cliente]?.sugestoes?.[i] || null;
}

function sugestaoParaCriar(id, cliente, i) {
  const x = sugestao(id, cliente, i);
  if (!x) return;
  const c = (obterEstado().clientesTrabalho || []).find((y) => !y.excluido_em && y.nome === cliente);
  const formato = (x.formato ? FORMATOS.find((f) => f.toLowerCase().startsWith(String(x.formato).toLowerCase())) : null) || FORMATO_DO_CRIAR[String(x.formato || '').toLowerCase().split(' ')[0]] || FORMATOS[0];
  const objetivo = { 'técnico': 'Educação', posicionamento: 'Posicionamento', 'conexão': 'Conexão', venda: 'Venda' }[String(x.linha || '').toLowerCase()] || 'Educação';
  const tema = [x.titulo, x.noticia ? `Notícia: ${x.noticia.titulo} (${x.noticia.link})` : '', x.caso ? `O caso: ${x.caso}` : '', x.gap ? `Gap: ${x.gap}` : '', x.estrutura ? `Estrutura: ${x.estrutura}` : '', x.porque_agora ? `Por que agora: ${x.porque_agora}` : ''].filter(Boolean).join('\n');
  const texto = [x.gancho, ...(x.esqueleto || []), x.cta ? `CTA: ${x.cta}` : ''].filter(Boolean).join('\n\n');
  atualizarEstado({ criar: { cliente: c?.chave || '', formato, objetivo, tema, titulo: x.titulo, texto }, criarStatus: x.cuidado ? `Cuidado: ${x.cuidado}` : '' });
  location.hash = '#criar';
}

async function salvarNicho(form) {
  const erro = form.querySelector('[data-erro]');
  const el = form.elements;
  const antigo = form.dataset.id || '';
  const nicho = conferirNicho({ id: antigo || idDoNicho(el.nome.value), nome: el.nome.value, palavras: el.palavras.value, clientes: [...form.querySelectorAll('[name="clientes"]:checked')].map((c) => c.value) });
  if (!nicho.nome) { erro.textContent = 'Dê um nome ao nicho.'; erro.hidden = false; return; }
  let id = nicho.id;
  await gravarNichos((lista) => {
    if (!antigo) {
      while (lista.some((n) => n.id === id)) id = `${nicho.id}-${Math.random().toString(36).slice(2, 5)}`;
      return [...lista, { ...nicho, id }];
    }
    return lista.map((n) => (n.id === antigo ? { ...nicho, id: antigo } : n));
  });
  location.hash = `#radar/${id}`;
  if (!antigo) atualizarRadar(id);
  else app.avisoCurto('Nicho salvo. Toque em Atualizar para buscar com as palavras novas.');
}

export function cliqueRadar(alvo) {
  switch (alvo.dataset.acao) {
    case 'radar-atualizar': atualizarRadar(alvo.dataset.id); return true;
    case 'radar-aba': location.hash = `#radar/${alvo.dataset.id}`; return true;
    case 'radar-parte':
      atualizarEstado({ radarAba: alvo.dataset.parte });
      try { localStorage.setItem('hub.radar.aba', alvo.dataset.parte); } catch { /* só nesta visita */ }
      app.renderizar();
      return true;
    case 'radar-visto': marcarVisto(alvo.dataset.id, alvo.dataset.cliente || ''); return true;
    case 'radar-exportar': exportar(alvo.dataset.id, alvo.dataset.como, alvo.dataset.cliente || ''); return true;
    case 'radar-criar-sugestao': sugestaoParaCriar(alvo.dataset.id, alvo.dataset.cliente || '', Number(alvo.dataset.i)); return true;
    case 'radar-copiar-sugestao': {
      const x = sugestao(alvo.dataset.id, alvo.dataset.cliente || '', Number(alvo.dataset.i));
      if (x) copiar([x.titulo, [x.formato, x.linha, x.estrutura].filter(Boolean).join(' · '), x.noticia ? `Notícia: ${x.noticia.titulo} ${x.noticia.link}` : '', x.caso ? `O caso: ${x.caso}` : '', x.gancho ? `Gancho: ${x.gancho}` : '', x.gap ? `Gap: ${x.gap}` : '', ...x.esqueleto.map((e, j) => `${j + 1}) ${e}`), x.cta ? `CTA: ${x.cta}` : '', x.cuidado ? `Cuidado: ${x.cuidado}` : ''].filter(Boolean).join('\n'), 'Sugestão copiada.');
      return true;
    }
    case 'radar-criar': levarParaCriar(alvo.dataset.id, Number(alvo.dataset.i)); return true;
    case 'radar-sugestao':
    case 'radar-sugestoes-todas': {
      const estado = obterEstado();
      const ja = nichosDoRadar(estado.config);
      const todas = sugerirNichos((estado.clientesTrabalho || []).filter((c) => !c.excluido_em), ja);
      const escolhidas = alvo.dataset.acao === 'radar-sugestao' ? [todas[Number(alvo.dataset.i)]].filter(Boolean) : todas;
      if (!escolhidas.length) return true;
      gravarNichos((lista) => [...lista, ...escolhidas]).then(() => {
        location.hash = `#radar/${escolhidas[0].id}`;
        escolhidas.forEach((n) => atualizarRadar(n.id, { silencioso: true }));
      });
      return true;
    }
    case 'radar-excluir':
      confirmar('Excluir este nicho? O radar dele some junto. As clientes e o resto do Trabalho não mudam.', { perigo: true }).then(async (ok) => {
        if (!ok) return;
        const id = alvo.dataset.id;
        await gravarNichos((lista) => lista.filter((n) => n.id !== id));
        const linha = (await listar('config')).find((c) => c.chave === `radar:${id}`);
        if (linha) await salvar('config', { ...linha, excluido_em: new Date().toISOString() });
        location.hash = '#radar';
        app.avisoCurto('Nicho excluído.');
      });
      return true;
    default:
      return false;
  }
}

// "Novo nicho": a especialidade (escolhida na busca) preenche o nome e as palavras. Ao digitar, só
// quando o texto já é o nome de uma da lista (escolha na lista de sugestões); ao sair do campo, sempre.
export function mudancaRadar(alvo, tipo) {
  if (alvo.dataset?.acaoMudar !== 'radar-especialidade') return false;
  const e = especialidade(idPeloNome(alvo.value));
  const exato = e && e.nome.toLowerCase() === String(alvo.value).trim().toLowerCase();
  const form = alvo.form;
  if (e && form && (tipo === 'change' || exato)) {
    form.elements.nome.value = e.nome;
    form.elements.palavras.value = e.palavras.join(', ');
  }
  return true;
}

export function enviarRadar(form) {
  if (form.dataset.form === 'radar-montar') { montarPelosClientes(form); return true; }
  if (form.dataset.form !== 'radar-nicho') return false;
  salvarNicho(form);
  return true;
}
