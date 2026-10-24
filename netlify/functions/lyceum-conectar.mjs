// Conecta o Lyceum uma única vez (decisão da Carol: sincronização automática).
//
// Faz um login para conferir matrícula e senha, lê o curso para confirmar o acesso
// e guarda matrícula + senha CRIPTOGRAFADAS no Supabase (AES-256-GCM).
// Só as funções conseguem abrir. A senha nunca volta para o app nem vai para log.
//
// Variáveis de ambiente: TOKEN_CRYPTO_KEY e as do Supabase (LYCEUM_BASE_URL opcional).

import { resposta, lerCorpo, texto } from '../lib/http.mjs';
import { exigirLogin, banco } from '../lib/supabase.mjs';
import { cifrar } from '../lib/cripto.mjs';
import { entrarNoLyceum } from '../lib/lyceum.mjs';

export default async (req) => {
  if (req.method !== 'POST') return resposta(405, { ok: false, erro: 'Use POST.' });

  const { usuaria, erro } = await exigirLogin(req);
  if (erro) return erro;

  const entrada = await lerCorpo(req);
  const matricula = texto(entrada?.matricula, 50).trim();
  let senha = texto(entrada?.senha, 200);
  if (!matricula || !senha) return resposta(400, { ok: false, erro: 'Preencha a matrícula e a senha do Lyceum.' });

  const sessao = await entrarNoLyceum(matricula, senha);
  if (!sessao.ok) {
    senha = null;
    return resposta(200, { ok: false, erro: sessao.erro });
  }

  // Confirma que os dados chegam e pega só o necessário para mostrar na tela.
  let curso = null;
  try {
    const dados = await sessao.ler('dadosAcademicos');
    curso = { curso: dados?.curso || null, turno: dados?.descrTurno || null, serie: dados?.descrSerie || null, situacao: dados?.situacaoAluno || null };
  } catch {
    senha = null;
    return resposta(200, { ok: false, erro: 'Entrou no Lyceum, mas os dados não vieram. Tente de novo em instantes.' });
  }

  try {
    await banco.salvarCredencial(usuaria.id, 'lyceum', cifrar({ matricula, senha }));
    senha = null;
    await banco.salvarConexao(usuaria.id, 'lyceum', {
      status: 'conectado',
      conectado_em: new Date().toISOString(),
      detalhe: curso,
    });
  } catch (falha) {
    senha = null;
    console.error('lyceum-conectar: não salvou a conexão:', falha.message);
    return resposta(200, { ok: false, erro: 'O Lyceum conectou, mas não consegui guardar o acesso. Tente de novo em instantes.' });
  }

  return resposta(200, { ok: true, curso });
};
