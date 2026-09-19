import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../Icons';
import Modal from '../Modal';
import {
  anularFactura, buscarReceptores, descargarPdf, descartarFactura, emitirFactura,
  listarFacturas, obtenerEstado, obtenerParametros, reconciliarFactura,
  resumenMensual,
} from './facturacionApi';
import {
  CONCEPTOS, CONDICIONES_IVA, CONSUMIDOR_FINAL, ESTADO_AUTORIZADA,
  ESTADO_DESCARTADA, ESTADO_ERROR_COMUNICACION, ESTADOS_FACTURA,
  RECEPTOR_VACIO, TIPOS_DOCUMENTO,
  claseAmbiente, detalleAmbiente, detalleParaCopiar, esDescartable, esProduccion,
  exigePeriodoDeServicio, nuevaClaveIdempotencia, textoAmbiente, totalDeItems,
} from './facturacionConstantes';
import { etiqueta, fechaCorta, formatearMonto } from './direccionConstantes';
import { periodoActual, periodoLegible } from './finanzasConstantes';
import {
  Cargando, ErrorCarga, EstadoVacio, Panel, Tabla,
  botonPrimario, botonSecundario, inputClase, Campo,
} from './DireccionComunes';
import { API_URL } from './direccionApi';
import { authHeader } from '../../utils/api';

// Pestaña 4 de Dirección > Finanzas: FACTURACIÓN ELECTRÓNICA ARCA.
// Backend: app/api/v1/facturas.py (PR #168) + PR #169. ADMIN-only.
//
// CUATRO REGLAS QUE ESTA PANTALLA NO PUEDE ROMPER, las cuatro con test:
//
//  1. EL AMBIENTE SIEMPRE A LA VISTA, y sobre todo en la confirmación
//     previa a emitir. HOMOLOGACIÓN en amarillo, PRODUCCIÓN en rojo.
//     Emitir en producción es irreversible: sólo se anula con nota de
//     crédito ante ARCA.
//  2. MÓDULO APAGADO NO ES UN ERROR. Un 503 por FACTURACION_ENABLED=false
//     se muestra como cartel informativo, nunca como error rojo de red.
//  3. LO QUE ARCA DIJO SE MUESTRA TEXTUAL Y COMPLETO. Ni resumido ni
//     traducido: el código y el mensaje de ARCA son lo que se busca en su
//     documentación.
//  4. DESPUÉS DE UN ERROR DE COMUNICACIÓN SE RECONCILIA, NO SE REINTENTA.
//     ARCA pudo haber autorizado; reintentar duplicaría el comprobante.

// ---------------------------------------------------------------------------
// Piezas chicas
// ---------------------------------------------------------------------------

// El ambiente, en grande. La pieza más importante de la pantalla.
export const CartelAmbiente = ({ ambiente, className = '' }) => (
  <div
    role="status"
    aria-label={`Ambiente ${textoAmbiente(ambiente)}`}
    className={`rounded-xl border px-4 py-3 ${claseAmbiente(ambiente)} ${className}`}
  >
    <p className="text-xs uppercase tracking-wide opacity-80">Ambiente</p>
    <p className="text-2xl font-black leading-tight">{textoAmbiente(ambiente)}</p>
    <p className="text-xs mt-1 opacity-90">{detalleAmbiente(ambiente)}</p>
  </div>
);

export const BadgeEstadoFactura = ({ estado }) => {
  const clases = {
    AUTORIZADA: 'bg-green-500/20 text-green-300',
    RECHAZADA: 'bg-red-500/20 text-red-300',
    ERROR_COMUNICACION: 'bg-orange-500/20 text-orange-200',
    ENVIANDO: 'bg-yellow-500/20 text-yellow-200',
    BORRADOR: 'bg-slate-700/60 text-slate-300',
    // Gris apagado: una descartada no compite por atención con un
    // comprobante de verdad.
    DESCARTADA: 'bg-slate-800 text-slate-500',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${clases[estado] || 'bg-slate-700/60 text-slate-300'}`}>
      {etiqueta(estado)}
    </span>
  );
};

// Cartel del módulo apagado. INFORMATIVO, no un error: el backend funciona,
// el flag está en false y eso es una decisión, no una falla.
export const CartelApagado = ({ mensaje, faltantes }) => (
  <div role="status" className="bg-slate-700/40 border border-slate-600 rounded-lg p-4 flex items-start gap-3">
    <Icon name="lock-closed" className="text-slate-300 shrink-0 mt-0.5" />
    <div className="min-w-0">
      <p className="text-slate-100 font-medium">Facturación apagada (FACTURACION_ENABLED=false)</p>
      <p className="text-slate-400 text-sm mt-1">
        Ningún comprobante se emite ni se consulta mientras siga así. Se prende cargando la variable en Render.
      </p>
      {mensaje && <p className="text-slate-500 text-xs mt-2">{mensaje}</p>}
      {faltantes?.length > 0 && (
        <p className="text-slate-400 text-xs mt-2">
          Además falta configurar: <code className="text-yellow-200">{faltantes.join(', ')}</code>
        </p>
      )}
    </div>
  </div>
);

// Un bloque de códigos de ARCA, tal cual vinieron: [codigo] mensaje.
const ListaArca = ({ titulo, filas, clase }) => (!filas?.length ? null : (
  <div className="mt-2">
    <p className={`text-xs font-semibold ${clase}`}>{titulo}</p>
    <ul className="mt-1 space-y-1">
      {filas.map((o, i) => (
        <li key={`${o.codigo}-${i}`} className="text-xs text-slate-200 font-mono break-words">
          <span className="text-slate-400">[{o.codigo}]</span> {o.mensaje}
        </li>
      ))}
    </ul>
  </div>
));

// Errores y observaciones de ARCA, TEXTUALES Y COMPLETOS.
export const DetalleArca = ({ factura }) => {
  const errores = factura?.errores_arca || [];
  const observaciones = factura?.observaciones_arca || [];
  const [copiado, setCopiado] = useState(false);
  if (!errores.length && !observaciones.length) return null;

  const copiar = async () => {
    const texto = detalleParaCopiar(factura);
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  };

  return (
    <div className="bg-slate-900/70 border border-slate-600 rounded-lg p-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-slate-300 text-sm font-medium">Lo que contestó ARCA</p>
        <button type="button" className={botonSecundario + ' text-xs py-1'} onClick={copiar}>
          <span className="inline-flex items-center gap-1"><Icon name="clipboard" size={14} /> Copiar detalle</span>
        </button>
      </div>
      {copiado && <p className="text-green-300 text-[11px] mt-1">Detalle copiado al portapapeles.</p>}
      <ListaArca titulo="Errores" filas={errores} clase="text-red-300" />
      <ListaArca titulo="Observaciones" filas={observaciones} clase="text-yellow-200" />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Pestaña
// ---------------------------------------------------------------------------

const TabFacturacion = ({ token }) => {
  const [estado, setEstado] = useState(null);
  const [errorEstado, setErrorEstado] = useState(null);
  const [cargandoEstado, setCargandoEstado] = useState(true);
  const [verParametros, setVerParametros] = useState(false);
  const [nueva, setNueva] = useState(false);
  const [refrescar, setRefrescar] = useState(0);

  const cargarEstado = useCallback(async () => {
    setCargandoEstado(true); setErrorEstado(null);
    try { setEstado(await obtenerEstado(token)); }
    catch (err) { setErrorEstado(err.message); setEstado(null); }
    finally { setCargandoEstado(false); }
  }, [token]);

  useEffect(() => { cargarEstado(); }, [cargarEstado]);

  const habilitado = Boolean(estado?.habilitado);

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-white">Facturación electrónica ARCA</h3>
          <p className="text-slate-400 text-xs mt-0.5">
            Comprobantes emitidos con CAE. Un comprobante autorizado no se edita ni se borra: se anula con una nota de crédito.
          </p>
        </div>
        <div className="ml-auto flex gap-2 flex-wrap">
          <button className={botonSecundario} onClick={cargarEstado} disabled={cargandoEstado}>
            <span className="inline-flex items-center gap-1"><Icon name="arrow-path" size={14} /> Actualizar estado</span>
          </button>
          <button className={botonSecundario} onClick={() => setVerParametros(true)} disabled={!habilitado}>
            Ver parámetros
          </button>
          <button className={botonPrimario} onClick={() => setNueva(true)} disabled={!habilitado}>
            + Nueva factura
          </button>
        </div>
      </div>

      {errorEstado && !cargandoEstado && (
        <ErrorCarga mensaje={errorEstado} que="el estado de la facturación" onReintentar={cargarEstado} />
      )}

      {cargandoEstado && !estado ? <Cargando texto="Consultando el estado de ARCA…" /> : null}

      {estado && <PanelEstado estado={estado} />}

      {estado && !habilitado && <CartelApagado faltantes={estado.faltantes} />}

      {habilitado && (
        <>
          <ResumenDelMes token={token} refrescar={refrescar} />
          <ListaFacturas token={token} refrescar={refrescar} onCambio={() => setRefrescar((n) => n + 1)} />
        </>
      )}

      {verParametros && <ModalParametros token={token} onCerrar={() => setVerParametros(false)} />}
      {nueva && (
        <ModalNuevaFactura
          token={token}
          ambiente={estado?.ambiente}
          onCerrar={() => setNueva(false)}
          onEmitida={() => setRefrescar((n) => n + 1)}
        />
      )}
    </div>
  );
};

// --- Estado ARCA -----------------------------------------------------------

const Dato = ({ titulo, valor, className = '' }) => (
  <div className={className}>
    <p className="text-slate-400 text-[11px]">{titulo}</p>
    <p className="text-slate-100 text-sm font-medium break-words">{valor ?? '—'}</p>
  </div>
);

const PanelEstado = ({ estado }) => {
  const ticket = estado.ticket || {};
  const arca = estado.arca || {};
  const cert = estado.certificado || {};
  const servidores = arca.consultado
    ? (arca.error ? `Error: ${arca.error}` : ['appserver', 'dbserver', 'authserver']
      .map((s) => `${s}: ${arca[s] ?? '—'}`).join(' · '))
    : `No consultado — ${arca.motivo || 'el módulo está apagado o sin configurar'}`;

  return (
    <Panel titulo="Estado ARCA" subtitulo="Flags, ambiente, configuración faltante y vigencia del ticket. No expone secretos.">
      <div className="p-4 space-y-4">
        <CartelAmbiente ambiente={estado.ambiente} />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Dato titulo="Módulo (FACTURACION_ENABLED)" valor={estado.habilitado ? 'Prendido' : 'Apagado'} />
          <Dato titulo="Ambiente (ARCA_PRODUCTION)" valor={estado.produccion ? 'true' : 'false'} />
          <Dato titulo="Configuración" valor={estado.configurado ? 'Completa' : 'Incompleta'} />
          <Dato titulo="Condición del emisor" valor={etiqueta(estado.condicion_emisor)} />
          <Dato titulo="Punto de venta" valor={estado.punto_venta} />
          <Dato titulo="CUIT del emisor" valor={estado.cuit_emisor_ultimos_digitos ? `…${estado.cuit_emisor_ultimos_digitos}` : 'Sin cargar'} />
          <Dato titulo="Tipos habilitados" valor={(estado.tipos_habilitados || []).map(etiqueta).join(', ') || '—'} />
          <Dato titulo="QR en el PDF" valor={estado.qr_disponible ? 'Disponible' : 'No disponible'} />
        </div>

        {estado.faltantes?.length > 0 && (
          <div role="alert" className="bg-yellow-500/15 border border-yellow-500/50 rounded-lg p-3">
            <p className="text-yellow-100 text-sm font-medium">Falta configurar</p>
            <p className="text-yellow-200/90 text-xs mt-1 font-mono break-words">{estado.faltantes.join(', ')}</p>
            <p className="text-yellow-200/80 text-xs mt-1">
              Se cargan en Render. El certificado y la clave van como Secret Files.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-700 pt-4">
          <Dato
            titulo="Ticket de acceso (WSAA)"
            valor={ticket.existe
              ? (ticket.vigente ? `Vigente hasta ${fechaCorta(ticket.vigente_hasta)}` : 'Vencido: se renueva solo al emitir')
              : 'Todavía no se pidió ninguno'}
          />
          <Dato
            titulo="Certificado"
            valor={cert.disponible === false
              ? (cert.motivo || 'No disponible')
              : `${cert.sujeto || 'cargado'}${cert.vence ? ` · vence ${fechaCorta(cert.vence)}` : ''}`}
          />
          <Dato titulo="Servidores de ARCA" valor={servidores} />
        </div>
      </div>
    </Panel>
  );
};

// --- Parámetros (diagnóstico) ---------------------------------------------

const ModalParametros = ({ token, onCerrar }) => {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [apagado, setApagado] = useState(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const d = await obtenerParametros(token);
        if (vivo) setDatos(d);
      } catch (err) {
        if (!vivo) return;
        if (err.apagado) setApagado(err);
        else setError(err.message);
      }
    })();
    return () => { vivo = false; };
  }, [token]);

  return (
    <Modal title="Parámetros habilitados en ARCA" onClose={onCerrar}>
      {apagado && <CartelApagado mensaje={apagado.message} faltantes={apagado.faltantes} />}
      {error && <div role="alert" className="bg-red-500/15 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">{error}</div>}
      {!datos && !error && !apagado && <Cargando texto="Preguntándole a ARCA…" />}
      {datos && (
        <div className="space-y-4">
          <CartelAmbiente ambiente={datos.ambiente} />

          {/* Las advertencias van TEXTUALES: son la respuesta al rechazo
              10018 antes de que haya un comprobante en juego. */}
          {(datos.advertencias || []).map((a, i) => (
            <div key={i} role="alert" className="bg-yellow-500/15 border border-yellow-500/50 rounded-lg p-3 text-yellow-100 text-sm">
              {a}
            </div>
          ))}

          <div>
            <p className="text-slate-300 text-sm font-medium mb-2">
              Puntos de venta habilitados para web services
              {' '}<span className="text-slate-500 text-xs">
                (configurado: {datos.punto_venta_configurado} —{' '}
                {datos.punto_venta_configurado_habilitado ? 'habilitado' : 'NO habilitado'})
              </span>
            </p>
            {(datos.puntos_venta || []).length === 0 ? (
              <p className="text-slate-500 text-sm">ARCA no devolvió ningún punto de venta.</p>
            ) : (
              <Tabla columnas={['Número', 'Tipo de emisión', 'Bloqueado', 'Fecha de baja']}>
                {datos.puntos_venta.map((p) => (
                  <tr key={p.numero}>
                    <td className="px-4 py-2 text-white">{p.numero}</td>
                    <td className="px-4 py-2 text-slate-300">{p.tipo_emision || '—'}</td>
                    <td className="px-4 py-2 text-slate-300">{p.bloqueado ? 'Sí' : 'No'}</td>
                    <td className="px-4 py-2 text-slate-400">{p.fecha_baja || '—'}</td>
                  </tr>
                ))}
              </Tabla>
            )}
          </div>

          <div>
            <p className="text-slate-300 text-sm font-medium mb-2">Tipos de comprobante</p>
            <Tabla columnas={['Código', 'Descripción', 'Interno', 'Lo puede emitir este emisor']}>
              {(datos.tipos_comprobante || []).map((t) => (
                <tr key={t.codigo}>
                  <td className="px-4 py-2 text-white">{t.codigo}</td>
                  <td className="px-4 py-2 text-slate-300">{t.descripcion || '—'}</td>
                  <td className="px-4 py-2 text-slate-400">{t.tipo_interno ? etiqueta(t.tipo_interno) : '—'}</td>
                  <td className="px-4 py-2">
                    {t.permitido_para_el_emisor
                      ? <span className="text-green-300 text-xs">Sí</span>
                      : <span className="text-slate-500 text-xs">No</span>}
                  </td>
                </tr>
              ))}
            </Tabla>
          </div>
        </div>
      )}
      <div className="flex justify-end pt-4">
        <button className={botonSecundario} onClick={onCerrar}>Cerrar</button>
      </div>
    </Modal>
  );
};

// --- Resumen mensual -------------------------------------------------------

const ResumenDelMes = ({ token, refrescar }) => {
  const [periodo, setPeriodo] = useState(periodoActual());
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vivo = true;
    const [anio, mes] = periodo.split('-');
    (async () => {
      try {
        const d = await resumenMensual(token, anio, mes);
        if (vivo) { setDatos(d); setError(null); }
      } catch (err) { if (vivo) { setError(err.message); setDatos(null); } }
    })();
    return () => { vivo = false; };
  }, [token, periodo, refrescar]);

  return (
    <Panel
      titulo={`Resumen de ${periodoLegible(periodo)}`}
      subtitulo="Las notas de crédito restan del total. El resumen cuenta UN solo ambiente y lo declara."
      acciones={(
        <input
          type="month" aria-label="Mes del resumen" className={inputClase + ' max-w-[170px]'}
          value={periodo} onChange={(e) => e.target.value && setPeriodo(e.target.value)}
        />
      )}
    >
      {error ? (
        <div className="p-4"><ErrorCarga mensaje={error} que="el resumen mensual" /></div>
      ) : !datos ? (
        <Cargando texto="Cargando el resumen…" />
      ) : (
        <div className="p-4 space-y-3">
          <div className="flex flex-wrap gap-6 items-end">
            <div>
              <p className="text-slate-400 text-xs">Comprobantes</p>
              <p className="text-2xl font-bold text-white">{datos.cantidad}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Autorizado neto de notas de crédito</p>
              <p className="text-2xl font-bold text-white">{formatearMonto(datos.total_autorizado_neto_de_notas_de_credito, 'ARS')}</p>
            </div>
            {/* El ambiente del resumen, SIEMPRE rotulado: un total de
                facturación sin decir si es de homologación no significa nada. */}
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${claseAmbiente(datos.ambiente)}`}>
              {textoAmbiente(datos.ambiente)}
            </span>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-slate-400">
            {Object.entries(datos.por_estado || {}).map(([e, n]) => (
              <span key={e}>{etiqueta(e)}: <strong className="text-slate-200">{n}</strong></span>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
};

// --- Listado ---------------------------------------------------------------

// `incluir_descartadas` arranca en false, igual que el default del backend:
// una DESCARTADA no es un comprobante y no tiene por qué aparecer sin que
// alguien la pida.
const FILTRO_INICIAL = {
  estado: '', desde: '', hasta: '', documento: '', incluir_descartadas: false,
};

const ListaFacturas = ({ token, refrescar, onCambio }) => {
  const [filtros, setFiltros] = useState(FILTRO_INICIAL);
  const [pagina, setPagina] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apagado, setApagado] = useState(null);
  const [abierta, setAbierta] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true); setError(null); setApagado(null);
    try { setPagina(await listarFacturas(token, { ...filtros, limit: 50 })); }
    catch (err) {
      if (err.apagado) setApagado(err); else setError(err.message);
      setPagina(null);
    } finally { setLoading(false); }
  }, [token, filtros]);

  useEffect(() => { cargar(); }, [cargar, refrescar]);

  const items = pagina?.items || [];

  return (
    <Panel
      titulo="Comprobantes emitidos"
      subtitulo="Del más nuevo al más viejo. La columna Ambiente distingue una prueba de un comprobante real."
    >
      <div className="p-4 flex gap-3 flex-wrap items-end border-b border-slate-700">
        <Campo label="Estado">
          <select
            className={inputClase + ' min-w-[170px]'} value={filtros.estado}
            onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}
          >
            <option value="">Todos</option>
            {ESTADOS_FACTURA.map((e) => <option key={e} value={e}>{etiqueta(e)}</option>)}
          </select>
        </Campo>
        <Campo label="Desde">
          <input type="date" className={inputClase} value={filtros.desde}
            onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })} />
        </Campo>
        <Campo label="Hasta">
          <input type="date" className={inputClase} value={filtros.hasta}
            onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })} />
        </Campo>
        <Campo label="Documento del receptor">
          <input className={inputClase} value={filtros.documento} placeholder="CUIT, con o sin guiones"
            onChange={(e) => setFiltros({ ...filtros, documento: e.target.value })} />
        </Campo>
        {/* EL FILTRO EXPLÍCITO. Sin él el operador no tiene cómo llegar a
            una descartada, y "no se ve" no puede significar "no existe": la
            fila está, con su motivo. Pedir el estado DESCARTADA ya las trae
            sin tildar nada, así que el checkbox queda desactivado ahí para
            no ofrecer una combinación que no cambia nada. */}
        <label className="flex items-center gap-2 text-xs text-slate-300 pb-2 cursor-pointer">
          <input
            type="checkbox" className="accent-blue-500"
            checked={filtros.incluir_descartadas || filtros.estado === ESTADO_DESCARTADA}
            disabled={filtros.estado === ESTADO_DESCARTADA}
            onChange={(e) => setFiltros({ ...filtros, incluir_descartadas: e.target.checked })}
          />
          Incluir descartadas
        </label>
        <button className={botonSecundario} onClick={() => setFiltros(FILTRO_INICIAL)}>Limpiar</button>
      </div>

      {apagado && <div className="p-4"><CartelApagado mensaje={apagado.message} faltantes={apagado.faltantes} /></div>}
      {error && !loading && <div className="p-4"><ErrorCarga mensaje={error} que="los comprobantes" onReintentar={cargar} /></div>}

      {loading ? <Cargando texto="Cargando los comprobantes…" /> : (error || apagado) ? null : items.length === 0 ? (
        <EstadoVacio
          icono="document-text"
          titulo="Todavía no hay comprobantes emitidos"
          detalle="Acá aparecen las facturas y notas de crédito con su CAE, su estado y su ambiente."
        />
      ) : (
        <Tabla columnas={['Fecha', 'Tipo', 'Número', 'Receptor', 'Total', 'Estado', 'Ambiente', 'CAE', '']}>
          {items.map((f) => (
            // Descartada: EN GRIS Y CON SU MOTIVO. Verla apagada sin saber
            // por qué está apagada es peor que no verla.
            <tr
              key={f.id}
              data-descartada={f.estado === ESTADO_DESCARTADA ? 'si' : undefined}
              className={f.estado === ESTADO_DESCARTADA
                ? 'opacity-50 text-slate-500'
                : (f.anulada_en ? 'opacity-60' : '')}
            >
              <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">{fechaCorta(f.fecha_comprobante)}</td>
              <td className="px-4 py-2.5 text-slate-300">{etiqueta(f.tipo_comprobante)}</td>
              <td className={`px-4 py-2.5 text-white ${f.anulada_en ? 'line-through' : ''}`}>
                {f.numero_completo || '—'}
                {f.anulada_en && (
                  <span className="block text-red-300 text-[11px] no-underline">Anulada el {fechaCorta(f.anulada_en)}</span>
                )}
                {f.estado === ESTADO_DESCARTADA && (
                  <span className="block text-slate-500 text-[11px] no-underline">
                    Descartada{f.descartada_en ? ` el ${fechaCorta(f.descartada_en)}` : ''}
                    {f.motivo_descarte ? `: ${f.motivo_descarte}` : ''}
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-slate-200">
                {f.receptor_razon_social}
                <span className="block text-slate-500 text-[11px]">{f.receptor_numero_documento || '—'}</span>
              </td>
              <td className="px-4 py-2.5 text-white whitespace-nowrap">{formatearMonto(f.importe_total, 'ARS')}</td>
              <td className="px-4 py-2.5"><BadgeEstadoFactura estado={f.estado} /></td>
              <td className="px-4 py-2.5">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${claseAmbiente(f.ambiente)}`}>
                  {textoAmbiente(f.ambiente)}
                </span>
              </td>
              <td className="px-4 py-2.5 text-slate-400 text-xs font-mono">{f.cae || '—'}</td>
              <td className="px-4 py-2.5">
                <button className="text-blue-300 hover:text-blue-200 text-xs" onClick={() => setAbierta(f)}>Ver detalle</button>
              </td>
            </tr>
          ))}
        </Tabla>
      )}

      {abierta && (
        <ModalDetalle
          token={token} id={abierta.id}
          onCerrar={() => setAbierta(null)}
          onCambio={() => { onCambio?.(); cargar(); }}
        />
      )}
    </Panel>
  );
};

// --- Detalle ---------------------------------------------------------------

export const AccionesComprobante = ({ token, factura, onCambio, onError }) => {
  const [trabajando, setTrabajando] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [confirmarAnular, setConfirmarAnular] = useState(false);
  const [confirmarDescartar, setConfirmarDescartar] = useState(false);
  const [motivoDescarte, setMotivoDescarte] = useState('');

  const bajar = async () => {
    setTrabajando('pdf');
    try { await descargarPdf(token, factura); }
    catch (err) { onError(err.message); }
    finally { setTrabajando(null); }
  };

  const reconciliar = async () => {
    setTrabajando('reconciliar');
    try { onCambio(await reconciliarFactura(token, factura.id)); }
    catch (err) { onError(err.message); }
    finally { setTrabajando(null); }
  };

  const anular = async () => {
    setTrabajando('anular');
    try {
      const nota = await anularFactura(token, factura.id, motivo);
      setConfirmarAnular(false);
      onCambio({ nota });
    } catch (err) { onError(err.message); }
    finally { setTrabajando(null); }
  };

  // DESCARTAR NO ES BORRAR, y el 409 con `reconciliado` es el caso que
  // justifica todo el mecanismo: ARCA SÍ lo tenía y se adoptó su CAE. Ese
  // 409 NO se muestra como un error rojo -no falló nada, el comprobante
  // quedó AUTORIZADA- y obliga a recargar el detalle.
  const descartar = async () => {
    setTrabajando('descartar');
    try {
      const res = await descartarFactura(token, factura.id, motivoDescarte);
      setConfirmarDescartar(false);
      onCambio(res);
    } catch (err) {
      if (err.reconciliado) {
        setConfirmarDescartar(false);
        onCambio({ detalle: err.message });
      } else {
        onError(err.message);
      }
    } finally { setTrabajando(null); }
  };

  const esError = factura.estado === ESTADO_ERROR_COMUNICACION;
  const puedeDescartarse = esDescartable(factura);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <button className={botonSecundario} onClick={bajar} disabled={trabajando === 'pdf'}>
          {trabajando === 'pdf' ? 'Descargando…' : 'Descargar PDF'}
        </button>

        {/* ERROR_COMUNICACION -> RECONCILIAR, y NUNCA un botón que diga
            "reintentar": ARCA pudo haber autorizado y un segundo envío
            duplicaría el comprobante. */}
        {esError && (
          <button className={botonPrimario} onClick={reconciliar} disabled={trabajando === 'reconciliar'}>
            {trabajando === 'reconciliar' ? 'Consultando a ARCA…' : 'Reconciliar'}
          </button>
        )}

        {factura.estado === ESTADO_AUTORIZADA && !factura.anulada_en && (
          <button
            className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium"
            onClick={() => setConfirmarAnular(true)}
          >
            Anular
          </button>
        )}

        {/* Sólo para una tentativa sin CAE. Secundario y NUNCA rojo: el
            botón caro de esta pantalla es Anular, que emite ante ARCA;
            descartar no toca ARCA más que para preguntarle. */}
        {puedeDescartarse && (
          <button className={botonSecundario} onClick={() => setConfirmarDescartar(true)}>
            Descartar
          </button>
        )}
      </div>

      {esError && (
        <p className="text-orange-200 text-xs">
          ARCA no contestó y PUDO HABER AUTORIZADO este comprobante. No se reintenta: “Reconciliar” le
          pregunta a ARCA qué pasó con el número que se intentó y adopta su CAE si lo tiene.
        </p>
      )}

      {confirmarDescartar && (
        <div className="bg-slate-700/40 border border-slate-600 rounded-lg p-3 space-y-3">
          <p className="text-slate-100 text-sm font-medium">
            Descartar {factura.numero_completo || 'el intento sin número'}
          </p>
          {/* LO QUE HAY QUE DECIR ANTES DE QUE APRIETE, y en este orden:
              primero que se le pregunta a ARCA, después que si ARCA lo
              tiene no se descarta. Al revés, el operador lee "no se
              descarta" como una advertencia de que puede fallar, en vez de
              como la garantía que es. */}
          <p className="text-slate-300 text-xs">
            Primero se le <strong>consulta a ARCA</strong> por este número.
            Si ARCA lo tiene autorizado, <strong>no se descarta</strong>: se adopta su CAE y el
            comprobante queda AUTORIZADA. Sólo si ARCA no lo tiene se marca como descartada.
          </p>
          <p className="text-slate-400 text-xs">
            No se borra nada: la fila queda con el motivo, quién y cuándo. Deja de contarse en el
            resumen y sale del listado salvo que tildes “Incluir descartadas”. El número vuelve a
            quedar libre.
          </p>
          <Campo label="Motivo (queda guardado en el comprobante)">
            <input className={inputClase} value={motivoDescarte} minLength={3}
              onChange={(e) => setMotivoDescarte(e.target.value)}
              placeholder="Intento fallido: quedó colgado por el bug de lock" />
          </Campo>
          <div className="flex gap-2 justify-end">
            <button className={botonSecundario} onClick={() => setConfirmarDescartar(false)}>Cancelar</button>
            <button
              className={botonPrimario + ' disabled:opacity-50'}
              disabled={motivoDescarte.trim().length < 3 || trabajando === 'descartar'}
              onClick={descartar}
            >
              {trabajando === 'descartar' ? 'Consultando a ARCA…' : 'Consultar a ARCA y descartar'}
            </button>
          </div>
        </div>
      )}

      {confirmarAnular && (
        <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-3 space-y-3">
          <p className="text-red-100 text-sm font-medium">Anular el comprobante {factura.numero_completo}</p>
          <p className="text-red-200/90 text-xs">
            No se borra ni se edita: se emite una NOTA DE CRÉDITO que lo referencia ante ARCA. El original queda
            declarado tal como se emitió.
          </p>
          <div className={`rounded-lg border px-3 py-2 ${claseAmbiente(factura.ambiente)}`}>
            <span className="text-xs">Se emite en ambiente </span>
            <strong className="text-sm">{textoAmbiente(factura.ambiente)}</strong>
          </div>
          <Campo label="Motivo (queda impreso en la nota de crédito)">
            <input className={inputClase} value={motivo} minLength={3}
              onChange={(e) => setMotivo(e.target.value)} placeholder="Error en el importe facturado" />
          </Campo>
          <div className="flex gap-2 justify-end">
            <button className={botonSecundario} onClick={() => setConfirmarAnular(false)}>Cancelar</button>
            <button
              className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium disabled:opacity-50"
              disabled={motivo.trim().length < 3 || trabajando === 'anular'}
              onClick={anular}
            >
              {trabajando === 'anular' ? 'Emitiendo la nota…' : 'Emitir nota de crédito'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const ModalDetalle = ({ token, id, onCerrar, onCambio }) => {
  const [factura, setFactura] = useState(null);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);

  const [recarga, setRecarga] = useState(0);
  const cargar = useCallback(() => setRecarga((n) => n + 1), []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const d = await verFacturaSegura(token, id);
        if (vivo) { setFactura(d); setError(null); }
      } catch (err) { if (vivo) setError(err.message); }
    })();
    return () => { vivo = false; };
  }, [token, id, recarga]);

  return (
    <Modal title="Comprobante" onClose={onCerrar}>
      {error && <div role="alert" className="bg-red-500/15 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">{error}</div>}
      {!factura && !error ? <Cargando /> : factura && (
        <div className="space-y-4">
          <ResumenComprobante factura={factura} />
          {aviso && <div role="status" className="bg-blue-500/15 border border-blue-500/40 rounded-lg p-3 text-blue-100 text-sm">{aviso}</div>}
          <DetalleArca factura={factura} />
          <AccionesComprobante
            token={token} factura={factura}
            onError={setError}
            onCambio={(resultado) => {
              if (resultado?.nota) {
                setAviso(`Se emitió la nota de crédito ${resultado.nota.numero_completo || '(sin número)'} (${resultado.nota.estado}).`);
              } else if (resultado?.detalle) {
                setAviso(resultado.detalle);
              }
              cargar();
              onCambio?.();
            }}
          />
        </div>
      )}
      <div className="flex justify-end pt-4">
        <button className={botonSecundario} onClick={onCerrar}>Cerrar</button>
      </div>
    </Modal>
  );
};

// GET /{id} directo: el detalle completo (con ítems y lo que dijo ARCA).
const verFacturaSegura = async (token, id) => {
  const res = await fetch(`${API_URL.replace(/\/$/, '')}/api/v1/finanzas/facturas/${encodeURIComponent(id)}`, {
    headers: authHeader(token),
  });
  if (!res.ok) {
    const err = new Error(`No se pudo traer el comprobante (HTTP ${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res.json();
};

export const ResumenComprobante = ({ factura }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-3 flex-wrap">
      <BadgeEstadoFactura estado={factura.estado} />
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${claseAmbiente(factura.ambiente)}`}>
        {textoAmbiente(factura.ambiente)}
      </span>
      {factura.anulada_en && <span className="text-red-300 text-xs">Anulada el {fechaCorta(factura.anulada_en)}</span>}
    </div>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <Dato titulo="Tipo" valor={etiqueta(factura.tipo_comprobante)} />
      <Dato titulo="Número" valor={factura.numero_completo || 'Sin número asignado'} />
      <Dato titulo="Fecha" valor={fechaCorta(factura.fecha_comprobante)} />
      <Dato titulo="CAE" valor={factura.cae || '—'} />
      <Dato titulo="Vencimiento del CAE" valor={factura.cae_vencimiento ? fechaCorta(factura.cae_vencimiento) : '—'} />
      <Dato titulo="Resultado de ARCA" valor={factura.resultado_arca || '—'} />
      <Dato titulo="Receptor" valor={factura.receptor_razon_social} />
      <Dato titulo="Documento" valor={`${etiqueta(factura.receptor_tipo_documento)} ${factura.receptor_numero_documento || ''}`} />
      <Dato titulo="Total" valor={formatearMonto(factura.importe_total, factura.moneda === 'PES' ? 'ARS' : factura.moneda)} />
    </div>
    {(factura.items || []).length > 0 && (
      <Tabla columnas={['Descripción', 'Cantidad', 'Precio unitario', 'Subtotal']}>
        {factura.items.map((it, i) => (
          <tr key={i}>
            <td className="px-4 py-2 text-slate-200">{it.descripcion}</td>
            <td className="px-4 py-2 text-slate-300">{it.cantidad}</td>
            <td className="px-4 py-2 text-slate-300">{formatearMonto(it.precio_unitario)}</td>
            <td className="px-4 py-2 text-white">{formatearMonto(it.subtotal ?? it.importe)}</td>
          </tr>
        ))}
      </Tabla>
    )}
  </div>
);

// --- Nueva factura ---------------------------------------------------------

const ITEM_VACIO = { descripcion: '', cantidad: '1', precio_unitario: '', bonificacion_porcentaje: '0' };

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const ModalNuevaFactura = ({ token, ambiente, onCerrar, onEmitida }) => {
  const [paso, setPaso] = useState('form');
  const [receptor, setReceptor] = useState(RECEPTOR_VACIO);
  const [items, setItems] = useState([{ ...ITEM_VACIO }]);
  const [concepto, setConcepto] = useState('SERVICIOS');
  const [fechas, setFechas] = useState({
    fecha_comprobante: hoyISO(), fecha_servicio_desde: '', fecha_servicio_hasta: '',
    fecha_vencimiento_pago: '',
  });
  const [observaciones, setObservaciones] = useState('');
  const [error, setError] = useState(null);
  const [apagado, setApagado] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  // LA CLAVE DE IDEMPOTENCIA SE GENERA UNA VEZ POR INTENTO DE EMISIÓN y se
  // conserva: "Reintentar" tiene que mandar LA MISMA. Sólo se renueva
  // cuando se vuelve al formulario a cambiar lo que se va a emitir.
  const [clave, setClave] = useState(() => nuevaClaveIdempotencia());

  const total = useMemo(() => totalDeItems(items), [items]);
  const pideFechas = exigePeriodoDeServicio(concepto);

  const volverAlFormulario = () => {
    setPaso('form');
    setError(null);
    setClave(nuevaClaveIdempotencia());
  };

  const cuerpo = () => ({
    receptor: {
      tipo_documento: receptor.tipo_documento,
      numero_documento: receptor.numero_documento || '',
      razon_social: receptor.razon_social,
      condicion_iva: receptor.condicion_iva,
      domicilio: receptor.domicilio || null,
      email: receptor.email || null,
    },
    items: items.map((it) => ({
      descripcion: it.descripcion,
      cantidad: it.cantidad || '1',
      precio_unitario: it.precio_unitario || '0',
      bonificacion_porcentaje: it.bonificacion_porcentaje || '0',
    })),
    concepto,
    fecha_comprobante: fechas.fecha_comprobante || null,
    fecha_servicio_desde: pideFechas ? (fechas.fecha_servicio_desde || null) : null,
    fecha_servicio_hasta: pideFechas ? (fechas.fecha_servicio_hasta || null) : null,
    fecha_vencimiento_pago: pideFechas ? (fechas.fecha_vencimiento_pago || null) : null,
    observaciones: observaciones || null,
    // `empresa_id` REFERENCIA `empresas` DEL CRM, y el receptor de este
    // formulario ahora sale del padrón de PROVEEDORES: mandar el id de un
    // proveedor acá sería una clave foránea a la tabla equivocada. Queda
    // null, que es la verdad - y no cambia nada de lo que se declara ante
    // ARCA, que es el snapshot fiscal y no la referencia al CRM.
    empresa_id: null,
  });

  const emitir = async () => {
    setEnviando(true); setError(null); setApagado(null);
    try {
      const factura = await emitirFactura(token, cuerpo(), clave);
      setResultado(factura);
      setPaso('resultado');
      onEmitida?.();
    } catch (err) {
      if (err.apagado) setApagado(err); else setError(err.message);
    } finally { setEnviando(false); }
  };

  return (
    <Modal title="Nueva factura" onClose={onCerrar}>
      {apagado && <CartelApagado mensaje={apagado.message} faltantes={apagado.faltantes} />}
      {error && <div role="alert" className="bg-red-500/15 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm mb-3">{error}</div>}

      {paso === 'form' && (
        <div className="space-y-5">
          <p className="text-slate-400 text-xs">
            El tipo de comprobante lo decide la condición del emisor: con el emisor en monotributo se emite
            <strong className="text-slate-200"> Factura C</strong>, sin IVA discriminado.
          </p>

          <FormReceptor token={token} receptor={receptor} onCambiar={setReceptor} />

          <div className="border-t border-slate-700 pt-4 space-y-3">
            <p className="text-slate-300 text-sm font-medium">Detalle</p>
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                <div className="md:col-span-6">
                  <Campo label="Descripción">
                    <input className={inputClase} value={it.descripcion} required
                      onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, descripcion: e.target.value } : x)))} />
                  </Campo>
                </div>
                <div className="md:col-span-2">
                  <Campo label="Cantidad">
                    <input type="number" step="0.01" min="0.01" className={inputClase} value={it.cantidad}
                      onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, cantidad: e.target.value } : x)))} />
                  </Campo>
                </div>
                <div className="md:col-span-3">
                  <Campo label="Precio unitario">
                    <input type="number" step="0.01" min="0" className={inputClase} value={it.precio_unitario}
                      onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, precio_unitario: e.target.value } : x)))} />
                  </Campo>
                </div>
                <div className="md:col-span-1">
                  {items.length > 1 && (
                    <button type="button" className="text-red-300 hover:text-red-200 text-xs py-2"
                      onClick={() => setItems(items.filter((_, j) => j !== i))}>Quitar</button>
                  )}
                </div>
              </div>
            ))}
            <button type="button" className={botonSecundario} onClick={() => setItems([...items, { ...ITEM_VACIO }])}>
              + Agregar ítem
            </button>
            <p className="text-slate-300 text-sm">
              Total: <strong className="text-white">{total === null ? 'sin calcular (hay un importe ilegible)' : formatearMonto(total, 'ARS')}</strong>
            </p>
          </div>

          <div className="border-t border-slate-700 pt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <Campo label="Concepto">
              <select className={inputClase} value={concepto} onChange={(e) => setConcepto(e.target.value)}>
                {CONCEPTOS.map((c) => <option key={c} value={c}>{etiqueta(c)}</option>)}
              </select>
            </Campo>
            <Campo label="Fecha del comprobante">
              <input type="date" className={inputClase} value={fechas.fecha_comprobante}
                onChange={(e) => setFechas({ ...fechas, fecha_comprobante: e.target.value })} />
            </Campo>

            {/* SERVICIOS y PRODUCTOS_Y_SERVICIOS EXIGEN período de servicio y
                vencimiento de pago: sin eso, ARCA rechaza con 10025/10026. */}
            {pideFechas && (
              <>
                <Campo label="Servicio desde" ayuda="Obligatorio para el concepto elegido (ARCA)">
                  <input type="date" className={inputClase} value={fechas.fecha_servicio_desde}
                    onChange={(e) => setFechas({ ...fechas, fecha_servicio_desde: e.target.value })} />
                </Campo>
                <Campo label="Servicio hasta" ayuda="Obligatorio para el concepto elegido (ARCA)">
                  <input type="date" className={inputClase} value={fechas.fecha_servicio_hasta}
                    onChange={(e) => setFechas({ ...fechas, fecha_servicio_hasta: e.target.value })} />
                </Campo>
                <Campo label="Vencimiento de pago">
                  <input type="date" className={inputClase} value={fechas.fecha_vencimiento_pago}
                    onChange={(e) => setFechas({ ...fechas, fecha_vencimiento_pago: e.target.value })} />
                </Campo>
              </>
            )}
            <Campo label="Observaciones">
              <input className={inputClase} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
            </Campo>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button className={botonSecundario} onClick={onCerrar}>Cancelar</button>
            <button
              className={botonPrimario}
              disabled={!receptor.razon_social || items.some((i) => !i.descripcion || i.precio_unitario === '')}
              onClick={() => { setError(null); setPaso('confirmar'); }}
            >
              Revisar y emitir
            </button>
          </div>
        </div>
      )}

      {paso === 'confirmar' && (
        <div className="space-y-4">
          {/* EL AMBIENTE, EN GRANDE, ANTES DE EMITIR. Es el último momento en
              que emitir todavía es reversible. */}
          <CartelAmbiente ambiente={ambiente} />
          {esProduccion(ambiente) && (
            <p role="alert" className="text-red-200 text-sm">
              Esto emite un comprobante REAL ante ARCA. Una vez autorizado no se edita ni se borra: se anula con
              una nota de crédito.
            </p>
          )}

          <div className="bg-slate-900/60 border border-slate-600 rounded-lg p-3 space-y-2">
            <Dato titulo="Receptor" valor={`${receptor.razon_social} · ${etiqueta(receptor.tipo_documento)} ${receptor.numero_documento || '—'}`} />
            <Dato titulo="Condición frente al IVA" valor={etiqueta(receptor.condicion_iva)} />
            <Dato titulo="Concepto" valor={etiqueta(concepto)} />
            <Dato titulo="Fecha" valor={fechas.fecha_comprobante} />
            {pideFechas && (
              <Dato titulo="Período de servicio" valor={`${fechas.fecha_servicio_desde || '—'} a ${fechas.fecha_servicio_hasta || '—'}`} />
            )}
            <Tabla columnas={['Descripción', 'Cantidad', 'Precio unitario']}>
              {items.map((it, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 text-slate-200">{it.descripcion}</td>
                  <td className="px-4 py-2 text-slate-300">{it.cantidad}</td>
                  <td className="px-4 py-2 text-slate-300">{formatearMonto(it.precio_unitario)}</td>
                </tr>
              ))}
            </Tabla>
            <p className="text-slate-200">
              Total a facturar: <strong className="text-white">{total === null ? '—' : formatearMonto(total, 'ARS')}</strong>
            </p>
          </div>

          <p className="text-slate-500 text-[11px]">
            Clave de idempotencia de este envío: <code className="text-slate-400">{clave}</code>. Si el envío falla,
            reintentar usa esta misma clave y ARCA no emite dos veces.
          </p>

          <div className="flex gap-3 justify-end">
            <button className={botonSecundario} onClick={volverAlFormulario} disabled={enviando}>Volver</button>
            <button className={botonPrimario} onClick={emitir} disabled={enviando}>
              {enviando ? 'Emitiendo…' : `Emitir en ${textoAmbiente(ambiente)}`}
            </button>
          </div>
        </div>
      )}

      {paso === 'resultado' && resultado && (
        <div className="space-y-4">
          {resultado.__reusado && (
            <div role="status" className="bg-blue-500/15 border border-blue-500/40 rounded-lg p-3 text-blue-100 text-sm">
              Este envío ya se había hecho con la misma clave de idempotencia: se muestra el comprobante original,
              no se emitió uno nuevo.
            </div>
          )}
          <ResumenComprobante factura={resultado} />
          <DetalleArca factura={resultado} />
          <AccionesComprobante
            token={token} factura={resultado}
            onError={setError}
            onCambio={(r) => { if (r?.factura) setResultado(r.factura); onEmitida?.(); }}
          />
          <div className="flex justify-end">
            <button className={botonSecundario} onClick={onCerrar}>Cerrar</button>
          </div>
        </div>
      )}
    </Modal>
  );
};

// --- Receptor --------------------------------------------------------------

// A QUIÉN LE FACTURA AYMA: LAS COMPAÑÍAS, NO EL CRM.
//
// Este buscador consultaba /api/v1/crm/buscar, o sea las EMPRESAS CLIENTE:
// las PyMEs a las que AYMA les vende seguros. A ésas no se les factura - su
// comprobante lo emite la compañía. AYMA le factura a las ASEGURADORAS y
// ART las comisiones que le liquidan, y ésas están en el padrón de
// PROVEEDORES de Dirección, que es donde vive su CUIT.
//
// Siguen existiendo los otros dos caminos, y por eso el buscador es UNO de
// tres y no el único: el atajo Consumidor Final y la carga a mano, que es
// la que sirve para un receptor que no está en ningún padrón.
//
// EL QUE NO TIENE CUIT SE MUESTRA IGUAL, marcado, y se puede elegir: el
// operador lo tipea a mano acá y se le sugiere cargarlo en Proveedores para
// la próxima. Esconderlo haría creer que la compañía no está cargada y
// llevaría a cargarla duplicada.
const FormReceptor = ({ token, receptor, onCambiar }) => {
  const [busqueda, setBusqueda] = useState('');
  const [candidatos, setCandidatos] = useState(null);
  const [sinCuit, setSinCuit] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState(null);

  const buscar = async () => {
    if (!busqueda.trim()) return;
    setBuscando(true); setErrorBusqueda(null);
    try {
      setCandidatos(await buscarReceptores(token, busqueda.trim()) || []);
    } catch (err) { setErrorBusqueda(err.message); setCandidatos([]); }
    finally { setBuscando(false); }
  };

  // El backend manda el snapshot YA ARMADO. No se recompone acá: un
  // segundo armado es un segundo lugar donde se puede colar un default
  // distinto, y la condición frente al IVA no admite dos versiones.
  const usarCompania = (compania) => {
    const propuesto = compania.receptor || {};
    onCambiar({
      tipo_documento: propuesto.tipo_documento || 'CUIT',
      numero_documento: propuesto.numero_documento || '',
      razon_social: propuesto.razon_social || compania.nombre || '',
      condicion_iva: propuesto.condicion_iva || '',
      domicilio: propuesto.domicilio || '',
      email: propuesto.email || '',
    });
    setSinCuit(compania.falta_cuit ? compania : null);
    setCandidatos(null);
  };

  const set = (campo) => (e) => onCambiar({ ...receptor, [campo]: e.target.value });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-slate-300 text-sm font-medium">Receptor</p>
        <button type="button" className={botonSecundario + ' text-xs py-1'}
          onClick={() => { onCambiar({ ...CONSUMIDOR_FINAL }, null); setSinCuit(null); }}>
          Consumidor Final
        </button>
      </div>

      <div className="flex gap-2 items-end">
        <Campo label="Buscar compañía (aseguradora o ART)">
          <input
            className={inputClase} value={busqueda} placeholder="Nombre o CUIT, con o sin guiones"
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscar(); } }}
          />
        </Campo>
        <button type="button" className={botonSecundario} onClick={buscar} disabled={buscando}>
          <span className="inline-flex items-center gap-1"><Icon name="magnifying-glass" size={14} /> Buscar</span>
        </button>
      </div>

      {errorBusqueda && <p className="text-red-300 text-xs">{errorBusqueda}</p>}
      {candidatos !== null && (
        candidatos.length === 0 ? (
          <p className="text-slate-500 text-xs">
            Ninguna compañía con ese nombre o CUIT en Proveedores. Cargala en
            Dirección &gt; Proveedores, o completá los datos a mano acá abajo.
          </p>
        ) : (
          <ul className="border border-slate-700 rounded-lg divide-y divide-slate-700">
            {candidatos.map((c) => (
              <li key={c.id}>
                <button type="button" className="w-full text-left px-3 py-2 hover:bg-slate-700/40"
                  onClick={() => usarCompania(c)}>
                  <span className="text-slate-100 text-sm">{c.nombre}</span>
                  <span className="block text-slate-500 text-[11px]">
                    {etiqueta(c.tipo)} · {c.cuit || 'SIN CUIT CARGADO'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
      )}

      {/* El backend NO inventa el CUIT: sin documento del receptor no hay
          comprobante. Se pide acá y se dice dónde dejarlo cargado para que
          no haya que volver a tipearlo. */}
      {sinCuit && (
        <p role="alert" className="text-yellow-200 text-xs">
          <strong>{sinCuit.nombre}</strong> no tiene CUIT cargado en Proveedores. Escribilo acá
          abajo para poder emitir, y completalo en <strong>Dirección &gt; Proveedores</strong> así la
          próxima vez sale solo.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Campo label="Razón social">
          <input className={inputClase} value={receptor.razon_social} onChange={set('razon_social')} required />
        </Campo>
        <Campo label="Tipo de documento">
          <select className={inputClase} value={receptor.tipo_documento} onChange={set('tipo_documento')}>
            {TIPOS_DOCUMENTO.map((t) => <option key={t} value={t}>{etiqueta(t)}</option>)}
          </select>
        </Campo>
        <Campo label="Número de documento">
          <input className={inputClase} value={receptor.numero_documento} onChange={set('numero_documento')} />
        </Campo>
        <Campo label="Condición frente al IVA">
          <select className={inputClase} value={receptor.condicion_iva} onChange={set('condicion_iva')} required>
            <option value="">Elegir…</option>
            {CONDICIONES_IVA.map((c) => <option key={c} value={c}>{etiqueta(c)}</option>)}
          </select>
        </Campo>
        <Campo label="Domicilio">
          <input className={inputClase} value={receptor.domicilio || ''} onChange={set('domicilio')} />
        </Campo>
        <Campo label="Email">
          <input type="email" className={inputClase} value={receptor.email || ''} onChange={set('email')} />
        </Campo>
      </div>
    </div>
  );
};

export default TabFacturacion;
