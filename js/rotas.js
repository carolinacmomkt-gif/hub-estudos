// Rotas por #hash: funcionam offline e sem configuração no servidor.
// "fixaCelular" indica o que aparece direto na barra inferior; o resto vai para "Mais".

export const ROTAS = [
  { id: 'inicio', titulo: 'Início', icone: 'inicio', fixaCelular: true },
  { id: 'faculdade', titulo: 'Faculdade', icone: 'faculdade', fixaCelular: true },
  { id: 'estudos', titulo: 'Estudos gerais', icone: 'estudos' },
  { id: 'substack', titulo: 'Substack', icone: 'substack' },
  { id: 'biblioteca', titulo: 'Biblioteca', icone: 'biblioteca' },
  { id: 'cadernos', titulo: 'Cadernos', icone: 'cadernos', fixaCelular: true },
  { id: 'questoes', titulo: 'Questões', icone: 'questoes' },
  { id: 'calendario', titulo: 'Calendário', icone: 'calendario', fixaCelular: true },
];

export const ROTA_CONFIGURACOES = { id: 'configuracoes', titulo: 'Configurações', icone: 'configuracoes' };

const TODAS = [...ROTAS, ROTA_CONFIGURACOES];

export function rotaAtual() {
  const id = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  return TODAS.find((rota) => rota.id === id) || ROTAS[0];
}
