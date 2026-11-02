// IA do relatório de métricas (Trabalho → Relatórios).
// lerPrints: lê os números dos prints do Instagram (só quando a Carol pede).
// escreverConsideracoes: escreve os tópicos do slide "Considerações" com os números que ela conferiu.

import { pedirJson, objeto, lista, texto, limpar, ErroIa } from './ia-comum.mjs';

export { ErroIa };

const METRICAS = ['visitas', 'toques', 'alcance', 'seguidores', 'interacoes'];
const numero = { type: 'object', properties: { achou: { type: 'boolean' }, valor: { type: 'number' } }, required: ['achou', 'valor'], additionalProperties: false };

const SISTEMA_LER = `Você lê prints das estatísticas (Insights / Painel profissional) do Instagram de uma cliente de agência e devolve os números do período.
Os prints podem estar em português ou inglês. Equivalências:
- visitas: "Visitas ao perfil" (Profile visits), dentro de "Atividade do perfil".
- toques: "Toques em links externos" (External link taps). Se houver vários tipos de toque (site, endereço, ligar), some só os de links externos; se só existir o total de toques em links, use ele.
- alcance: "Contas alcançadas" (Accounts reached). Nunca use "Visualizações" ou "Impressões" no lugar do alcance.
- seguidores: o saldo de seguidores do período ("Seguidores" com +N, ou "Ganhos" menos "Deixaram de seguir"). Pode ser negativo. Não é o total de seguidores do perfil.
- interacoes: "Interações com o conteúdo" / "Interações" (Content interactions). Não confunda com "Contas com engajamento".
Regras:
- Copie o número exato do print. "12,3 mil" = 12300; "1,2 mi" = 1200000. Em português o ponto separa milhar ("1.194" = 1194).
- Se o mesmo número aparecer em mais de um print, use o do período mais longo que corresponde ao mês do relatório.
- Se um número não aparecer em nenhum print, devolva achou=false e valor=0. Nunca invente nem estime.
- variacao: a porcentagem que o próprio print mostra em relação ao período anterior (ex.: "+23,4%" = 23.4, "-5%" = -5). Se não aparecer, achou=false.
- destaques: até 3 conteúdos com melhor desempenho que aparecem nos prints (lista de "Principais conteúdos", reels, posts). Para cada um: o índice do print (0 é o primeiro), a caixa da miniatura do post no print em frações de 0 a 1 (x, y = canto de cima à esquerda; w, h = largura e altura) e uma linha curta sobre o tema do conteúdo, se der para ler. Se não houver miniaturas de posts, devolva a lista vazia.
- periodo: o período que os prints mostram (ex.: "1 a 30 de setembro"), ou "" se não aparecer.
- avisos: uma frase curta se algo não bater (prints de períodos diferentes, de outro perfil, números cortados). Senão, "".`;

export async function lerPrints({ imagens, nome, mes }) {
  if (!imagens?.length) throw new ErroIa('Mande pelo menos um print.');
  const conteudo = [
    ...imagens.map((img) => ({ type: 'image', source: { type: 'base64', media_type: img.tipo, data: img.base64 } })),
    { type: 'text', text: `Cliente: ${limpar(nome, 120) || 'não informado'}\nMês do relatório: ${mes}\nLeia os ${imagens.length} print(s) acima (na ordem, o primeiro é o 0) e devolva os números.` },
  ];
  const esquema = objeto({
    numeros: objeto(Object.fromEntries(METRICAS.map((m) => [m, numero]))),
    variacao: objeto(Object.fromEntries(METRICAS.map((m) => [m, numero]))),
    destaques: lista('Até 3 conteúdos com melhor desempenho', objeto({
      print: { type: 'integer' }, x: { type: 'number' }, y: { type: 'number' }, w: { type: 'number' }, h: { type: 'number' }, tema: texto,
    })),
    periodo: texto,
    avisos: texto,
  });
  const r = await pedirJson({ system: SISTEMA_LER, conteudo, esquema, maxTokens: 3000, esforco: 'medium' });
  const pegar = (grupo, inteiro) => Object.fromEntries(METRICAS.map((m) => {
    const v = r?.[grupo]?.[m];
    if (!v?.achou || !Number.isFinite(Number(v.valor))) return [m, null];
    return [m, inteiro ? Math.round(Number(v.valor)) : Math.round(Number(v.valor) * 10) / 10];
  }));
  const fracao = (v) => Math.min(1, Math.max(0, Number(v) || 0));
  return {
    numeros: pegar('numeros', true),
    variacao: pegar('variacao', false),
    destaques: (Array.isArray(r?.destaques) ? r.destaques : []).slice(0, 3)
      .filter((d) => Number.isInteger(d.print) && d.print >= 0 && d.print < imagens.length)
      .map((d) => ({ print: d.print, x: fracao(d.x), y: fracao(d.y), w: fracao(d.w), h: fracao(d.h), tema: limpar(d.tema, 160) })),
    periodo: limpar(r?.periodo, 80),
    avisos: limpar(r?.avisos, 300),
  };
}

const SISTEMA_ESCREVER = `Você escreve o slide "Considerações" do relatório mensal de Instagram que a agência entrega à cliente (em geral médicos e profissionais de saúde).
Como escrever:
- Português do Brasil, frases curtas, tom de agência: direto, acolhedor e seguro. Fale do perfil e dos resultados, não da IA.
- Um tópico = 1 ou 2 frases. Comece pelo que aconteceu e diga o que isso significa.
- Use só os números e as comparações que vierem no pedido. Nunca invente número, porcentagem ou motivo.
- Se não houver comparação com o mês anterior, não diga que subiu nem que caiu.
- Queda se diz com calma e com o próximo passo, sem drama e sem culpar a cliente.
- Nada de travessão (—), de emoji, de exclamação, de jargão ("engajamento orgânico", "performance", "insights") e de exagero ("incrível", "explosão", "sucesso absoluto").
- Linha editorial: fale do tipo de conteúdo que se destacou (pelos temas informados) e do que manter no próximo mês. Se não houver temas, fale do equilíbrio do mês de forma geral, sem citar posts.`;

export async function escreverConsideracoes({ nome, mes, metricas, temas, topicos, observacoes }) {
  const conteudo = `<relatorio cliente="${limpar(nome, 120)}" mes="${limpar(mes, 40)}">
${metricas.map((m) => `- ${m.rotulo}: ${m.valor}${m.comparacao ? ` (${m.comparacao})` : ''}`).join('\n') || '- Sem números.'}
</relatorio>
${temas.length ? `<conteudos_em_destaque>\n${temas.map((t) => `- ${t}`).join('\n')}\n</conteudos_em_destaque>\n` : ''}${observacoes ? `<observacoes_da_carol>\n${observacoes}\n</observacoes_da_carol>\n` : ''}
Escreva um texto para cada tópico, nesta ordem: ${topicos.join(', ')}.`;
  const esquema = objeto({ topicos: lista('Um item por tópico, na ordem pedida', objeto({ titulo: texto, texto })) });
  const r = await pedirJson({ system: SISTEMA_ESCREVER, conteudo, esquema, maxTokens: 2000, esforco: 'low' });
  const itens = Array.isArray(r?.topicos) ? r.topicos : [];
  return topicos.map((titulo, i) => ({
    titulo,
    texto: String((itens.find((x) => limpar(x.titulo, 80).toLowerCase() === titulo.toLowerCase()) || itens[i] || {}).texto || '')
      .replace(/\s*—\s*/g, ', ').replace(/\s+/g, ' ').trim().slice(0, 600),
  }));
}
