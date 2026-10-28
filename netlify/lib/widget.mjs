// Resumo para o widget do iPhone (Scriptable): só leitura, com o código do widget que a Carol gera
// em Configurações. O app guarda só o hash (SHA-256) do código em config "widget".

import { createHash, timingSafeEqual } from 'node:crypto';
import { banco } from './supabase.mjs';
import { noFuso } from './avisos.mjs';
import { tarefasDeHoje } from '../../js/dados-tarefas.js';
import { habitosDoDia } from '../../js/dados-habitos.js';
import { resumoDoMes, mesDe } from '../../js/dados-financas.js';
import { planoDeHoje, blocoAgora } from '../../js/dados-dia.js';

const FUSO = 'America/Sao_Paulo';
export const hashDoCodigo = (codigo) => createHash('sha256').update(String(codigo)).digest('hex');

// Acha a dona do código (comparação em tempo constante).
export async function usuariaDoCodigo(codigo) {
  if (!/^[A-Za-z0-9_-]{30,80}$/.test(codigo || '')) return null;
  const alvo = Buffer.from(hashDoCodigo(codigo));
  const linhas = await banco.listarTodas('config', 'chave=eq.widget&excluido_em=is.null');
  const achada = linhas.find((l) => {
    const h = Buffer.from(String(l.valor?.hash || ''));
    return h.length === alvo.length && timingSafeEqual(h, alvo);
  });
  return achada?.user_id || null;
}

const hhmm = (iso) => noFuso(iso, FUSO);

export async function resumoDoWidget(userId, agora = Date.now()) {
  const { data: hoje, minutos } = noFuso(agora, FUSO);
  const ler = (t, f = '') => banco.listar(t, userId, f).catch(() => []);
  const ate = new Date(agora + 3 * 864e5).toISOString();
  const [tarefas, eventos, demandas, habitos, registros, financas, configs] = await Promise.all([
    ler('tarefas', 'feita_em=is.null'),
    ler('eventos', `inicio=gte.${new Date(agora - 12 * 3600e3).toISOString()}&inicio=lte.${ate}&order=inicio`),
    ler('demandas', 'status=eq.nova'),
    ler('habitos'),
    ler('habito_registros', `data=gte.${hoje.slice(0, 8)}01`),
    ler('financas', `data=gte.${mesDe(hoje)}-01`),
    ler('config', 'chave=eq.meu_dia'),
  ]);
  const t = tarefasDeHoje(tarefas, hoje);
  const lista = [...t.atrasadas, ...t.hoje];
  const proximos = eventos.filter((e) => e.status !== 'entregue' && Date.parse(e.fim || e.inicio) >= agora).slice(0, 4).map((e) => {
    const q = hhmm(e.inicio);
    return { titulo: e.titulo, tipo: e.tipo, dia: q.data, hora: e.dia_inteiro ? null : `${String(Math.floor(q.minutos / 60)).padStart(2, '0')}:${String(q.minutos % 60).padStart(2, '0')}` };
  });
  const h = habitosDoDia(habitos, registros, hoje);
  const plano = planoDeHoje(configs[0]?.valor, hoje);
  const bloco = plano?.aceito ? blocoAgora(plano.blocos, minutos) : null;
  return {
    ok: true,
    hoje,
    atualizado_em: new Date(agora).toISOString(),
    tarefas: { total: lista.length, atrasadas: t.atrasadas.length, feitas: t.feitas.length, primeiras: lista.slice(0, 5).map((x) => ({ titulo: x.titulo, hora: x.hora || null, prioridade: x.prioridade || 0 })) },
    proximos,
    agora: bloco ? { titulo: bloco.titulo, inicio: bloco.inicio, fim: bloco.fim } : null,
    demandas: { total: demandas.length, aprovacao: demandas.filter((d) => d.dados?.tipo === 'aprovacao').length, primeira: demandas[0]?.titulo || null },
    habitos: { feitos: h.feitos, total: h.total },
    gastos_mes: resumoDoMes(financas, mesDe(hoje)).saiu,
  };
}
