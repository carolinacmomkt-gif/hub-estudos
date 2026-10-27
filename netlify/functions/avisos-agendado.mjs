// Avisos de prazo no aparelho, de hora em hora (Netlify Scheduled Function).
// Para cada aparelho ativado: vê o que vence em 3 dias, amanhã e hoje, manda o aviso no
// horário escolhido e anota o que já saiu (cada prazo sai uma vez em cada marco).

import { banco } from '../lib/supabase.mjs';
import { avisosDevidos, montarNotificacoes, enviarPush, configDeAvisos, chaveEnviado, ErroPush } from '../lib/avisos.mjs';
import { resumoDevido, resumoDaSemana, textoDaNotificacao } from '../../js/dados-resumo.js';

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
  const [sessoes, respostas, artigos, pautas, videos, eventos, disciplinas, areas, cadernos] = await Promise.all([
    ler('sessoes_foco', entre('inicio')), ler('respostas', entre('respondida_em')), ler('artigos', entre('lido_em')),
    ler('pautas_substack', entre('publicado_em')), ler('videos', entre('data_publicacao')), ler('eventos', entre('inicio', de, depois)),
    ler('disciplinas', ''), ler('areas', ''), ler('cadernos', entre('atualizado_em')),
  ]);
  const r = resumoDaSemana({ sessoes, respostas, artigos, pautas, videos, eventos, disciplinas, areas, cadernos }, semana);
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

export async function enviarAvisosDaUsuaria(userId, assinaturas, agora = Date.now()) {
  const [linhaConfig] = await banco.listar('config', userId, 'chave=eq.avisos');
  const config = configDeAvisos(linhaConfig?.valor);
  await enviarResumoDaUsuaria(userId, assinaturas, linhaConfig?.valor, agora).catch((erro) => console.error('resumo:', erro?.message));
  const janela = `inicio=gte.${new Date(agora - DIA).toISOString()}&inicio=lt.${new Date(agora + 5 * DIA).toISOString()}`;
  const eventos = await banco.listar('eventos', userId, janela);
  const enviados = new Set((await banco.listarTodas('avisos_enviados', `user_id=eq.${userId}&enviado_em=gte.${new Date(agora - 10 * DIA).toISOString()}`))
    .map((l) => chaveEnviado(l.evento_id, l.marco, l.data_evento)));

  const devidos = avisosDevidos({ eventos, config, agora, enviados });
  if (!devidos.length) return { enviados: 0 };

  const disciplinas = new Map((await banco.listar('disciplinas', userId)).map((d) => [d.id, d.nome]));
  const notificacoes = montarNotificacoes(devidos, { nomeDisciplina: (id) => disciplinas.get(id) || '', fuso: config.fuso });
  let entregues = 0;
  const marcosEntregues = new Set();
  for (const assinatura of assinaturas) {
    for (const n of notificacoes) {
      const r = await enviarPush(assinatura, n);
      if (r === 'expirada') {
        await banco.apagar('assinaturas_push', `user_id=eq.${userId}&id=eq.${assinatura.id}`);
        break;
      }
      if (r === 'ok') {
        entregues += 1;
        marcosEntregues.add(n.marco);
      }
    }
  }
  // Só anota o que chegou a pelo menos um aparelho; o resto tenta de novo na próxima hora.
  const anotar = devidos.filter((d) => marcosEntregues.has(d.marco));
  if (anotar.length) {
    await banco.gravar('avisos_enviados', anotar.map((d) => ({
      user_id: userId, evento_id: d.evento.id, marco: d.marco, data_evento: d.evento.inicio,
    })), 'user_id,evento_id,marco,data_evento');
  }
  return { enviados: entregues };
}

export default async () => {
  const agora = Date.now();
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
      await enviarAvisosDaUsuaria(userId, lista, agora);
    } catch (erro) {
      console.error('avisos:', erro instanceof ErroPush ? erro.message : erro?.message);
      if (erro instanceof ErroPush) break;
    }
  }
  await banco.apagar('avisos_enviados', `enviado_em=lt.${new Date(agora - 30 * DIA).toISOString()}`).catch(() => {});
  return new Response('ok');
};

export const config = { schedule: '0 * * * *' };
