// Rotas por #hash: funcionam offline e sem configuração no servidor.
// "fixaCelular" indica o que aparece direto na barra inferior; o resto vai para "Mais".

// "curto" é o nome na barra de baixo do celular.
// "grupo" é onde a rota começa no menu (a Carol pode mudar em "Editar menu").
export const ROTAS = [
  // Hoje: executar
  { id: 'inicio', titulo: 'Hoje', curto: 'Hoje', icone: 'inicio', fixaCelular: true, grupo: 'dia' },
  { id: 'calendario', titulo: 'Calendário', curto: 'Agenda', icone: 'calendario', fixaCelular: true, grupo: 'dia' },
  { id: 'foco', titulo: 'Sessão de foco', curto: 'Foco', icone: 'foco', grupo: 'dia' },
  { id: 'entrada', titulo: 'Entrada', curto: 'Entrada', icone: 'entrada', grupo: 'dia' },
  { id: 'buscar', titulo: 'Pergunte à Bússola', curto: 'Buscar', icone: 'buscar', grupo: 'dia' },
  // Planejar: planejar e revisar
  { id: 'tarefas', titulo: 'Tarefas e projetos', curto: 'Tarefas', icone: 'tarefas', fixaCelular: true, grupo: 'planejar' },
  { id: 'projetos', titulo: 'Projetos', curto: 'Projetos', icone: 'projetos', grupo: 'planejar' },
  { id: 'portfolio', titulo: 'Painel de projetos', curto: 'Painel', icone: 'painel', grupo: 'planejar' },
  { id: 'revisao', titulo: 'Revisão da semana', curto: 'Revisão', icone: 'revisao', grupo: 'planejar' },
  { id: 'metas', titulo: 'Metas e lazer', curto: 'Metas', icone: 'metas', grupo: 'planejar' },
  { id: 'habitos', titulo: 'Hábitos e rotinas', curto: 'Hábitos', icone: 'habitos', grupo: 'planejar' },
  { id: 'resumo', titulo: 'Resumo da semana', curto: 'Semana', icone: 'calendario', grupo: 'planejar' },
  // Trabalho, na ordem do fluxo: planejar → produzir → aprovar → entregar → medir
  { id: 'clientes', titulo: 'Clientes', curto: 'Clientes', icone: 'clientes', grupo: 'trabalho' },
  { id: 'radar', titulo: 'Radar do nicho', curto: 'Radar', icone: 'radar', grupo: 'trabalho' },
  { id: 'conteudo', titulo: 'Conteúdo', curto: 'Conteúdo', icone: 'conteudo', grupo: 'trabalho' },
  { id: 'criar', titulo: 'Criar', curto: 'Criar', icone: 'criar', grupo: 'trabalho' },
  { id: 'aprovar', titulo: 'Aprovar', curto: 'Aprovar', icone: 'aprovar', grupo: 'trabalho' },
  { id: 'pautas', titulo: 'Pautas', curto: 'Pautas', icone: 'pauta', grupo: 'trabalho' },
  { id: 'relatorio', titulo: 'Relatórios', curto: 'Relatórios', icone: 'relatorio', grupo: 'trabalho' },
  // Estudos (a Faculdade entra aqui; está acabando)
  { id: 'biblioteca', titulo: 'Biblioteca', curto: 'Biblioteca', icone: 'biblioteca', grupo: 'estudos' },
  { id: 'estudos', titulo: 'Estudos gerais', curto: 'Estudos', icone: 'estudos', grupo: 'estudos' },
  { id: 'cadernos', titulo: 'Cadernos', curto: 'Cadernos', icone: 'cadernos', grupo: 'estudos' },
  { id: 'faculdade', titulo: 'Faculdade', curto: 'Faculdade', icone: 'faculdade', fixaCelular: true, grupo: 'estudos' },
  // Criação
  { id: 'youtube', titulo: 'YouTube', curto: 'YouTube', icone: 'youtube', grupo: 'criacao' },
  { id: 'substack', titulo: 'Substack', curto: 'Substack', icone: 'substack', grupo: 'criacao' },
  // Vida
  { id: 'financas', titulo: 'Finanças', curto: 'Finanças', icone: 'financas', grupo: 'vida' },
  { id: 'cantinho', titulo: 'Meu cantinho', curto: 'Cantinho', icone: 'cantinho', grupo: 'vida' },
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
