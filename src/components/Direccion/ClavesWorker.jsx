import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from '../Icons';
import Modal from '../Modal';
import { crearClaveWorker, listarClavesWorker, revocarClaveWorker } from './direccionApi';
import { useAccionManual } from './accionManual';
import { fechaCorta } from './direccionConstantes';
import {
  Campo, Cargando, ErrorCarga, EstadoVacio, Panel, Tabla, botonPrimario, botonSecundario, inputClase,
} from './DireccionComunes';

// COMPLIANCE-0003 · H-71: claves de worker con escritura (backend #215,
// docs/SEGURIDAD-SUPERFICIE-API.md §11).
//
// LA CLAVE EN CLARO VIVE EN UN SOLO LUGAR: el estado `creada` de este
// componente, entre la respuesta del POST y el cierre del modal. Al cerrar se
// pone en null. Nunca va a console, localStorage/sessionStorage, la URL ni un
// store global, y el listado no la trae (el GET no la tiene). Verificado por
// ClavesWorker.test.jsx.
//
// Sólo ADMIN: el backend ya contesta 403 a otro rol, pero sin `esAdmin` este
// bloque no pide nada ni dibuja un botón.

const WORKERS = ['CERVI', 'VALENTINI', 'PAZ'];

// VIGENTE · POR_VENCER (≤ 15 d, ámbar) · VENCIDA · REVOCADA — lo calcula el
// backend (worker_credenciales.estado_de); acá sólo se pinta.
const CLASES_ESTADO_CLAVE = {
  VIGENTE: 'bg-green-500/20 text-green-300',
  POR_VENCER: 'bg-amber-500/20 text-amber-300',
  VENCIDA: 'bg-red-500/20 text-red-300',
  REVOCADA: 'bg-slate-600/40 text-slate-400',
};

const ChipEstadoClave = ({ estado }) => (
  <span
    data-estado={estado}
    className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${CLASES_ESTADO_CLAVE[estado] || 'bg-slate-700/60 text-slate-300'}`}
  >
    {estado ? estado.replace(/_/g, ' ') : '—'}
  </span>
);

const diasTexto = (c) => {
  if (c.estado === 'REVOCADA' || typeof c.dias_para_vencer !== 'number') return '—';
  if (c.dias_para_vencer < 0) return `venció hace ${-c.dias_para_vencer} d`;
  return `${c.dias_para_vencer} d`;
};

const ClavesWorker = ({ token, esAdmin }) => {
  if (!esAdmin) return null;
  return <ClavesWorkerAdmin token={token} />;
};

const ClavesWorkerAdmin = ({ token }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [worker, setWorker] = useState(WORKERS[0]);
  const [errorAlta, setErrorAlta] = useState(null);
  // {worker_nombre, prefijo, clave} — el ÚNICO lugar donde existe el claro.
  const [creada, setCreada] = useState(null);
  const [aRevocar, setARevocar] = useState(null);
  const { corriendo, correr } = useAccionManual();

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await listarClavesWorker(token)); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { cargar(); }, [cargar]);

  const crear = () => correr('crear', async () => {
    setErrorAlta(null);
    try {
      const r = await crearClaveWorker(token, worker);
      setCreada({ worker_nombre: r.worker_nombre, prefijo: r.prefijo, clave: r.clave });
      cargar();
    } catch (err) {
      // 409: ya hay 2 vigentes para ese worker. El mensaje del backend dice qué hacer.
      setErrorAlta(err.message);
    }
  });

  const alertas = items.filter((c) => c.estado === 'POR_VENCER' || c.estado === 'VENCIDA');

  return (
    <section className="space-y-4" aria-label="Claves de worker">
      <div>
        <h3 className="text-lg font-semibold">Claves de worker</h3>
        <p className="text-slate-400 text-sm mt-1">
          Una clave por worker, 90 días de vigencia, máximo 2 vigentes. El alcance lo asigna el backend.
          Rotar = crear la nueva, cambiarla en el worker, revocar la vieja.
        </p>
      </div>

      {alertas.length > 0 && (
        <div role="alert" className="bg-amber-500/10 border border-amber-500/50 rounded-lg p-3 flex items-start gap-3">
          <Icon name="exclamation-triangle" size={18} className="text-amber-300 shrink-0 mt-0.5" />
          <p className="text-amber-100 text-sm">
            {alertas.length === 1 ? 'Hay 1 clave' : `Hay ${alertas.length} claves`} por vencer o vencidas
            ({alertas.map((c) => `${c.worker_nombre} ${c.prefijo}`).join(', ')}). Rotalas antes de que el worker se quede sin acceso.
          </p>
        </div>
      )}

      <div className="flex items-end gap-3 flex-wrap">
        <Campo label="Worker">
          <select
            aria-label="Worker"
            className={inputClase + ' min-w-[160px]'}
            value={worker}
            onChange={(e) => setWorker(e.target.value)}
          >
            {WORKERS.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </Campo>
        <button type="button" className={botonPrimario} onClick={crear} disabled={Boolean(corriendo)}>
          {corriendo ? 'Creando…' : 'Crear clave'}
        </button>
      </div>

      {errorAlta && <ErrorCarga mensaje={errorAlta} que="crear la clave" />}
      {error && !loading && <ErrorCarga mensaje={error} que="las claves de worker" onReintentar={cargar} />}

      <Panel>
        {loading ? <Cargando /> : error ? null : items.length === 0 ? (
          <EstadoVacio
            icono="lock-closed"
            titulo="Todavía no hay claves de worker"
            detalle="Elegí el worker y creá la primera."
          />
        ) : (
          <Tabla columnas={['Worker', 'Prefijo', 'Alcance', 'Creada', 'Vence', 'Días para vencer', 'Estado', 'Último uso', '']}>
            {items.map((c) => (
              <tr key={c.id} data-testid={`clave-${c.id}`}>
                <td className="px-4 py-2.5 text-white">{c.worker_nombre}</td>
                <td className="px-4 py-2.5 text-slate-300 font-mono text-xs">{c.prefijo}</td>
                <td className="px-4 py-2.5 text-slate-300 text-xs">
                  {c.alcance?.length
                    ? c.alcance.map((a) => <div key={a} className="font-mono">{a}</div>)
                    : <span className="text-slate-500 italic">sin alcance</span>}
                </td>
                <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{fechaCorta(c.creada_en)}</td>
                <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{fechaCorta(c.expira_en)}</td>
                <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">{diasTexto(c)}</td>
                <td className="px-4 py-2.5"><ChipEstadoClave estado={c.estado} /></td>
                <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">
                  {c.ultimo_uso_en ? fechaCorta(c.ultimo_uso_en) : 'Nunca'}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {c.estado !== 'REVOCADA' && (
                    <button type="button" className="text-red-300 hover:text-red-200 text-xs" onClick={() => setARevocar(c)}>
                      Revocar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </Tabla>
        )}
      </Panel>

      {creada && <ModalClaveCreada creada={creada} onCerrar={() => setCreada(null)} />}
      {aRevocar && (
        <ModalRevocar
          token={token}
          clave={aRevocar}
          onCerrar={() => setARevocar(null)}
          onRevocada={() => { setARevocar(null); cargar(); }}
        />
      )}
    </section>
  );
};

const ModalClaveCreada = ({ creada, onCerrar }) => {
  const [copiada, setCopiada] = useState(false);
  const [errorCopia, setErrorCopia] = useState(null);
  const [confirmando, setConfirmando] = useState(false);

  const copiar = async () => {
    setErrorCopia(null);
    try {
      await navigator.clipboard.writeText(creada.clave);
      setCopiada(true);
    } catch {
      setErrorCopia('No se pudo copiar. Seleccioná el texto y copialo a mano.');
    }
  };

  return (
    <Modal title={`Clave creada · ${creada.worker_nombre}`} onClose={() => setConfirmando(true)}>
      <div className="space-y-4">
        <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-lg p-3">
          <p className="text-yellow-100 text-sm">
            Esta clave no se vuelve a mostrar. Pegala en el Environment de Render o en tu gestor de contraseñas.
            No la pegues en ningún chat.
          </p>
        </div>
        <p className="text-slate-400 text-xs">Prefijo <span className="font-mono">{creada.prefijo}</span></p>
        <code
          data-testid="clave-en-claro"
          className="block bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-white font-mono break-all select-all"
        >
          {creada.clave}
        </code>
        {errorCopia && <p className="text-red-300 text-xs">{errorCopia}</p>}

        {confirmando ? (
          <div className="border-t border-slate-700 pt-4 space-y-3">
            <p className="text-white text-sm font-semibold">¿Ya la copiaste?</p>
            <div className="flex justify-end gap-2">
              <button type="button" className={botonSecundario} onClick={() => setConfirmando(false)}>Volver</button>
              <button type="button" className={botonPrimario} onClick={onCerrar}>Sí, cerrar</button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className={botonSecundario} onClick={copiar}>{copiada ? 'Copiada' : 'Copiar'}</button>
            <button type="button" className={botonPrimario} onClick={() => setConfirmando(true)}>Cerrar</button>
          </div>
        )}
      </div>
    </Modal>
  );
};

const ModalRevocar = ({ token, clave, onCerrar, onRevocada }) => {
  const [error, setError] = useState(null);
  const { corriendo, correr } = useAccionManual();

  const revocar = () => correr('revocar', async () => {
    setError(null);
    try {
      await revocarClaveWorker(token, clave.id);
      onRevocada();
    } catch (err) { setError(err.message); }
  });

  return (
    <Modal title="Revocar clave de worker" onClose={onCerrar}>
      <div className="space-y-4">
        {error && <ErrorCarga mensaje={error} que="revocar la clave" />}
        <p className="text-slate-300 text-sm">
          ¿Revocar la clave <span className="font-mono text-white">{clave.prefijo}</span> de {clave.worker_nombre}?
          Deja de valer desde el pedido siguiente y no se puede deshacer.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={botonSecundario} onClick={onCerrar}>Cancelar</button>
          <button type="button" className={botonPrimario} onClick={revocar} disabled={Boolean(corriendo)}>
            {corriendo ? 'Revocando…' : `Revocar ${clave.prefijo}`}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ClavesWorker;
