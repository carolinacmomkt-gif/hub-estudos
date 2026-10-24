// Peças comuns da sincronização da faculdade (AVA + Lyceum).

// Roda tarefas com no máximo N ao mesmo tempo (para não sobrecarregar o AVA nem estourar o tempo).
export async function emParalelo(itens, limite, fn) {
  const resultados = new Array(itens.length);
  let proximo = 0;
  async function trabalhador() {
    while (proximo < itens.length) {
      const i = proximo;
      proximo += 1;
      try {
        resultados[i] = await fn(itens[i], i);
      } catch (erro) {
        resultados[i] = { erro };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, trabalhador));
  return resultados;
}

const PALAVRAS_PEQUENAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o', 'as', 'os', 'para', 'por', 'com', 'na', 'no', 'nas', 'nos']);
const ROMANOS = /^(i|ii|iii|iv|v|vi|vii|viii|ix|x)$/i;

// "ESTATÍSTICA APLICADA À COMUNICAÇÃO II" → "Estatística Aplicada à Comunicação II"
export function nomeBonito(nome) {
  const limpo = String(nome || '').trim().replace(/\s+/g, ' ');
  if (!limpo) return '';
  if (limpo !== limpo.toUpperCase()) return limpo; // já vem com maiúsculas e minúsculas
  return limpo.toLowerCase().split(' ').map((palavra, i) => {
    if (ROMANOS.test(palavra)) return palavra.toUpperCase();
    if (i > 0 && (PALAVRAS_PEQUENAS.has(palavra) || palavra === 'à')) return palavra;
    return palavra.charAt(0).toUpperCase() + palavra.slice(1);
  }).join(' ');
}

// Palavras que identificam a disciplina, sem acento, código, turma ou semestre.
function palavrasDoNome(nome) {
  return String(nome || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/\b(turma|t\d+|\d{4}[./-]?\d?|\d+[ºo]?\s*periodo|semestre|ead|presencial)\b/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length > 1 && !PALAVRAS_PEQUENAS.has(p) && !/^\d+$/.test(p));
}

// Quanto dois nomes parecem a mesma disciplina (0 a 1).
export function semelhanca(a, b) {
  const pa = new Set(palavrasDoNome(a));
  const pb = new Set(palavrasDoNome(b));
  if (!pa.size || !pb.size) return 0;
  let comuns = 0;
  for (const p of pa) if (pb.has(p)) comuns += 1;
  return comuns / Math.min(pa.size, pb.size);
}

// Escolhe, entre as candidatas, a disciplina que melhor combina com o nome (ou null).
export function melhorCombinacao(nome, candidatas, campoNome) {
  let melhor = null;
  let pontos = 0;
  for (const c of candidatas) {
    const p = semelhanca(nome, c[campoNome] || c.nome);
    if (p > pontos) {
      pontos = p;
      melhor = c;
    }
  }
  return pontos >= 0.8 ? melhor : null;
}

// "8,5" → 8.5; "" → null
export function numero(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  let texto = String(valor).trim();
  if (texto.includes(',')) texto = texto.replace(/\./g, '').replace(',', '.'); // "1.234,5" → "1234.5"
  const n = Number(texto);
  return texto && Number.isFinite(n) ? n : null;
}

// Aceita segundos (Moodle), milissegundos, "dd/mm/aaaa [hh:mm]" ou ISO. Devolve ISO ou null.
export function dataIso(valor) {
  if (valor === null || valor === undefined || valor === '' || valor === 0) return null;
  if (typeof valor === 'number') return new Date(valor < 1e11 ? valor * 1000 : valor).toISOString();
  const texto = String(valor).trim();
  const br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (br) {
    const [, d, m, a, h = '12', min = '00'] = br;
    return new Date(`${a}-${m}-${d}T${h}:${min}:00-03:00`).toISOString();
  }
  if (/^\d+$/.test(texto)) return dataIso(Number(texto));
  const data = new Date(texto);
  return Number.isNaN(data.getTime()) ? null : data.toISOString();
}

export function textoSemHtml(html, limite = 2000) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, limite);
}

// Provas, trabalhos e atividades pelo nome (quizzes e eventos do calendário).
export function tipoPeloNome(nome, padrao = 'atividade') {
  const n = String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/\b(prova|avaliacao|exame|n1|n2|n3|av1|av2|simulado|recuperacao)\b/.test(n)) return 'prova';
  if (/\bferiado|recesso\b/.test(n)) return 'feriado';
  if (/\b(trabalho|seminario|projeto|artigo|resenha|relatorio)\b/.test(n)) return 'trabalho';
  return padrao;
}
