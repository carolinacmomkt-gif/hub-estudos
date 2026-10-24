// Respostas JSON das funções.

export function resposta(status, corpo) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function lerCorpo(req) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export function texto(valor, max) {
  return typeof valor === 'string' && valor.length <= max ? valor : '';
}
