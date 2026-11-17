import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TONS_DESTAQUE, tokensDoDestaque, cssDoDestaque, contraste, destaqueEscolhido } from '../js/dados-destaque.js';

const cores = [...TONS_DESTAQUE.map((t) => t.cor), '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#000000', '#FFFFFF', '#808080'];

test('todo tom tem contraste AA no escuro e no claro', () => {
  for (const cor of cores) {
    const t = tokensDoDestaque(cor);
    assert.ok(contraste(t.escuro['--cor-texto-destaque'], '#242424') >= 4.5, `texto escuro ${cor}`);
    assert.ok(contraste(t.escuro['--cor-destaque'], '#242424') >= 3, `detalhe escuro ${cor}`);
    assert.ok(contraste(t.escuro['--cor-sobre-preenchido'], t.escuro['--cor-preenchido']) >= 4.5, `preenchido escuro ${cor}`);
    assert.ok(contraste(t.escuro['--cor-sobre-destaque'], t.escuro['--cor-destaque']) >= 4.5, `sobre destaque escuro ${cor}`);
    assert.ok(contraste(t.claro['--cor-texto-destaque'], '#F1F1F1') >= 4.5, `texto claro ${cor}`);
    assert.ok(contraste(t.claro['--cor-sobre-preenchido'], t.claro['--cor-preenchido']) >= 4.5, `preenchido claro ${cor}`);
    assert.ok(contraste(t.claro['--cor-foco'], '#FFFFFF') >= 3, `foco claro ${cor}`);
  }
});

test('o padrão Areia e cor inválida não mudam nada', () => {
  assert.equal(destaqueEscolhido('#d9c6b3'), null);
  assert.equal(destaqueEscolhido('vermelho'), null);
  assert.equal(destaqueEscolhido('#9db8a2'), '#9DB8A2');
  assert.equal(cssDoDestaque('xx'), '');
  assert.match(cssDoDestaque('#9DB8A2'), /html:root\[data-tema="claro"\]\{--cor-destaque:#/);
});
