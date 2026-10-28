// Backup automático sem tela: nome dos arquivos e quais cópias ficam guardadas.
// Fica: as 7 mais novas e, das mais antigas, a primeira de cada semana até 8 semanas.

export const PASTA_BACKUP = 'backups';
export const GUARDAR_DIARIAS = 7;
export const GUARDAR_SEMANAS = 8;

export const nomeDoBackup = (dia) => `bussola-${dia}.json.gz`;
export function diaDoBackup(nome) {
  const m = String(nome || '').match(/^bussola-(\d{4}-\d{2}-\d{2})\.json\.gz$/);
  return m ? m[1] : null;
}

const segundaDa = (dia) => {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

// Nomes que podem ser apagados (os que sobram da regra acima).
export function backupsParaApagar(nomes, hoje) {
  const dias = [...new Set((nomes || []).map(diaDoBackup).filter(Boolean))].sort().reverse();
  const ficam = new Set(dias.slice(0, GUARDAR_DIARIAS));
  const limite = new Date(Date.parse(`${hoje}T12:00:00Z`) - GUARDAR_SEMANAS * 7 * 864e5).toISOString().slice(0, 10);
  const semanas = new Map();
  for (const dia of [...dias].reverse()) { // do mais antigo para o mais novo: a primeira da semana fica
    if (dia < limite) continue;
    const s = segundaDa(dia);
    if (!semanas.has(s)) semanas.set(s, dia);
  }
  for (const dia of semanas.values()) ficam.add(dia);
  return (nomes || []).filter((n) => diaDoBackup(n) && !ficam.has(diaDoBackup(n)));
}
