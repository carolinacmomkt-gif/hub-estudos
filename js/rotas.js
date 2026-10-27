// Rotas por #hash: funcionam offline e sem configuração no servidor.
// "fixaCelular" indica o que aparece direto na barra inferior; o resto vai para "Mais".

export const ROTAS = [
  { id: 'inicio', titulo: 'Início', icone: 'inicio', fixaCelular: true },
  { id: 'faculdade', titulo: 'Faculdade', icone: 'faculdade', fixaCelular: true },
  { id: 'estudos', titulo: 'Estudos gerais', icone: 'estudos' },
  { id: 'substack', titulo: 'Substack', icone: 'substack' },
  { id: 'youtube', titulo: 'YouTube', icone: 'youtube' },
  { id: 'biblioteca', titulo: 'Biblioteca', icone: 'biblioteca' },
  { id: 'cadernos', titulo: 'Cadernos', icone: 'cadernos', fixaCelular: true },
  { id: 'questoes', titulo: 'Questões', icone: 'questoes' },
  { id: 'calendario', titulo: 'Calendário', icone: 'calendario', fixaCelular: true },
];

export const ROTA_CONFIGURACOES = { id: 'configuracoes', titulo: 'Configurações', icone: 'configuracoes' };

// Telas que não aparecem no menu (abertas por um botão).
const ROTAS_INTERNAS = [
  { id: 'caneta', titulo: 'Testar a caneta', icone: 'cadernos' },
  { id: 'foco', titulo: 'Sessão de foco', icone: 'estudos' },
  { id: 'resumo', titulo: 'Resumo da semana', icone: 'calendario' },
];

const TODAS = [...ROTAS, ROTA_CONFIGURACOES, ...ROTAS_INTERNAS];

// "#faculdade/abc" → rota faculdade com parametro "abc"
export function rotaAtual() {
  const [id, parametro = null] = location.hash.replace(/^#\/?/, '').split(/[?]/)[0].split('/');
  const rota = TODAS.find((r) => r.id === id) || ROTAS[0];
  return { ...rota, parametro: rota.id === id ? (parametro ? decodeURIComponent(parametro) : null) : null };
}
