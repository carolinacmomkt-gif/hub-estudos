// Widgets do iPhone (Scriptable): só leitura, com o código do widget que a Carol gera em
// Configurações (o app guarda só o SHA-256 em config "widget"). Cada widget tem uma área e
// cores (config "widgets"); aqui sai o resumo daquela área, só com o necessário.

import { createHash, timingSafeEqual } from 'node:crypto';
import { banco } from './supabase.mjs';
import { noFuso } from './avisos.mjs';
import { tarefasDeHoje } from '../../js/dados-tarefas.js';
import { habitosDoDia, feitoNoDia, valorNoDia } from '../../js/dados-habitos.js';
import { resumoDoMes, mesDe, livreParaGastar, contasDaSemana, CATEGORIAS_PADRAO } from '../../js/dados-financas.js';
import { livreHoje } from '../../js/dados-comprar.js';
import { planoDeHoje, blocoAgora } from '../../js/dados-dia.js';
import { listaQuantoPrecisa, situacaoFaltas } from '../../js/dados-faculdade.js';
import { ativas, progressoDaMeta } from '../../js/dados-metas.js';
import { fraseDoDia } from '../../js/frases.js';
import { configSubstack, publicadosNoMesSubstack } from '../../js/dados-substack.js';
import { ETAPAS } from '../../js/dados-youtube.js';
import { widgetsDaConfig, widgetDoParametro, coresDoWidget, AREAS_WIDGET } from '../../js/dados-widgets.js';

const FUSO = 'America/Sao_Paulo';
const DIA = 864e5;
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

const hora = (iso) => { const q = noFuso(iso, FUSO); return { dia: q.data, hora: `${String(Math.floor(q.minutos / 60)).padStart(2, '0')}:${String(q.minutos % 60).padStart(2, '0')}` }; };
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

// Cada área: o que ler do banco e como resumir. ctx = { userId, hoje, minutos, agora, ler }.
const AREAS = {
  async tarefas({ hoje, ler }) {
    const tarefas = await ler('tarefas');
    const t = tarefasDeHoje(tarefas, hoje);
    const lista = [...t.atrasadas, ...t.hoje];
    return {
      total: lista.length, atrasadas: t.atrasadas.length, feitas: t.feitas.length,
      progresso: lista.length + t.feitas.length ? t.feitas.length / (lista.length + t.feitas.length) : 1,
      lista: lista.slice(0, 8).map((x) => ({ titulo: x.titulo, hora: x.hora || null, prioridade: x.prioridade || 0, atrasada: x.data < hoje })),
    };
  },
  async agenda({ hoje, minutos, agora, ler }) {
    const [eventos, configs] = await Promise.all([
      ler('eventos', `inicio=gte.${new Date(agora - 12 * 3600e3).toISOString()}&inicio=lte.${new Date(agora + 7 * DIA).toISOString()}&order=inicio`),
      ler('config', 'chave=eq.meu_dia'),
    ]);
    const plano = planoDeHoje(configs[0]?.valor, hoje);
    const bloco = plano?.aceito ? blocoAgora(plano.blocos, minutos) : null;
    return {
      agora: bloco ? { titulo: bloco.titulo, inicio: bloco.inicio, fim: bloco.fim } : null,
      lista: eventos.filter((e) => e.status !== 'entregue' && Date.parse(e.fim || e.inicio) >= agora).slice(0, 8)
        .map((e) => ({ titulo: e.titulo, tipo: e.tipo, ...hora(e.inicio), hora: e.dia_inteiro ? null : hora(e.inicio).hora })),
    };
  },
  async demandas({ ler }) {
    const d = await ler('demandas', 'status=eq.nova');
    const ordem = (x) => (x.dados?.tipo === 'aprovacao' ? 0 : 1) * 10 - (Number(x.prioridade) || 0);
    return {
      total: d.length,
      aprovacao: d.filter((x) => x.dados?.tipo === 'aprovacao').length,
      lista: [...d].sort((a, b) => ordem(a) - ordem(b)).slice(0, 6).map((x) => ({ titulo: x.titulo, tipo: x.dados?.tipo || null, quem: x.quem || null, origem: x.origem })),
    };
  },
  async habitos({ hoje, ler }) {
    const [habitos, registros] = await Promise.all([ler('habitos'), ler('habito_registros', `data=gte.${new Date(Date.parse(`${hoje}T12:00:00Z`) - 8 * DIA).toISOString().slice(0, 10)}`)]);
    const h = habitosDoDia(habitos, registros, hoje);
    return {
      feitos: h.feitos, total: h.total, progresso: h.total ? h.feitos / h.total : 0,
      lista: h.lista.slice(0, 8).map((x) => ({ nome: x.nome, icone: x.icone || null, feito: feitoNoDia(registros, x, hoje), valor: valorNoDia(registros, x, hoje), meta: Math.max(1, Number(x.meta) || 1), unidade: x.unidade || null })),
    };
  },
  async financas({ hoje, ler }) {
    const [linhas, configs] = await Promise.all([ler('financas'), ler('config', 'chave=eq.financas')]);
    const cats = configs[0]?.valor?.categorias || CATEGORIAS_PADRAO;
    const r = resumoDoMes(linhas, mesDe(hoje), { categorias: cats });
    const l = livreParaGastar(linhas, hoje);
    const h = livreHoje(linhas, hoje);
    return {
      saiu: r2(r.saiu), entrou: r2(r.entrou), livre: r2(l.livre), porDia: r2(l.porDia), diasRestantes: l.diasRestantes,
      livreHoje: r2(h.sobra), gastoHoje: r2(h.gastoHoje),
      categorias: r.porCategoria.slice(0, 4).map((c) => ({ nome: c.nome, total: r2(c.total) })),
      contas: contasDaSemana(linhas, hoje).slice(0, 4).map((x) => ({ nome: x.conta.descricao, valor: r2(x.conta.valor), dias: x.dias, atrasada: x.estado === 'atrasada' })),
    };
  },
  async faculdade({ agora, ler }) {
    const [disciplinas, notasLyceum, notasAva, frequencias, eventos] = await Promise.all([
      ler('disciplinas'), ler('notas_lyceum'), ler('notas_ava'), ler('frequencias'),
      ler('eventos', `tipo=eq.prova&inicio=gte.${new Date(agora - 12 * 3600e3).toISOString()}&order=inicio`),
    ]);
    const estado = { disciplinas, notasLyceum, notasAva, frequencias, eventos };
    const prova = eventos[0];
    const nomeDisc = new Map(disciplinas.map((d) => [d.id, d.nome]));
    return {
      prova: prova ? { titulo: prova.titulo, disciplina: nomeDisc.get(prova.disciplina_id) || null, ...hora(prova.inicio), dias: Math.max(0, Math.ceil((Date.parse(prova.inicio) - agora) / DIA)) } : null,
      notas: listaQuantoPrecisa(estado, agora).filter((x) => !['garantida', 'passou'].includes(x.nivel)).slice(0, 4).map((x) => ({
        disciplina: x.disciplina.nome, nivel: x.nivel,
        texto: x.nivel === 'impossivel' ? 'recuperação' : x.nivel === 'abaixo' ? `média ${x.r.final.toFixed(1).replace('.', ',')}` : `precisa ${(Math.ceil(x.r.necessaria * 10) / 10).toFixed(1).replace('.', ',')}`,
      })),
      faltas: disciplinas.filter((d) => !d.arquivada).map((d) => ({ d, s: situacaoFaltas(frequencias.find((f) => f.disciplina_id === d.id)) }))
        .filter((x) => x.s && ['atencao', 'estourou'].includes(x.s.nivel)).slice(0, 3).map((x) => ({ disciplina: x.d.nome, restantes: x.s.restantes })),
    };
  },
  async metas({ hoje, ler }) {
    const [metas, financas, habitos, habitoRegistros, tarefas] = await Promise.all([ler('metas'), ler('financas'), ler('habitos'), ler('habito_registros'), ler('tarefas')]);
    const dados = { financas, habitos, habitoRegistros, tarefas };
    return {
      lista: ativas(metas).map((m) => ({ m, p: progressoDaMeta(m, dados, hoje) })).filter((x) => x.p).slice(0, 5)
        .map(({ m, p }) => ({ titulo: m.titulo, fracao: p.fracao, texto: p.texto || `${Math.round(p.fracao * 100)}%` })),
    };
  },
  async foco({ hoje, ler }) {
    const segunda = new Date(Date.parse(`${hoje}T12:00:00Z`) - ((new Date(`${hoje}T12:00:00Z`).getUTCDay() + 6) % 7) * DIA).toISOString().slice(0, 10);
    const sessoes = await ler('sessoes_foco', `inicio=gte.${segunda}T03:00:00Z`);
    const minutos = (l) => l.reduce((t, s) => t + (Number(s.minutos) || 0), 0);
    const porDia = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.parse(`${segunda}T12:00:00Z`) + i * DIA).toISOString().slice(0, 10);
      return minutos(sessoes.filter((s) => noFuso(s.inicio, FUSO).data === d));
    });
    return { hoje: minutos(sessoes.filter((s) => noFuso(s.inicio, FUSO).data === hoje)), semana: minutos(sessoes), porDia, sessoes: sessoes.length };
  },
  async frase({ hoje }) {
    const f = fraseDoDia(new Date(`${hoje}T12:00:00`));
    return typeof f === 'string' ? { texto: f } : { texto: f?.texto || f?.frase || '', autor: f?.autor || null };
  },
  async youtube({ ler }) {
    const videos = (await ler('videos')).filter((v) => v.etapa !== 'publicado');
    const proximo = [...videos].sort((a, b) => String(a.data_publicacao || '9').localeCompare(String(b.data_publicacao || '9')))[0];
    return {
      proximo: proximo ? { titulo: proximo.titulo, etapa: ETAPAS.find((e) => e.id === proximo.etapa)?.nome || proximo.etapa, publicacao: proximo.data_publicacao ? hora(proximo.data_publicacao).dia : null } : null,
      etapas: ETAPAS.filter((e) => e.id !== 'publicado').map((e) => ({ nome: e.nome, total: videos.filter((v) => v.etapa === e.id).length })).filter((e) => e.total),
    };
  },
  async substack({ agora, ler }) {
    const [pautas, config] = await Promise.all([ler('pautas_substack'), ler('config', 'chave=eq.substack')]);
    const estado = { pautas, config };
    const meta = configSubstack(estado).porMes;
    const feitos = publicadosNoMesSubstack(estado, agora).length;
    const proxima = pautas.filter((p) => p.etapa !== 'publicado').sort((a, b) => ['revisao', 'rascunho', 'ideia'].indexOf(a.etapa) - ['revisao', 'rascunho', 'ideia'].indexOf(b.etapa))[0];
    return { feitos, meta, fracao: Math.min(1, feitos / meta), proxima: proxima ? { titulo: proxima.titulo, etapa: proxima.etapa } : null };
  },
  async leituras({ ler }) {
    const artigos = await ler('artigos', 'status=in.(lendo,ler)');
    const ordem = (a) => (a.status === 'lendo' ? 0 : 1);
    return { lendo: artigos.filter((a) => a.status === 'lendo').length, fila: artigos.filter((a) => a.status === 'ler').length, lista: [...artigos].sort((a, b) => ordem(a) - ordem(b)).slice(0, 5).map((a) => ({ titulo: a.titulo, autor: a.autor || null, status: a.status })) };
  },
  async hoje(ctx) {
    const [tarefas, agenda, demandas, habitos] = await Promise.all([AREAS.tarefas(ctx), AREAS.agenda(ctx), AREAS.demandas(ctx), AREAS.habitos(ctx)]);
    return { tarefas, agenda, demandas: { total: demandas.total, aprovacao: demandas.aprovacao, primeira: demandas.lista[0]?.titulo || null }, habitos: { feitos: habitos.feitos, total: habitos.total, progresso: habitos.progresso } };
  },
};

export async function resumoDoWidget(userId, parametro = '', agora = Date.now()) {
  const { data: hoje, minutos } = noFuso(agora, FUSO);
  const ler = (t, f = '') => banco.listar(t, userId, f).catch(() => []); // tabela que ainda não existe: segue sem ela
  const widgets = widgetsDaConfig(await ler('config', 'chave=eq.widgets'));
  const w = widgetDoParametro(widgets, parametro);
  const area = AREAS_WIDGET.find((a) => a.id === w.area) || AREAS_WIDGET[0];
  const dados = await AREAS[area.id]({ userId, hoje, minutos, agora, ler });
  return {
    ok: true,
    hoje,
    atualizado_em: new Date(agora).toISOString(),
    widget: { nome: w.nome, parametro: w.parametro, area: area.id, titulo: area.nome, simbolo: area.simbolo, cores: coresDoWidget(w) },
    dados,
  };
}
