// Coordena a sincronização da faculdade para uma usuária (usada pelo app e pela agendada).
// Abre o segredo guardado, chama o AVA ou o Lyceum e atualiza a tabela "conexoes".

import { banco } from './supabase.mjs';
import { decifrar, cifrar } from './cripto.mjs';
import { lerSiteInfo, ErroAva } from './ava.mjs';
import { sincronizarAvaGeral, sincronizarAvaCursos, CURSOS_POR_PARTE } from './sincronizar-ava.mjs';
import { sincronizarLyceum, ErroLyceum } from './sincronizar-lyceum.mjs';

export { CURSOS_POR_PARTE };

async function atualizarConexao(userId, servico, campos, detalheExtra) {
  const atual = await banco.lerConexao(userId, servico);
  await banco.salvarConexao(userId, servico, {
    ...campos,
    detalhe: { ...(atual?.detalhe || {}), ...(detalheExtra || {}) },
  });
}

async function lerSegredo(userId, servico) {
  const cifrado = await banco.lerCredencial(userId, servico);
  return cifrado ? decifrar(cifrado) : null;
}

// AVA. parte: 'geral' (devolve a lista de cursos) ou 'cursos' (materiais e notas de até 3 cursos).
export async function sincronizarAva(userId, { parte = 'geral', cursos = [] } = {}) {
  const base = (process.env.AVA_BASE_URL || '').replace(/\/+$/, '');
  const segredo = await lerSegredo(userId, 'ava');
  if (!segredo?.token) return { ok: false, erro: 'O AVA não está conectado.' };

  try {
    let avaUserId = segredo.userid;
    if (!avaUserId) {
      const info = await lerSiteInfo(base, segredo.token);
      if (!info.ok) throw new ErroAva(info.detalhe, /token/i.test(info.detalhe) ? 'token' : 'outro');
      avaUserId = info.dados.userid;
      await banco.salvarCredencial(userId, 'ava', cifrar({ ...segredo, userid: avaUserId }));
    }

    if (parte === 'cursos') {
      const r = await sincronizarAvaCursos({ userId, base, token: segredo.token, avaUserId, cursos });
      // Guarda o que veio de cada curso, para a tela mostrar o resumo do AVA.
      const atual = await banco.lerConexao(userId, 'ava');
      const somar = { ...(atual?.detalhe?.cursosContagens || {}) };
      for (const [chave, valor] of Object.entries(r.contagens)) somar[chave] = (somar[chave] || 0) + valor;
      await atualizarConexao(userId, 'ava', {}, {
        cursosContagens: somar,
        cursosBloqueados: [...new Map([...(atual?.detalhe?.cursosBloqueados || []), ...r.bloqueados].map((b) => [b.metodo, b])).values()],
      });
      return { ok: true, ...r };
    }

    const r = await sincronizarAvaGeral({ userId, base, token: segredo.token, avaUserId });
    // A parte geral recomeça o resumo; as partes por curso vão somando.
    await atualizarConexao(userId, 'ava', { status: 'conectado', ultima_sincronizacao: new Date().toISOString() }, {
      mensagem: null,
      sincronizacao: { contagens: r.contagens, bloqueados: r.bloqueados },
      cursosContagens: {},
      cursosBloqueados: [],
    });
    return { ok: true, ...r };
  } catch (erro) {
    if (erro instanceof ErroAva && erro.codigo === 'token') {
      await atualizarConexao(userId, 'ava', { status: 'reconectar' }, { mensagem: erro.message });
      return { ok: false, reconectar: true, erro: erro.message };
    }
    console.error('sincronizar AVA:', erro.message);
    return { ok: false, erro: `Não foi possível sincronizar o AVA agora: ${erro.message}` };
  }
}

export async function sincronizarLyceumDaUsuaria(userId) {
  const segredo = await lerSegredo(userId, 'lyceum');
  if (!segredo?.matricula) return { ok: false, erro: 'O Lyceum não está conectado.' };

  try {
    const r = await sincronizarLyceum({ userId, matricula: segredo.matricula, senha: segredo.senha });
    await atualizarConexao(userId, 'lyceum', { status: 'conectado', ultima_sincronizacao: new Date().toISOString() }, {
      mensagem: null,
      ...(r.curso || {}),
      sincronizacao: { contagens: r.contagens, bloqueados: r.bloqueados },
    });
    return { ok: true, ...r };
  } catch (erro) {
    if (erro instanceof ErroLyceum && ['senha', 'captcha', 'recusado'].includes(erro.motivo)) {
      // Para na hora: nada de novas tentativas com a mesma senha.
      await atualizarConexao(userId, 'lyceum', { status: 'reconectar' }, { mensagem: erro.message });
      return { ok: false, reconectar: true, erro: erro.message };
    }
    console.error('sincronizar Lyceum:', erro.message);
    return { ok: false, erro: `Não foi possível sincronizar o Lyceum agora: ${erro.message}` };
  }
}
