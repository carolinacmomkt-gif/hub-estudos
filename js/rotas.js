// Rotas por #hash: funcionam offline e sem configuração no servidor.
// "fixaCelular" indica o que aparece direto na barra inferior; o resto vai para "Mais".

// "curto" é o nome na barra de baixo do celular.
// "grupo" é onde a rota começa no menu (a Carol pode mudar em "Editar menu").
export const ROTAS = [
  { id: 'inicio', titulo: 'Hoje', curto: 'Hoje', icone: 'inicio', fixaCelular: true, grupo: 'dia' },
  { id: 'tarefas', titulo: 'Tarefas e projetos', curto: 'Tarefas', icone: 'tarefas', fixaCelular: true, grupo: 'dia' },
  { id: 'habitos', titulo: 'Hábitos e rotinas', curto: 'Hábitos', icone: 'habitos', grupo: 'dia' },
  { id: 'calendario', titulo: 'Calendário', curto: 'Agenda', icone: 'calendario', fixaCelular: true, grupo: 'dia' },
  { id: 'foco', titulo: 'Sessão de foco', curto: 'Foco', icone: 'foco', grupo: 'dia' },
  { id: 'faculdade', titulo: 'Faculdade', curto: 'Faculdade', icone: 'faculdade', fixaCelular: true, grupo: 'faculdade' },
  { id: 'cadernos', titulo: 'Cadernos', curto: 'Cadernos', icone: 'cadernos', grupo: 'faculdade' },
  { id: 'questoes', titulo: 'Questões', curto: 'Questões', icone: 'questoes', grupo: 'faculdade' },
  { id: 'estudos', titulo: 'Estudos gerais', curto: 'Estudos', icone: 'estudos', grupo: 'estudos' },
  { id: 'biblioteca', titulo: 'Biblioteca', curto: 'Biblioteca', icone: 'biblioteca', grupo: 'estudos' },
  { id: 'youtube', titulo: 'YouTube', curto: 'YouTube', icone: 'youtube', grupo: 'criacao' },
  { id: 'substack', titulo: 'Substack', curto: 'Substack', icone: 'substack', grupo: 'criacao' },
  { id: 'resumo', titulo: 'Resumo da semana', curto: 'Semana', icone: 'calendario', grupo: 'dia' },
  { id: 'buscar', titulo: 'Pergunte à Bússola', curto: 'Buscar', icone: 'buscar', grupo: 'dia' },
  { id: 'financas', titulo: 'Finanças', curto: 'Finanças', icone: 'financas', grupo: 'vida' },
  { id: 'metas', titulo: 'Metas e lazer', curto: 'Metas', icone: 'metas', grupo: 'vida' },
];

export const ROTA_CONFIGURACOES = { id: 'configuracoes', titulo: 'Configurações', icone: 'configuracoes' };

// Telas que não aparecem no menu (abertas por um botão).
const ROTAS_INTERNAS = [
  { id: 'caneta', titulo: 'Testar a caneta', icone: 'cadernos' },
  { id: 'livro', titulo: 'Leitor', icone: 'biblioteca' },
  { id: 'retrospectiva', titulo: 'Retrospectiva do mês', icone: 'calendario' },
];

const TODAS = [...ROTAS, ROTA_CONFIGURACOES, ...ROTAS_INTERNAS];

// "#faculdade/abc" → rota faculdade com parametro "abc"
export function rotaAtual() {
  const [id, parametro = null] = location.hash.replace(/^#\/?/, '').split(/[?]/)[0].split('/');
  const rota = TODAS.find((r) => r.id === id) || ROTAS[0];
  return { ...rota, parametro: rota.id === id ? (parametro ? decodeURIComponent(parametro) : null) : null };
}
