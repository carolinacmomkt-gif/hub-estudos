// Pessoas (Meu cantinho, parte 2): aniversários, o que cada um gosta, ideias de presente e
// "faz X dias que não fala". Nada de trabalho: é a sua gente. O estado fica em config "pessoas".

import { somarDias } from './dados-tarefas.js';
import { novoId } from './dados-cuidar.js';

export const pessoasDe = (config) => (config || []).find((c) => c.chave === 'pessoas' && !c.excluido_em)?.valor?.lista || [];

export const OPCOES_LEMBRAR = [
  { valor: 0, nome: 'não precisa' },
  { valor: 7, nome: 'a cada semana' },
  { valor: 14, nome: 'a cada 2 semanas' },
  { valor: 30, nome: 'a cada mês' },
  { valor: 90, nome: 'a cada 3 meses' },
];

// "12/03" ou "12/03/1998" → { mes, dia, ano|null }; também aceita "AAAA-MM-DD".
export function lerAniversario(texto) {
  const t = String(texto || '').trim();
  let m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(t);
  if (m) return valido({ dia: Number(m[1]), mes: Number(m[2]), ano: m[3] ? Number(m[3]) : null });
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return valido({ dia: Number(m[3]), mes: Number(m[2]), ano: Number(m[1]) });
  return null;
}

function valido(a) {
  if (a.mes < 1 || a.mes > 12 || a.dia < 1 || a.dia > 31) return null;
  if (a.ano !== null && (a.ano < 1900 || a.ano > 2100)) return null;
  return a;
}

export const textoAniversario = (a) => (a ? `${String(a.dia).padStart(2, '0')}/${String(a.mes).padStart(2, '0')}${a.ano ? `/${a.ano}` : ''}` : '');

export function novaPessoa({ nome, aniversario = '', gosta = '', lembrar = 0, presentes = '' }) {
  return {
    id: novoId(), nome: String(nome || '').trim().slice(0, 60), aniversario: lerAniversario(aniversario), gosta: String(gosta || '').trim().slice(0, 160),
    lembrar: Number(lembrar) || 0, ultimoContato: null, presentes: String(presentes || '').trim().slice(0, 160),
  };
}

// O próximo aniversário a partir de hoje: { data, faltam, idade|null }
export function proximoAniversario(p, hoje) {
  const a = p.aniversario;
  if (!a) return null;
  const ano = Number(hoje.slice(0, 4));
  const monta = (y) => { const d = new Date(y, a.mes - 1, Math.min(a.dia, 28 + (a.mes === 2 ? 0 : 3))); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  let data = monta(ano);
  if (data < hoje) data = monta(ano + 1);
  const faltam = Math.round((new Date(`${data}T12:00:00`) - new Date(`${hoje}T12:00:00`)) / 86400000);
  const idade = a.ano ? Number(data.slice(0, 4)) - a.ano : null;
  return { data, faltam, idade };
}

export const aniversariosProximos = (lista, hoje, dias = 30) => lista
  .map((p) => ({ pessoa: p, ...(proximoAniversario(p, hoje) || {}) }))
  .filter((x) => x.data && x.faltam <= dias)
  .sort((a, b) => a.faltam - b.faltam);

export function textoFaltam(n) {
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  return `em ${n} dias`;
}

// Quem faz tempo que você não fala: { pessoa, dias }
export function paraFalar(lista, hoje) {
  return lista.filter((p) => p.lembrar > 0).map((p) => {
    const dias = p.ultimoContato ? Math.round((new Date(`${hoje}T12:00:00`) - new Date(`${p.ultimoContato}T12:00:00`)) / 86400000) : null;
    return { pessoa: p, dias, passou: dias === null || dias >= p.lembrar };
  }).filter((x) => x.passou).sort((a, b) => (b.dias ?? 9999) - (a.dias ?? 9999));
}

export const textoContato = (p, hoje) => {
  if (!p.ultimoContato) return 'nunca marcou um contato';
  const dias = Math.round((new Date(`${hoje}T12:00:00`) - new Date(`${p.ultimoContato}T12:00:00`)) / 86400000);
  return dias === 0 ? 'falou hoje' : dias === 1 ? 'falou ontem' : `faz ${dias} dias que não fala`;
};

export const amanha = (hoje) => somarDias(hoje, 1);
