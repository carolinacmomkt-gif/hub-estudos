// Cálculos sobre os dados da faculdade (AVA + Lyceum) que as telas usam.

import { DIA } from './utilidades.js';
import { revisoesPorGrupo } from './dados-questoes.js';
import { areasAtivas, nomeDaArea, progressoDaArea } from './dados-estudos.js';
import { filtrarArtigos } from './dados-biblioteca.js';
import { pautasAtivas, configSubstack, publicadosNoMesSubstack } from './dados-substack.js';

const tempo = (iso) => (iso ? new Date(iso).getTime() : null);

export function disciplinasAtivas(estado) {
  return (estado.disciplinas || [])
    .filter((d) => !d.arquivada && !d.excluido_em)
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
}

export function nomeDaDisciplina(estado, id) {
  return (estado.disciplinas || []).find((d) => d.id === id)?.nome || '';
}

// Dados reais = qualquer coisa que a Carol já guardou (disciplinas, leituras, questões, pautas…).
export function temDadosReais(estado) {
  if (disciplinasAtivas(estado).length) return true;
  return ['cadernos', 'artigos', 'questoes', 'pautas', 'areas', 'videos'].some((k) => (estado[k] || []).some((x) => !x.excluido_em));
}

// Situação efetiva de um evento: "pendente" com prazo vencido conta como atrasado.
export function situacaoDoEvento(evento, agora = Date.now()) {
  if (evento.status === 'pendente' && tempo(evento.inicio) < agora) return 'atrasado';
  return evento.status;
}

// Prazos que importam agora: atrasados das últimas 2 semanas e o que vence nos próximos 7 dias.
export function prazosProximos(estado, agora = Date.now(), dias = 7) {
  return (estado.eventos || [])
    .filter((e) => !e.excluido_em && e.inicio)
    .filter((e) => {
      const t = tempo(e.inicio);
      const situacao = situacaoDoEvento(e, agora);
      if (situacao === 'entregue') return false;
      if (t < agora) return situacao === 'atrasado' && t >= agora - 14 * DIA;
      return t <= agora + dias * DIA;
    })
    .sort((a, b) => tempo(a.inicio) - tempo(b.inicio));
}

export function eventosDaDisciplina(estado, disciplinaId) {
  return (estado.eventos || [])
    .filter((e) => e.disciplina_id === disciplinaId && !e.excluido_em && e.inicio)
    .sort((a, b) => tempo(a.inicio) - tempo(b.inicio));
}

export function frequenciaDaDisciplina(estado, disciplinaId) {
  return (estado.frequencias || []).find((f) => f.disciplina_id === disciplinaId && !f.excluido_em) || null;
}

// Faltas: as do Lyceum + as marcadas no app ("faltei hoje") que o Lyceum ainda não registrou.
export function situacaoFaltas(freq) {
  if (!freq) return null;
  const doLyceum = Number(freq.faltas) || 0;
  const marcadas = Number(freq.faltas_manuais) || 0;
  const total = doLyceum + marcadas;
  const permitidas = freq.faltas_permitidas === null || freq.faltas_permitidas === undefined ? null : Number(freq.faltas_permitidas);
  if (permitidas === null) return { total, doLyceum, marcadas, permitidas: null, restantes: null, nivel: 'sem-limite', presenca: freq.percentual_presenca };
  const restantes = permitidas - total;
  let nivel = 'ok';
  if (restantes < 0) nivel = 'estourou';
  else if (restantes <= Math.max(1, Math.round(permitidas * 0.25))) nivel = 'atencao';
  return { total, doLyceum, marcadas, permitidas, restantes, nivel, presenca: freq.percentual_presenca };
}

export function textoFaltas(s) {
  if (!s) return 'Frequência ainda não veio do Lyceum';
  if (s.permitidas === null) return `${s.total} ${s.total === 1 ? 'falta' : 'faltas'}`;
  if (s.restantes < 0) return `Passou do limite em ${-s.restantes} ${-s.restantes === 1 ? 'falta' : 'faltas'}`;
  if (s.restantes === 0) return 'No limite: não pode mais faltar';
  return `Pode faltar mais ${s.restantes} ${s.restantes === 1 ? 'vez' : 'vezes'}`;
}

// Nível de urgência (mesmas cores dos prazos) para as faltas.
export function urgenciaFaltas(s) {
  if (!s) return 'futuro';
  return { estourou: 'atrasado', atencao: 'urgente', ok: 'semana' }[s.nivel] || 'futuro';
}

export function notasLyceumDaDisciplina(estado, disciplinaId) {
  return (estado.notasLyceum || [])
    .filter((n) => n.disciplina_id === disciplinaId && !n.excluido_em)
    .sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99));
}

export function notasAvaDaDisciplina(estado, disciplinaId) {
  return (estado.notasAva || [])
    .filter((n) => n.disciplina_id === disciplinaId && !n.excluido_em)
    .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
}

// Calculadora de média. provas: [{ chave, nome, nota, maxima }]; pesos: { chave: peso }; meta: média para aprovar.
// Notas vão para a escala de 0 a 10 antes da conta.
export function calcularMedia(provas, pesos = {}, meta = 7) {
  const itens = provas.map((p) => {
    const max = Number(p.maxima) > 0 ? Number(p.maxima) : 10;
    return { ...p, peso: Number(pesos[p.chave] ?? 1) || 0, nota10: p.nota === null || p.nota === undefined ? null : (Number(p.nota) / max) * 10 };
  }).filter((p) => p.peso > 0);
  if (!itens.length) return null;

  const somaPesos = itens.reduce((s, p) => s + p.peso, 0);
  const feitas = itens.filter((p) => p.nota10 !== null);
  const faltam = itens.filter((p) => p.nota10 === null);
  const pontos = feitas.reduce((s, p) => s + p.peso * p.nota10, 0);
  const pesoFeitas = feitas.reduce((s, p) => s + p.peso, 0);
  const parcial = pesoFeitas ? pontos / pesoFeitas : null;

  if (!faltam.length) {
    const final = pontos / somaPesos;
    return { final, aprovada: final >= meta - 1e-9, parcial, faltam: 0 };
  }
  const pesoFaltam = faltam.reduce((s, p) => s + p.peso, 0);
  const necessaria = (meta * somaPesos - pontos) / pesoFaltam;
  return { parcial, necessaria, faltam: faltam.length, garantida: necessaria <= 0, possivel: necessaria <= 10 + 1e-9 };
}

// Provas da calculadora: as do Lyceum (oficiais); se não houver, as notas do AVA da disciplina.
export function provasDaCalculadora(estado, disciplinaId) {
  const lyceum = notasLyceumDaDisciplina(estado, disciplinaId);
  if (lyceum.length) {
    return lyceum.map((n) => ({ chave: n.origem_id, nome: n.prova, nota: n.nota, maxima: n.nota_maxima }));
  }
  return notasAvaDaDisciplina(estado, disciplinaId)
    .filter((n) => n.item !== 'Total da disciplina')
    .map((n) => ({ chave: n.origem_id, nome: n.item, nota: n.nota, maxima: n.nota_maxima }));
}

// Dados reais no formato que a tela Início já usa (o mesmo dos dados de exemplo).
export function dadosReaisDoInicio(estado, agora = Date.now()) {
  const nome = (id) => nomeDaDisciplina(estado, id) || 'Sem disciplina';
  const eventos = (estado.eventos || []).filter((e) => !e.excluido_em && e.inicio).map((e) => ({
    id: e.id,
    tipo: e.tipo,
    titulo: e.titulo,
    // Sem disciplina: o calendário acadêmico se identifica; os eventos próprios ficam sem rótulo.
    disciplina: e.disciplina_id ? nome(e.disciplina_id) : (e.origem === 'academico' ? 'Calendário acadêmico' : ''),
    semDisciplina: !e.disciplina_id,
    prazo: tempo(e.inicio),
    status: situacaoDoEvento(e, agora) || null,
    link: e.link,
  }));

  const notas = [
    ...(estado.notasLyceum || []).filter((n) => n.nota !== null && !n.excluido_em).map((n) => ({
      disciplina: nome(n.disciplina_id), item: n.prova, nota: Number(n.nota), maximo: Number(n.nota_maxima) || 10, data: tempo(n.data_nota || n.atualizado_em),
    })),
    ...(estado.notasAva || []).filter((n) => n.nota !== null && !n.excluido_em && n.item !== 'Total da disciplina').map((n) => ({
      disciplina: nome(n.disciplina_id), item: n.item, nota: Number(n.nota), maximo: Number(n.nota_maxima) || 10, data: tempo(n.data || n.atualizado_em),
    })),
  ].sort((a, b) => (b.data || 0) - (a.data || 0)).slice(0, 4);

  const cadernos = (estado.cadernos || []).filter((c) => !c.excluido_em).map((c) => ({
    id: c.id,
    titulo: c.titulo,
    disciplina: c.disciplina_id ? nome(c.disciplina_id) : '',
    capa: c.capa?.cor || 1,
    estilo: c.capa?.estilo || 'lisa',
    paginas: (estado.paginas || []).filter((p) => p.caderno_id === c.id && !p.excluido_em).length,
    editadoEm: tempo(c.atualizado_em),
  }));

  const doSemestre = (estado.eventos || []).filter((e) => !e.excluido_em && (e.tipo === 'trabalho' || e.tipo === 'atividade') && e.status);
  const entregues = doSemestre.filter((e) => e.status === 'entregue').length;

  return {
    nome: estado.dados?.nome || 'Carol',
    eventos,
    revisoes: revisoesPorGrupo(estado, (q) => (q?.disciplina_id ? nome(q.disciplina_id) : nomeDaArea(estado, q?.area_id))),
    notas,
    cadernos,
    areas: [
      { id: 'faculdade', nome: 'Faculdade', detalhe: doSemestre.length ? `${entregues} de ${doSemestre.length} atividades entregues` : 'Sem atividades com prazo ainda', progresso: doSemestre.length ? entregues / doSemestre.length : 0 },
      ...areasAtivas(estado).slice(0, 4).map((a) => {
        const p = progressoDaArea(estado, a);
        return { id: a.id, nome: a.nome, detalhe: p.detalhe, progresso: p.fracao, destino: `#estudos/${a.id}` };
      }),
      ...(pautasAtivas(estado).length ? [(() => {
        const meta = configSubstack(estado).porMes;
        const feitos = publicadosNoMesSubstack(estado, agora).length;
        return { id: 'substack', nome: 'Substack', detalhe: `${feitos} de ${meta} textos publicados no mês`, progresso: feitos / meta, destino: '#substack' };
      })()] : []),
    ],
    leituras: filtrarArtigos(estado, {}).filter((a) => a.status === 'lendo' || a.status === 'ler').map((a) => ({ id: a.id, titulo: a.titulo, status: a.status })),
  };
}

export function avisosRecentes(estado, limite = 4) {
  return (estado.avisos || [])
    .filter((a) => !a.excluido_em)
    .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))
    .slice(0, limite);
}

export function disciplinasComFaltasEmRisco(estado) {
  return disciplinasAtivas(estado)
    .map((d) => ({ disciplina: d, faltas: situacaoFaltas(frequenciaDaDisciplina(estado, d.id)) }))
    .filter((x) => x.faltas && (x.faltas.nivel === 'atencao' || x.faltas.nivel === 'estourou'));
}
