// El mensaje de cada toque y el link de WhatsApp.
//
// Lo que fijan estos tests:
//
//   1. Los tres toques NO son el mismo texto. Un bug de copy/paste que dejara
//      "¿pudiste verla?" en los tres convierte la cadencia en tres
//      insistencias, y desde la pantalla no se nota: las tres filas se ven
//      bien, el mensaje se lee bien, y lo único que pasa es que dejan de
//      contestar.
//   2. `telefonoWhatsapp` normaliza. `https://wa.me/54${telefono}` pelado es
//      el bug ya arreglado en la tabla de leads: con "+54 9 341 695-2259"
//      produce una URL con espacios y el 54 dos veces, y wa.me abre una
//      pestaña con un error en vez del chat.
import { describe, it, expect } from 'vitest';
import { mensajeSugerido, telefonoWhatsapp, linkWhatsapp } from './seguimientoMensajes';

const fila = (extra = {}) => ({
  nombre: 'Juan Pérez',
  vehiculo: 'Ford Focus 2019',
  compania: 'San Cristóbal',
  premio: 185000,
  numero_de_toque: 1,
  ...extra,
});

describe('mensajeSugerido', () => {
  it('el toque 1 pregunta por la cotización', () => {
    const msg = mensajeSugerido(fila({ numero_de_toque: 1 }));
    expect(msg).toContain('Hola Juan');
    expect(msg).toContain('pudiste ver la cotización');
    expect(msg).toContain('Ford Focus 2019');
    expect(msg).toContain('San Cristóbal');
  });

  it('el toque 2 pide un dato de valor y deja el hueco a completar', () => {
    const msg = mensajeSugerido(fila({ numero_de_toque: 2 }));
    expect(msg).toContain('dato');
    expect(msg).toContain('[escribí acá el dato de valor');
    expect(msg).not.toContain('pudiste ver la cotización');
  });

  it('el toque 3 es un cierre abierto, no un pedido de decisión', () => {
    const msg = mensajeSugerido(fila({ numero_de_toque: 3 }));
    expect(msg).toContain('la dejamos para más adelante');
    expect(msg).not.toContain('[escribí acá');
  });

  it('los tres toques son textos distintos', () => {
    const textos = [1, 2, 3].map((n) => mensajeSugerido(fila({ numero_de_toque: n })));
    expect(new Set(textos).size).toBe(3);
  });

  it('sin nombre ni vehículo sigue armando un mensaje usable', () => {
    const msg = mensajeSugerido({ numero_de_toque: 1 });
    expect(msg).toContain('Hola,');
    expect(msg).not.toContain('undefined');
    expect(msg).not.toContain('null');
  });

  it('un número de toque fuera de rango cae en el toque 1 y nunca queda vacío', () => {
    expect(mensajeSugerido(fila({ numero_de_toque: 9 }))).toContain('pudiste ver la cotización');
    expect(mensajeSugerido({}).length).toBeGreaterThan(10);
  });
});

describe('telefonoWhatsapp', () => {
  it('deja pasar un número ya normalizado', () => {
    expect(telefonoWhatsapp('5493416952259')).toBe('5493416952259');
  });

  it('saca los separadores y el + sin duplicar el 54', () => {
    expect(telefonoWhatsapp('+54 9 341 695-2259')).toBe('5493416952259');
  });

  it('le pone el 54 a un número local y le saca el 0 de discado', () => {
    expect(telefonoWhatsapp('03416952259')).toBe('543416952259');
    expect(telefonoWhatsapp('3416952259')).toBe('543416952259');
  });

  it('devuelve null cuando no hay con qué armar el link', () => {
    expect(telefonoWhatsapp('')).toBeNull();
    expect(telefonoWhatsapp(null)).toBeNull();
    expect(telefonoWhatsapp('123')).toBeNull();
  });
});

describe('linkWhatsapp', () => {
  it('arma la URL con el texto encodeado', () => {
    const url = linkWhatsapp('+54 9 341 695-2259', 'Hola ¿cómo va?');
    expect(url.startsWith('https://wa.me/5493416952259?text=')).toBe(true);
    expect(url).not.toMatch(/\s/);
    expect(decodeURIComponent(url.split('text=')[1])).toBe('Hola ¿cómo va?');
  });

  it('sin teléfono válido no inventa un link roto', () => {
    expect(linkWhatsapp('', 'hola')).toBeNull();
  });
});
