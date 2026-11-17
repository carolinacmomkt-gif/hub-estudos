// Ações do robô do Google da R7 (Carol, 17/11/2026): gerar o código (o app guarda só o SHA-256 em
// config "robo_r7"), copiar o script e as propriedades, e a demanda de vídeos (escolher, copiar e marcar
// como pedido em config "r7-videos").

import { obterEstado, atualizarEstado } from './estado.js';
import { listar, salvar } from './persistencia.js';
import { confirmar } from './confirmar.js';
import { configPublica } from './nuvem.js';
import { clientesR7, fichaDe } from './views-r7.js';
import { linhasDaDemanda } from './views-robo.js';
import { textoDaDemanda } from './dados-robo.js';

let app; // { renderizar, avisoCurto }

export function ligarRobo(funcoes) { app = funcoes; }

function copiar(texto, ok = 'Copiado.') {
  if (!navigator.clipboard) return app.avisoCurto('Este navegador não deixa copiar.');
  navigator.clipboard.writeText(texto).then(() => app.avisoCurto(ok), () => app.avisoCurto('Não consegui copiar.'));
}

async function gravarConfig(chave, valor) {
  const atual = (await listar('config')).find((c) => c.chave === chave && !c.excluido_em);
  await salvar('config', { ...(atual || {}), chave, valor });
  atualizarEstado({ config: await listar('config') });
}

async function gerarCodigo() {
  const ligado = (obterEstado().config || []).some((c) => c.chave === 'robo_r7' && !c.excluido_em && c.valor?.hash);
  if (ligado && !(await confirmar('Gerar outro código? O robô com o código antigo para de entregar até você trocar nas Propriedades do script.', { botao: 'Gerar outro' }))) return;
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const codigo = `r7-${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codigo)))].map((b) => b.toString(16).padStart(2, '0')).join('');
  await gravarConfig('robo_r7', { hash, criado_em: new Date().toISOString() });
  atualizarEstado({ roboCodigo: codigo });
  app.renderizar();
}

async function copiarScript() {
  try {
    const r = await fetch('robo/bussola-robo-r7.gs', { cache: 'no-store' });
    if (!r.ok) throw new Error();
    copiar(await r.text(), 'Script copiado. Cole no editor do Apps Script.');
  } catch {
    app.avisoCurto('Não consegui buscar o script agora. Tente com internet.');
  }
}

async function pedidoEnviado() {
  const estado = obterEstado();
  const linhas = linhasDaDemanda(estado, clientesR7(estado), fichaDe).filter((l) => l.pedir.length && l.mes);
  if (!linhas.length) return;
  const atual = (estado.config || []).find((c) => c.chave === 'r7-videos' && !c.excluido_em)?.valor || {};
  const em = new Date().toISOString();
  const novos = linhas.flatMap((l) => l.pedir.map((v) => ({ cliente: l.nome, mes: l.mes, n: v.n, tipo: v.tipo, em })));
  // Guarda os pedidos dos últimos 8 meses (o resto não muda mais nada).
  const limite = new Date(Date.now() - 240 * 864e5).toISOString();
  const pedidos = [...(atual.pedidos || []).filter((p) => p.em >= limite && !novos.some((x) => x.cliente === p.cliente && x.mes === p.mes && x.n === p.n)), ...novos];
  await gravarConfig('r7-videos', { ...atual, pedidos, ultimoPedido: em });
  atualizarEstado({ r7VideosEscolha: {} });
  app.renderizar();
  app.avisoCurto(`${novos.length} ${novos.length === 1 ? 'vídeo marcado como pedido' : 'vídeos marcados como pedidos'} hoje.`);
}

export function cliqueRobo(alvo) {
  switch (alvo.dataset.acao) {
    case 'robo-gerar': gerarCodigo(); return true;
    case 'robo-script': copiarScript(); return true;
    case 'robo-copiar-prop': {
      const c = configPublica();
      copiar(alvo.dataset.prop === 'url' ? c.supabaseUrl : c.supabaseAnonKey, alvo.dataset.prop === 'url' ? 'Endereço copiado.' : 'Chave pública copiada.');
      return true;
    }
    case 'r7v-copiar': {
      const estado = obterEstado();
      copiar(textoDaDemanda(linhasDaDemanda(estado, clientesR7(estado), fichaDe)), 'Pedido copiado. Cole no grupo de gestão.');
      return true;
    }
    case 'r7v-enviado': pedidoEnviado(); return true;
    default: return false;
  }
}

export function mudancaRobo(alvo, tipo) {
  if (alvo.dataset?.acaoMudar !== 'r7v-escolher') return false;
  if (tipo !== 'change') return true;
  const chave = alvo.dataset.cliente;
  const marcados = [...document.querySelectorAll(`[data-acao-mudar="r7v-escolher"][data-cliente="${CSS.escape(chave)}"]:checked`)].map((x) => Number(x.value));
  atualizarEstado({ r7VideosEscolha: { ...(obterEstado().r7VideosEscolha || {}), [chave]: marcados } });
  app.renderizar();
  return true;
}
