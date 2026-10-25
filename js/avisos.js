// Avisos de prazo neste aparelho (Web Push): ativar, desativar, testar e preferências.
// O aparelho se inscreve no serviço de push do navegador e a inscrição fica no Supabase;
// a função avisos-agendado (de hora em hora) é quem manda os avisos.

import { chaveDosAvisos, rest, idDaUsuaria } from './nuvem.js';
import { chamar } from './funcoes.js';
import { listar, salvar } from './persistencia.js';

// Igual a AVISOS_PADRAO em netlify/lib/avisos.mjs.
export const AVISOS_PADRAO = {
  hora: '08:00',
  fuso: 'America/Sao_Paulo',
  marcos: { '3d': true, '1d': true, dia: true },
  tipos: { prova: true, trabalho: true, atividade: true, revisao: true, youtube: true, aula: false, feriado: false, pessoal: false },
};

export function configDeAvisos(estado) {
  const v = (estado.config || []).find((c) => c.chave === 'avisos' && !c.excluido_em)?.valor || {};
  return {
    hora: v.hora || AVISOS_PADRAO.hora,
    fuso: v.fuso || AVISOS_PADRAO.fuso,
    marcos: { ...AVISOS_PADRAO.marcos, ...(v.marcos || {}) },
    tipos: { ...AVISOS_PADRAO.tipos, ...(v.tipos || {}) },
  };
}

function fusoDoAparelho() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || AVISOS_PADRAO.fuso;
  } catch {
    return AVISOS_PADRAO.fuso;
  }
}

export async function salvarConfigAvisos(valor) {
  const atual = (await listar('config')).find((c) => c.chave === 'avisos');
  await salvar('config', { ...(atual || {}), chave: 'avisos', valor: { ...valor, fuso: fusoDoAparelho() } });
}

export function suportaAvisos() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// No iPhone/iPad e em alguns navegadores, o push só existe com o app instalado.
function instalado() {
  return window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
}

async function inscricaoAtual() {
  if (!suportaAvisos()) return null;
  const registro = await navigator.serviceWorker.getRegistration();
  return registro ? registro.pushManager.getSubscription() : null;
}

// { estado: 'sem-suporte' | 'sem-chave' | 'bloqueado' | 'ativo' | 'inativo', instalado }
export async function situacaoAvisos() {
  if (!suportaAvisos()) return { estado: 'sem-suporte', instalado: instalado() };
  if (!chaveDosAvisos()) return { estado: 'sem-chave', instalado: instalado() };
  if (Notification.permission === 'denied') return { estado: 'bloqueado', instalado: instalado() };
  const inscricao = await inscricaoAtual().catch(() => null);
  return { estado: inscricao && Notification.permission === 'granted' ? 'ativo' : 'inativo', instalado: instalado() };
}

function bytesDaChave(base64url) {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function nomeDoAparelho() {
  const ua = navigator.userAgent;
  const sistema = /Android/i.test(ua) ? (/Mobile/i.test(ua) ? 'Celular Android' : 'Tablet Android')
    : /iPhone|iPad/i.test(ua) ? 'iPhone/iPad' : /Mac/i.test(ua) ? 'Mac' : /Windows/i.test(ua) ? 'Windows' : 'Aparelho';
  const navegador = /SamsungBrowser/i.test(ua) ? 'Samsung Internet' : /Edg\//i.test(ua) ? 'Edge' : /Firefox/i.test(ua) ? 'Firefox'
    : /Chrome/i.test(ua) ? 'Chrome' : /Safari/i.test(ua) ? 'Safari' : '';
  return navegador ? `${sistema} · ${navegador}` : sistema;
}

// Devolve null se deu certo, ou o texto do problema.
export async function ativarAvisos() {
  if (!suportaAvisos()) return 'Este navegador não recebe avisos. No tablet, use o app instalado pelo Chrome ou pelo Samsung Internet.';
  const chave = chaveDosAvisos();
  if (!chave) return 'Os avisos ainda não foram configurados na Netlify (faltam as chaves VAPID).';
  if (!navigator.onLine) return 'Sem internet agora. Ativar os avisos precisa de conexão.';
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') {
    return 'O navegador não deixou mandar avisos. Libere as notificações do Hub nas configurações do aparelho e tente de novo.';
  }
  try {
    const registro = await navigator.serviceWorker.ready;
    let inscricao = await registro.pushManager.getSubscription();
    if (!inscricao) inscricao = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytesDaChave(chave) });
    const { endpoint, keys } = inscricao.toJSON();
    await rest('assinaturas_push?on_conflict=user_id,endpoint', {
      metodo: 'POST',
      corpo: { user_id: idDaUsuaria(), endpoint, p256dh: keys.p256dh, auth: keys.auth, aparelho: nomeDoAparelho(), excluido_em: null },
      prefer: 'resolution=merge-duplicates,return=minimal',
    });
    // Guarda o fuso do aparelho com as preferências (os avisos saem no horário daqui).
    const atual = (await listar('config')).find((c) => c.chave === 'avisos');
    if (!atual || atual.valor?.fuso !== fusoDoAparelho()) await salvarConfigAvisos({ ...AVISOS_PADRAO, ...(atual?.valor || {}) });
    return null;
  } catch (erro) {
    return `Não foi possível ativar agora. ${erro.message || ''}`.trim();
  }
}

export async function desativarAvisos() {
  const inscricao = await inscricaoAtual().catch(() => null);
  if (!inscricao) return null;
  const { endpoint } = inscricao;
  await inscricao.unsubscribe().catch(() => {});
  try {
    await rest(`assinaturas_push?endpoint=eq.${encodeURIComponent(endpoint)}`, { metodo: 'DELETE', prefer: 'return=minimal' });
  } catch {
    // Sem internet: o servidor descobre sozinho na próxima tentativa (o aviso volta como expirado).
  }
  return null;
}

export const testarAvisos = () => chamar('avisos-teste', {});
