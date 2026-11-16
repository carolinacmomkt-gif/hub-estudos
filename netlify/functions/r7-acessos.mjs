// Acessos dos clientes da R7 (senhas e códigos de reserva). Sigiloso (Carol, 16/11/2026):
// grava criptografado com TOKEN_CRYPTO_KEY em acessos_clientes (RLS sem política: só esta função lê).
// O app nunca guarda a senha: "mostrar" devolve uma vez, e a tela esconde de novo depois de 30 s.
// Nunca entra no backup, na busca, na IA, no relatório nem na pauta.
// Corpo: { acao: 'listar', cliente } | { acao: 'mostrar', id } | { acao: 'gravar', cliente, id?, rotulo, usuario, senha, observacao }
//        | { acao: 'apagar', id } | { acao: 'apagar-cliente', cliente }

import { resposta, lerCorpo } from '../lib/http.mjs';
import { exigirLogin, banco } from '../lib/supabase.mjs';
import { cifrar, decifrar } from '../lib/cripto.mjs';

const TABELA = 'acessos_clientes';
const ID = /^[0-9a-f-]{36}$/i;
const CHAVE = /^[a-z0-9-]{1,60}$/;
const limpo = (v, max) => String(v ?? '').trim().slice(0, max);
const daUsuaria = (userId, extra) => `user_id=eq.${encodeURIComponent(userId)}${extra ? `&${extra}` : ''}`;

export default async (req) => {
  if (req.method !== 'POST') return resposta(405, { ok: false, erro: 'Use POST.' });
  const { usuaria, erro } = await exigirLogin(req);
  if (erro) return erro;
  const e = (await lerCorpo(req)) || {};
  try {
    if (e.acao === 'listar') {
      if (!CHAVE.test(e.cliente || '')) return resposta(400, { ok: false, erro: 'Cliente inválido.' });
      const linhas = await banco.listarTodas(TABELA, daUsuaria(usuaria.id, `cliente=eq.${encodeURIComponent(e.cliente)}&order=rotulo.asc`));
      // Só o rótulo e a data: a senha nunca sai na lista.
      return resposta(200, { ok: true, acessos: linhas.map((l) => ({ id: l.id, rotulo: l.rotulo, atualizado_em: l.atualizado_em })) });
    }
    if (e.acao === 'mostrar') {
      if (!ID.test(e.id || '')) return resposta(400, { ok: false, erro: 'Acesso inválido.' });
      const [l] = await banco.listarTodas(TABELA, daUsuaria(usuaria.id, `id=eq.${e.id}`));
      if (!l) return resposta(404, { ok: false, erro: 'Esse acesso não existe mais.' });
      const d = decifrar(l.dados_cifrados) || {};
      return resposta(200, { ok: true, acesso: { id: l.id, rotulo: l.rotulo, usuario: d.usuario || '', senha: d.senha || '', observacao: d.observacao || '' } });
    }
    if (e.acao === 'gravar') {
      if (!CHAVE.test(e.cliente || '')) return resposta(400, { ok: false, erro: 'Cliente inválido.' });
      const rotulo = limpo(e.rotulo, 80);
      if (!rotulo) return resposta(400, { ok: false, erro: 'Dê um nome ao acesso (ex.: Instagram).' });
      const dados = { usuario: limpo(e.usuario, 200), senha: limpo(e.senha, 500), observacao: limpo(e.observacao, 1000) };
      const linha = { user_id: usuaria.id, cliente: e.cliente, rotulo, dados_cifrados: cifrar(dados) };
      if (e.id) {
        if (!ID.test(e.id)) return resposta(400, { ok: false, erro: 'Acesso inválido.' });
        linha.id = e.id;
      }
      await banco.gravar(TABELA, [linha], 'id');
      return resposta(200, { ok: true });
    }
    if (e.acao === 'apagar') {
      if (!ID.test(e.id || '')) return resposta(400, { ok: false, erro: 'Acesso inválido.' });
      await banco.apagar(TABELA, daUsuaria(usuaria.id, `id=eq.${e.id}`));
      return resposta(200, { ok: true });
    }
    if (e.acao === 'apagar-cliente') {
      if (!CHAVE.test(e.cliente || '')) return resposta(400, { ok: false, erro: 'Cliente inválido.' });
      await banco.apagar(TABELA, daUsuaria(usuaria.id, `cliente=eq.${encodeURIComponent(e.cliente)}`));
      return resposta(200, { ok: true });
    }
    return resposta(400, { ok: false, erro: 'Pedido desconhecido.' });
  } catch (falha) {
    // Nunca registra o conteúdo, só o tipo do erro.
    console.error('r7-acessos:', falha?.message);
    const semTabela = /acessos_clientes|PGRST205|42P01/.test(falha?.message || '');
    return resposta(200, { ok: false, erro: semTabela ? 'Falta rodar a migração 016-r7.sql no Supabase.' : 'Não consegui mexer nos acessos agora. Tente de novo.' });
  }
};
