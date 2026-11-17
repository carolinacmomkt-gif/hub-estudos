// O que a R7 faz sozinha ao abrir (Carol, 17/11/2026), com o que o robô do Google mandou:
// 1) cadastra os clientes que aparecem nos briefings e ainda não estão na Bússola (ficha com o selo "confira");
// 2) põe as artes dos cards do Trello da R7 nas peças certas do cronograma (pela copy da descrição do card),
//    copiando cada imagem reduzida para a pasta dela e apagando a original do lugar do robô.
// Nada é escrito no Trello nem no Drive.

import { obterEstado, atualizarEstado } from './estado.js';
import { listar, salvar } from './persistencia.js';
import { baixarArquivo, apagarArquivo } from './nuvem.js';
import { dadosDoRobo, clientesNovosDoRobo, listaDoCliente, artesDoTrelloParaCronograma, sem } from './dados-robo.js';
import { fichaR7Vazia, conferirFichaR7, fichaEmTexto, nichoDaFicha, especialidadeSugerida, chaveDoNome } from './dados-r7.js';
import { PREFIXO_CRONOGRAMA, normalizarCronograma, chaveDoCronograma } from './dados-cronograma.js';
import { reduzir, guardarArte } from './cronograma-importar.js';

const hojeIso = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
let rodando = false;

async function gravarConfig(chave, valor) {
  const linhas = await listar('config');
  const atual = linhas.find((l) => l.chave === chave && !l.excluido_em);
  await salvar('config', { ...(atual || {}), chave, valor });
}

const ehIdentidade = (nome) => /\b(idv|infos?|identidade)\b/i.test(String(nome || ''));

// A ficha que o robô consegue montar: assinatura e registro do briefing, especialidade pelo cabeçalho,
// quadro e lista do Trello, e o card de identidade (texto e a primeira cor em #hex).
export function fichaDoRobo(c, trello) {
  const f = fichaR7Vazia();
  f.identificacao.assinatura = c.assinatura || '';
  f.identificacao.especialidade = especialidadeSugerida(`${c.topo} ${c.arquivo}`) || '';
  const onde = listaDoCliente(trello, c.nome);
  if (onde) { f.equipe.quadro = onde.quadro; f.equipe.lista = onde.lista; }
  const idv = (trello?.quadros || []).flatMap((q) => q.cartoes || [])
    .find((x) => onde && sem(x.lista) === sem(onde.lista) && ehIdentidade(x.nome) && x.desc);
  if (idv) {
    f.briefing.idVisual = String(idv.desc).slice(0, 1500);
    const cor = /#[0-9a-f]{6}\b/i.exec(idv.desc);
    if (cor) f.rotina.estilo.corDestaque = cor[0].toUpperCase();
  }
  return conferirFichaR7(f);
}

export async function cadastrarDoRobo() {
  const estado = obterEstado();
  const videos = dadosDoRobo(estado.config, 'videos');
  if (!videos?.briefings?.length) return 0;
  const trello = dadosDoRobo(estado.config, 'trello');
  const todos = (estado.clientesTrabalho || []).filter((c) => !c.excluido_em);
  const r7 = todos.filter((c) => c.casa === 'r7');
  const auto = (estado.config || []).find((l) => l.chave === 'r7-auto' && !l.excluido_em)?.valor || {};
  const novos = clientesNovosDoRobo(videos, r7, auto.vistos || [], { hoje: hojeIso() }).slice(0, 15);
  if (!novos.length) return 0;
  const usadas = new Set(todos.map((c) => c.chave));
  for (const c of novos) {
    let chave = `r7-${chaveDoNome(c.nome)}`;
    for (let i = 2; usadas.has(chave); i += 1) chave = `r7-${chaveDoNome(c.nome)}-${i}`;
    usadas.add(chave);
    const ficha = fichaDoRobo(c, trello);
    const dados = { r7: ficha, ficha: fichaEmTexto(c.nome, ficha), memoria: [], r7_auto: { em: new Date().toISOString(), de: c.arquivo, confira: true } };
    const nicho = nichoDaFicha(ficha);
    if (nicho) dados.nicho = nicho;
    await salvar('clientes_trabalho', { chave, nome: c.nome, casa: 'r7', dados });
  }
  await gravarConfig('r7-auto', { ...auto, vistos: [...new Set([...(auto.vistos || []), ...novos.map((c) => c.chave)])].slice(-300) });
  atualizarEstado({ clientesTrabalho: await listar('clientes_trabalho'), config: await listar('config') });
  return novos.length;
}

// Artes do Trello → peças do cronograma (cronogramas que ainda não acabaram há mais de 3 semanas).
export async function encaixarArtesDoTrello() {
  const estado = obterEstado();
  const trello = dadosDoRobo(estado.config, 'trello');
  if (!trello?.quadros?.some((q) => (q.cartoes || []).some((c) => c.anexos?.length))) return 0;
  const limite = new Date(Date.now() - 21 * 864e5).toISOString().slice(0, 10);
  const clientes = (estado.clientesTrabalho || []).filter((c) => !c.excluido_em && c.casa === 'r7');
  let postas = 0;
  for (const linha of (estado.config || []).filter((l) => !l.excluido_em && String(l.chave).startsWith(PREFIXO_CRONOGRAMA))) {
    const cron = normalizarCronograma(linha.valor);
    if (!cron.fim || cron.fim < limite) continue;
    const c = clientes.find((x) => x.chave === cron.cliente);
    if (!c) continue;
    const pares = artesDoTrelloParaCronograma(cron, trello, { nome: c.nome, lista: c.dados?.r7?.equipe?.lista || '' });
    let mudou = false;
    for (const par of pares) {
      const p = cron.pecas.find((x) => x.id === par.peca);
      const ja = new Set((p.artes || []).filter((a) => a.origem === 'trello').map((a) => a.anexo));
      if (par.anexos.every((a) => ja.has(a.id))) continue;
      const artes = [];
      for (const [n, a] of par.anexos.entries()) {
        const existente = (p.artes || []).find((x) => x.anexo === a.id);
        if (existente) { artes.push(existente); continue; }
        try {
          const blob = await baixarArquivo(a.caminho, 'robo-r7');
          const caminho = await guardarArte(await reduzir(blob), { cliente: c.chave, inicio: cron.inicio, peca: p.id, n: n + 1 });
          artes.push({ caminho, origem: 'trello', anexo: a.id, cartao: par.cartao });
          apagarArquivo(a.caminho, 'robo-r7');
        } catch { /* a original já foi copiada e apagada, ou ainda não chegou: fica para a próxima */ }
      }
      if (artes.length) { p.artes = artes; mudou = true; postas += 1; }
    }
    if (mudou) await salvar('config', { ...linha, chave: chaveDoCronograma(cron.cliente, cron.inicio), valor: normalizarCronograma({ ...cron, atualizado_em: new Date().toISOString() }) });
  }
  if (postas) atualizarEstado({ config: await listar('config') });
  return postas;
}

// Roda as duas, uma vez por abertura da R7 (e de novo quando o robô mandar algo novo).
export async function rodarAutomaticoR7(app) {
  if (rodando) return;
  const estado = obterEstado();
  const marca = ['videos', 'trello'].map((t) => dadosDoRobo(estado.config, t)?.recebido_em || '').join('|');
  if (marca === estado.r7AutoMarca) return;
  rodando = true;
  try {
    const cadastrados = await cadastrarDoRobo();
    const artes = await encaixarArtesDoTrello();
    atualizarEstado({ r7AutoMarca: marca });
    if (cadastrados || artes) {
      app?.renderizar();
      app?.avisoCurto([cadastrados && `${cadastrados} ${cadastrados === 1 ? 'cliente cadastrado' : 'clientes cadastrados'} pelos briefings`, artes && `artes do Trello em ${artes} ${artes === 1 ? 'peça' : 'peças'}`].filter(Boolean).join(' · ') + '. Confira.');
    }
  } catch { /* sem internet agora: tenta na próxima abertura */ } finally {
    rodando = false;
  }
}
