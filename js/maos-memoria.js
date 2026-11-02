// A versão mais nova dos trabalhos do Com as mãos (antes de chegar ao IndexedDB). A tela e as ações leem
// daqui, para um redesenho no meio da pintura (ex.: chegou uma sincronização) não voltar um traço atrás.
export const atuais = new Map(); // id → dados
export const dadosDe = (linha) => (linha ? atuais.get(linha.id) || linha.dados || {} : {});
