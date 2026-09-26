import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from '../Icons';
import { obtenerResumenDireccion } from '../Direccion/finanzasApi';
import { formatearMonto, etiqueta } from '../Direccion/direccionConstantes';
import TechoNoSumado from '../ArtCartera/TechoNoSumado';

// Los cuatro bloques del resumen de Dirección en el Dashboard principal.
// GET /api/v1/dashboard/resumen-direccion (ADMIN-only, require_admin en el
// backend): esta pieza sólo se monta para ADMIN y para los demás roles el
// dashboard queda exactamente como estaba.
//
// LA REGLA, la misma que la del servicio del backend: **NUNCA RENDERIZAR 0
// CUANDO `disponible` ES FALSE**. Un "siniestros abiertos: 0" porque la
// tabla está vacía y otro porque de verdad no hay ninguno abierto son la
// misma pantalla con dos significados opuestos. Si `disponible` es false se
// muestra "Sin dato todavía" y el `motivo` que mandó el backend, y nada más.
//
// Los montos llegan como STRING (Decimal serializado): se formatean con
// formatearMonto, que no los suma ni los pasa por float.

// Cartel único de "no hay de dónde sacar este número". El motivo es del
// backend: no se reescribe ni se resume, es el que dice qué falta cargar.
export const SinDato = ({ motivo }) => (
  <div className="mt-3">
    <p className="text-slate-300 text-sm font-medium">Sin dato todavía</p>
    {motivo && <p className="text-slate-500 text-xs mt-1 leading-snug">{motivo}</p>}
  </div>
);

const Cifra = ({ etiqueta: texto, valor, alerta, ayuda }) => (
  <div className="min-w-0">
    <p className={`text-2xl font-bold leading-tight ${alerta ? 'text-red-300' : 'text-white'}`}>
      {valor === null || valor === undefined ? '—' : valor}
    </p>
    <p className="text-[11px] text-slate-400 leading-tight mt-0.5">{texto}</p>
    {ayuda && <p className="text-[10px] text-slate-500 leading-tight">{ayuda}</p>}
  </div>
);

const Tarjeta = ({ titulo, icono, onClick, irA, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={`${titulo}. Ir a ${irA}`}
    className="text-left bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-blue-500/60 rounded-xl p-4 transition flex flex-col"
  >
    <div className="flex items-center justify-between gap-2">
      <h4 className="font-semibold text-white flex items-center gap-2">
        <Icon name={icono} size={18} className="text-blue-300 shrink-0" />
        {titulo}
      </h4>
      <span className="text-[11px] text-slate-500 flex items-center gap-1 whitespace-nowrap">
        {irA} <Icon name="arrow-right" size={12} />
      </span>
    </div>
    <div className="mt-1 flex-1">{children}</div>
  </button>
);

// Desglose de empresas_sin_comision_estimable (backend ART-111 B3): las
// claves son MOTIVOS_RELEVAMIENTO y vienen siempre, también en 0; se
// muestran sólo las que tienen algo.
const MOTIVO_SIN_COMISION_LABEL = {
  ESTADO_ARCA: 'Situación fiscal ARCA',
  SIN_CIIU: 'Sin CIIU',
  NO_COTIZAR: 'No cotizar',
  SIN_INSUMO: 'Sin alícuota o masa',
};

const SinComisionPorMotivo = ({ porMotivo }) => {
  const entradas = Object.entries(porMotivo || {}).filter(([, n]) => Number(n) > 0);
  if (entradas.length === 0) return null;
  return (
    <p className="text-[10px] text-slate-500 mt-0.5" data-testid="sin-comision-por-motivo">
      {entradas.map(([motivo, n]) => `${MOTIVO_SIN_COMISION_LABEL[motivo] || motivo}: ${n}`).join(' · ')}
    </p>
  );
};

const ResumenDireccion = ({ token, onIrSiniestros, onIrUniversoArt, onIrComisiones, onIrComercios }) => {
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDatos(await obtenerResumenDireccion(token));
    } catch (err) {
      setError(err.message);
      setDatos(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { cargar(); }, [cargar]);

  // Si la carga entera falló NO se pintan tarjetas vacías: el cartel dice el
  // status real y ofrece reintentar. Cuatro tarjetas en cero serían cuatro
  // afirmaciones falsas sobre la empresa.
  if (error && !loading) {
    return (
      <section className="space-y-3">
        <Encabezado onRefrescar={cargar} cargando={loading} />
        <div role="alert" className="bg-red-500/15 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
          <Icon name="exclamation-triangle" className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-red-200 text-sm">No se pudo cargar el resumen de Dirección. {error}</p>
            <button onClick={cargar} className="mt-2 text-red-200 underline text-xs hover:text-white">
              Reintentar
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (loading && !datos) {
    return (
      <section className="space-y-3">
        <Encabezado onRefrescar={cargar} cargando />
        <p className="text-slate-400 text-sm animate-pulse py-6 text-center">Cargando el resumen de Dirección…</p>
      </section>
    );
  }

  if (!datos) return null;

  const siniestros = datos.siniestros || {};
  const art = datos.art || {};
  const comisiones = datos.comisiones || {};
  const comercios = datos.comercios || {};

  return (
    <section className="space-y-3">
      <Encabezado onRefrescar={cargar} cargando={loading} />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

        <Tarjeta titulo="Siniestros" icono="shield-check" irA="Seguros > Siniestros" onClick={onIrSiniestros}>
          {!siniestros.disponible ? <SinDato motivo={siniestros.motivo} /> : (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Cifra etiqueta="Abiertos" valor={siniestros.abiertos} alerta={siniestros.abiertos > 0} />
              <Cifra etiqueta="Cerrados 30 días" valor={siniestros.cerrados_30d} />
              <Cifra etiqueta="Cerrados en el año" valor={siniestros.cerrados_anio} />
              <Cifra
                etiqueta="Días del más antiguo abierto"
                valor={siniestros.dias_del_mas_antiguo_abierto === null
                  || siniestros.dias_del_mas_antiguo_abierto === undefined
                  ? '—'
                  : `${siniestros.dias_del_mas_antiguo_abierto} d`}
                alerta={Number(siniestros.dias_del_mas_antiguo_abierto) > 30}
                ayuda={siniestros.dias_del_mas_antiguo_abierto === null ? 'Ninguno abierto' : null}
              />
            </div>
          )}
        </Tarjeta>

        <Tarjeta titulo="ART" icono="briefcase" irA="CRM > Empresas > Universo ART" onClick={onIrUniversoArt}>
          {!art.disponible ? <SinDato motivo={art.motivo} /> : (
            <>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Cifra etiqueta={`En ventana ${art.dias_ventana ?? 90} días`} valor={art.en_ventana_90d} />
                <Cifra
                  etiqueta="Relevadas / pendientes de relevar"
                  valor={`${art.relevadas ?? '—'} / ${art.pendientes_relevar ?? '—'}`}
                />
                <Cifra etiqueta="Pedidas" valor={art.pedidas} />
                <Cifra etiqueta="Cotizadas" valor={art.cotizadas} />
                <Cifra etiqueta="Ganadas" valor={art.ganadas} />
              </div>
              <div className="mt-3 pt-3 border-t border-slate-700">
                <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  Comisión en juego
                  {/* La etiqueta ESTIMADA es del backend y va VISIBLE: no es
                      plata cobrada ni comprometida, es el tamaño del premio
                      si se gana la cuenta. */}
                  <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-200 text-[10px] font-semibold">
                    {art.comision_etiqueta || 'ESTIMADA'}
                  </span>
                </p>
                {art.comision_estimada_en_juego === null || art.comision_estimada_en_juego === undefined ? (
                  <p className="text-slate-300 text-sm mt-1">
                    Sin dato todavía
                    <span className="block text-slate-500 text-[11px]">
                      Ninguna empresa de la ventana tiene masa salarial ni alícuota para estimarla
                    </span>
                  </p>
                ) : (
                  <p className="text-xl font-bold text-white mt-0.5">
                    {formatearMonto(art.comision_estimada_en_juego, 'ARS')}
                  </p>
                )}
                <TechoNoSumado
                  techo={art.techo_baja_no_sumado}
                  formatear={(v) => formatearMonto(v, 'ARS')}
                  className="text-[10px] mt-1"
                />
                {/* Universo del backend #221: TODA la ventana de 90 días sin
                    comisión actual, de cualquier confianza (también las BAJA
                    sin comisión), más SIN_CIIU y NO_COTIZAR. No es el
                    `sin_comision` del techo: no se leen uno contra el otro. */}
                {art.empresas_sin_comision_estimable > 0 && (
                  <p
                    className="text-[10px] text-slate-500 mt-1"
                    data-testid="sin-comision-estimable"
                    title="Toda la ventana de 90 días sin comisión actual, de cualquier confianza de masa (también BAJA), más las sin CIIU y las marcadas no cotizar. No se compara con el 'sin dato' del techo BAJA."
                  >
                    {art.empresas_sin_comision_estimable} empresas de la ventana sin comisión estimable (cualquier confianza, incluye sin CIIU)
                  </p>
                )}
                <SinComisionPorMotivo porMotivo={art.sin_comision_por_motivo} />
              </div>
            </>
          )}
        </Tarjeta>

        <Tarjeta titulo="Comisiones" icono="currency-dollar" irA="Dirección > Finanzas > Comisiones liquidadas" onClick={onIrComisiones}>
          {!comisiones.disponible ? <SinDato motivo={comisiones.motivo} /> : (
            <div className="mt-3 space-y-3">
              {/* DOS NÚMEROS SEPARADOS Y ROTULADOS. Nunca sumados, nunca
                  restados, nunca en un mismo total: la estimada es un cálculo
                  propio sobre la cartera ART y la liquidada es lo que la
                  compañía liquidó con comprobante. */}
              <BloqueComision titulo="Estimada del mes" bloque={comisiones.estimada_mes} destacar="yellow" />
              <BloqueComision titulo="Liquidada del mes" bloque={comisiones.liquidada_mes} destacar="green" />
              <p className="text-[10px] text-slate-500 leading-snug">
                Período {comisiones.periodo}. No son comparables ni sumables.
              </p>
            </div>
          )}
        </Tarjeta>

        <Tarjeta titulo="Comercios" icono="building-office" irA="CRM > Oportunidades" onClick={onIrComercios}>
          {!comercios.disponible ? <SinDato motivo={comercios.motivo} /> : (
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-[11px] text-slate-400">Oportunidades por estado</p>
                {!comercios.oportunidades_por_estado?.disponible ? (
                  <SinDato motivo={comercios.oportunidades_por_estado?.motivo} />
                ) : (
                  <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    {Object.entries(comercios.oportunidades_por_estado.por_estado || {}).map(([estado, cantidad]) => (
                      <li key={estado} className="text-sm text-white">
                        <span className="font-bold">{cantidad}</span>{' '}
                        <span className="text-slate-400 text-[11px]">{etiqueta(estado)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="pt-2 border-t border-slate-700">
                {!comercios.polizas?.disponible ? (
                  <SinDato motivo={comercios.polizas?.motivo} />
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Cifra etiqueta="Pólizas vigentes" valor={comercios.polizas.polizas_vigentes} />
                    <Cifra
                      etiqueta="Por vencer 60 días"
                      valor={comercios.polizas.por_vencer_60d}
                      alerta={comercios.polizas.por_vencer_60d > 0}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </Tarjeta>
      </div>
    </section>
  );
};

// Un lado de la tarjeta de comisiones: SIEMPRE por moneda y siempre con su
// rótulo. Si el lado no está disponible dice por qué, en vez de un 0 que se
// leería como "este mes no se liquidó nada".
const BloqueComision = ({ titulo, bloque, destacar }) => {
  const color = destacar === 'green' ? 'text-green-300' : 'text-yellow-200';
  if (!bloque?.disponible) {
    return (
      <div>
        <p className="text-[11px] text-slate-400 font-medium">{titulo}</p>
        <SinDato motivo={bloque?.motivo} />
      </div>
    );
  }
  const porMoneda = Object.entries(bloque.por_moneda || {});
  return (
    <div>
      <p className="text-[11px] text-slate-400 font-medium">{titulo}</p>
      {porMoneda.length === 0 ? (
        <SinDato motivo="El backend no informó ninguna moneda para este bloque" />
      ) : (
        <ul className="mt-0.5 space-y-0.5">
          {porMoneda.map(([moneda, monto]) => (
            <li key={moneda} className={`text-lg font-bold ${color}`}>
              {formatearMonto(monto, moneda)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const Encabezado = ({ onRefrescar, cargando }) => (
  <div className="flex items-center justify-between gap-3 flex-wrap">
    <div>
      <h3 className="text-lg font-semibold">Resumen de Dirección</h3>
      <p className="text-slate-400 text-xs">Siniestros, ART, comisiones y comercios. Sólo visible para ADMIN.</p>
    </div>
    <button
      onClick={onRefrescar}
      disabled={cargando}
      className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs transition disabled:opacity-50 flex items-center gap-2"
    >
      <Icon name="arrow-path" size={14} /> Actualizar
    </button>
  </div>
);

export default ResumenDireccion;
