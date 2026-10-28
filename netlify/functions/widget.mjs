// Widgets do iPhone (Scriptable): GET com "Authorization: Bearer <código do widget>" e
// "?w=<parâmetro do widget>" (o nome que ela deu ao widget em Configurações, ou uma área).
// Só leitura. O código é gerado e desligado em Configurações (o app guarda só o hash).

import { resposta } from '../lib/http.mjs';
import { usuariaDoCodigo, resumoDoWidget } from '../lib/widget.mjs';

export default async (req) => {
  if (req.method !== 'GET') return resposta(405, { ok: false, erro: 'Use GET.' });
  const codigo = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  try {
    const userId = await usuariaDoCodigo(codigo);
    if (!userId) return resposta(401, { ok: false, erro: 'Código do widget inválido. Gere outro em Configurações.' });
    const parametro = new URL(req.url).searchParams.get('w') || '';
    return resposta(200, await resumoDoWidget(userId, parametro.slice(0, 60)));
  } catch (falha) {
    console.error('widget:', falha?.message);
    return resposta(200, { ok: false, erro: 'Não deu para ler agora.' });
  }
};
