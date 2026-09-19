import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from '../Icons';
import { obtenerTablero } from './direccionApi';
import {
  SIN_FRENTES, diasDesde, fechaCorta, formatearMonto, gerenciaSinCargar,
  semaforoDeGerencia, semaforoGlobalMostrado,
} from './direccionConstantes';
import {
  Badge, Cargando, ChipSemaforo, ErrorCarga, EstadoVacio, Panel, PuntoSemaforo, Tabla,
} from './DireccionComunes';
import ModalImportarSemilla from './ModalImportarSemilla';

// Pantalla 1 del módulo DIRECCIÓN: el estado de la empresa en una pantalla.
// GET /api/v1/direccion/tablero (TableroOut). Todo lo que se muestra acá
// viene calculado del backend; el front no recalcula semáforos ni totales.
const DireccionTablero = ({ token, onAbrirGerencia }) => {
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [importar, setImportar] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDatos(await obtenerTablero(token));
    } catch (err) {
      setError(err.message);
      setDatos(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { cargar(); }, [cargar]);

  // Si la carga falló NO se pinta el tablero: un cero acá se lee como "no hay
  // frentes bloqueados", que es exactamente lo contrario de "no sabemos".
  if (error && !loading) {
    return (
      <div className="space-y-6">
        <Encabezado onRefrescar={cargar} onImportar={() => setImportar(true)} />
        <ErrorCarga mensaje={error} que="el tablero de Dirección" onReintentar={cargar} />
        {importar && (
          <ModalImportarSemilla token={token} onCerrar={() => setImportar(false)} onImportado={cargar} />
        )}
      </div>
    );
  }
  if (loading && !datos) {
    return (
      <div className="space-y-6">
        <Encabezado onRefrescar={cargar} onImportar={() => setImportar(true)} />
        <Cargando texto="Cargando el tablero…" />
        {importar && (
          <ModalImportarSemilla token={token} onCerrar={() => setImportar(false)} onImportado={cargar} />
        )}
      </div>
    );
  }
  if (!datos) return null;

  const gerencias = datos.gerencias || [];
  const topFrentes = datos.top_frentes || [];
  const decisiones = datos.decisiones_abiertas || [];
  const workers = datos.workers_por_estado || {};
  const herramientas = datos.herramientas_pagas || [];
  const costos = datos.costos || {};
  const porRubro = costos.por_rubro || {};
  const porMoneda = costos.por_moneda || {};

  // Decisiones por antigüedad: primero la que más tiempo lleva esperando.
  const decisionesOrdenadas = [...decisiones].sort(
    (a, b) => new Date(a.creada_en || 0) - new Date(b.creada_en || 0)
  );

  return (
    <div className="space-y-6">
      <Encabezado
        onRefrescar={cargar}
        onImportar={() => setImportar(true)}
        semaforo={semaforoGlobalMostrado(datos.semaforo_global, gerencias)}
        cargando={loading}
      />

      {/* Tarjetas por gerencia */}
      {gerencias.length === 0 ? (
        <Panel>
          <EstadoVacio
            icono="building-office"
            titulo="Todavía no hay gerencias cargadas"
            detalle="El tablero se llena cuando existen gerencias con frentes y decisiones."
          />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {gerencias.map((g) => {
            const sinCargar = gerenciaSinCargar(g);
            return (
            <button
              key={g.codigo}
              type="button"
              onClick={() => onAbrirGerencia(g.codigo)}
              className="text-left bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-blue-500/60 rounded-xl p-4 transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">{g.codigo}</p>
                  <p className="font-semibold text-white truncate">{g.nombre}</p>
                </div>
                <PuntoSemaforo color={semaforoDeGerencia(g)} />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                <Metrica etiqueta="Frentes" valor={g.frentes_abiertos} />
                <Metrica etiqueta="Bloqueados" valor={g.frentes_bloqueados} alerta={g.frentes_bloqueados > 0} />
                <Metrica etiqueta="Decisiones" valor={g.decisiones_abiertas} alerta={g.decisiones_abiertas > 0} />
              </div>
              {/* Sin frentes ni decisiones no se muestran los motivos del
                  backend (que dirían "todo en orden"): se dice que no hay
                  nada cargado, que es lo que pasa de verdad. */}
              {sinCargar ? (
                <p className="mt-3 text-[11px] text-slate-400">{SIN_FRENTES}</p>
              ) : (g.motivos || []).length > 0 && (
                <ul className="mt-3 space-y-1">
                  {g.motivos.slice(0, 3).map((m, i) => (
                    <li key={i} className="text-[11px] text-slate-400 truncate">• {m}</li>
                  ))}
                </ul>
              )}
            </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Qué mueve la aguja */}
        <Panel titulo="Qué mueve la aguja" subtitulo="Los 5 frentes de mayor prioridad">
          {topFrentes.length === 0 ? (
            <EstadoVacio titulo="Todavía no hay frentes abiertos" detalle="Cargá el primero desde la ficha de una gerencia." />
          ) : (
            <ul className="divide-y divide-slate-700/60">
              {topFrentes.slice(0, 5).map((f) => (
                <li key={f.codigo} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white text-sm truncate">{f.titulo}</p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {f.codigo}{f.gerencia_codigo ? ` · ${f.gerencia_codigo}` : ''}
                      {f.responsable ? ` · ${f.responsable}` : ''}
                    </p>
                  </div>
                  <Badge valor={f.estado} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Decisiones que esperan a Sebs */}
        <Panel titulo="Decisiones que esperan a Sebs" subtitulo="Ordenadas por antigüedad: primero la que más espera">
          {decisionesOrdenadas.length === 0 ? (
            <EstadoVacio titulo="Todavía no hay decisiones abiertas" detalle="Nada pendiente de resolución." icono="check-badge" />
          ) : (
            <ul className="divide-y divide-slate-700/60">
              {decisionesOrdenadas.map((d) => {
                const dias = diasDesde(d.creada_en);
                return (
                  <li key={d.codigo} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-white text-sm">{d.pregunta}</p>
                      <p className="text-slate-500 text-xs mt-0.5">
                        {d.codigo}{d.gerencia_codigo ? ` · ${d.gerencia_codigo}` : ''} · {fechaCorta(d.creada_en)}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold whitespace-nowrap ${dias !== null && dias > 14 ? 'text-red-300' : 'text-slate-400'}`}>
                      {dias === null ? '—' : `${dias} d`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      {/* Workers por estado */}
      <Panel titulo="Workers por estado">
        {Object.keys(workers).length === 0 ? (
          <EstadoVacio titulo="Todavía no hay workers registrados" detalle="El padrón de automatizaciones está vacío." />
        ) : (
          <div className="p-4 flex flex-wrap gap-3">
            {Object.entries(workers).map(([estado, cantidad]) => (
              <div key={estado} className="px-4 py-3 rounded-lg bg-slate-900/60 border border-slate-700 min-w-[120px]">
                <p className="text-2xl font-bold text-white">{cantidad}</p>
                <div className="mt-1"><Badge valor={estado} /></div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Herramientas pagas */}
      <Panel
        titulo="Herramientas pagas"
        subtitulo="En rojo, las que se pagan y no tienen trabajo asignado"
      >
        {herramientas.length === 0 ? (
          <EstadoVacio
            icono="currency-dollar"
            titulo="Todavía no hay herramientas pagas cargadas"
            detalle="Aparecen acá los proveedores activos con costo mensual."
          />
        ) : (
          <Tabla columnas={['Herramienta', 'Rubro', 'Costo mensual', 'Trabajo asignado']}>
            {herramientas.map((h) => (
              <tr key={h.proveedor_id} className={h.sin_trabajo_asignado ? 'bg-red-500/10' : ''}>
                <td className="px-4 py-2.5 text-white whitespace-nowrap">{h.nombre}</td>
                <td className="px-4 py-2.5"><Badge valor={h.rubro_presupuesto} /></td>
                <td className="px-4 py-2.5 text-slate-200 whitespace-nowrap">
                  {formatearMonto(h.costo_mensual, h.moneda)}
                </td>
                <td className="px-4 py-2.5">
                  {h.sin_trabajo_asignado ? (
                    <span className="text-red-300 text-xs font-semibold">Sin trabajo asignado</span>
                  ) : (
                    <span className="text-green-300 text-xs">Asignado</span>
                  )}
                </td>
              </tr>
            ))}
          </Tabla>
        )}
      </Panel>

      {/* Costos por rubro y moneda */}
      <Panel
        titulo="Total mensual por rubro y moneda"
        subtitulo="No se suman monedas distintas: eso exigiría una cotización implícita"
      >
        {Object.keys(porRubro).length === 0 ? (
          <EstadoVacio
            icono="currency-dollar"
            titulo="Todavía no hay costos cargados"
            detalle="Cargá el costo mensual de un proveedor activo para verlo acá."
          />
        ) : (
          <>
            <Tabla columnas={['Rubro', 'Moneda', 'Total mensual']}>
              {Object.entries(porRubro).flatMap(([rubro, porMon]) =>
                Object.entries(porMon).map(([moneda, monto]) => (
                  <tr key={`${rubro}-${moneda}`}>
                    <td className="px-4 py-2.5"><Badge valor={rubro} /></td>
                    <td className="px-4 py-2.5 text-slate-300">{moneda}</td>
                    <td className="px-4 py-2.5 text-white whitespace-nowrap">{formatearMonto(monto, moneda)}</td>
                  </tr>
                ))
              )}
            </Tabla>
            <div className="px-4 py-3 border-t border-slate-700 flex flex-wrap gap-4">
              {Object.entries(porMoneda).map(([moneda, monto]) => (
                <div key={moneda}>
                  <p className="text-slate-400 text-xs">Total {moneda}</p>
                  <p className="text-lg font-bold text-white">{formatearMonto(monto, moneda)}</p>
                </div>
              ))}
              <div>
                <p className="text-slate-400 text-xs">Proveedores contados</p>
                <p className="text-lg font-bold text-white">{costos.proveedores_contados ?? '—'}</p>
              </div>
            </div>
          </>
        )}
      </Panel>

      {importar && (
        <ModalImportarSemilla token={token} onCerrar={() => setImportar(false)} onImportado={cargar} />
      )}
    </div>
  );
};

const Metrica = ({ etiqueta: texto, valor, alerta }) => (
  <div>
    <p className={`text-xl font-bold ${alerta ? 'text-red-300' : 'text-white'}`}>{valor ?? '—'}</p>
    <p className="text-[11px] text-slate-500">{texto}</p>
  </div>
);

const Encabezado = ({ onRefrescar, onImportar, semaforo, cargando }) => (
  <div className="flex items-center justify-between flex-wrap gap-3">
    <div>
      <h2 className="text-2xl font-bold">Tablero de Dirección</h2>
      <p className="text-slate-400 text-sm mt-1">El estado de la empresa en una pantalla.</p>
    </div>
    <div className="flex items-center gap-3">
      {semaforo && <ChipSemaforo color={semaforo} />}
      {/* Carga inicial de la semilla. Siempre pasa por la corrida en seco
          (ver ModalImportarSemilla): no hay forma de escribir de una. */}
      <button
        onClick={onImportar}
        className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm transition flex items-center gap-2"
      >
        <Icon name="document-text" size={16} /> Importar semilla
      </button>
      <button
        onClick={onRefrescar}
        disabled={cargando}
        className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm transition disabled:opacity-50 flex items-center gap-2"
      >
        <Icon name="arrow-path" size={16} /> Actualizar
      </button>
    </div>
  </div>
);

export default DireccionTablero;
