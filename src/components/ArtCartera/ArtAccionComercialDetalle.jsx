import React, { useEffect, useState } from 'react';
import Modal from '../Modal';
import { obtenerEmpresaArt } from './artCarteraApi';
import { aseguradoraLabel, numeroAr } from './artCarteraConstants';
import { fechaCorta } from '../../utils/fechas';

// Motivos de descarte por colocabilidad (ART-76, PR #136). El texto sale
// del código canónico que manda el backend; un código que no esté acá se
// muestra crudo, no se esconde.
const MOTIVO_DESCARTE = {
  AYMA_NO_COLOCA: 'AYMA no coloca en esta compañía',
  AUTORIZACION_REVOCADA_SSN: 'Autorización revocada por la SSN',
};

// ART-74 (backend PR #139). Texto largo de la confianza del ORIGEN de la
// dotación: en el modal hay lugar para decirlo entero, en la fila no.
const DOTACION_CONFIANZA_TEXTO = {
  ALTA: 'ALTA — origen confirmado (F931)',
  MEDIA: 'MEDIA — ventanilla SRT, contrato o padrón ARCA',
  BAJA: 'BAJA — planilla histórica, rango MiPyME o sin origen identificable',
};

const Bloque = ({ titulo, children, nota }) => (
  <section className="space-y-2">
    <h4 className="text-sm font-semibold text-slate-200">{titulo}</h4>
    {nota && <p className="text-xs text-slate-500">{nota}</p>}
    {children}
  </section>
);

// Detalle de empresa de la pantalla de Acción comercial (BLOQUE 3). Es un
// MODAL sobre la lista y no una pantalla nueva: el operador está llamando
// por teléfono y vuelve a la fila siguiente.
//
// Dos fuentes, las dos del backend y ninguna calculada acá:
//   - GET /art/empresas/{cuit} -> historial_contratos + antiguedad_total_meses
//     (app/api/v1/art_consultas.py).
//   - `companias_descartadas_no_colocables` de la FILA de
//     /art/accion-comercial/lista (ART-76): viaja en la fila y no en la
//     ficha, así que se recibe por prop en vez de pedirse de nuevo.
//
// Los tres juntos contestan la única pregunta que la tabla deja abierta:
// por qué la compañía sugerida es ésa y no otra.
const ArtAccionComercialDetalle = ({ token, fila, onCerrar }) => {
  const [ficha, setFicha] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cuit = fila?.cuit;

  useEffect(() => {
    let cancelado = false;
    if (!cuit) {
      setLoading(false);
      setError('La empresa no tiene CUIT cargado: la ficha se busca por CUIT.');
      return undefined;
    }
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await obtenerEmpresaArt(token, cuit);
        if (!cancelado) setFicha(data);
      } catch (err) {
        if (!cancelado) setError(err.message);
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [token, cuit]);

  const contratos = Array.isArray(ficha?.historial_contratos) ? ficha.historial_contratos : [];
  const descartadas = Array.isArray(fila?.companias_descartadas_no_colocables)
    ? fila.companias_descartadas_no_colocables
    : [];
  const antiguedad = ficha?.antiguedad_total_meses;

  return (
    <Modal title={fila?.razon_social || fila?.cuit || 'Empresa'} onClose={onCerrar} maxWidth="max-w-3xl">
      <div className="space-y-6">
        <p className="text-xs text-slate-500">
          CUIT {fila?.cuit || 'sin dato'}
          {fila?.provincia ? ` · ${fila.provincia}` : ''}
          {fila?.aseguradora_actual ? ` · ART actual: ${aseguradoraLabel(fila.aseguradora_actual)}` : ''}
        </p>

        {loading && <p className="text-slate-400 text-sm">Cargando ficha...</p>}
        {error && (
          <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {!loading && !error && (
          <>
            <Bloque
              titulo="Antigüedad total en ART"
              nota="Suma de todos los contratos del historial, huecos excluidos (no es la del contrato vigente)."
            >
              <p className="text-2xl font-bold text-white">
                {antiguedad === null || antiguedad === undefined
                  ? <span className="text-slate-500 text-base font-normal">Sin dato</span>
                  : `${antiguedad} meses`}
              </p>
            </Bloque>

            <Bloque
              titulo="Dotación"
              nota="La confianza y la marca de sospecha las decide el backend a partir del origen (ART-74): acá se leen, no se recalculan."
            >
              <dl className="text-sm space-y-1">
                <div className="flex gap-2">
                  <dt className="text-slate-400 w-40 shrink-0">Dotación</dt>
                  <dd className="text-slate-200">
                    {fila?.dotacion === null || fila?.dotacion === undefined
                      ? <span className="text-slate-500">Sin dato</span>
                      : numeroAr(fila.dotacion)}
                    {fila?.dotacion_fuente ? ` · fuente ${fila.dotacion_fuente}` : ''}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-slate-400 w-40 shrink-0">Confianza del origen</dt>
                  <dd className="text-slate-200">
                    {fila?.dotacion_confianza
                      ? (DOTACION_CONFIANZA_TEXTO[fila.dotacion_confianza] || fila.dotacion_confianza)
                      : <span className="text-slate-500">Sin dato</span>}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-slate-400 w-40 shrink-0">Dotación sospechosa</dt>
                  <dd className={fila?.dotacion_sospechosa === true ? 'text-red-300' : 'text-slate-200'}>
                    {fila?.dotacion_sospechosa === true
                      ? 'Sí — Dotación >5.000 — verificar contra F931'
                      : 'No'}
                  </dd>
                </div>
              </dl>
            </Bloque>

            <Bloque titulo={`Historial de contratos (${contratos.length})`}>
              {contratos.length === 0 ? (
                <p className="text-sm text-slate-500">Sin contratos en el historial de la SRT.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-slate-400 border-b border-slate-700">
                      <tr>
                        <th className="text-left px-3 py-2">Aseguradora</th>
                        <th className="text-left px-3 py-2">Desde</th>
                        <th className="text-left px-3 py-2">Hasta</th>
                        <th className="text-left px-3 py-2">Motivo de baja</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/60">
                      {contratos.map((c, i) => (
                        <tr key={`${c.numero_contrato || 'sn'}-${c.fecha_inicio || i}`}>
                          <td className="px-3 py-2 text-slate-200">
                            {c.aseguradora_display || c.aseguradora || 'Sin dato'}
                            {c.aseguradora_activa === false && (
                              <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-400">
                                ya no opera
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-300">{fechaCorta(c.fecha_inicio) || '—'}</td>
                          <td className="px-3 py-2 text-slate-300">
                            {c.fecha_fin ? fechaCorta(c.fecha_fin) : <span className="text-green-400">vigente</span>}
                          </td>
                          <td className="px-3 py-2 text-slate-400">{c.motivo_baja || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Bloque>

            <Bloque
              titulo={`Compañías descartadas por colocabilidad (${descartadas.length})`}
              nota="El dato estaba y no se puede usar: sin esto la sugerencia se leería como un dato que falta."
            >
              {descartadas.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Ninguna: la colocabilidad no filtró compañías en esta empresa.
                </p>
              ) : (
                <ul className="space-y-2">
                  {descartadas.map((d) => (
                    <li
                      key={d.compania}
                      className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-medium text-slate-200">{aseguradoraLabel(d.compania)}</span>
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                          {MOTIVO_DESCARTE[d.motivo] || d.motivo || 'Sin motivo informado'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {d.mediana === null || d.mediana === undefined
                          ? 'Descartada por una cotización vigente, no por la mediana.'
                          : `Mediana que habría ganado: ${d.mediana}% sobre ${d.n} cotización${d.n === 1 ? '' : 'es'}`}
                        {d.nivel_evidencia ? ` · evidencia ${d.nivel_evidencia}` : ''}
                        {d.confianza_datos_historicos === 'BAJA' ? ' · histórico de confianza BAJA' : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Bloque>
          </>
        )}
      </div>
    </Modal>
  );
};

export default ArtAccionComercialDetalle;
