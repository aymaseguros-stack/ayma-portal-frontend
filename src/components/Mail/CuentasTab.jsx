import React, { useEffect, useState } from 'react';
import { Icon } from '../Icons';
import { listarCuentas, sincronizarCuenta, iniciarConexionCuenta } from './mailApi';

const DIAS_OPCIONES = [30, 90, 180];

const ESTADO_BADGE = {
  ACTIVA: 'bg-green-500/20 text-green-400',
  OK: 'bg-green-500/20 text-green-400',
  ERROR: 'bg-red-500/20 text-red-400',
  DESCONECTADA: 'bg-red-500/20 text-red-400',
  PENDIENTE: 'bg-yellow-500/20 text-yellow-400',
};

// Cuentas de correo conectadas al portal: última sincronización, estado,
// resincronización manual con ventana de días configurable, y alta de una
// cuenta nueva vía OAuth (redirige a la URL que devuelve el backend).
const CuentasTab = ({ token }) => {
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dias, setDias] = useState(90);
  const [sincronizando, setSincronizando] = useState(null);
  const [conectando, setConectando] = useState(false);

  const cargar = () => {
    setLoading(true);
    setError(null);
    listarCuentas(token)
      .then(setCuentas)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(cargar, [token]);

  const handleSincronizar = async (cuentaId) => {
    setSincronizando(cuentaId);
    try {
      await sincronizarCuenta(token, cuentaId, dias);
      cargar();
    } catch (err) {
      alert('No se pudo sincronizar: ' + err.message);
    } finally {
      setSincronizando(null);
    }
  };

  const handleConectar = async () => {
    setConectando(true);
    try {
      const url = await iniciarConexionCuenta(token);
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('El servidor no devolvió una URL de autorización');
      }
    } catch (err) {
      alert('No se pudo iniciar la conexión: ' + err.message);
      setConectando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-slate-400 text-sm">Ventana de sincronización</label>
          <select
            value={dias}
            onChange={(e) => setDias(Number(e.target.value))}
            className="px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {DIAS_OPCIONES.map((d) => (
              <option key={d} value={d}>{d} días</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleConectar}
          disabled={conectando}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition text-sm font-medium"
        >
          <Icon name="plus" size={14} />
          {conectando ? 'Redirigiendo...' : 'Conectar cuenta'}
        </button>
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        {error ? (
          <div className="p-8 text-center">
            <p className="text-red-300 font-semibold">No se pudieron cargar las cuentas</p>
            <p className="text-red-400/80 text-sm mt-2">{error}</p>
          </div>
        ) : loading ? (
          <p className="text-slate-400 text-center py-12">Cargando...</p>
        ) : cuentas.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-400">Todavía no hay cuentas de correo conectadas</p>
            <p className="text-slate-500 text-sm mt-2">Usá "Conectar cuenta" para vincular una casilla</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Cuenta</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Estado</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Última sincronización</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {cuentas.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-sm">{c.email || c.direccion}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${ESTADO_BADGE[c.estado] || 'bg-slate-500/20 text-slate-400'}`}>
                        {c.estado || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">
                      {c.ultima_sync ? new Date(c.ultima_sync).toLocaleString('es-AR') : 'Nunca'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleSincronizar(c.id)}
                        disabled={sincronizando === c.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded transition text-sm whitespace-nowrap"
                      >
                        <Icon name="arrow-path" size={14} />
                        {sincronizando === c.id ? 'Sincronizando...' : 'Sincronizar ahora'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CuentasTab;
