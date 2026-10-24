// Conecta o AVA (Moodle da UniEVANGÉLICA) uma única vez.
//
// Recebe matrícula + senha, pede o token do app mobile, confere com
// core_webservice_get_site_info e guarda SÓ o token, criptografado, no Supabase.
// A senha é descartada na hora e nunca é registrada em log.
// Devolve o relatório do que está liberado (sem o token).
//
// Variáveis de ambiente: AVA_BASE_URL, TOKEN_CRYPTO_KEY e as do Supabase.

import { resposta, lerCorpo, texto } from '../lib/http.mjs';
import { exigirLogin, banco } from '../lib/supabase.mjs';
import { cifrar } from '../lib/cripto.mjs';
import { lerConfigPublica, pedirToken, lerSiteInfo, montarRelatorio } from '../lib/ava.mjs';

export default async (req) => {
  if (req.method !== 'POST') return resposta(405, { ok: false, erro: 'Use POST.' });

  const { usuaria, erro } = await exigirLogin(req);
  if (erro) return erro;

  const base = (process.env.AVA_BASE_URL || '').replace(/\/+$/, '');
  if (!base) return resposta(500, { ok: false, erro: 'Falta a variável AVA_BASE_URL na Netlify.' });

  const entrada = await lerCorpo(req);
  const matricula = texto(entrada?.matricula, 100).trim();
  let senha = texto(entrada?.senha, 200);
  if (!matricula || !senha) return resposta(400, { ok: false, erro: 'Preencha a matrícula e a senha do AVA.' });

  // A configuração pública não depende do login: as duas consultas vão juntas.
  const [config, login] = await Promise.all([lerConfigPublica(base), pedirToken(base, matricula, senha)]);
  senha = null; // não é mais necessária

  const etapas = [
    { nome: 'Configuração pública do AVA', ok: config.ok, detalhe: config.ok ? config.tipoLoginDescricao : config.detalhe },
    { nome: 'Gerar o token do app (moodle_mobile_app)', ok: login.ok, detalhe: login.ok ? 'Token gerado.' : login.detalhe },
  ];
  if (!login.ok) return resposta(200, { ok: false, etapas, config, erro: login.detalhe });

  const info = await lerSiteInfo(base, login.token);
  etapas.push({ nome: 'Ler core_webservice_get_site_info', ok: info.ok, detalhe: info.ok ? 'Funções liberadas lidas.' : info.detalhe });
  if (!info.ok) return resposta(200, { ok: false, etapas, config, erro: info.detalhe });

  const relatorio = montarRelatorio(info.dados);
  try {
    await banco.salvarCredencial(usuaria.id, 'ava', cifrar({ token: login.token, userid: info.dados.userid ?? null }));
    await banco.salvarConexao(usuaria.id, 'ava', {
      status: 'conectado',
      conectado_em: new Date().toISOString(),
      detalhe: {
        site: relatorio.site,
        totalFuncoes: relatorio.totalFuncoes,
        bloqueados: relatorio.metodos.filter((m) => !m.liberado).map((m) => m.nome),
        frequenciaNoAva: relatorio.frequencia.disponivel,
      },
    });
  } catch (falha) {
    console.error('ava-conectar: não salvou a conexão:', falha.message);
    etapas.push({ nome: 'Guardar o acesso criptografado', ok: false, detalhe: 'Não foi possível guardar no Supabase.' });
    return resposta(200, { ok: false, etapas, config, ...relatorio, erro: 'O AVA conectou, mas não consegui guardar o acesso. Tente de novo em instantes.' });
  }
  etapas.push({ nome: 'Guardar o acesso criptografado', ok: true, detalhe: 'Token guardado criptografado. A senha foi descartada.' });

  return resposta(200, { ok: true, etapas, config, ...relatorio });
};
