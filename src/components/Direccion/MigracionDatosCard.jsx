import React, { useCallback, useState } from 'react';
import { Icon } from '../Icons';
import { useAccionManual, useReinicioAlRestaurar } from './accionManual';
import { sanear } from './diagnosticosCatalogo';
import { Cargando, ErrorCarga, Panel, botonPrimario, botonSecundario } from './DireccionComunes';

// Una migración de datos, corrida desde la pantalla con la sesión del admin.
//
// LAS CUATRO REGLAS DE ESTA TARJETA, Y NINGUNA ES DECORACIÓN:
//
// 0. NADA SALE SIN UN CLIC EN ESTA MISMA CARGA DE PANTALLA. Es la regla que
//    dejó H-66: el panel terminó en "Ejecutada en firme (dry_run: false) -
//    Escribió 0 fila(s)" sin que nadie apretara nada. La tarjeta no tiene un
//    solo `useEffect` que pida datos, no persiste su estado en ningún lado y
//    no reintenta sola; lo que faltaba -y está en accionManual.js- es el
//    guardián de reentrada, porque `disabled` llega un render tarde, y el
//    reinicio al volver del back/forward cache, que restaura el estado
//    entero de la página como si nunca se hubiera ido.
//
// 1. NO SE PUEDE EJECUTAR EN FIRME SIN HABER SIMULADO ANTES, en esta misma
//    pantalla y en esta misma sesión. El botón nace deshabilitado y lo
//    habilita la simulación, no el tiempo ni la costumbre. Estas tres tocan
//    `origen` de todas las oportunidades, afirman algo sobre LOOP que nadie
//    declaró en su momento y escriben la patente de un auto concreto: un
//    mapeo mal decidido no se deshace con un redeploy.
//
// 2. LA CONFIRMACIÓN ES ESCRITA. Hay que tipear EJECUTAR. Un segundo click
//    en un diálogo se da sin leer; escribir una palabra obliga a mirar qué
//    dice arriba. La comparación es EXACTA y en mayúsculas: si el aviso pide
//    EJECUTAR, aceptar "ejecutar" enseña que el texto del aviso es
//    aproximado.
//
// 3. UNA SIMULACIÓN VIEJA NO HABILITA LA NUEVA. Ejecutar en firme borra la
//    simulación y ofrece "Simular de nuevo": esa segunda corrida en seco es
//    la verificación de que quedó en 0, y es la única forma de comprobarlo
//    sin volver a escribir.
//
// `sin_mapeo` se muestra RESALTADO y aparte del resto del detalle: es lo que
// la migración NO tocó porque no tiene mapeo declarado, y lo decide una
// persona. Adivinar que "fb" es META_ADS convertiría el texto libre en un
// vocabulario cerrado que miente con más prolijidad.

const PALABRA_CONFIRMACION = 'EJECUTAR';

const textoValor = (v) => {
  if (v === true) return 'Sí';
  if (v === false) return 'No';
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

// El detalle de cada migración es una forma distinta (tablas de mapeo,
// conteos, listas). Se imprime TAL CUAL en vez de con un layout por
// migración: lo que hay que poder leer es lo que el backend contestó, y un
// layout a medida esconde la clave que se agregue mañana.
const TablaDeValores = ({ titulo, datos, resaltado = false }) => {
  if (datos === null || datos === undefined) return null;
  const filas = Array.isArray(datos)
    ? datos.map((v, i) => [String(i + 1), v])
    : (typeof datos === 'object' ? Object.entries(datos) : [['valor', datos]]);
  if (filas.length === 0) {
    return (
      <div>
        <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">{titulo}</p>
        <p className="text-slate-500 text-sm">Vacío</p>
      </div>
    );
  }
  return (
    <div>
      <p className={`text-xs uppercase tracking-wide mb-1 ${resaltado ? 'text-amber-300' : 'text-slate-400'}`}>
        {titulo}
      </p>
      <div className={`rounded-lg border divide-y ${
        resaltado ? 'border-amber-500/50 divide-amber-500/20 bg-amber-500/10' : 'border-slate-700 divide-slate-700 bg-slate-900/60'
      }`}>
        {filas.map(([clave, valor]) => (
          <div key={clave} className="flex justify-between gap-3 px-3 py-1.5 text-sm">
            <span className="text-slate-300 break-all">{clave}</span>
            <span className={`font-semibold break-all text-right ${resaltado ? 'text-amber-200' : 'text-white'}`}>
              {textoValor(valor)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Detalle = ({ resultado }) => {
  const detalle = sanear(resultado?.detalle) || {};
  const verificacion = sanear(resultado?.verificacion) || {};
  // `sin_mapeo` puede venir en la raíz del detalle o dentro de cada tabla:
  // se buscan las dos formas en vez de asumir una, que es lo que haría que
  // la advertencia desapareciera en silencio.
  const sinMapeo = Object.entries(detalle).filter(([k]) => /sin_mapeo/i.test(k));
  const resto = Object.fromEntries(Object.entries(detalle).filter(([k]) => !/sin_mapeo/i.test(k)));

  return (
    <div className="space-y-3">
      {sinMapeo.map(([clave, valor]) => (
        <TablaDeValores key={clave} titulo={`${clave} — NO se tocó, lo decide una persona`} datos={valor} resaltado />
      ))}
      {Object.entries(resto).map(([clave, valor]) => (
        <TablaDeValores key={clave} titulo={clave} datos={valor} />
      ))}
      <TablaDeValores titulo="verificación (después de escribir, antes del commit)" datos={verificacion} />
    </div>
  );
};

const MigracionDatosCard = ({ token, migracion }) => {
  const [simulacion, setSimulacion] = useState(null);
  const [ejecucion, setEjecucion] = useState(null);
  const [error, setError] = useState(null);
  const [confirmacion, setConfirmacion] = useState('');
  // 'simular' | 'ejecutar' | null. El guardián de reentrada vive acá adentro:
  // un segundo disparo del mismo gesto no vuelve a pegarle al backend.
  const { corriendo, correr } = useAccionManual();

  // Volver con el botón Atrás restaura la página congelada, no la monta de
  // nuevo: sin esto, la tarjeta reaparece con el resultado viejo y con
  // "Ejecutar en firme" habilitado por una simulación de otra carga de
  // pantalla. Se borra todo y queda en "Todavía no se corrió".
  const reiniciar = useCallback(() => {
    setSimulacion(null); setEjecucion(null); setError(null); setConfirmacion('');
  }, []);
  useReinicioAlRestaurar(reiniciar);

  const simular = () => correr('simular', async () => {
    setError(null); setEjecucion(null); setConfirmacion('');
    try {
      setSimulacion(await migracion.ejecutar(token, true));
    } catch (err) {
      setError(err.message); setSimulacion(null);
    }
  });

  const ejecutar = () => correr('ejecutar', async () => {
    // LA PRECONDICIÓN SE VUELVE A MIRAR ACÁ ADENTRO, no sólo en `disabled`.
    // Un atributo del DOM es lo que la pantalla muestra; esto es lo que
    // decide si sale el POST. Si alguna vez un evento llega con el botón ya
    // habilitado por un estado viejo, acá se corta.
    if (!simulacion || confirmacion !== PALABRA_CONFIRMACION) return;
    setError(null);
    try {
      const r = await migracion.ejecutar(token, false);
      setEjecucion(r);
      // La simulación se descarta: la próxima ejecución en firme necesita su
      // propia corrida en seco, sobre el estado que dejó ésta.
      setSimulacion(null);
      setConfirmacion('');
    } catch (err) {
      setError(err.message);
    }
  });

  const puedeEjecutar = Boolean(simulacion) && confirmacion === PALABRA_CONFIRMACION && !corriendo;

  return (
    <Panel
      titulo={migracion.titulo}
      subtitulo={migracion.descripcion}
      acciones={
        <button type="button" className={botonSecundario} onClick={simular} disabled={Boolean(corriendo)}>
          {corriendo === 'simular' ? 'Simulando…' : (ejecucion ? 'Simular de nuevo' : 'Simular')}
        </button>
      }
    >
      <div className="p-4 space-y-4">
        {corriendo && <Cargando texto={corriendo === 'simular' ? 'Simulando…' : 'Ejecutando en firme…'} />}

        {error && !corriendo && (
          <ErrorCarga mensaje={error} que="la migración" onReintentar={simular} />
        )}

        {!corriendo && !simulacion && !ejecucion && !error && (
          <p className="text-slate-400 text-sm">
            Todavía no se corrió. Apretá <strong>Simular</strong>: la corrida en seco recorre el
            mismo camino que la de verdad -los UPDATE incluidos- y termina en <code>rollback</code>,
            así que los conteos que muestre son los reales.
          </p>
        )}

        {!corriendo && simulacion && (
          <>
            <div role="status" className="rounded-lg border p-3 text-sm bg-sky-500/15 border-sky-500/50 text-sky-100">
              <p className="font-semibold flex items-center gap-2">
                <Icon name="magnifying-glass" size={16} className="shrink-0" />
                Simulación — no se escribió nada (dry_run: {String(simulacion.dry_run)})
              </p>
              <p className="mt-1">
                Afectaría <strong>{simulacion.filas_afectadas}</strong> fila(s).
                {simulacion.filas_afectadas === 0 && ' Nada que hacer: ya está aplicada, o no hay casos en esta base.'}
              </p>
            </div>

            <Detalle resultado={simulacion} />

            <div className="border border-red-500/40 bg-red-500/10 rounded-lg p-3 space-y-3">
              <p className="text-red-100 text-sm">
                <strong>Ejecutar en firme escribe en producción y no se deshace con un redeploy.</strong>
                {' '}Mirá la tabla de arriba antes. Para habilitar el botón, escribí{' '}
                <span className="font-mono font-semibold">{PALABRA_CONFIRMACION}</span>.
              </p>
              <input
                type="text"
                aria-label={`Escribí ${PALABRA_CONFIRMACION} para habilitar la ejecución en firme`}
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
                placeholder={PALABRA_CONFIRMACION}
                className="w-full max-w-xs px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm font-mono"
              />
              <div>
                <button type="button" className={botonPrimario} onClick={ejecutar} disabled={!puedeEjecutar}>
                  Ejecutar en firme
                </button>
              </div>
            </div>
          </>
        )}

        {!corriendo && ejecucion && (
          <>
            <div role="status" className="rounded-lg border p-3 text-sm bg-green-500/15 border-green-500/50 text-green-100">
              <p className="font-semibold flex items-center gap-2">
                <Icon name="check-badge" size={16} className="shrink-0" />
                Ejecutada en firme (dry_run: {String(ejecucion.dry_run)})
              </p>
              <p className="mt-1">
                Escribió <strong>{ejecucion.filas_afectadas}</strong> fila(s).
                {' '}Corré <strong>Simular de nuevo</strong> para verificar que ahora quede en 0.
              </p>
            </div>
            <Detalle resultado={ejecucion} />
          </>
        )}
      </div>
    </Panel>
  );
};

export default MigracionDatosCard;
