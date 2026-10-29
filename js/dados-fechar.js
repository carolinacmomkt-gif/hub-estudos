// Fechar o dia e Diário do mês (Meu cantinho, parte 3). O fechamento grava na mesma linha do
// diário do "Como estou hoje" (tabela diario: humor, texto e dados.fechar), então os Padrões e a
// Retrospectiva enxergam o humor do mesmo jeito. Nada de trabalho nos números: pausas, água,
// leitura, hábitos e o que você fez por você.

import { iso } from './dados-habitos.js';
import { habitosDoDia, feitoNoDia } from './dados-habitos.js';
import { leituraDe, minutosNoDia } from './dados-leitura.js';
import { pausasDoDia } from './dados-cantinho.js';
import { HUMORES } from './hoje.js';

export { HUMORES };

export const linhaDoDiario = (estado, data) => (estado.diario || [])
  .filter((d) => !d.excluido_em && d.data === data)
  .sort((a, b) => String(b.atualizado_em).localeCompare(String(a.atualizado_em)))[0] || null;

// { bom, amanha, fechado_em } ou null
export const fechamentoDe = (linha) => (linha?.dados?.fechar?.fechado_em ? linha.dados.fechar : null);

export const rostoDoHumor = (valor) => HUMORES.find((h) => h.valor === Number(valor)) || null;

// O dia em números (só o que é seu).
export function resumoDoDia(estado, cantinho, hoje, agua = null) {
  const registros = estado.habitoRegistros || [];
  const habitos = habitosDoDia(estado.habitos || [], registros, hoje).lista;
  const feitasHoje = (estado.tarefas || []).filter((t) => !t.excluido_em && t.feita_em && iso(new Date(t.feita_em)) === hoje && t.area !== 'trabalho' && t.area !== 'consultoria').length;
  return {
    pausas: pausasDoDia(cantinho, hoje).length,
    agua,
    leitura: minutosNoDia(leituraDe(estado.config), hoje),
    habitos: { feitos: habitos.filter((h) => feitoNoDia(registros, h, hoje)).length, total: habitos.length },
    feitas: feitasHoje,
  };
}

// ---------------------------------------------------------------------------
// Mês
// ---------------------------------------------------------------------------

export const mesDe = (data) => String(data).slice(0, 7);

export function somarMeses(mes, n) {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const fmtMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
export const nomeDoMes = (mes) => { const t = fmtMes.format(new Date(`${mes}-01T12:00:00`)); return t.charAt(0).toUpperCase() + t.slice(1); };

export const NOMES_DIA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

// Os dias do mês com o que o diário tem: { data, dia, humor, texto, bom, amanha, fechado }
export function mesDoDiario(estado, mes, hoje) {
  const [a, m] = mes.split('-').map(Number);
  const total = new Date(a, m, 0).getDate();
  const dias = [];
  for (let d = 1; d <= total; d += 1) {
    const data = `${mes}-${String(d).padStart(2, '0')}`;
    const linha = linhaDoDiario(estado, data);
    const f = fechamentoDe(linha);
    dias.push({ data, dia: d, humor: Number(linha?.humor) > 0 ? Number(linha.humor) : null, texto: linha?.texto || '', bom: f?.bom || '', amanha: f?.amanha || '', fechado: Boolean(f), futuro: data > hoje, hoje: data === hoje });
  }
  const comHumor = dias.filter((x) => x.humor);
  const media = comHumor.length ? comHumor.reduce((t, x) => t + x.humor, 0) / comHumor.length : null;
  const primeiro = new Date(a, m - 1, 1).getDay(); // 0 = domingo
  return { mes, dias, media, fechados: dias.filter((x) => x.fechado).length, escritos: dias.filter((x) => x.texto || x.bom).length, vazioAntes: primeiro };
}
