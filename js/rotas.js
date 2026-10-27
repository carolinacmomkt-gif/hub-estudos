// Rotas por #hash: funcionam offline e sem configuração no servidor.
// "fixaCelular" indica o que aparece direto na barra inferior; o resto vai para "Mais".

// "grupo" é onde a rota começa no menu (a Carol pode mudar em "Editar menu").
export const ROTAS = [
  { id: 'inicio', titulo: 'Hoje', icone: 'inicio', fixaCelular: true, grupo: 'dia' },
  { id: 'tarefas', titulo: 'Tarefas e projetos', icone: 'tarefas', fixaCelular: true, grupo: 'dia' },
  { id: 'habitos', titulo: 'Hábitos e rotinas', icone: 'habitos', grupo: 'dia' },
  { id: 'calendario', titulo: 'Calendário', icone: 'calendario', fixaCelular: true, grupo: 'dia' },
  { id: 'foco', titulo: 'Sessão de foco', icone: 'foco', grupo: 'dia' },
  { id: 'faculdade', titulo: 'Faculdade', icone: 'faculdade', fixaCelular: true, grupo: 'faculdade' },
  { id: 'cadernos', titulo: 'Cadernos', icone: 'cadernos', grupo: 'faculdade' },
  { id: 'questoes', titulo: 'Questões', icone: 'questoes', grupo: 'faculdade' },
  { id: 'estudos', titulo: 'Estudos gerais', icone: 'estudos', grupo: 'estudos' },
  { id: 'biblioteca', titulo: 'Biblioteca', icone: 'biblioteca', grupo: 'estudos' },
  { id: 'youtube', titulo: 'YouTube', icone: 'youtube', grupo: 'criacao' },
  { id: 'substack', titulo: 'Substack', icone: 'substack', grupo: 'criacao' },
  { id: 'resumo', titulo: 'Resumo da semana', icone: 'calendario', grupo: 'dia' },
  { id: 'financas', titulo: 'Finanças', icone: 'financas', grupo: 'vida' },
  { id: 'recompensas', titulo: 'Recompensas', icone: 'estrela', grupo: 'dia' },
];

export const ROTA_CONFIGURACOES = { id: 'configuracoes', titulo: 'Configurações', icone: 'configuracoes' };

// Telas que não aparecem no menu (abertas por um botão).
const ROTAS_INTERNAS = [
  { id: 'caneta', titulo: 'Testar a caneta', icone: 'cadernos' },
];

const TODAS = [...ROTAS, ROTA_CONFIGURACOES, ...ROTAS_INTERNAS];

// "#faculdade/abc" → rota faculdade com parametro "abc"
export function rotaAtual() {
  const [id, parametro = null] = location.hash.replace(/^#\/?/, '').split(/[?]/)[0].split('/');
  const rota = TODAS.find((r) => r.id === id) || ROTAS[0];
  return { ...rota, parametro: rota.id === id ? (parametro ? decodeURIComponent(parametro) : null) : null };
}
