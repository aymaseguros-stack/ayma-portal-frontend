import React, { useEffect, useState } from 'react';
import Modal from '../Modal';
import { obtenerEmpresaArt } from './artCarteraApi';
import { aseguradoraLabel, numeroAr, propensionInfo } from './artCarteraConstants';
import { fechaCorta } from '../../utils/fechas';
import { BadgeEstadoPar, TextoRespuesta } from './ArtTandasBoard';
import { canalLabel } from './artCotizacionesConstants';

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

const meses = (n) => (n === null || n === undefined ? null : `${numeroAr(n)} ${n === 1 ? 'mes' : 'meses'}`);
const sinDato = <span className="text-slate-500">Sin dato</span>;

const Dato = ({ label, children }) => (
  <div className="flex gap-2">
    <dt className="text-slate-400 w-44 shrink-0">{label}</dt>
    <dd className="text-slate-200">{children}</dd>
  </div>
);

// ART-99 / ART-102: causa del hueco (historial_art.clasificar_baja en el
// backend, igualdad contra los 9 motivos SRT). Un código que no esté acá se
// muestra crudo.
const CAUSA_HUECO = {
  FALTA_DE_PAGO: 'Falta de pago',
  RESCISION_ART: 'Rescisión de la ART',
  BAJA_EMPLEADOR: 'Baja del empleador',
  CAMBIO: 'Cambio de aseguradora',
  NO_ES_CAMBIO: 'Absorción / cesión de cartera (no cuenta como cambio)',
  VIGENTE: 'Afiliación vigente',
  SIN_DATO: 'Sin dato',
};

// ART-103: las fechas del Historial ART van con dos dígitos (01/09/2018);
// el `fechaCorta` por defecto de es-AR da 1/9/2018.
const FECHA_2D = { day: '2-digit', month: '2-digit', year: 'numeric' };
const fechaHist = (valor) => fechaCorta(valor, FECHA_2D);

// ART-99: `huecos` pasó de cantidad a lista; `huecos_cantidad` es la
// cantidad. Se acepta el formato viejo por si el backend todavía no se
// desplegó.
const cantidadHuecos = (h) => {
  if (h.huecos_cantidad !== null && h.huecos_cantidad !== undefined) return h.huecos_cantidad;
  if (Array.isArray(h.huecos)) return h.huecos.length;
  return h.huecos ?? 0;
};

// ART-97 (backend PR #210): `historial_art` de GET /art/empresas/{cuit}.
// Todo se calcula en el backend (historial_art.py); acá sólo se muestra.
// Sin `fecha_ultimo_cambio` la empresa nunca cambió de ART.
export const HistorialArt = ({ h }) => {
  if (!h) return <p className="text-sm text-slate-500">Sin historial calculado.</p>;
  const prop = propensionInfo(h.propension_cambio);
  const nHuecos = cantidadHuecos(h);
  const detalleHuecos = Array.isArray(h.huecos) ? h.huecos : [];
  return (
    <dl className="text-sm space-y-1" data-testid="historial-art">
      <Dato label="Contrato vigente">{meses(h.meses_contrato_vigente) ?? <span className="text-slate-500">Ninguno vigente</span>}</Dato>
      <Dato label="Contratos">{numeroAr(h.cantidad_contratos ?? 0)}</Dato>
      <Dato label="Cambios de ART">{numeroAr(h.cambios_de_art ?? 0)}</Dato>
      <Dato label="Permanencia prom. / mediana">
        {meses(h.permanencia_promedio_meses) ?? '—'} / {meses(h.permanencia_mediana_meses) ?? '—'}
      </Dato>
      <Dato label="Huecos">
        {numeroAr(nHuecos)}
        {nHuecos ? ` · ${meses(h.meses_sin_cobertura_total ?? 0)} sin cobertura` : ''}
        {detalleHuecos.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-xs text-slate-300" data-testid="historial-art-huecos">
            {detalleHuecos.map((x) => (
              <li key={`${x.desde}-${x.hasta}`}>
                {fechaHist(x.desde)} → {fechaHist(x.hasta)} · {numeroAr(x.dias)} {x.dias === 1 ? 'día' : 'días'}
                {' · '}
                <span className={x.causa === 'FALTA_DE_PAGO' ? 'text-red-300' : undefined}>
                  {CAUSA_HUECO[x.causa] || x.causa}
                </span>
                {x.misma_art
                  ? ' · volvió a la misma ART'
                  : ` · ${aseguradoraLabel(x.art_saliente) || x.art_saliente || '?'} → ${aseguradoraLabel(x.art_entrante) || x.art_entrante || '?'}`}
              </li>
            ))}
          </ul>
        )}
      </Dato>
      {h.riesgo_deuda_historica !== undefined && (
        <Dato label="Riesgo deuda histórica">
          {h.riesgo_deuda_historica === null ? sinDato : (
            <span className={h.riesgo_deuda_historica ? 'text-red-300' : 'text-slate-300'}>
              {h.riesgo_deuda_historica ? 'Sí — falta de pago en los últimos 5 años' : 'No'}
              {h.ultima_falta_de_pago ? ` · última falta de pago ${fechaHist(h.ultima_falta_de_pago)}` : ''}
            </span>
          )}
        </Dato>
      )}
      <Dato label="Último cambio">
        {h.fecha_ultimo_cambio
          ? `${fechaHist(h.fecha_ultimo_cambio)}${h.meses_desde_ultimo_cambio !== null && h.meses_desde_ultimo_cambio !== undefined ? ` · hace ${meses(h.meses_desde_ultimo_cambio)}` : ''}`
          : 'Nunca cambió'}
      </Dato>
      {h.absorciones > 0 && (
        <Dato label="Absorciones/cesiones">
          <span title="La ART desapareció dentro de otra: no cuenta como cambio ni corta la permanencia (ART-101/102).">
            {numeroAr(h.absorciones)}
          </span>
        </Dato>
      )}
      <Dato label="Cambios en 5 años">{numeroAr(h.cambios_ultimos_5_anios ?? 0)}</Dato>
      <Dato label="Propensión">
        {prop ? (
          <span className={prop.clase ? `text-[11px] px-1.5 py-0.5 rounded ${prop.clase}` : 'text-slate-400'} title={prop.detalle}>
            {prop.label}
          </span>
        ) : sinDato}
      </Dato>
    </dl>
  );
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
  const pedidos = Array.isArray(ficha?.pedidos) ? ficha.pedidos : [];

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
            <div className="grid gap-6 sm:grid-cols-[12rem_1fr]">
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
                titulo="Historial ART"
                nota="Renovar con la misma ART no es cambio. Propensión: cambios en los últimos 5 años (ART-97)."
              >
                <HistorialArt h={ficha?.historial_art} />
              </Bloque>
            </div>

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
                          <td className="px-3 py-2 text-slate-300">{fechaHist(c.fecha_inicio) || '—'}</td>
                          <td className="px-3 py-2 text-slate-300">
                            {c.fecha_fin ? fechaHist(c.fecha_fin) : <span className="text-green-400">vigente</span>}
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
              titulo={`Pedidos de cotización (${pedidos.length})`}
              nota="Por par empresa–aseguradora, el más nuevo primero. El estado lo deriva el backend (OPERACIONES-0008)."
            >
              {pedidos.length === 0 ? (
                <p className="text-sm text-slate-500">Sin pedidos de cotización registrados.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-slate-400 border-b border-slate-700">
                      <tr>
                        <th className="text-left px-3 py-2">Aseguradora</th>
                        <th className="text-left px-3 py-2">Pedida</th>
                        <th className="text-left px-3 py-2">Canal / tanda</th>
                        <th className="text-left px-3 py-2">Estado</th>
                        <th className="text-left px-3 py-2">Respuesta</th>
                        <th className="text-left px-3 py-2">Días resp.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/60">
                      {pedidos.map((p) => (
                        <tr key={p.evento_id}>
                          <td className="px-3 py-2 text-slate-200">{aseguradoraLabel(p.aseguradora)}</td>
                          <td className="px-3 py-2 text-slate-300">{fechaCorta(p.fecha_pedido) || '—'}</td>
                          <td className="px-3 py-2 text-slate-300">
                            {canalLabel(p.canal)}{p.tanda_id ? ` · #${p.tanda_id}` : ' · suelto'}
                          </td>
                          <td className="px-3 py-2"><BadgeEstadoPar estado={p.estado} /></td>
                          <td className="px-3 py-2"><TextoRespuesta respuesta={p.respuesta} /></td>
                          <td className="px-3 py-2 text-slate-300">
                            {p.dias_respuesta === null || p.dias_respuesta === undefined ? '—' : `${p.dias_respuesta} d`}
                          </td>
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
