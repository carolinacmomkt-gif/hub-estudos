// Grupo Trabalho: o que é copiado do Notion (os mesmos calendários e bases de clientes do Pauta).
// Para incluir ou tirar um calendário, é só mudar esta lista. A conexão do Notion do trabalho precisa
// estar ligada à página de cada calendário (••• → Conexões).
// cliente null: o calendário tem vários clientes, e o nome vem do campo "Cliente" de cada card.

export const CALENDARIOS = [
  { nome: 'Central', banco: 'd2b6ab58-aa97-83d8-b27c-813bbcce7fca', cliente: null, clientePadrao: 'Carol' },
  { nome: 'Cronograma Gustavo', banco: '44d6ab58-aa97-83e5-9193-0102653b9f4e', cliente: 'Gustavo', clientePadrao: 'Gustavo' },
  { nome: 'Dra. Carla Lenita', banco: '6f36ab58-aa97-83c5-928e-014d660943fb', cliente: 'Dra. Carla Lenita', clientePadrao: 'Dra. Carla Lenita' },
  { nome: 'Dra. Anisse', banco: '3336ab58-aa97-813f-a502-f4400b19bba6', cliente: 'Dra. Anisse', clientePadrao: 'Dra. Anisse' },
  { nome: 'Dra. Larissa', banco: '4536ab58-aa97-82d8-903b-8194c242d408', cliente: 'Dra. Larissa', clientePadrao: 'Dra. Larissa' },
  { nome: 'Dra. Lorena Prudente', banco: 'b1f6ab58-aa97-8226-b5f4-818f12bc56a0', cliente: 'Dra. Lorena Prudente', clientePadrao: 'Dra. Lorena Prudente' },
  { nome: 'Portal da Carol', banco: '3126ab58-aa97-81a6-9f6c-cd487860f799', cliente: 'Carol', clientePadrao: 'Carol' },
  { nome: 'Essence', banco: '3526ab58-aa97-8190-b48b-e589a25e1145', cliente: 'Essence', clientePadrao: 'Essence' },
];

export const BASES_DE_CLIENTES = [
  { nome: 'Clientes da Central', banco: 'd966ab58-aa97-831c-b82f-018c46914632' },
  { nome: 'Clientes da Essence', banco: '2f06ab58-aa97-81d1-a158-c61a22c4245f' },
];

// Os testes trocam a lista por calendários falsos (sem tocar no Notion de verdade).
export function fontes() {
  if (process.env.HUB_TESTE_LOCAL === '1' && process.env.TRABALHO_FONTES) return JSON.parse(process.env.TRABALHO_FONTES);
  return { calendarios: CALENDARIOS, bases: BASES_DE_CLIENTES };
}

// Os calendários que o Trabalho lê: os do Pauta (menos os que ela desligou) e os que ela acrescentou em
// Configurações → Trabalho (conexão "notion_trabalho": detalhe.calendariosDesligados e calendariosExtras).
export function calendariosDaConexao(detalhe = {}) {
  const desligados = new Set(detalhe.calendariosDesligados || []);
  const base = fontes().calendarios.filter((c) => !desligados.has(c.banco)).map((c) => ({ ...c, doPauta: true }));
  const extras = (detalhe.calendariosExtras || []).filter((c) => c?.banco && !base.some((b) => b.banco === c.banco) && !desligados.has(c.banco));
  return [...base, ...extras.map((c) => ({ nome: c.nome, banco: c.banco, cliente: c.cliente || null, clientePadrao: c.cliente || 'Carol', doPauta: false }))];
}
