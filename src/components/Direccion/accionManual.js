import { useCallback, useEffect, useRef, useState } from 'react';

// Una ACCIÓN MANUAL es una llamada que escribe (o que simula una escritura)
// en producción: una migración de datos, un importador, una semilla, un
// snapshot. H-66 es el incidente que la definió: el panel de Diagnósticos
// terminó mostrando "Ejecutada en firme (dry_run: false) — Escribió 0
// fila(s)" sin que nadie apretara el botón en esa carga de pantalla.
//
// LA REGLA, Y ES UNA SOLA: NINGUNA DE ESTAS LLAMADAS SALE SIN UN CLIC EN
// ESTA MISMA CARGA DE PANTALLA. De ahí las dos piezas de este archivo, y
// ninguna es una precaución teórica: las dos cierran un camino por el que el
// portal manda hoy un POST que nadie pidió.

// --- 1. El guardián de reentrada ------------------------------------------
//
// `disabled={corriendo}` NO alcanza y por eso esto existe. `setCorriendo` es
// asíncrono: entre el primer `click` y el re-render que pinta el botón
// deshabilitado hay una ventana en la que un segundo evento -un doble clic,
// un doble tap, Enter o Espacio mantenidos sobre el botón enfocado (el
// navegador repite el evento), un clic mientras la pestaña re-renderiza-
// entra por el mismo handler y dispara un SEGUNDO POST con `dry_run=false`.
// Esa segunda corrida es la que devuelve "Escribió 0 fila(s)", porque la
// primera ya había escrito todo; y como su respuesta llega tarde, repinta el
// panel cuando el operador ya estaba mirando otra cosa. Leído desde la
// pantalla, eso es exactamente "se ejecutó sola".
//
// El `ref` se lee y se escribe SINCRÓNICAMENTE, dentro del mismo tick del
// evento, así que el segundo disparo encuentra la puerta cerrada aunque
// React todavía no haya vuelto a renderizar. Un `useState` acá no serviría:
// tendría el mismo retraso que el `disabled` que vino a reforzar.
//
// El segundo disparo NO es un error y no se avisa: es el mismo gesto del
// operador contado dos veces. Simplemente no pasa nada.
export const useAccionManual = () => {
  const enVuelo = useRef(false);
  const [corriendo, setCorriendo] = useState(null);
  const vivo = useRef(true);

  useEffect(() => () => { vivo.current = false; }, []);

  // `etiqueta` es cuál de las acciones de la tarjeta está corriendo
  // ('simular' | 'ejecutar' | …): la pantalla la usa para el texto, y este
  // hook sólo la guarda.
  const correr = useCallback(async (etiqueta, fn) => {
    if (enVuelo.current) return;
    enVuelo.current = true;
    setCorriendo(etiqueta);
    try {
      await fn();
    } finally {
      enVuelo.current = false;
      // Desmontada la tarjeta, no se toca su estado: el pedido ya salió y su
      // respuesta no tiene dónde escribirse.
      if (vivo.current) setCorriendo(null);
    }
  }, []);

  return { corriendo, correr };
};

// --- 2. El reinicio al volver de la caché de navegación -------------------
//
// Montar la tarjeta la deja en "Todavía no se corrió" porque su estado vive
// en `useState` y nada lo persiste. Pero VOLVER CON EL BOTÓN ATRÁS no es
// montar: el back/forward cache de Chrome congela la página entera -el heap
// de JavaScript, el estado de React y los `fetch` en vuelo- y la restaura
// tal cual. La tarjeta reaparece con el resultado de la corrida anterior a
// la vista, con "Ejecutar en firme" habilitado por una simulación de OTRA
// carga de pantalla, y con un pedido que resuelve después de la restauración
// y repinta el panel solo.
//
// `pageshow` con `persisted: true` es el ÚNICO evento que este archivo
// escucha, y lo único que hace es BORRAR: deja la tarjeta como recién
// montada. No dispara un pedido, no reintenta nada y no lee nada de la red.
//
// NO se escucha `focus` ni `visibilitychange` A PROPÓSITO: volver de otra
// pestaña o de otra ventana no es una carga nueva de pantalla, y una tarjeta
// que se vacía porque alguien miró el mail haría perder el resultado que se
// estaba leyendo. Lo que se cierra acá es la restauración de un estado
// viejo, no el cambio de foco.
// `reiniciar` tiene que venir envuelto en useCallback: se usa como dep del
// efecto, así que una función nueva por render re-suscribiría el listener en
// cada render.
export const useReinicioAlRestaurar = (reiniciar) => {
  useEffect(() => {
    const alRestaurar = (e) => { if (e.persisted) reiniciar(); };
    window.addEventListener('pageshow', alRestaurar);
    return () => window.removeEventListener('pageshow', alRestaurar);
  }, [reiniciar]);
};
