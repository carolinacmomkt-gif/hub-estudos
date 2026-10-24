// Sincronização do AVA (somente leitura) → Supabase.
//
// Dividida em duas partes para caber no tempo das funções da Netlify:
// - geral: disciplinas, trabalhos (com status de entrega), quizzes, eventos do calendário e avisos;
// - cursos: materiais e notas de até 3 disciplinas por vez.
// Métodos bloqueados (accessexception) entram em "bloqueados" e o resto continua.

import { chamarAva, ErroAva } from './ava.mjs';
import { banco } from './supabase.mjs';
import { emParalelo, melhorCombinacao, nomeBonito, dataIso, textoSemHtml, tipoPeloNome, numero } from './faculdade.mjs';

const DIA = 24 * 60 * 60 * 1000;
const MODULOS_DE_MATERIAL = new Set(['resource', 'url', 'page', 'folder', 'book']);

// Executa uma consulta; se o método estiver bloqueado ou falhar, anota e devolve null.
// Token vencido não é engolido: interrompe a sincronização para pedir reconexão.
async function tentar(nome, bloqueados, fn) {
  try {
    return await fn();
  } catch (erro) {
    if (erro instanceof ErroAva && erro.codigo === 'token') throw erro;
    bloqueados.push({ metodo: nome, motivo: erro.message });
    return null;
  }
}

function cursoAtivo(curso, agora) {
  if (curso.visible === 0) return false;
  if (curso.enddate) return curso.enddate * 1000 >= agora - 15 * DIA;
  return !curso.startdate || curso.startdate * 1000 >= agora - 300 * DIA;
}

export async function sincronizarAvaGeral({ userId, base, token, avaUserId }) {
  const agora = Date.now();
  const bloqueados = [];
  const contagens = {};

  // 1. Disciplinas
  const cursos = (await chamarAva(base, token, 'core_enrol_get_users_courses', { userid: avaUserId })) || [];
  const existentes = await banco.listar('disciplinas', userId);
  const linhasDisciplinas = [];
  const idPorCurso = new Map();
  for (const curso of cursos) {
    const ativo = cursoAtivo(curso, agora);
    let linha = existentes.find((d) => Number(d.ava_course_id) === curso.id);
    if (!linha && ativo) {
      // Disciplina que já veio do Lyceum e ainda não tem o AVA ligado: combina pelo nome.
      linha = melhorCombinacao(curso.fullname, existentes.filter((d) => !d.ava_course_id && !d.arquivada && !d.combinacao_manual), 'nome_lyceum');
    }
    const id = linha?.id || crypto.randomUUID();
    idPorCurso.set(curso.id, id);
    linhasDisciplinas.push({
      id,
      user_id: userId,
      ava_course_id: curso.id,
      nome_ava: curso.fullname,
      nome: nomeBonito(linha?.nome_lyceum || curso.fullname),
      arquivada: !ativo,
    });
    if (linha) linha.ava_course_id = curso.id; // não combinar a mesma linha duas vezes
  }
  await banco.gravar('disciplinas', linhasDisciplinas, 'id');
  contagens.disciplinas = linhasDisciplinas.filter((d) => !d.arquivada).length;

  const ativos = cursos.filter((c) => cursoAtivo(c, agora)).map((c) => c.id);
  const link = (caminho) => `${base}${caminho}`;
  const eventos = [];

  // 2. Pendências do calendário (dizem o que ainda falta fazer e o que está atrasado)
  const acoes = await tentar('core_calendar_get_action_events_by_timesort', bloqueados, () => chamarAva(base, token, 'core_calendar_get_action_events_by_timesort', {
    timesortfrom: Math.floor((agora - 30 * DIA) / 1000),
    limitnum: 50,
  }));
  const pendencias = new Map();
  for (const ev of acoes?.events || []) pendencias.set(`${ev.modulename}-${ev.instance}`, ev);

  if (ativos.length) {
    // 3. Trabalhos + status de entrega
    const tarefas = await tentar('mod_assign_get_assignments', bloqueados, () => chamarAva(base, token, 'mod_assign_get_assignments', { courseids: ativos }));
    const listaTarefas = (tarefas?.courses || []).flatMap((c) => (c.assignments || []).map((a) => ({ ...a, course: a.course || c.id })))
      .filter((a) => a.duedate && a.duedate * 1000 >= agora - 60 * DIA && a.duedate * 1000 <= agora + 200 * DIA);

    const status = await emParalelo(listaTarefas, 6, async (a) => {
      const r = await chamarAva(base, token, 'mod_assign_get_submission_status', { assignid: a.id });
      return r?.lastattempt?.submission?.status || r?.lastattempt?.teamsubmission?.status || null;
    });
    let statusBloqueado = false;
    listaTarefas.forEach((a, i) => {
      if (status[i]?.erro) {
        if (status[i].erro instanceof ErroAva && status[i].erro.codigo === 'token') throw status[i].erro;
        statusBloqueado = true;
      }
      const enviado = status[i] === 'submitted';
      const pendencia = pendencias.get(`assign-${a.id}`);
      let situacao = enviado ? 'entregue' : a.duedate * 1000 < agora ? 'atrasado' : 'pendente';
      if (status[i]?.erro) situacao = pendencia ? (pendencia.overdue ? 'atrasado' : 'pendente') : (a.duedate * 1000 < agora ? null : 'pendente');
      eventos.push({
        user_id: userId,
        origem: 'ava',
        origem_id: `assign-${a.id}`,
        disciplina_id: idPorCurso.get(a.course) || null,
        tipo: tipoPeloNome(a.name, 'trabalho') === 'prova' ? 'prova' : 'trabalho',
        titulo: a.name,
        inicio: dataIso(a.duedate),
        status: situacao,
        link: link(`/mod/assign/view.php?id=${a.cmid}`),
      });
    });
    if (statusBloqueado) bloqueados.push({ metodo: 'mod_assign_get_submission_status', motivo: 'Status de entrega indisponível; usando as pendências do calendário.' });

    // 4. Quizzes (provas e questionários online)
    const quizzes = await tentar('mod_quiz_get_quizzes_by_courses', bloqueados, () => chamarAva(base, token, 'mod_quiz_get_quizzes_by_courses', { courseids: ativos }));
    for (const q of quizzes?.quizzes || []) {
      const quando = q.timeclose || q.timeopen;
      if (!quando || quando * 1000 < agora - 60 * DIA) continue;
      const pendencia = pendencias.get(`quiz-${q.id}`);
      let situacao = null;
      if (pendencia) situacao = pendencia.overdue ? 'atrasado' : 'pendente';
      else if (q.timeopen && q.timeopen * 1000 > agora) situacao = 'pendente'; // ainda não abriu
      else if (quando * 1000 >= agora) situacao = acoes ? 'entregue' : 'pendente'; // aberto e sem pendência = já respondido
      eventos.push({
        user_id: userId,
        origem: 'ava',
        origem_id: `quiz-${q.id}`,
        disciplina_id: idPorCurso.get(q.course) || null,
        tipo: tipoPeloNome(q.name, 'atividade'),
        titulo: q.name,
        inicio: dataIso(quando),
        status: situacao,
        link: link(`/mod/quiz/view.php?id=${q.coursemodule}`),
      });
    }
  }

  // 5. Outros eventos do calendário (do curso, da instituição, pessoais)
  const proximos = await tentar('core_calendar_get_calendar_upcoming_view', bloqueados, () => chamarAva(base, token, 'core_calendar_get_calendar_upcoming_view', {}));
  for (const ev of proximos?.events || []) {
    if (ev.modulename === 'assign' || ev.modulename === 'quiz') continue; // já vieram acima
    const cursoId = ev.course?.id || ev.courseid;
    eventos.push({
      user_id: userId,
      origem: 'ava',
      origem_id: `evento-${ev.id}`,
      disciplina_id: idPorCurso.get(cursoId) || null,
      tipo: tipoPeloNome(ev.name, 'atividade'),
      titulo: ev.name,
      descricao: textoSemHtml(ev.description, 500) || null,
      inicio: dataIso(ev.timestart),
      fim: ev.timeduration ? dataIso(ev.timestart + ev.timeduration) : null,
      link: ev.url || null,
    });
  }
  await banco.gravar('eventos', eventos.filter((e) => e.inicio), 'user_id,origem,origem_id');
  contagens.eventos = eventos.length;

  // 6. Avisos (fóruns de notícias de cada disciplina)
  if (ativos.length) {
    const foruns = await tentar('mod_forum_get_forums_by_courses', bloqueados, () => chamarAva(base, token, 'mod_forum_get_forums_by_courses', { courseids: ativos }));
    const deAvisos = (Array.isArray(foruns) ? foruns : []).filter((f) => f.type === 'news');
    const discussoes = await emParalelo(deAvisos, 4, (f) => chamarAva(base, token, 'mod_forum_get_forum_discussions', { forumid: f.id, page: 0, perpage: 10 }));
    const avisos = [];
    deAvisos.forEach((forum, i) => {
      for (const d of discussoes[i]?.discussions || []) {
        avisos.push({
          user_id: userId,
          origem: 'ava',
          origem_id: `forum-${d.discussion || d.id}`,
          disciplina_id: idPorCurso.get(forum.course) || null,
          titulo: d.subject || d.name || 'Aviso',
          texto: textoSemHtml(d.message),
          data: dataIso(d.created || d.timemodified),
          link: link(`/mod/forum/discuss.php?d=${d.discussion || d.id}`),
        });
      }
    });
    if (discussoes.some((d) => d?.erro)) bloqueados.push({ metodo: 'mod_forum_get_forum_discussions', motivo: 'Alguns avisos não vieram.' });
    await banco.gravar('avisos', avisos, 'user_id,origem,origem_id');
    contagens.avisos = avisos.length;
  }

  return { cursos: ativos, contagens, bloqueados };
}

export async function sincronizarAvaCursos({ userId, base, token, avaUserId, cursos }) {
  const bloqueados = [];
  const contagens = { materiais: 0, notas: 0 };
  const disciplinas = await banco.listar('disciplinas', userId);
  const idPorCurso = new Map(disciplinas.filter((d) => d.ava_course_id).map((d) => [Number(d.ava_course_id), d.id]));

  for (const cursoId of cursos.slice(0, 3)) {
    const disciplinaId = idPorCurso.get(cursoId) || null;

    const [conteudo, notas] = await Promise.all([
      tentar('core_course_get_contents', bloqueados, () => chamarAva(base, token, 'core_course_get_contents', { courseid: cursoId })),
      tentar('gradereport_user_get_grade_items', bloqueados, () => chamarAva(base, token, 'gradereport_user_get_grade_items', { courseid: cursoId, userid: avaUserId })),
    ]);

    const materiais = [];
    for (const secao of Array.isArray(conteudo) ? conteudo : []) {
      for (const m of secao.modules || []) {
        if (!MODULOS_DE_MATERIAL.has(m.modname) || m.uservisible === false) continue;
        const arquivos = (m.contents || []).filter((c) => c.type === 'file').slice(0, 10)
          .map((c) => ({ nome: c.filename, tipo: c.mimetype || null, tamanho: c.filesize || null, url: c.fileurl || null }));
        const externo = m.modname === 'url' ? (m.contents || [])[0]?.fileurl || null : null;
        materiais.push({
          user_id: userId,
          origem: 'ava',
          origem_id: `mod-${m.id}`,
          disciplina_id: disciplinaId,
          titulo: m.name,
          tipo: m.modname,
          url: m.url || null,
          dados: { secao: secao.name || null, arquivos, linkExterno: externo },
        });
      }
    }
    await banco.gravar('materiais', materiais, 'user_id,origem,origem_id');
    contagens.materiais += materiais.length;

    const itens = notas?.usergrades?.[0]?.gradeitems || [];
    const linhasNotas = itens
      .filter((g) => g.graderaw !== null && g.graderaw !== undefined && g.itemtype !== 'category')
      .map((g) => ({
        user_id: userId,
        origem_id: `${cursoId}-${g.id}`,
        disciplina_id: disciplinaId,
        ava_course_id: cursoId,
        item: g.itemtype === 'course' ? 'Total da disciplina' : (g.itemname || 'Nota'),
        nota: numero(g.graderaw),
        nota_maxima: numero(g.grademax),
        peso: numero(g.weightraw),
        data: dataIso(g.gradedategraded || g.gradedatesubmitted),
      }));
    await banco.gravar('notas_ava', linhasNotas, 'user_id,origem_id');
    contagens.notas += linhasNotas.length;
  }
  return { contagens, bloqueados };
}
