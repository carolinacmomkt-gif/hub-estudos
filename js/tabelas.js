// Tabelas que o app guarda no aparelho e sincroniza com o Supabase. Sem dependências: o backup
// automático (netlify/lib/backup.mjs) usa a mesma lista.

export const TABELAS = [
  'areas', 'disciplinas', 'materiais', 'eventos', 'notas_ava', 'notas_lyceum', 'frequencias',
  'avisos', 'artigos', 'pastas', 'cadernos', 'secoes', 'paginas', 'questoes', 'respostas',
  'revisoes', 'pautas_substack', 'caixa_entrada', 'config', 'conexoes', 'videos', 'simulados', 'sessoes_foco',
  'projetos', 'tarefas', 'habitos', 'habito_registros', 'diario', 'saude', 'clientes', 'consultoria', 'financas', 'casa', 'metas', 'lazer',
  'demandas', 'livro_paginas',
];
export const SOMENTE_LEITURA = new Set(['conexoes']); // quem escreve são as funções da Netlify
