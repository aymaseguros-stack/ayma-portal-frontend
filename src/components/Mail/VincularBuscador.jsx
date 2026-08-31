import React, { useEffect, useState } from 'react';
import Modal from '../Modal';
import { Icon } from '../Icons';
import { buscarEnCrm, vincularEmail, TIPO_ENTIDAD_LABEL } from './mailApi';

// Buscador contra GET /api/v1/crm/buscar para vincular un correo a una ficha
// del CRM. El endpoint devuelve resultados agrupados por tipo de entidad
// (personas/empresas/grupos/oportunidades/leads); cada resultado clickeado
// llama PATCH /api/v1/email/{id}/vincular.
const RESULT_KEYS = [
  { key: 'personas', tipo: 'persona', nombre: (r) => `${r.nombre || ''} ${r.apellido || ''}`.trim() },
  { key: 'empresas', tipo: 'empresa', nombre: (r) => r.razon_social },
  { key: 'grupos', tipo: 'grupo', nombre: (r) => r.nombre },
  { key: 'oportunidades', tipo: 'oportunidad', nombre: (r) => r.nombre_vinculado || r.token },
  { key: 'leads', tipo: 'lead', nombre: (r) => r.nombre },
];

const VincularBuscador = ({ token, emailId, onClose, onVinculado }) => {
  const [q, setQ] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState(null);
  const [vinculando, setVinculando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!q.trim()) { setResultados(null); return; }
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        const data = await buscarEnCrm(token, q);
        setResultados(data);
      } catch (err) {
        console.error('Error buscando en CRM:', err);
        setResultados({});
      } finally {
        setBuscando(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q, token]);

  const elegir = async (tipo, id) => {
    setVinculando(true);
    setError(null);
    try {
      await vincularEmail(token, emailId, { tipoEntidad: tipo, entidadId: id });
      onVinculado?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setVinculando(false);
    }
  };

  const filas = RESULT_KEYS.flatMap(({ key, tipo, nombre }) =>
    (resultados?.[key] || []).map((r) => ({ tipo, id: r.id, nombre: nombre(r) || r.token || '-', extra: r.token }))
  );

  return (
    <Modal title="Vincular a una ficha" onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-4">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            <Icon name="magnifying-glass" size={16} />
          </span>
          <input
            type="text"
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar persona, empresa, grupo, oportunidad o lead..."
            className="w-full pl-10 pr-4 py-3 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        {buscando ? (
          <p className="text-slate-400 text-center py-6 text-sm">Buscando...</p>
        ) : !q.trim() ? (
          <p className="text-slate-500 text-center py-6 text-sm">Escribí para buscar</p>
        ) : filas.length === 0 ? (
          <p className="text-slate-500 text-center py-6 text-sm">Sin resultados</p>
        ) : (
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {filas.map((r) => (
              <button
                key={`${r.tipo}-${r.id}`}
                type="button"
                disabled={vinculando}
                onClick={() => elegir(r.tipo, r.id)}
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-700/50 transition disabled:opacity-50 flex items-center justify-between gap-3"
              >
                <span className="min-w-0 truncate">{r.nombre}</span>
                <span className="shrink-0 px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-400">
                  {TIPO_ENTIDAD_LABEL[r.tipo]}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default VincularBuscador;
