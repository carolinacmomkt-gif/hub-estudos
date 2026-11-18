// O que a R7 faz sozinha ao abrir (Carol, 17 e 18/11/2026), com o que o robô do Google mandou:
// 1) completa a ficha dos clientes que ELA cadastrou (só os campos vazios) com o briefing, a lista do Trello
//    e o "Portfolio dos Clientes" do Trello da R7; ninguém é cadastrado sozinho ("só os que eu colocar");
// 2) põe as artes dos cards do Trello da R7 nas peças certas do cronograma (pela copy da descrição do card),
//    copiando cada imagem reduzida para a pasta dela e apagando a original do lugar do robô.
// Nada é escrito no Trello nem no Drive.

import { obterEstado, atualizarEstado } from './estado.js';
import { listar, salvar } from './persistencia.js';
import { baixarArquivo, apagarArquivo } from './nuvem.js';
import { dadosDoRobo, listaDoCliente, artesDoTrelloParaCronograma, sem, clientesDosBriefings, ehDoCliente, textoDoPortfolio, dadosDoCliente, completarFicha } from './dados-robo.js';
import { fichaR7Vazia, conferirFichaR7, fichaEmTexto, nichoDaFicha, especialidadeSugerida } from './dados-r7.js';
import { PREFIXO_CRONOGRAMA, normalizarCronograma, chaveDoCronograma } from './dados-cronograma.js';
import { reduzir, guardarArte } from './cronograma-importar.js';

const hojeIso = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
let rodando = false;

async function gravarConfig(chave, valor) {
  const linhas = await listar('config');
  const atual = linhas.find((l) => l.chave === chave && !l.excluido_em);
  await salvar('config', { ...(atual || {}), chave, valor });
}


// Uma vez: os clientes que o cadastro automático de 17/11 criou e ela não conferiu vão para a lixeira.
async function limparCadastroAutomatico() {
  const estado = obterEstado();
  const auto = (estado.config || []).find((l) => l.chave === 'r7-auto' && !l.excluido_em)?.valor || {};
  if (auto.limpo) return 0;
  const tirar = (estado.clientesTrabalho || []).filter((c) => !c.excluido_em && c.casa === 'r7' && c.dados?.r7_auto?.confira);
  for (const c of tirar) await salvar('clientes_trabalho', { ...c, excluido_em: new Date().toISOString() });
  await gravarConfig('r7-auto', { ...auto, limpo: new Date().toISOString() });
  atualizarEstado({ clientesTrabalho: await listar('clientes_trabalho'), config: await listar('config') });
  return tirar.length;
}

// Completa a ficha de cada cliente da R7 (só o que está vazio) e guarda o que preencheu em dados.r7_auto.
export async function completarFichas({ so = '' } = {}) {
  const estado = obterEstado();
  const videos = dadosDoRobo(estado.config, 'videos');
  const trello = dadosDoRobo(estado.config, 'trello');
  if (!videos && !trello) return 0;
  const briefings = videos ? clientesDosBriefings(videos, { dias: 400 }) : [];
  let mudou = 0;
  for (const c of (estado.clientesTrabalho || []).filter((x) => !x.excluido_em && x.casa === 'r7' && (!so || x.chave === so))) {
    const base = conferirFichaR7(c.dados?.r7 || fichaR7Vazia());
    const brief = briefings.find((b) => ehDoCliente(b.nome, c.nome) || ehDoCliente(c.nome, b.nome));
    const portfolio = textoDoPortfolio(trello, c.nome);
    const d = dadosDoCliente(c.nome, { portfolio, briefing: brief?.topo || '' });
    const { ficha, campos } = completarFicha(base, d, { especialidade: especialidadeSugerida(`${brief?.topo || ''} ${portfolio}`) });
    const onde = listaDoCliente(trello, c.nome);
    if (onde && !ficha.equipe?.lista) { ficha.equipe = { ...(ficha.equipe || {}), quadro: onde.quadro, lista: onde.lista }; campos.push('lista do Trello'); }
    if (!campos.length) continue;
    const r7 = conferirFichaR7(ficha);
    const dados = { ...(c.dados || {}), r7, ficha: fichaEmTexto(c.nome, r7), r7_auto: { ...(c.dados?.r7_auto || {}), confira: false, preenchido: [...new Set([...(c.dados?.r7_auto?.preenchido || []), ...campos])], em: new Date().toISOString() } };
    const nicho = nichoDaFicha(r7);
    if (nicho) dados.nicho = nicho;
    await salvar('clientes_trabalho', { ...c, dados });
    mudou += 1;
  }
  if (mudou) atualizarEstado({ clientesTrabalho: await listar('clientes_trabalho') });
  return mudou;
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
    const tirados = await limparCadastroAutomatico();
    const fichas = await completarFichas();
    const artes = await encaixarArtesDoTrello();
    atualizarEstado({ r7AutoMarca: marca });
    if (tirados || fichas || artes) {
      app?.renderizar();
      app?.avisoCurto([tirados && `${tirados} ${tirados === 1 ? 'cliente que entrou sozinho foi para a lixeira' : 'clientes que entraram sozinhos foram para a lixeira'}`, fichas && `${fichas} ${fichas === 1 ? 'ficha completada' : 'fichas completadas'} pelo Trello`, artes && `artes do Trello em ${artes} ${artes === 1 ? 'peça' : 'peças'}`].filter(Boolean).join(' · ') + '.');
    }
  } catch { /* sem internet agora: tenta na próxima abertura */ } finally {
    rodando = false;
  }
}
