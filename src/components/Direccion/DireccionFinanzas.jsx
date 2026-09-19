import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Icon } from '../Icons';
import Modal from '../Modal';
import {
  anularComision, anularGasto, borrarAsignacion, copiarAsignaciones, crearAsignacion,
  crearComision, crearGasto, editarAsignacion, generarRecurrentes, listarAsignaciones,
  listarComisiones, listarGastos, resumenPresupuesto, seriePresupuesto, sumarMontos,
} from './finanzasApi';
import { listarProveedores } from './direccionApi';
import {
  MONEDAS, RUBROS_PRESUPUESTO, etiqueta, fechaCorta, formatearMonto,
} from './direccionConstantes';
import {
  CANALES_MARKETING, FUENTES_COMISION, MEDIOS_PAGO, ORIGENES_GASTO, RUBRO_CON_CANAL,
  SIN_PRESUPUESTO_ASIGNADO, anchoBarra, esPeriodoValido, formatearPorcentaje,
  periodoActual, periodoDesplazado, periodoLegible, primerDiaDelPeriodo,
  proveedoresActivosSinDatos,
} from './finanzasConstantes';
import {
  Badge, Campo, Cargando, ErrorCarga, EstadoVacio, Panel, Tabla,
  botonPrimario, botonSecundario, inputClase,
} from './DireccionComunes';

// Pantalla 5 del módulo DIRECCIÓN: FINANZAS.
// Backend: app/api/v1/finanzas.py (PR #167 / bd5d8f5), entero bajo
// require_admin -> esta pantalla es ADMIN-only, igual que las otras cuatro.
//
// TRES REGLAS QUE ESTA PANTALLA NO PUEDE ROMPER, las tres con test propio:
//  1. ARS y USD NUNCA se suman. Todo total sale en una fila POR MONEDA. Si
//     el backend informa un total convertido, va APARTE y rotulado como lo
//     que es (una conversión con el tipo de cambio de cada gasto).
//  2. `pct_ejecutado === null` NO es 0%: es "gastado sin presupuesto
//     asignado", que es el caso importante de los dos, y va resaltado.
//  3. Todo lo destructivo es ANULAR, no borrar: el gasto y la comisión
//     anulados siguen a la vista, tachados y con su fecha de anulación.

const TABS = [
  { id: 'presupuesto', label: 'Presupuesto' },
  { id: 'gastos', label: 'Gastos' },
  { id: 'comisiones', label: 'Comisiones liquidadas' },
];

const tabClase = (activo) =>
  `px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
    activo ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
  }`;

// Selector de período. `<input type="month">` ya devuelve YYYY-MM, que es
// exactamente el formato que valida el backend (PATRON_PERIODO).
const SelectorPeriodo = ({ periodo, onCambiar }) => (
  <Campo label="Período">
    <input
      type="month"
      aria-label="Período"
      className={inputClase + ' min-w-[170px]'}
      value={periodo}
      onChange={(e) => { if (esPeriodoValido(e.target.value)) onCambiar(e.target.value); }}
    />
  </Campo>
);

const DireccionFinanzas = ({ token, tabInicial = 'presupuesto' }) => {
  const [tab, setTab] = useState(TABS.some((t) => t.id === tabInicial) ? tabInicial : 'presupuesto');
  const [periodo, setPeriodo] = useState(periodoActual());

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Finanzas</h2>
        <p className="text-slate-400 text-sm mt-1">
          Presupuesto asignado, gasto efectivo y comisiones liquidadas. Los totales van por moneda: ARS y USD no se suman.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap border-b border-slate-700 pb-3">
        {TABS.map((t) => (
          <button key={t.id} className={tabClase(tab === t.id)} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === 'presupuesto' && <TabPresupuesto token={token} periodo={periodo} onPeriodo={setPeriodo} />}
      {tab === 'gastos' && <TabGastos token={token} periodo={periodo} onPeriodo={setPeriodo} />}
      {tab === 'comisiones' && <TabComisiones token={token} periodo={periodo} onPeriodo={setPeriodo} />}
    </div>
  );
};

// ---------------------------------------------------------------------------
// a) PRESUPUESTO
// ---------------------------------------------------------------------------

const TabPresupuesto = ({ token, periodo, onPeriodo }) => {
  const [resumen, setResumen] = useState(null);
  const [asignaciones, setAsignaciones] = useState([]);
  const [serie, setSerie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalAlta, setModalAlta] = useState(false);
  const [editando, setEditando] = useState(null);
  const [aBorrar, setABorrar] = useState(null);
  const [copiar, setCopiar] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [r, a] = await Promise.all([
        resumenPresupuesto(token, periodo),
        listarAsignaciones(token, { periodo }),
      ]);
      setResumen(r);
      setAsignaciones(a);
    } catch (err) { setError(err.message); setResumen(null); }
    finally { setLoading(false); }
  }, [token, periodo]);

  // La serie de 6 meses se carga aparte: si falla, el resumen del mes sigue
  // a la vista. Un gráfico caído no puede vaciar la tabla.
  const cargarSerie = useCallback(async () => {
    try {
      setSerie(await seriePresupuesto(token, periodoDesplazado(periodo, -5), periodo));
    } catch { setSerie(null); }
  }, [token, periodo]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { cargarSerie(); }, [cargarSerie]);

  const porRubro = resumen?.por_rubro || [];
  const porCanal = resumen?.marketing_por_canal || [];
  const totales = Object.entries(resumen?.totales_por_moneda || {});

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-3 flex-wrap">
        <SelectorPeriodo periodo={periodo} onCambiar={onPeriodo} />
        <button className={botonSecundario} onClick={() => setCopiar({ paso: 'previa' })}>
          Copiar del mes anterior
        </button>
        <button className={botonPrimario + ' ml-auto'} onClick={() => setModalAlta(true)}>Nueva asignación</button>
      </div>

      {error && !loading && <ErrorCarga mensaje={error} que="el resumen de presupuesto" onReintentar={cargar} />}

      <Panel
        titulo={`Ejecución por rubro · ${periodoLegible(periodo)}`}
        subtitulo="Desvío positivo = se gastó más de lo asignado"
      >
        {loading ? <Cargando texto="Cargando el presupuesto…" /> : error ? null : porRubro.length === 0 ? (
          <EstadoVacio
            icono="currency-dollar"
            titulo="Todavía no hay movimiento en este período"
            detalle="Acá aparece, por rubro, cuánto se asignó y cuánto se gastó. Cargá una asignación o un gasto del mes."
          />
        ) : (
          <Tabla columnas={['Rubro', 'Moneda', 'Asignado', 'Ejecutado', 'Desvío', '% ejecutado']}>
            {porRubro.map((f) => (
              <tr key={`${f.rubro}-${f.moneda}`}>
                <td className="px-4 py-2.5"><Badge valor={f.rubro} /></td>
                <td className="px-4 py-2.5 text-slate-300">{f.moneda}</td>
                <td className="px-4 py-2.5 text-slate-200 whitespace-nowrap">{formatearMonto(f.asignado, f.moneda)}</td>
                <td className="px-4 py-2.5 text-white whitespace-nowrap">{formatearMonto(f.ejecutado, f.moneda)}</td>
                <td className={`px-4 py-2.5 whitespace-nowrap ${Number(f.desvio) > 0 ? 'text-red-300' : 'text-slate-300'}`}>
                  {formatearMonto(f.desvio, f.moneda)}
                </td>
                <td className="px-4 py-2.5"><CeldaPorcentaje pct={f.pct_ejecutado} /></td>
              </tr>
            ))}
          </Tabla>
        )}
      </Panel>

      <Panel
        titulo="MARKETING por canal"
        subtitulo="Asignado vs. gastado efectivo. El canal sin nombre es el techo del rubro, sin abrir."
      >
        {loading ? null : porCanal.length === 0 ? (
          <EstadoVacio
            icono="megaphone"
            titulo="Todavía no hay presupuesto ni gasto de MARKETING en este período"
            detalle="Acá se abre MARKETING por canal (Meta, Google, Buffer, LinkedIn) para saber dónde poner el próximo peso."
          />
        ) : (
          <Tabla columnas={['Canal', 'Moneda', 'Asignado', 'Gastado', 'Desvío', '% ejecutado']}>
            {porCanal.map((f, i) => (
              <tr key={`${f.canal || 'sin-canal'}-${f.moneda}-${i}`}>
                <td className="px-4 py-2.5 text-white">
                  {f.canal ? etiqueta(f.canal) : <span className="text-slate-400">Sin canal (techo del rubro)</span>}
                </td>
                <td className="px-4 py-2.5 text-slate-300">{f.moneda}</td>
                <td className="px-4 py-2.5 text-slate-200 whitespace-nowrap">{formatearMonto(f.asignado, f.moneda)}</td>
                <td className="px-4 py-2.5 text-white whitespace-nowrap">{formatearMonto(f.gastado, f.moneda)}</td>
                <td className={`px-4 py-2.5 whitespace-nowrap ${Number(f.desvio) > 0 ? 'text-red-300' : 'text-slate-300'}`}>
                  {formatearMonto(f.desvio, f.moneda)}
                </td>
                <td className="px-4 py-2.5"><CeldaPorcentaje pct={f.pct_ejecutado} /></td>
              </tr>
            ))}
          </Tabla>
        )}
      </Panel>

      {/* TOTALES POR MONEDA, en FILAS SEPARADAS. No hay un "total general":
          sumarlos exigiría una cotización que nadie declaró. */}
      <Panel titulo="Totales por moneda" subtitulo="ARS y USD nunca se suman entre sí">
        {loading ? null : totales.length === 0 ? (
          <EstadoVacio icono="currency-dollar" titulo="Todavía no hay totales para este período" detalle="Aparecen cuando hay al menos una asignación o un gasto cargado." />
        ) : (
          <>
            <Tabla columnas={['Moneda', 'Asignado', 'Ejecutado', 'Desvío']}>
              {totales.map(([moneda, t]) => (
                <tr key={moneda}>
                  <td className="px-4 py-2.5 text-slate-200 font-medium">{moneda}</td>
                  <td className="px-4 py-2.5 text-slate-200 whitespace-nowrap">{formatearMonto(t.asignado, moneda)}</td>
                  <td className="px-4 py-2.5 text-white whitespace-nowrap">{formatearMonto(t.ejecutado, moneda)}</td>
                  <td className={`px-4 py-2.5 whitespace-nowrap ${Number(t.desvio) > 0 ? 'text-red-300' : 'text-slate-300'}`}>
                    {formatearMonto(t.desvio, moneda)}
                  </td>
                </tr>
              ))}
            </Tabla>
            {resumen?.total_convertido && <TotalConvertido dato={resumen.total_convertido} />}
          </>
        )}
      </Panel>

      <GraficoSerie serie={serie} periodo={periodo} />

      <Panel
        titulo={`Asignaciones de ${periodoLegible(periodo)}`}
        subtitulo="Lo que se DECIDIÓ gastar. El período, el rubro, el canal y la moneda son la clave: para cambiarlos hay que borrar la línea y crear otra."
      >
        {loading ? null : asignaciones.length === 0 ? (
          <EstadoVacio
            icono="currency-dollar"
            titulo="Todavía no hay asignaciones en este período"
            detalle="Acá se carga cuánto se decide gastar por rubro. Sin asignación, el gasto del mes aparece como “gastado sin presupuesto asignado”."
            accion={<button className={botonPrimario} onClick={() => setModalAlta(true)}>Cargar la primera</button>}
          />
        ) : (
          <Tabla columnas={['Rubro', 'Canal', 'Moneda', 'Asignado', 'Notas', '']}>
            {asignaciones.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-2.5"><Badge valor={a.rubro} /></td>
                <td className="px-4 py-2.5 text-slate-300">{a.canal ? etiqueta(a.canal) : '—'}</td>
                <td className="px-4 py-2.5 text-slate-300">{a.moneda}</td>
                <td className="px-4 py-2.5 text-white whitespace-nowrap">{formatearMonto(a.monto_asignado, a.moneda)}</td>
                <td className="px-4 py-2.5 text-slate-400 text-xs">{a.notas || '—'}</td>
                <td className="px-4 py-2.5 whitespace-nowrap space-x-3">
                  <button className="text-blue-300 hover:text-blue-200 text-xs" onClick={() => setEditando(a)}>Editar</button>
                  <button className="text-red-300 hover:text-red-200 text-xs" onClick={() => setABorrar(a)}>Borrar</button>
                </td>
              </tr>
            ))}
          </Tabla>
        )}
      </Panel>

      {modalAlta && (
        <ModalAsignacion
          token={token} periodo={periodo}
          onCerrar={() => setModalAlta(false)}
          onGuardado={() => { setModalAlta(false); cargar(); cargarSerie(); }}
        />
      )}

      {editando && (
        <ModalEditarAsignacion
          token={token} asignacion={editando}
          onCerrar={() => setEditando(null)}
          onGuardado={() => { setEditando(null); cargar(); cargarSerie(); }}
        />
      )}

      {aBorrar && (
        <Modal title="Borrar la asignación" onClose={() => setABorrar(null)}>
          <p className="text-slate-300 text-sm">
            ¿Borrar la asignación de <strong className="text-white">{etiqueta(aBorrar.rubro)}</strong>
            {aBorrar.canal ? ` / ${etiqueta(aBorrar.canal)}` : ''} por {formatearMonto(aBorrar.monto_asignado, aBorrar.moneda)}?
          </p>
          <p className="text-slate-500 text-xs mt-2">
            Se borra la decisión de presupuesto. Los gastos del período no se tocan.
          </p>
          <div className="flex gap-3 justify-end mt-5">
            <button className={botonSecundario} onClick={() => setABorrar(null)}>Cancelar</button>
            <button
              className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium"
              onClick={async () => {
                try { await borrarAsignacion(token, aBorrar.id); setABorrar(null); cargar(); cargarSerie(); }
                catch (err) { setError(err.message); setABorrar(null); }
              }}
            >
              Borrar
            </button>
          </div>
        </Modal>
      )}

      {copiar && (
        <ModalCopiar
          token={token} hacia={periodo}
          onCerrar={() => setCopiar(null)}
          onConfirmado={() => { setCopiar(null); cargar(); cargarSerie(); }}
        />
      )}
    </div>
  );
};

// `pct_ejecutado === null` significa "hay ejecutado y no hay asignado". Un
// 0% ahí diría exactamente lo contrario (que no se ejecutó nada), así que
// se rotula y se resalta en vez de inventar un número.
const CeldaPorcentaje = ({ pct }) => {
  const texto = formatearPorcentaje(pct);
  if (texto === null) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-200 whitespace-nowrap">
        {SIN_PRESUPUESTO_ASIGNADO}
      </span>
    );
  }
  const excedido = Number(pct) > 100;
  return (
    <div className="min-w-[120px]">
      <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
        <div
          className={`h-full ${excedido ? 'bg-red-500' : 'bg-blue-500'}`}
          style={{ width: `${anchoBarra(pct)}%` }}
        />
      </div>
      <span className={`text-xs mt-1 inline-block ${excedido ? 'text-red-300' : 'text-slate-300'}`}>{texto}</span>
    </div>
  );
};

// El convertido va APARTE y etiquetado, nunca dentro de la tabla de
// totales: no es "el total", es la suma de los gastos que tienen tipo de
// cambio cargado. Si falta alguno, lo dice.
const TotalConvertido = ({ dato }) => (
  <div className="px-4 py-3 border-t border-slate-700 bg-slate-900/40">
    <p className="text-[11px] text-slate-400 uppercase tracking-wide">
      Dato aparte · {dato.etiqueta || 'CONVERTIDO_CON_TIPO_DE_CAMBIO_DE_CADA_GASTO'}
    </p>
    <p className="text-lg font-bold text-white mt-1">
      {formatearMonto(dato.total_convertido, dato.moneda_destino)}
    </p>
    <p className="text-slate-500 text-xs mt-1">
      {dato.gastos_convertidos} gasto(s) convertidos con el tipo de cambio de cada uno.
      {dato.completo
        ? ' No quedó ninguno afuera.'
        : ` ${dato.sin_tipo_cambio} gasto(s) en otra moneda sin tipo de cambio quedaron AFUERA: este convertido es parcial.`}
    </p>
    <p className="text-slate-500 text-xs mt-1">No reemplaza a los totales por moneda de arriba.</p>
  </div>
);

// Asignado vs. ejecutado de los últimos 6 meses. Recharts ya está en el
// repo (Admin/GraficosHistoricos.jsx): no se agrega ninguna dependencia.
const GraficoSerie = ({ serie, periodo }) => {
  const datos = useMemo(() => {
    const puntos = serie?.puntos || [];
    // Se grafica UNA sola moneda -ARS, la de la operación- porque un gráfico
    // que apila ARS con USD es exactamente la suma entre monedas que el
    // resto de la pantalla se niega a hacer.
    const porPeriodo = new Map();
    for (const p of puntos) {
      if (p.moneda !== 'ARS') continue;
      const acumulado = porPeriodo.get(p.periodo) || { asignado: [], ejecutado: [] };
      acumulado.asignado.push(p.asignado);
      acumulado.ejecutado.push(p.ejecutado);
      porPeriodo.set(p.periodo, acumulado);
    }
    return Array.from({ length: 6 }, (_, i) => periodoDesplazado(periodo, i - 5)).map((per) => {
      const acumulado = porPeriodo.get(per);
      return {
        periodo: per,
        asignado: Number(sumarMontos(acumulado?.asignado || []) ?? 0),
        ejecutado: Number(sumarMontos(acumulado?.ejecutado || []) ?? 0),
      };
    });
  }, [serie, periodo]);

  const hayDatos = datos.some((d) => d.asignado !== 0 || d.ejecutado !== 0);

  return (
    <Panel titulo="Asignado vs. ejecutado · últimos 6 meses" subtitulo="En ARS. Las otras monedas no se apilan acá: se leen en la tabla de totales.">
      {!serie ? (
        <EstadoVacio icono="chart-bar" titulo="Todavía no se pudo cargar la serie" detalle="El resumen del mes sigue disponible arriba." />
      ) : !hayDatos ? (
        <EstadoVacio icono="chart-bar" titulo="Todavía no hay movimiento en los últimos 6 meses" detalle="Aparece acá cuando haya asignaciones o gastos en ARS cargados." />
      ) : (
        <div className="p-4" style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={datos}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="periodo" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(v) => formatearMonto(v, 'ARS')}
              />
              <Legend />
              <Bar dataKey="asignado" name="Asignado" fill="#3b82f6" />
              <Bar dataKey="ejecutado" name="Ejecutado" fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
};

const ModalAsignacion = ({ token, periodo, onCerrar, onGuardado }) => {
  const [form, setForm] = useState({
    rubro: RUBROS_PRESUPUESTO[0], canal: '', monto_asignado: '', moneda: 'ARS', notas: '',
  });
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const esMarketing = form.rubro === RUBRO_CON_CANAL;

  const enviar = async (e) => {
    e.preventDefault();
    setGuardando(true); setError(null);
    try {
      await crearAsignacion(token, {
        periodo,
        rubro: form.rubro,
        // `canal` sólo con MARKETING: el schema del backend contesta 422 si
        // llega colgado de otro rubro.
        canal: esMarketing && form.canal ? form.canal : null,
        monto_asignado: form.monto_asignado === '' ? '0' : form.monto_asignado,
        moneda: form.moneda,
        notas: form.notas || null,
      });
      onGuardado();
    } catch (err) { setError(err.message); }
    finally { setGuardando(false); }
  };

  return (
    <Modal title={`Nueva asignación · ${periodoLegible(periodo)}`} onClose={onCerrar}>
      <form onSubmit={enviar} className="space-y-4">
        {error && <div role="alert" className="bg-red-500/15 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">{error}</div>}
        <Campo label="Rubro">
          <select className={inputClase} value={form.rubro} onChange={(e) => setForm({ ...form, rubro: e.target.value, canal: '' })}>
            {RUBROS_PRESUPUESTO.map((r) => <option key={r} value={r}>{etiqueta(r)}</option>)}
          </select>
        </Campo>
        {esMarketing && (
          <Campo label="Canal" ayuda="Vacío = el techo del rubro MARKETING, sin abrir por canal.">
            <select className={inputClase} value={form.canal} onChange={(e) => setForm({ ...form, canal: e.target.value })}>
              <option value="">Sin canal</option>
              {CANALES_MARKETING.map((c) => <option key={c} value={c}>{etiqueta(c)}</option>)}
            </select>
          </Campo>
        )}
        <Campo label="Monto asignado">
          <input type="number" step="0.01" min="0" className={inputClase}
            value={form.monto_asignado} onChange={(e) => setForm({ ...form, monto_asignado: e.target.value })} />
        </Campo>
        <Campo label="Moneda">
          <select className={inputClase} value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })}>
            {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Campo>
        <Campo label="Notas">
          <input className={inputClase} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
        </Campo>
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" className={botonSecundario} onClick={onCerrar}>Cancelar</button>
          <button type="submit" className={botonPrimario} disabled={guardando}>Crear asignación</button>
        </div>
      </form>
    </Modal>
  );
};

const ModalEditarAsignacion = ({ token, asignacion, onCerrar, onGuardado }) => {
  const [monto, setMonto] = useState(String(asignacion.monto_asignado ?? ''));
  const [notas, setNotas] = useState(asignacion.notas || '');
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setGuardando(true); setError(null);
    try {
      await editarAsignacion(token, asignacion.id, { monto_asignado: monto, notas: notas || null });
      onGuardado();
    } catch (err) { setError(err.message); }
    finally { setGuardando(false); }
  };

  return (
    <Modal title="Editar la asignación" onClose={onCerrar}>
      <form onSubmit={enviar} className="space-y-4">
        {error && <div role="alert" className="bg-red-500/15 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">{error}</div>}
        <p className="text-slate-400 text-xs">
          {etiqueta(asignacion.rubro)}{asignacion.canal ? ` · ${etiqueta(asignacion.canal)}` : ''} · {asignacion.moneda} · {asignacion.periodo}.
          Sólo se editan el monto y las notas: el resto es la clave única.
        </p>
        <Campo label="Monto asignado">
          <input type="number" step="0.01" min="0" className={inputClase} value={monto} onChange={(e) => setMonto(e.target.value)} />
        </Campo>
        <Campo label="Notas">
          <input className={inputClase} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </Campo>
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" className={botonSecundario} onClick={onCerrar}>Cancelar</button>
          <button type="submit" className={botonPrimario} disabled={guardando}>Guardar</button>
        </div>
      </form>
    </Modal>
  );
};

// Copiar del mes anterior: SIEMPRE dry_run primero. El backend devuelve
// exactamente lo que escribiría; recién con "Confirmar" se manda
// dry_run=false. Un 200 de dry_run se lee igual que uno real si no se
// muestra `escritura`, así que el modal lo dice.
const ModalCopiar = ({ token, hacia, onCerrar, onConfirmado }) => {
  const desde = periodoDesplazado(hacia, -1);
  const [previa, setPrevia] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await copiarAsignaciones(token, desde, hacia, true);
        if (vivo) setPrevia(r);
      } catch (err) { if (vivo) setError(err.message); }
      finally { if (vivo) setCargando(false); }
    })();
    return () => { vivo = false; };
  }, [token, desde, hacia]);

  const confirmar = async () => {
    setConfirmando(true); setError(null);
    try {
      await copiarAsignaciones(token, desde, hacia, false);
      onConfirmado();
    } catch (err) { setError(err.message); setConfirmando(false); }
  };

  return (
    <Modal title="Copiar asignaciones del mes anterior" onClose={onCerrar} maxWidth="max-w-2xl">
      <div className="space-y-4">
        <p className="text-slate-300 text-sm">
          De <strong className="text-white">{periodoLegible(desde)}</strong> a{' '}
          <strong className="text-white">{periodoLegible(hacia)}</strong>.
        </p>
        {error && <div role="alert" className="bg-red-500/15 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">{error}</div>}
        {cargando ? <Cargando texto="Calculando la propuesta…" /> : !previa ? null : (
          <>
            <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 text-sm">
              <p className="text-yellow-200 font-medium">
                Simulación: todavía no se escribió nada (escritura: {String(previa.escritura)}).
              </p>
              <p className="text-slate-400 text-xs mt-1">
                Se copiarían <strong className="text-white">{previa.a_copiar}</strong> asignación(es).{' '}
                <strong className="text-white">{previa.ya_existentes}</strong> ya existen en el destino y no se tocan.
              </p>
            </div>
            {(previa.detalle || []).length === 0 ? (
              <EstadoVacio
                titulo={`No hay asignaciones en ${periodoLegible(desde)}`}
                detalle="No hay nada para copiar. Cargá las asignaciones del mes a mano."
              />
            ) : (
              <Tabla columnas={['Rubro', 'Canal', 'Moneda', 'Acción']}>
                {previa.detalle.map((d, i) => (
                  <tr key={`${d.rubro}-${d.canal || ''}-${d.moneda}-${i}`}>
                    <td className="px-4 py-2"><Badge valor={d.rubro} /></td>
                    <td className="px-4 py-2 text-slate-300">{d.canal ? etiqueta(d.canal) : '—'}</td>
                    <td className="px-4 py-2 text-slate-300">{d.moneda}</td>
                    <td className="px-4 py-2 text-xs">
                      {d.accion === 'COPIAR'
                        ? <span className="text-green-300">Se copia</span>
                        : <span className="text-slate-400">Ya existe: no se toca</span>}
                    </td>
                  </tr>
                ))}
              </Tabla>
            )}
          </>
        )}
        <div className="flex gap-3 justify-end pt-2">
          <button className={botonSecundario} onClick={onCerrar}>Cancelar</button>
          <button
            className={botonPrimario}
            disabled={cargando || confirmando || !previa || previa.a_copiar === 0}
            onClick={confirmar}
          >
            Confirmar
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// b) GASTOS
// ---------------------------------------------------------------------------

const TabGastos = ({ token, periodo, onPeriodo }) => {
  const [gastos, setGastos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [filtros, setFiltros] = useState({ rubro: '', canal: '', proveedor_id: '', origen: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalAlta, setModalAlta] = useState(false);
  const [aAnular, setAAnular] = useState(null);
  const [recurrentes, setRecurrentes] = useState(false);

  // `incluir_anulados: true` SIEMPRE: el gasto anulado tiene que seguir a la
  // vista (tachado, con su fecha de anulación). Un gasto que desaparece es
  // indistinguible de uno que nunca se cargó.
  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setGastos(await listarGastos(token, {
        periodo,
        incluir_anulados: true,
        rubro: filtros.rubro || undefined,
        canal: filtros.canal || undefined,
        proveedor_id: filtros.proveedor_id || undefined,
        origen: filtros.origen || undefined,
      }));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [token, periodo, filtros]);

  const cargarProveedores = useCallback(async () => {
    try { setProveedores(await listarProveedores(token, { limit: 1000 })); }
    catch { setProveedores([]); }
  }, [token]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { cargarProveedores(); }, [cargarProveedores]);

  const nombreProveedor = useCallback(
    (id) => proveedores.find((p) => p.id === id)?.nombre || (id ? id : '—'),
    [proveedores],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-3 flex-wrap">
        <SelectorPeriodo periodo={periodo} onCambiar={onPeriodo} />
        <Campo label="Rubro">
          <select className={inputClase + ' min-w-[160px]'} value={filtros.rubro}
            onChange={(e) => setFiltros({ ...filtros, rubro: e.target.value, canal: e.target.value === RUBRO_CON_CANAL ? filtros.canal : '' })}>
            <option value="">Todos</option>
            {RUBROS_PRESUPUESTO.map((r) => <option key={r} value={r}>{etiqueta(r)}</option>)}
          </select>
        </Campo>
        <Campo label="Canal">
          <select className={inputClase + ' min-w-[150px]'} value={filtros.canal}
            onChange={(e) => setFiltros({ ...filtros, canal: e.target.value })}>
            <option value="">Todos</option>
            {CANALES_MARKETING.map((c) => <option key={c} value={c}>{etiqueta(c)}</option>)}
          </select>
        </Campo>
        <Campo label="Proveedor">
          <select className={inputClase + ' min-w-[180px]'} value={filtros.proveedor_id}
            onChange={(e) => setFiltros({ ...filtros, proveedor_id: e.target.value })}>
            <option value="">Todos</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </Campo>
        <Campo label="Origen">
          <select className={inputClase + ' min-w-[170px]'} value={filtros.origen}
            onChange={(e) => setFiltros({ ...filtros, origen: e.target.value })}>
            <option value="">Todos</option>
            {ORIGENES_GASTO.map((o) => <option key={o} value={o}>{etiqueta(o)}</option>)}
          </select>
        </Campo>
        <div className="ml-auto flex gap-3">
          <button className={botonSecundario} onClick={() => setRecurrentes(true)}>Generar recurrentes del mes</button>
          <button className={botonPrimario} onClick={() => setModalAlta(true)}>+ Nuevo gasto</button>
        </div>
      </div>

      {error && !loading && <ErrorCarga mensaje={error} que="los gastos" onReintentar={cargar} />}

      <Panel titulo={`Gastos de ${periodoLegible(periodo)}`} subtitulo="Los anulados siguen listados, tachados y con su fecha de anulación">
        {loading ? <Cargando texto="Cargando los gastos…" /> : error ? null : gastos.length === 0 ? (
          <EstadoVacio
            icono="currency-dollar"
            titulo="Todavía no hay gastos en este período"
            detalle="Acá va la plata que efectivamente salió: herramientas, pauta, profesionales, impuestos. Es lo que se compara contra el presupuesto asignado."
            accion={<button className={botonPrimario} onClick={() => setModalAlta(true)}>Cargar el primero</button>}
          />
        ) : (
          <Tabla columnas={['Fecha', 'Rubro', 'Canal', 'Proveedor', 'Concepto', 'Monto', 'Medio de pago', 'Origen', 'Comprobante', '']}>
            {gastos.map((g) => {
              const anulado = Boolean(g.anulado_en);
              return (
                <tr key={g.id} className={anulado ? 'opacity-60' : ''}>
                  <td className={`px-4 py-2.5 text-slate-300 whitespace-nowrap ${anulado ? 'line-through' : ''}`}>{fechaCorta(g.fecha)}</td>
                  <td className="px-4 py-2.5"><Badge valor={g.rubro} /></td>
                  <td className="px-4 py-2.5 text-slate-300">{g.canal ? etiqueta(g.canal) : '—'}</td>
                  <td className="px-4 py-2.5 text-slate-300">{g.proveedor_id ? nombreProveedor(g.proveedor_id) : '—'}</td>
                  <td className={`px-4 py-2.5 text-white ${anulado ? 'line-through' : ''}`}>
                    {g.concepto}
                    {anulado && (
                      <span className="block text-red-300 text-[11px] no-underline">
                        Anulado el {fechaCorta(g.anulado_en)}
                      </span>
                    )}
                  </td>
                  <td className={`px-4 py-2.5 text-white whitespace-nowrap ${anulado ? 'line-through' : ''}`}>
                    {formatearMonto(g.monto, g.moneda)}
                    {g.tipo_cambio && <span className="block text-slate-500 text-[11px]">TC {g.tipo_cambio}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 text-xs">{g.medio_pago ? etiqueta(g.medio_pago) : '—'}</td>
                  <td className="px-4 py-2.5"><Badge valor={g.origen} /></td>
                  <td className="px-4 py-2.5">
                    {g.comprobante_url_drive ? (
                      <a href={g.comprobante_url_drive} target="_blank" rel="noopener noreferrer"
                        className="text-blue-300 hover:text-blue-200 text-xs inline-flex items-center gap-1">
                        Ver <Icon name="arrow-top-right-on-square" size={12} />
                      </a>
                    ) : <span className="text-slate-600 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {!anulado && (
                      <button className="text-red-300 hover:text-red-200 text-xs" onClick={() => setAAnular(g)}>Anular</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </Tabla>
        )}
      </Panel>

      {modalAlta && (
        <ModalGasto
          token={token} periodo={periodo} proveedores={proveedores}
          onCerrar={() => setModalAlta(false)}
          onGuardado={() => { setModalAlta(false); cargar(); }}
        />
      )}

      {aAnular && (
        <Modal title="Anular el gasto" onClose={() => setAAnular(null)}>
          <p className="text-slate-300 text-sm">
            ¿Anular <strong className="text-white">{aAnular.concepto}</strong> por {formatearMonto(aAnular.monto, aAnular.moneda)}?
          </p>
          <p className="text-slate-500 text-xs mt-2">
            No se borra: queda listado tachado, con la fecha de anulación, y deja de contar en el ejecutado del período.
          </p>
          <div className="flex gap-3 justify-end mt-5">
            <button className={botonSecundario} onClick={() => setAAnular(null)}>Cancelar</button>
            <button
              className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium"
              onClick={async () => {
                try { await anularGasto(token, aAnular.id); setAAnular(null); cargar(); }
                catch (err) { setError(err.message); setAAnular(null); }
              }}
            >
              Anular
            </button>
          </div>
        </Modal>
      )}

      {recurrentes && (
        <ModalRecurrentes
          token={token} periodo={periodo} proveedores={proveedores}
          onCerrar={() => setRecurrentes(false)}
          onConfirmado={() => { setRecurrentes(false); cargar(); }}
        />
      )}
    </div>
  );
};

const ModalGasto = ({ token, periodo, proveedores, onCerrar, onGuardado }) => {
  const [form, setForm] = useState({
    fecha: primerDiaDelPeriodo(periodo),
    rubro: RUBROS_PRESUPUESTO[0],
    canal: '',
    proveedor_id: '',
    concepto: '',
    monto: '',
    moneda: 'ARS',
    tipo_cambio: '',
    medio_pago: '',
    comprobante_url_drive: '',
  });
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const esMarketing = form.rubro === RUBRO_CON_CANAL;

  const enviar = async (e) => {
    e.preventDefault();
    setGuardando(true); setError(null);
    try {
      await crearGasto(token, {
        fecha: form.fecha,
        rubro: form.rubro,
        canal: esMarketing && form.canal ? form.canal : null,
        proveedor_id: form.proveedor_id || null,
        concepto: form.concepto,
        monto: form.monto === '' ? '0' : form.monto,
        moneda: form.moneda,
        tipo_cambio: form.tipo_cambio === '' ? null : form.tipo_cambio,
        medio_pago: form.medio_pago || null,
        comprobante_url_drive: form.comprobante_url_drive || null,
      });
      onGuardado();
    } catch (err) { setError(err.message); }
    finally { setGuardando(false); }
  };

  return (
    <Modal title="Nuevo gasto" onClose={onCerrar}>
      <form onSubmit={enviar} className="space-y-4">
        {error && <div role="alert" className="bg-red-500/15 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">{error}</div>}
        <Campo label="Fecha" ayuda="El período del gasto lo calcula el backend a partir de esta fecha.">
          <input type="date" className={inputClase} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required />
        </Campo>
        <Campo label="Rubro">
          <select className={inputClase} value={form.rubro} onChange={(e) => setForm({ ...form, rubro: e.target.value, canal: '' })}>
            {RUBROS_PRESUPUESTO.map((r) => <option key={r} value={r}>{etiqueta(r)}</option>)}
          </select>
        </Campo>
        {esMarketing && (
          <Campo label="Canal">
            <select className={inputClase} value={form.canal} onChange={(e) => setForm({ ...form, canal: e.target.value })}>
              <option value="">Sin canal</option>
              {CANALES_MARKETING.map((c) => <option key={c} value={c}>{etiqueta(c)}</option>)}
            </select>
          </Campo>
        )}
        <Campo label="Proveedor (opcional)">
          <select className={inputClase} value={form.proveedor_id} onChange={(e) => setForm({ ...form, proveedor_id: e.target.value })}>
            <option value="">Sin proveedor</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </Campo>
        <Campo label="Concepto">
          <input className={inputClase} value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} required />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Monto">
            <input type="number" step="0.01" min="0" className={inputClase} value={form.monto}
              onChange={(e) => setForm({ ...form, monto: e.target.value })} required />
          </Campo>
          <Campo label="Moneda">
            <select className={inputClase} value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })}>
              {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Campo>
        </div>
        <Campo label="Tipo de cambio (opcional)" ayuda="Sólo se usa para el total convertido, que se informa aparte y rotulado.">
          <input type="number" step="0.0001" min="0" className={inputClase} value={form.tipo_cambio}
            onChange={(e) => setForm({ ...form, tipo_cambio: e.target.value })} />
        </Campo>
        <Campo label="Medio de pago">
          <select className={inputClase} value={form.medio_pago} onChange={(e) => setForm({ ...form, medio_pago: e.target.value })}>
            <option value="">Sin especificar</option>
            {MEDIOS_PAGO.map((m) => <option key={m} value={m}>{etiqueta(m)}</option>)}
          </select>
        </Campo>
        <Campo label="Link al comprobante">
          <input className={inputClase} value={form.comprobante_url_drive}
            onChange={(e) => setForm({ ...form, comprobante_url_drive: e.target.value })} placeholder="https://drive.google.com/…" />
        </Campo>
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" className={botonSecundario} onClick={onCerrar}>Cancelar</button>
          <button type="submit" className={botonPrimario} disabled={guardando}>Crear gasto</button>
        </div>
      </form>
    </Modal>
  );
};

// Generar recurrentes: dry_run primero, tabla propuesta, y recién ahí
// "Confirmar". Además avisa cuántos proveedores ACTIVOS quedaron AFUERA por
// no tener costo_mensual o rubro_presupuesto: ese número no está en la
// respuesta del backend (que sólo lista los que sí califican) y sin él un
// "0 gastos a crear" parece que no hay nada que pagar cuando en realidad
// falta cargarles el dato.
const ModalRecurrentes = ({ token, periodo, proveedores, onCerrar, onConfirmado }) => {
  const [previa, setPrevia] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const afuera = useMemo(() => proveedoresActivosSinDatos(proveedores), [proveedores]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await generarRecurrentes(token, periodo, true);
        if (vivo) setPrevia(r);
      } catch (err) { if (vivo) setError(err.message); }
      finally { if (vivo) setCargando(false); }
    })();
    return () => { vivo = false; };
  }, [token, periodo]);

  const confirmar = async () => {
    setConfirmando(true); setError(null);
    try {
      await generarRecurrentes(token, periodo, false);
      onConfirmado();
    } catch (err) { setError(err.message); setConfirmando(false); }
  };

  return (
    <Modal title={`Generar recurrentes de ${periodoLegible(periodo)}`} onClose={onCerrar} maxWidth="max-w-2xl">
      <div className="space-y-4">
        {error && <div role="alert" className="bg-red-500/15 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">{error}</div>}
        {cargando ? <Cargando texto="Calculando la propuesta…" /> : !previa ? null : (
          <>
            <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 text-sm">
              <p className="text-yellow-200 font-medium">
                Simulación: todavía no se escribió nada (escritura: {String(previa.escritura)}).
              </p>
              <p className="text-slate-400 text-xs mt-1">
                Se crearían <strong className="text-white">{previa.gastos_a_crear}</strong> gasto(s) sobre{' '}
                {previa.proveedores_evaluados} proveedor(es) recurrente(s).{' '}
                <strong className="text-white">{previa.ya_existentes}</strong> ya tienen el recurrente del período.
              </p>
            </div>

            {afuera.length > 0 && (
              <div role="status" className="bg-yellow-500/15 border border-yellow-500/50 rounded-lg p-3 text-sm">
                <p className="text-yellow-100">
                  {afuera.length} proveedor(es) ACTIVO(s) quedaron afuera por no tener costo mensual o rubro de presupuesto cargado.
                </p>
                <p className="text-yellow-200/80 text-xs mt-1">
                  {afuera.slice(0, 5).map((p) => p.nombre).join(', ')}{afuera.length > 5 ? '…' : ''}
                </p>
                <p className="text-yellow-200/80 text-xs mt-1">
                  Cargales el dato en Dirección &gt; Proveedores para que entren en la generación del mes.
                </p>
              </div>
            )}

            {(previa.propuestos || []).length === 0 ? (
              <EstadoVacio
                icono="currency-dollar"
                titulo="Ningún proveedor califica como recurrente"
                detalle="Un proveedor entra acá si está ACTIVO y tiene costo mensual y rubro de presupuesto cargados."
              />
            ) : (
              <Tabla columnas={['Proveedor', 'Rubro', 'Monto', 'Acción']}>
                {previa.propuestos.map((p) => (
                  <tr key={p.proveedor_id}>
                    <td className="px-4 py-2 text-white">{p.proveedor_nombre}</td>
                    <td className="px-4 py-2"><Badge valor={p.rubro} /></td>
                    <td className="px-4 py-2 text-slate-200 whitespace-nowrap">{formatearMonto(p.monto, p.moneda)}</td>
                    <td className="px-4 py-2 text-xs">
                      {p.omitido_porque
                        ? <span className="text-slate-400">{p.omitido_porque}</span>
                        : <span className="text-green-300">Se crea</span>}
                    </td>
                  </tr>
                ))}
              </Tabla>
            )}
          </>
        )}
        <div className="flex gap-3 justify-end pt-2">
          <button className={botonSecundario} onClick={onCerrar}>Cancelar</button>
          <button
            className={botonPrimario}
            disabled={cargando || confirmando || !previa || previa.gastos_a_crear === 0}
            onClick={confirmar}
          >
            Confirmar
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// c) COMISIONES LIQUIDADAS
// ---------------------------------------------------------------------------

const TabComisiones = ({ token, periodo, onPeriodo }) => {
  const [comisiones, setComisiones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalAlta, setModalAlta] = useState(false);
  const [aAnular, setAAnular] = useState(null);

  // Igual que los gastos: las anuladas siguen a la vista.
  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try { setComisiones(await listarComisiones(token, { periodo, incluir_anuladas: true })); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [token, periodo]);

  useEffect(() => { cargar(); }, [cargar]);

  // Totales POR MONEDA de lo liquidado VIGENTE (las anuladas no suman).
  // Se suma en centavos enteros, nunca en float, y nunca entre monedas.
  const totales = useMemo(() => {
    const porMoneda = new Map();
    for (const c of comisiones) {
      if (c.anulado_en) continue;
      const lista = porMoneda.get(c.moneda) || [];
      lista.push(c.monto);
      porMoneda.set(c.moneda, lista);
    }
    return Array.from(porMoneda, ([moneda, montos]) => [moneda, sumarMontos(montos)]);
  }, [comisiones]);

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-3 flex-wrap">
        <SelectorPeriodo periodo={periodo} onCambiar={onPeriodo} />
        <button className={botonPrimario + ' ml-auto'} onClick={() => setModalAlta(true)}>Nueva comisión liquidada</button>
      </div>

      {error && !loading && <ErrorCarga mensaje={error} que="las comisiones liquidadas" onReintentar={cargar} />}

      <Panel
        titulo={`Comisiones liquidadas de ${periodoLegible(periodo)}`}
        subtitulo="Lo que la compañía efectivamente liquidó, con comprobante. No se compara ni se suma con la comisión ESTIMADA de la cartera ART."
      >
        {loading ? <Cargando texto="Cargando las comisiones…" /> : error ? null : comisiones.length === 0 ? (
          <EstadoVacio
            icono="currency-dollar"
            titulo="Todavía no hay comisiones liquidadas en este período"
            detalle="Acá se carga, por compañía y ramo, lo que efectivamente liquidaron. Es el número con comprobante detrás."
            accion={<button className={botonPrimario} onClick={() => setModalAlta(true)}>Cargar la primera</button>}
          />
        ) : (
          <>
            <Tabla columnas={['Compañía', 'Ramo', 'Monto', 'Fuente', 'Comprobante', 'Notas', '']}>
              {comisiones.map((c) => {
                const anulada = Boolean(c.anulado_en);
                return (
                  <tr key={c.id} className={anulada ? 'opacity-60' : ''}>
                    <td className={`px-4 py-2.5 text-white ${anulada ? 'line-through' : ''}`}>
                      {c.compania}
                      {anulada && (
                        <span className="block text-red-300 text-[11px] no-underline">
                          Anulada el {fechaCorta(c.anulado_en)}
                        </span>
                      )}
                    </td>
                    <td className={`px-4 py-2.5 text-slate-300 ${anulada ? 'line-through' : ''}`}>{c.ramo}</td>
                    <td className={`px-4 py-2.5 text-white whitespace-nowrap ${anulada ? 'line-through' : ''}`}>
                      {formatearMonto(c.monto, c.moneda)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">{etiqueta(c.fuente)}</td>
                    <td className="px-4 py-2.5">
                      {c.comprobante_url_drive ? (
                        <a href={c.comprobante_url_drive} target="_blank" rel="noopener noreferrer"
                          className="text-blue-300 hover:text-blue-200 text-xs inline-flex items-center gap-1">
                          Ver <Icon name="arrow-top-right-on-square" size={12} />
                        </a>
                      ) : <span className="text-slate-600 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">{c.notas || '—'}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {!anulada && (
                        <button className="text-red-300 hover:text-red-200 text-xs" onClick={() => setAAnular(c)}>Anular</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </Tabla>
            <div className="px-4 py-3 border-t border-slate-700 flex flex-wrap gap-6">
              {totales.map(([moneda, total]) => (
                <div key={moneda}>
                  <p className="text-slate-400 text-xs">Liquidado {moneda} (vigente)</p>
                  <p className="text-lg font-bold text-white">
                    {total === null ? 'Sin dato: algún monto no es legible' : formatearMonto(total, moneda)}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </Panel>

      {modalAlta && (
        <ModalComision
          token={token} periodo={periodo}
          onCerrar={() => setModalAlta(false)}
          onGuardado={() => { setModalAlta(false); cargar(); }}
        />
      )}

      {aAnular && (
        <Modal title="Anular la comisión liquidada" onClose={() => setAAnular(null)}>
          <p className="text-slate-300 text-sm">
            ¿Anular la comisión de <strong className="text-white">{aAnular.compania}</strong> / {aAnular.ramo} por{' '}
            {formatearMonto(aAnular.monto, aAnular.moneda)}?
          </p>
          <p className="text-slate-500 text-xs mt-2">
            No se borra: queda listada tachada y con su fecha de anulación. Al anularla, la clave queda libre para cargar la corregida.
          </p>
          <div className="flex gap-3 justify-end mt-5">
            <button className={botonSecundario} onClick={() => setAAnular(null)}>Cancelar</button>
            <button
              className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium"
              onClick={async () => {
                try { await anularComision(token, aAnular.id); setAAnular(null); cargar(); }
                catch (err) { setError(err.message); setAAnular(null); }
              }}
            >
              Anular
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

const ModalComision = ({ token, periodo, onCerrar, onGuardado }) => {
  const [form, setForm] = useState({
    compania: '', ramo: '', periodo, monto: '', moneda: 'ARS',
    fuente: FUENTES_COMISION[0], comprobante_url_drive: '', notas: '',
  });
  const [error, setError] = useState(null);
  const [duplicado, setDuplicado] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setGuardando(true); setError(null); setDuplicado(null);
    try {
      await crearComision(token, {
        compania: form.compania,
        ramo: form.ramo,
        periodo: form.periodo,
        monto: form.monto === '' ? '0' : form.monto,
        moneda: form.moneda,
        fuente: form.fuente,
        comprobante_url_drive: form.comprobante_url_drive || null,
        notas: form.notas || null,
      });
      onGuardado();
    } catch (err) {
      // El 409 por duplicado NO es un error crudo: es "esa liquidación ya
      // está cargada". Se muestra como aviso, con la salida concreta.
      if (err.status === 409) setDuplicado(err.duplicado || err.message);
      else setError(err.message);
    } finally { setGuardando(false); }
  };

  return (
    <Modal title="Nueva comisión liquidada" onClose={onCerrar}>
      <form onSubmit={enviar} className="space-y-4">
        {error && <div role="alert" className="bg-red-500/15 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">{error}</div>}
        {duplicado && (
          <div role="alert" className="bg-yellow-500/15 border border-yellow-500/50 rounded-lg p-3 text-sm">
            <p className="text-yellow-100">Esa liquidación ya está cargada</p>
            <p className="text-yellow-200/90 text-xs mt-1">{duplicado}</p>
            <p className="text-yellow-200/80 text-xs mt-1">
              Ya existe una comisión vigente para esa compañía, ramo, período y moneda. Si el monto cambió, anulá la que está cargada y volvé a cargarla.
            </p>
          </div>
        )}
        <Campo label="Compañía">
          <input className={inputClase} value={form.compania} onChange={(e) => setForm({ ...form, compania: e.target.value })} required />
        </Campo>
        <Campo label="Ramo">
          <input className={inputClase} value={form.ramo} onChange={(e) => setForm({ ...form, ramo: e.target.value })} required
            placeholder="ART, automotor, hogar…" />
        </Campo>
        <Campo label="Período">
          <input type="month" className={inputClase} value={form.periodo} onChange={(e) => setForm({ ...form, periodo: e.target.value })} required />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Monto">
            <input type="number" step="0.01" min="0" className={inputClase} value={form.monto}
              onChange={(e) => setForm({ ...form, monto: e.target.value })} required />
          </Campo>
          <Campo label="Moneda">
            <select className={inputClase} value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })}>
              {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Campo>
        </div>
        <Campo label="Fuente">
          <select className={inputClase} value={form.fuente} onChange={(e) => setForm({ ...form, fuente: e.target.value })}>
            {FUENTES_COMISION.map((f) => <option key={f} value={f}>{etiqueta(f)}</option>)}
          </select>
        </Campo>
        <Campo label="Link al comprobante">
          <input className={inputClase} value={form.comprobante_url_drive}
            onChange={(e) => setForm({ ...form, comprobante_url_drive: e.target.value })} placeholder="https://drive.google.com/…" />
        </Campo>
        <Campo label="Notas">
          <input className={inputClase} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
        </Campo>
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" className={botonSecundario} onClick={onCerrar}>Cancelar</button>
          <button type="submit" className={botonPrimario} disabled={guardando}>Cargar comisión</button>
        </div>
      </form>
    </Modal>
  );
};

export default DireccionFinanzas;
