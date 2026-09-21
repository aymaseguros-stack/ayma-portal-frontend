import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../Icons';
import Modal from '../Modal';
import {
  Badge, Campo, Cargando, ErrorCarga, EstadoVacio, Panel, Tabla,
  botonPrimario, botonSecundario, inputClase,
} from '../Direccion/DireccionComunes';
import { listarProveedores } from '../Direccion/direccionApi';
import {
  anularComision, crearComision, editarComision, listarComisiones, listarPuntos,
} from './comercialApi';
import {
  ESTADOS_COMISION_REFERIDO, SIN_DATO, fechaCorta, formatearPctCampo,
  formatearPesos, oSinDato,
} from './comercialConstantes';

// Sub-pestaña "Comisiones de referido" del CRM (backend PR #183).
//
// OJO CON EL SIGNO, Y NO ES UN DETALLE: esto es lo que AYMA LE DEBE a un
// canal (egreso). No es "Comisiones liquidadas" de Dirección → Finanzas, que
// es lo que una compañía NOS liquidó (ingreso). En el backend son dos tablas
// distintas a propósito: sumarlas obligaría a cada consulta del tablero a
// acordarse del signo, y la primera que se olvide infla el ingreso con un
// egreso. Por eso esta pantalla no muestra ningún total mezclado con
// aquélla, y el encabezado lo dice con todas las letras.
const ComisionesReferidoPanel = ({ token }) => {
  const [items, setItems] = useState([]);
  const [estado, setEstado] = useState('');
  const [periodo, setPeriodo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalAlta, setModalAlta] = useState(false);
  const [aLiquidar, setALiquidar] = useState(null);
  const [aAnular, setAAnular] = useState(null);
  const [accionando, setAccionando] = useState(false);
  const [proveedores, setProveedores] = useState(null);
  const [puntos, setPuntos] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      // Los dos filtros los resuelve el BACKEND
      // (GET /comercial/comisiones-referido?estado=&periodo=). `periodo` va
      // con el patrón YYYY-MM que valida allá: cualquier otra cosa es 422.
      setItems(await listarComisiones(token, {
        estado: estado || undefined,
        periodo: periodo || undefined,
        limite: 500,
      }));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [token, estado, periodo]);

  useEffect(() => { cargar(); }, [cargar]);

  // Los nombres: el backend devuelve `proveedor_id` y `punto_contacto_id`,
  // no los nombres. Si alguna de las dos cargas falla, la celda dice "sin
  // dato todavía" y no el UUID crudo, que no le dice nada a nadie.
  useEffect(() => {
    listarProveedores(token, { limit: 500 })
      .then((f) => setProveedores(Object.fromEntries(f.map((p) => [p.id, p.nombre]))))
      .catch(() => setProveedores({}));
    listarPuntos(token, { limite: 500 })
      .then((f) => setPuntos(Object.fromEntries(f.map((p) => [p.id, p.slug]))))
      .catch(() => setPuntos({}));
  }, [token]);

  const hayFiltro = Boolean(estado || periodo);

  // Los totales se calculan SOBRE LO QUE SE MUESTRA y se parten por estado.
  // Un único "total" mezclando DEVENGADA con ANULADA sería un número que no
  // le sirve a nadie: lo devengado es la deuda viva y lo anulado es lo que
  // se dio de baja.
  const totales = useMemo(() => {
    const suma = (e) => items
      .filter((c) => c.estado === e)
      .reduce((acc, c) => acc + (Number(c.monto) || 0), 0);
    return { DEVENGADA: suma('DEVENGADA'), LIQUIDADA: suma('LIQUIDADA') };
  }, [items]);

  const liquidar = async () => {
    setAccionando(true);
    try {
      await editarComision(token, aLiquidar.id, { estado: 'LIQUIDADA' });
      setALiquidar(null);
      cargar();
    } catch (err) { setError(err.message); setALiquidar(null); }
    finally { setAccionando(false); }
  };

  const anular = async () => {
    setAccionando(true);
    try {
      await anularComision(token, aAnular.id);
      setAAnular(null);
      cargar();
    } catch (err) { setError(err.message); setAAnular(null); }
    finally { setAccionando(false); }
  };

  const nombreProveedor = (id) => {
    if (!id) return <span className="text-slate-500">{SIN_DATO}</span>;
    if (proveedores === null) return <span className="text-slate-500">…</span>;
    return proveedores[id]
      ? <span className="text-slate-300">{proveedores[id]}</span>
      : <span className="text-slate-500">{SIN_DATO}</span>;
  };

  const slugPunto = (id) => {
    if (!id) return <span className="text-slate-500">{SIN_DATO}</span>;
    if (puntos === null) return <span className="text-slate-500">…</span>;
    return puntos[id]
      ? <code className="font-mono text-blue-300 text-xs">{puntos[id]}</code>
      : <span className="text-slate-500">{SIN_DATO}</span>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Comisiones de referido</h2>
        <p className="text-slate-400 text-sm mt-1">
          Lo que le debemos a cada canal por el negocio que trajo. Es un{' '}
          <strong className="text-slate-300">egreso</strong>: no se suma con las comisiones
          liquidadas de Finanzas, que son lo que una compañía nos liquidó a nosotros.
        </p>
      </div>

      <div className="flex items-end gap-3 flex-wrap">
        <Campo label="Estado">
          <select
            aria-label="Estado"
            className={inputClase + ' min-w-[170px]'}
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
          >
            <option value="">Todos</option>
            {ESTADOS_COMISION_REFERIDO.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </Campo>
        <Campo label="Período" ayuda="Mes de devengamiento.">
          <input
            type="month"
            aria-label="Período"
            className={inputClase + ' min-w-[170px]'}
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
          />
        </Campo>
        {hayFiltro && (
          <button
            className={botonSecundario}
            onClick={() => { setEstado(''); setPeriodo(''); }}
          >
            Limpiar filtros
          </button>
        )}
        <button className={botonPrimario + ' ml-auto'} onClick={() => setModalAlta(true)}>
          Nueva comisión
        </button>
      </div>

      {error && !loading && <ErrorCarga mensaje={error} que="las comisiones de referido" onReintentar={cargar} />}

      <Panel>
        {loading ? (
          <Cargando texto="Cargando comisiones…" />
        ) : error ? null : items.length === 0 ? (
          <EstadoVacio
            icono="currency-dollar"
            titulo={hayFiltro
              ? 'Ninguna comisión coincide con el filtro'
              : 'Todavía no hay comisiones de referido'}
            detalle={hayFiltro
              ? 'Probá con otro estado o período.'
              : 'Acá va lo que se le reconoce a cada canal por el negocio que trajo.'}
            accion={!hayFiltro
              ? <button className={botonPrimario} onClick={() => setModalAlta(true)}>Cargar la primera</button>
              : null}
          />
        ) : (
          <>
            <Tabla columnas={[
              'Estado', 'Período', 'Proveedor', 'Punto', 'Póliza',
              'Prima base', '%', 'Monto', 'Liquidada', '',
            ]}>
              {items.map((c) => (
                <tr key={c.id} className={c.estado === 'ANULADA' ? 'opacity-60' : ''}>
                  <td className="px-4 py-2.5"><Badge valor={c.estado} /></td>
                  <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">{oSinDato(c.periodo)}</td>
                  <td className="px-4 py-2.5 text-sm">{nombreProveedor(c.proveedor_id)}</td>
                  <td className="px-4 py-2.5">{slugPunto(c.punto_contacto_id)}</td>
                  <td className="px-4 py-2.5 text-slate-300 text-xs">{oSinDato(c.numero_poliza)}</td>
                  <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">{formatearPesos(c.prima_base)}</td>
                  <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">{formatearPctCampo(c.comision_pct)}</td>
                  <td className="px-4 py-2.5 text-white font-medium whitespace-nowrap">{formatearPesos(c.monto)}</td>
                  <td className="px-4 py-2.5 text-slate-400 text-xs whitespace-nowrap">
                    {c.liquidada_en ? fechaCorta(c.liquidada_en) : <span className="text-slate-500">—</span>}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      {c.estado === 'DEVENGADA' && (
                        <button
                          className="text-green-300 hover:text-green-200 text-xs"
                          onClick={() => setALiquidar(c)}
                        >
                          Marcar liquidada
                        </button>
                      )}
                      {c.estado !== 'ANULADA' && (
                        <button
                          className="text-red-300 hover:text-red-200 text-xs"
                          onClick={() => setAAnular(c)}
                        >
                          Anular
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </Tabla>
            <div className="px-4 py-3 border-t border-slate-700 flex flex-wrap gap-6">
              <div>
                <p className="text-slate-400 text-xs">Devengado (se debe)</p>
                <p className="text-lg font-bold text-white">{formatearPesos(totales.DEVENGADA)}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Liquidado</p>
                <p className="text-lg font-bold text-white">{formatearPesos(totales.LIQUIDADA)}</p>
              </div>
              <p className="text-slate-500 text-[11px] self-end max-w-sm">
                Sobre lo que muestra la tabla. Los dos números no se suman entre sí: lo devengado
                es la deuda viva y lo liquidado ya se pagó.
              </p>
            </div>
          </>
        )}
      </Panel>

      {modalAlta && (
        <ModalComision
          token={token}
          onCerrar={() => setModalAlta(false)}
          onGuardado={() => { setModalAlta(false); cargar(); }}
        />
      )}

      {aLiquidar && (
        <Modal title="Marcar la comisión como liquidada" onClose={() => setALiquidar(null)}>
          <p className="text-slate-300 text-sm">
            ¿Marcar como liquidada la comisión de{' '}
            <strong className="text-white">{formatearPesos(aLiquidar.monto)}</strong>
            {aLiquidar.periodo ? ` del período ${aLiquidar.periodo}` : ''}?
          </p>
          <p className="text-slate-400 text-xs mt-2">
            El backend sella la fecha de liquidación en este momento, y esa fecha no se vuelve a
            correr: es el dato del hecho, no el del último cambio.
          </p>
          <div className="flex justify-end gap-2 mt-6">
            <button className={botonSecundario} onClick={() => setALiquidar(null)}>Cancelar</button>
            <button className={botonPrimario} onClick={liquidar} disabled={accionando}>
              {accionando ? 'Guardando…' : 'Marcar liquidada'}
            </button>
          </div>
        </Modal>
      )}

      {aAnular && (
        <Modal title="Anular la comisión" onClose={() => setAAnular(null)}>
          <p className="text-slate-300 text-sm">
            ¿Anular la comisión de{' '}
            <strong className="text-white">{formatearPesos(aAnular.monto)}</strong>?
          </p>
          <p className="text-slate-400 text-xs mt-2">
            Anula, no borra: la fila queda con estado ANULADA. La plata que se le reconoció a un
            canal y después se dio de baja tiene que poder auditarse — una fila que desaparece es
            indistinguible de una que nunca se cargó.
          </p>
          <div className="flex justify-end gap-2 mt-6">
            <button className={botonSecundario} onClick={() => setAAnular(null)}>Cancelar</button>
            <button
              className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition disabled:opacity-50"
              onClick={anular}
              disabled={accionando}
            >
              {accionando ? 'Anulando…' : 'Anular'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

const FORM_VACIO = {
  proveedor_id: '', punto_contacto_id: '', numero_poliza: '',
  prima_base: '', comision_pct: '', periodo: '',
};

const ModalComision = ({ token, onCerrar, onGuardado }) => {
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [proveedores, setProveedores] = useState([]);
  const [puntos, setPuntos] = useState([]);

  useEffect(() => {
    listarProveedores(token, { estado: 'ACTIVO', limit: 500 })
      .then(setProveedores).catch(() => setProveedores([]));
    listarPuntos(token, { limite: 500 })
      .then(setPuntos).catch(() => setPuntos([]));
  }, [token]);

  const texto = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  // EL MONTO LO CALCULA EL SERVIDOR desde prima_base * comision_pct: este
  // número es sólo una previsualización para quien está cargando, y por eso
  // NO viaja en el cuerpo. Mandarlo y que no coincida con el porcentaje es
  // una discusión que se descubre el día de la liquidación.
  const montoPrevisto = useMemo(() => {
    const prima = Number(form.prima_base);
    const pct = Number(form.comision_pct);
    if (!form.prima_base || !form.comision_pct
        || !Number.isFinite(prima) || !Number.isFinite(pct)) return null;
    return (prima * pct) / 100;
  }, [form.prima_base, form.comision_pct]);

  const enviar = async (e) => {
    e.preventDefault();
    setGuardando(true); setError(null);
    const vacioANull = (v) => (v === '' || v === undefined ? null : v);
    try {
      await crearComision(token, {
        proveedor_id: vacioANull(form.proveedor_id),
        punto_contacto_id: vacioANull(form.punto_contacto_id),
        numero_poliza: vacioANull(form.numero_poliza),
        prima_base: form.prima_base === '' ? null : String(form.prima_base),
        comision_pct: form.comision_pct === '' ? null : String(form.comision_pct),
        periodo: vacioANull(form.periodo),
        // Sin `monto`: lo calcula el backend. Si falta prima o porcentaje,
        // contesta 422 explicando que no puede calcularlo, que es la
        // respuesta correcta y no un monto inventado en el navegador.
      });
      onGuardado();
    } catch (err) { setError(err.message); }
    finally { setGuardando(false); }
  };

  return (
    <Modal title="Nueva comisión de referido" onClose={onCerrar} maxWidth="max-w-xl">
      <form onSubmit={enviar} className="space-y-4">
        {error && <ErrorCarga mensaje={error} que="guardar la comisión" />}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Proveedor (canal)">
            <select className={inputClase} value={form.proveedor_id} onChange={texto('proveedor_id')}>
              <option value="">—</option>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="Punto de contacto">
            <select className={inputClase} value={form.punto_contacto_id} onChange={texto('punto_contacto_id')}>
              <option value="">—</option>
              {puntos.map((p) => <option key={p.id} value={p.id}>{p.slug} — {p.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="Número de póliza">
            <input className={inputClase} value={form.numero_poliza} onChange={texto('numero_poliza')} maxLength={50} />
          </Campo>
          <Campo label="Período" ayuda="Mes de devengamiento.">
            <input type="month" className={inputClase} value={form.periodo} onChange={texto('periodo')} />
          </Campo>
          <Campo label="Prima base">
            <input
              type="number" step="0.01" min="0"
              className={inputClase}
              value={form.prima_base}
              onChange={texto('prima_base')}
            />
          </Campo>
          <Campo label="Comisión (%)" ayuda="0 a 100.">
            <input
              type="number" step="0.01" min="0" max="100"
              className={inputClase}
              value={form.comision_pct}
              onChange={texto('comision_pct')}
            />
          </Campo>
        </div>

        <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 flex items-start gap-3">
          <Icon name="currency-dollar" size={16} className="text-slate-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-slate-300 text-sm">
              Monto: <strong className="text-white">
                {montoPrevisto === null ? SIN_DATO : formatearPesos(montoPrevisto)}
              </strong>
            </p>
            <p className="text-slate-500 text-[11px] mt-0.5">
              Lo calcula el servidor desde la prima base y el porcentaje. Esto es una
              previsualización: el número que se guarda es el suyo.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={botonSecundario} onClick={onCerrar}>Cancelar</button>
          <button type="submit" className={botonPrimario} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Crear comisión'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ComisionesReferidoPanel;
