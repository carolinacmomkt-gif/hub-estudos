// Avisos no aparelho, NO MÁXIMO 2 POR DIA (Carol, 16 e 17/11/2026, para gastar menos crédito da
// Netlify e não encher o celular): às 16h45 sai o "Fim da tarde" só se tiver pendência (as entregas da
// R7 do dia e as tarefas de hoje abertas). Às 7h45 de Brasília a função olha o dia inteiro de uma vez (prazos, contas, hábitos,
// remédios com os horários, consultas, trabalho, datas) e manda um aviso só, "Seu dia". O resumo da
// semana continua num aviso próprio, no dia escolhido. Cada coisa sai uma vez por dia (as marcas
// continuam em config "avisos_vida_enviados" e na tabela avisos_enviados).

import { banco } from '../lib/supabase.mjs';
import { avisosDevidos, montarNotificacoes, enviarPush, configDeAvisos, chaveEnviado, ErroPush } from '../lib/avisos.mjs';
import { avisosDaVida } from '../lib/avisos-vida.mjs';
import { resumoDevido, resumoDaSemana, textoDaNotificacao } from '../../js/dados-resumo.js';
import { normalizarCronograma } from '../../js/dados-cronograma.js';
import { videosDoCliente } from '../../js/dados-robo.js';

const DIA = 24 * 60 * 60 * 1000;

// Resumo da semana (domingo à noite, ou segunda de manhã): uma notificação por semana.
export async function enviarResumoDaUsuaria(userId, assinaturas, valorAvisos, agora = Date.now()) {
  const fuso = configDeAvisos(valorAvisos).fuso;
  const [marca] = await banco.listar('config', userId, 'chave=eq.resumo_enviado');
  const semana = resumoDevido({ config: valorAvisos?.resumo, agora, fuso, ultimaSemana: marca?.valor?.semana });
  if (!semana) return { enviado: false };
  const de = new Date(semana.inicio).toISOString();
  const ate = new Date(semana.fim).toISOString();
  const depois = new Date(semana.fim + 7 * DIA).toISOString();
  const entre = (campo, a = de, b = ate) => `${campo}=gte.${a}&${campo}=lt.${b}`;
  const ler = (tabela, filtro) => banco.listar(tabela, userId, filtro).catch(() => []); // tabela que ainda não existe: segue sem ela
  const [sessoes, artigos, pautas, videos, eventos, disciplinas, areas, cadernos] = await Promise.all([
    ler('sessoes_foco', entre('inicio')), ler('artigos', entre('lido_em')),
    ler('pautas_substack', entre('publicado_em')), ler('videos', entre('data_publicacao')), ler('eventos', entre('inicio', de, depois)),
    ler('disciplinas', ''), ler('areas', ''), ler('cadernos', entre('atualizado_em')),
  ]);
  const r = resumoDaSemana({ sessoes, artigos, pautas, videos, eventos, disciplinas, areas, cadernos }, semana);
  const n = { ...textoDaNotificacao(r), tag: `resumo-${semana.chave}`, url: `/#resumo/${semana.chave}` };
  let entregue = false;
  for (const assinatura of assinaturas) {
    if ((await enviarPush(assinatura, n)) === 'ok') entregue = true;
  }
  if (entregue) {
    await banco.gravar('config', [{ user_id: userId, chave: 'resumo_enviado', valor: { semana: semana.chave } }], 'user_id,chave');
  }
  return { enviado: entregue };
}

// Os momentos de hoje (no fuso dela), de 15 em 15 minutos, das 6h às 23h45: a função roda uma vez
// e pergunta "o que avisaria em cada um deles?", para nada do dia ficar de fora.
export function momentosDoDia(agora, fuso) {
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(agora)).reduce((o, p) => ({ ...o, [p.type]: p.value }), {});
  const comoUtc = Date.UTC(+local.year, +local.month - 1, +local.day, +local.hour, +local.minute);
  const desvio = comoUtc - Math.floor(agora / 60000) * 60000; // quanto o fuso está à frente do UTC
  const meiaNoite = Date.UTC(+local.year, +local.month - 1, +local.day) - desvio;
  const saida = [];
  for (let m = 6 * 60; m < 24 * 60; m += 15) saida.push(meiaNoite + m * 60000);
  return saida;
}

// Avisos do dia a dia: tudo o que o dia pede, sem mandar (quem manda é o "Seu dia").
export async function avisosDaVidaDoDia(userId, valorAvisos, agora = Date.now()) {
  const fuso = configDeAvisos(valorAvisos).fuso;
  const [marca] = await banco.listar('config', userId, 'chave=eq.avisos_vida_enviados');
  const enviados = new Set(marca?.valor?.chaves || []);
  const semana = new Date(agora - 8 * DIA).toISOString().slice(0, 10);
  const ler = (tabela, filtro = '') => banco.listar(tabela, userId, filtro).catch(() => []); // tabela que ainda não existe: segue sem ela
  const [tarefas, financas, habitos, registros, eventos, [meuDia], [cantinhoCfg], [cuidarCfg], [pessoasCfg], conteudos, clientesTrabalho, [trabalhoCfg], [datasCfg]] = await Promise.all([
    ler('tarefas', 'feita_em=is.null'), ler('financas'), ler('habitos'), ler('habito_registros', `data=gte.${semana}`),
    ler('eventos', `inicio=gte.${new Date(agora - DIA).toISOString()}&inicio=lt.${new Date(agora + 2 * DIA).toISOString()}`),
    ler('config', 'chave=eq.meu_dia'),
    ler('config', 'chave=eq.cantinho'),
    ler('config', 'chave=eq.cuidar'),
    ler('config', 'chave=eq.pessoas'),
    ler('conteudos', 'excluido_em=is.null'),
    ler('clientes_trabalho', 'excluido_em=is.null'),
    ler('config', 'chave=eq.trabalho'),
    ler('config', 'chave=eq.datas_especiais'),
  ]);
  const dados = { tarefas, financas, habitos, registros, eventos, meuDia: meuDia?.valor, cantinho: cantinhoCfg?.valor, cuidar: cuidarCfg?.valor, pessoas: pessoasCfg?.valor?.lista || [], conteudos, clientesTrabalho, configTrabalho: trabalhoCfg?.valor || {}, datasEspeciais: datasCfg?.valor || {} };
  const vistos = new Set(enviados);
  const notificacoes = [];
  for (const t of momentosDoDia(agora, fuso)) {
    for (const n of avisosDaVida({ dados, config: valorAvisos?.vida, fuso, agora: t, enviados: vistos })) {
      if (vistos.has(n.chave)) continue;
      vistos.add(n.chave);
      notificacoes.push(n);
    }
  }
  return { notificacoes, enviados };
}
async function anotarVida(userId, enviados, entregues, agora, fuso) {
  if (!entregues.size) return;
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: fuso }).format(new Date(agora));
  const doDia = [...enviados].filter((c) => c.includes(`:${hoje}`));
  await banco.gravar('config', [{ user_id: userId, chave: 'avisos_vida_enviados', valor: { chaves: [...new Set([...doDia, ...entregues])] } }], 'user_id,chave');
}

// Prazos da faculdade e eventos (3 dias antes, véspera, no dia), pelo dia inteiro.
async function prazosDoDia(userId, config, agora) {
  const janela = `inicio=gte.${new Date(agora - DIA).toISOString()}&inicio=lt.${new Date(agora + 5 * DIA).toISOString()}`;
  const [arquivo] = await banco.listar('config', userId, 'chave=eq.faculdade_arquivo').catch(() => []);
  // Faculdade no arquivo: os prazos do AVA, do Lyceum e do calendário acadêmico não avisam mais.
  const eventos = (await banco.listar('eventos', userId, janela))
    .filter((e) => !arquivo?.valor?.arquivada || !['ava', 'ics', 'lyceum', 'academico'].includes(e.origem));
  const enviados = new Set((await banco.listarTodas('avisos_enviados', `user_id=eq.${userId}&enviado_em=gte.${new Date(agora - 10 * DIA).toISOString()}`))
    .map((l) => chaveEnviado(l.evento_id, l.marco, l.data_evento)));
  const devidos = [];
  for (const t of momentosDoDia(agora, config.fuso)) {
    for (const d of avisosDevidos({ eventos, config, agora: t, enviados })) {
      const k = chaveEnviado(d.evento.id, d.marco, d.evento.inicio);
      if (enviados.has(k)) continue;
      enviados.add(k);
      devidos.push(d);
    }
  }
  if (!devidos.length) return { devidos, notificacoes: [] };
  const disciplinas = new Map((await banco.listar('disciplinas', userId)).map((d) => [d.id, d.nome]));
  return { devidos, notificacoes: montarNotificacoes(devidos, { nomeDisciplina: (id) => disciplinas.get(id) || '', fuso: config.fuso }) };
}

// Uma linha do "Seu dia" para cada aviso (remédio vira "Nome às 14:00").
export function linhaDoDia(n) {
  const remedio = String(n.chave || '').startsWith('remedio:') && /^Hora de (.+)$/.exec(n.titulo || '');
  if (remedio) return `${remedio[1]} às ${String(n.texto || '').slice(0, 5)}`;
  return String(n.titulo || '').trim();
}
export function avisoDoDia(lista, hoje) {
  const linhas = [...new Set(lista.map(linhaDoDia).filter(Boolean))];
  const mostrar = linhas.slice(0, 6);
  const resto = linhas.length - mostrar.length;
  return {
    titulo: `Seu dia · ${linhas.length} ${linhas.length === 1 ? 'coisa' : 'coisas'}`,
    texto: [...mostrar, ...(resto > 0 ? [`e mais ${resto}`] : [])].join('\n'),
    tag: `dia-${hoje}`,
    url: '/#inicio',
  };
}

// Segunda: a demanda de vídeos da R7 (o robô do Google lê o Drive às 6h) entra no "Seu dia".
export function linhaDaDemanda({ clientes = [], robo, pedidos = [], hoje }) {
  if (!robo || new Date(`${hoje}T12:00:00Z`).getUTCDay() !== 1) return null;
  const linhas = clientes.map((c) => videosDoCliente(c.nome, robo, pedidos, { porSemana: c.dados?.r7?.rotina?.videos?.porSemana || 2, hoje }));
  const pedir = linhas.filter((l) => l.pedir.length).length;
  const captar = linhas.filter((l) => l.captacao === 'acabou').length;
  if (!pedir && !captar) return null;
  return { chave: `r7-videos:${hoje}`, titulo: `Demanda de vídeos: ${pedir} ${pedir === 1 ? 'cliente' : 'clientes'}${captar ? `, ${captar} sem vídeo (pedir captação)` : ''}` };
}

async function linhaDosVideos(userId, hoje) {
  if (new Date(`${hoje}T12:00:00Z`).getUTCDay() !== 1) return null;
  const [clientes, linhasRobo, linhasPedidos] = await Promise.all([
    banco.listar('clientes_trabalho', userId, 'casa=eq.r7&excluido_em=is.null'),
    banco.listar('config', userId, 'chave=eq.r7-robo:videos'),
    banco.listar('config', userId, 'chave=eq.r7-videos'),
  ]);
  return linhaDaDemanda({ clientes, robo: linhasRobo[0]?.valor?.dados, pedidos: linhasPedidos[0]?.valor?.pedidos || [], hoje });
}

export async function enviarAvisosDaUsuaria(userId, assinaturas, agora = Date.now()) {
  const [linhaConfig] = await banco.listar('config', userId, 'chave=eq.avisos');
  const config = configDeAvisos(linhaConfig?.valor);
  // Resumo da semana: no dia escolhido, de manhã (o horário não importa mais, a função roda uma vez).
  const fimDoDia = momentosDoDia(agora, config.fuso).at(-1);
  await enviarResumoDaUsuaria(userId, assinaturas, linhaConfig?.valor, fimDoDia).catch((erro) => console.error('resumo:', erro?.message));
  const vida = await avisosDaVidaDoDia(userId, linhaConfig?.valor, agora).catch((erro) => { console.error('avisos do dia:', erro?.message); return { notificacoes: [], enviados: new Set() }; });
  const prazos = await prazosDoDia(userId, config, agora).catch((erro) => { console.error('prazos:', erro?.message); return { devidos: [], notificacoes: [] }; });
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: config.fuso }).format(new Date(agora));
  const r7 = await linhaDosVideos(userId, hoje).catch(() => null);
  const todas = [...(r7 ? [r7] : []), ...prazos.notificacoes, ...vida.notificacoes];
  if (!todas.length) return { enviados: 0 };
  const aviso = avisoDoDia(todas, hoje);
  let entregue = false;
  for (const assinatura of assinaturas) {
    const r = await enviarPush(assinatura, aviso);
    if (r === 'expirada') { await banco.apagar('assinaturas_push', `user_id=eq.${userId}&id=eq.${assinatura.id}`); continue; }
    if (r === 'ok') entregue = true;
  }
  if (!entregue) return { enviados: 0 };
  await anotarVida(userId, vida.enviados, new Set(vida.notificacoes.map((n) => n.chave)), agora, config.fuso);
  if (prazos.devidos.length) {
    await banco.gravar('avisos_enviados', prazos.devidos.map((d) => ({
      user_id: userId, evento_id: d.evento.id, marco: d.marco, data_evento: d.evento.inicio,
    })), 'user_id,evento_id,marco,data_evento');
  }
  return { enviados: 1, itens: todas.length };
}

// "Fim da tarde" (16h45): as etapas da R7 que vencem hoje (esboço na terça e na quarta, entrega na quinta,
// envio na sexta) para os cronogramas que começam nos próximos 10 dias, e as tarefas de hoje abertas.
// Sem pendência, não manda nada.
export function avisoDaTarde({ hoje, diaDaSemana, cronogramas = [], tarefasAbertas = 0 }) {
  const ate = new Date(Date.parse(`${hoje}T12:00:00Z`) + 10 * DIA).toISOString().slice(0, 10);
  const proximos = cronogramas.map((v) => normalizarCronograma(v)).filter((c) => c.inicio > hoje && c.inicio <= ate);
  const etapa = { 2: ['esboco', 'Apresentar o esboço à R7'], 3: ['esboco', 'Apresentar o esboço à R7'], 4: ['finalizado', 'Entrega da R7 hoje'], 5: ['enviado', 'Mandar o cronograma ao cliente'] }[diaDaSemana];
  const linhas = [];
  if (etapa) {
    const faltam = proximos.filter((c) => !c.marcas?.[etapa[0]]).map((c) => c.nome);
    if (faltam.length) linhas.push(`${etapa[1]}: ${faltam.slice(0, 4).join(', ')}${faltam.length > 4 ? ` e mais ${faltam.length - 4}` : ''}`);
  }
  if (tarefasAbertas) linhas.push(`${tarefasAbertas} ${tarefasAbertas === 1 ? 'tarefa de hoje aberta' : 'tarefas de hoje abertas'}`);
  if (!linhas.length) return null;
  return { titulo: 'Fim da tarde', texto: linhas.join('\n'), tag: `tarde-${hoje}`, url: etapa && linhas.length > (tarefasAbertas ? 1 : 0) ? '/#r7' : '/#tarefas' };
}

async function enviarTardeDaUsuaria(userId, assinaturas, agora) {
  const [linhaAvisos] = await banco.listar('config', userId, 'chave=eq.avisos').catch(() => []);
  const fuso = configDeAvisos(linhaAvisos?.valor).fuso;
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(new Date(agora)).reduce((o, p) => ({ ...o, [p.type]: p.value }), {});
  const hoje = `${local.year}-${local.month}-${local.day}`;
  const diaDaSemana = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(local.weekday);
  const [crons, tarefas] = await Promise.all([
    banco.listar('config', userId, 'chave=like.cronograma-r7:*&excluido_em=is.null').catch(() => []),
    banco.listar('tarefas', userId, `data=eq.${hoje}&feita_em=is.null&excluido_em=is.null`).catch(() => []),
  ]);
  const n = avisoDaTarde({ hoje, diaDaSemana, cronogramas: crons.map((c) => c.valor || {}), tarefasAbertas: tarefas.length });
  if (!n) return { enviados: 0 };
  let entregue = false;
  for (const a of assinaturas) if ((await enviarPush(a, n)) === 'ok') entregue = true;
  return { enviados: entregue ? 1 : 0 };
}

export default async () => {
  const agora = Date.now();
  // 19:45 UTC = 16h45 em Brasília: o segundo aviso (e último) do dia.
  const tarde = new Date(agora).getUTCHours() >= 18;
  let assinaturas;
  try {
    assinaturas = await banco.listarTodas('assinaturas_push', 'excluido_em=is.null');
  } catch (erro) {
    // Sem a migração 004 (ou Supabase fora do ar): nada a avisar nesta hora.
    console.error('avisos: não deu para ler os aparelhos:', erro.message);
    return new Response('sem aparelhos');
  }
  const porUsuaria = new Map();
  for (const a of assinaturas) {
    if (!porUsuaria.has(a.user_id)) porUsuaria.set(a.user_id, []);
    porUsuaria.get(a.user_id).push(a);
  }
  for (const [userId, lista] of porUsuaria) {
    try {
      if (tarde) await enviarTardeDaUsuaria(userId, lista, agora);
      else await enviarAvisosDaUsuaria(userId, lista, agora);
    } catch (erro) {
      console.error('avisos:', erro instanceof ErroPush ? erro.message : erro?.message);
      if (erro instanceof ErroPush) break;
    }
  }
  await banco.apagar('avisos_enviados', `enviado_em=lt.${new Date(agora - 30 * DIA).toISOString()}`).catch(() => {});
  return new Response('ok');
};

// 10:45 UTC = 7h45 e 19:45 UTC = 16h45 em Brasília, todo dia (no máximo 2 avisos).
export const config = { schedule: '45 10,19 * * *' };
