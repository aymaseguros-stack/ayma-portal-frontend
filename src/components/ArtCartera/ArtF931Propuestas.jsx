import React, { useState } from 'react';
import Modal from '../Modal';
import { aceptarPropuestaF931, rechazarPropuestaF931, textoDetail } from './artF931Api';
import {
  bloqueantesF931, estadoF931Info, motivoF931Label, motivosDeFila, periodoF931,
} from './artF931Constants';
import { pctDosDecimales } from './artCerviConstants';
import { numeroAr, pesosAr } from './artCarteraConstants';
import { fechaCorta } from '../../utils/fechas';

const thClass = 'text-left px-3 py-2 font-medium whitespace-nowrap';
const tdClass = 'px-3 py-2';
const badgeBase = 'inline-block text-[11px] px-1.5 py-0.5 rounded whitespace-nowrap';

// Aceptar y rechazar piden motivo SIEMPRE. El backend lo exige al aceptar
// (3..1000) y lo deja opcional al rechazar; la pantalla lo pide en los dos:
// un F.931 descartado sin una línea que diga por qué no se puede revisar.
const MIN_MOTIVO = 3;

const MotivoModal = ({ accion, fila, onCerrar, onConfirmar }) => {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const acepta = accion === 'aceptar';
  const enviar = async (e) => {
    e.preventDefault();
    if (motivo.trim().length < MIN_MOTIVO) {
      setError(`El motivo es obligatorio (al menos ${MIN_MOTIVO} caracteres).`);
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await onConfirmar(motivo.trim());
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  };
  return (
    <Modal title={`${acepta ? 'Aceptar' : 'Rechazar'} F.931 · ${fila.razon_social || fila.cuit}`} onClose={onCerrar}>
      <form onSubmit={enviar} className="space-y-3" aria-label={acepta ? 'Aceptar F931' : 'Rechazar F931'}>
        <p className="text-sm text-slate-300">
          {acepta
            ? 'Aplica el F.931 aunque no haya validado: la empresa pasa a dotación ALTA · F931 con este período.'
            : 'No toca la empresa: el F.931 queda RECHAZADO.'}
        </p>
        <div>
          <label className="block text-slate-400 text-xs mb-1" htmlFor="f931-motivo">Motivo (obligatorio)</label>
          <textarea
            id="f931-motivo"
            className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
            rows={3}
            maxLength={1000}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCerrar} className="px-3 py-2 rounded-lg bg-slate-700 text-sm">Cancelar</button>
          <button
            type="submit"
            disabled={enviando}
            className={`px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 ${acepta ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'}`}
          >
            {enviando ? 'Enviando…' : (acepta ? 'Aceptar' : 'Rechazar')}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// Solapa "F931" de la bandeja "Dotación propuesta" (OPERACIONES-0010 ·
// @VALENTINI, backend PR #216): los F.931 subidos en PDF que no validaron
// (`GET /art/f931/propuestas`, estado PROPUESTO).
//
// QUIÉN DECIDE SI SE PUEDE ACEPTAR ES EL BACKEND. Con los motivos que ya
// trae la fila (CUIT distinto, empresa sin CUIT, sin empleados, superado)
// no se ofrece Aceptar: el backend los rechaza con 409. Y si al aceptar
// igual contesta 409 (revalida: la empresa pudo cambiar), el motivo queda
// en la fila y el botón desaparece. Nunca se reintenta.
const ArtF931Propuestas = ({ token, filas, loading, esAdmin, onCambio }) => {
  const [accion, setAccion] = useState(null);
  const [resultado, setResultado] = useState({});
  const [conflicto, setConflicto] = useState({});
  const [ultimo, setUltimo] = useState(null);

  const confirmar = async (motivo) => {
    const { tipo, fila } = accion;
    try {
      if (tipo === 'aceptar') await aceptarPropuestaF931(token, fila.id, motivo);
      else await rechazarPropuestaF931(token, fila.id, motivo);
    } catch (err) {
      if (err.status === 409) {
        setConflicto((prev) => ({ ...prev, [fila.id]: textoDetail(err.detail) || err.message }));
        setAccion(null);
        return;
      }
      throw err;
    }
    setAccion(null);
    const estado = tipo === 'aceptar' ? 'APLICADO' : 'RECHAZADO';
    setResultado((prev) => ({ ...prev, [fila.id]: estado }));
    setUltimo(`${fila.razon_social || fila.cuit} · F.931 ${periodoF931(fila.periodo)}: ${estado}`);
    onCambio?.();
  };

  const columnas = 9 + (esAdmin ? 1 : 0);

  return (
    <div className="space-y-2">
    {ultimo && (
      <p role="status" className="text-sm text-slate-300 bg-slate-800 rounded-lg border border-slate-700 px-3 py-2" data-testid="f931-ultimo">
        {ultimo}
      </p>
    )}
    <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-x-auto">
      <table className="w-full text-sm" aria-label="F931">
        <thead className="text-xs uppercase text-slate-400 border-b border-slate-700">
          <tr>
            <th className={thClass}>Empresa</th>
            <th className={thClass}>CUIT</th>
            <th className={thClass}>Período</th>
            <th className={thClass}>Rectif.</th>
            <th className={thClass}>Dotación</th>
            <th className={thClass}>Masa</th>
            <th className={thClass}>Alíc. variable</th>
            <th className={thClass}>No validó por</th>
            <th className={thClass}>Cargado</th>
            {esAdmin && <th className={thClass}>Acción</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/60">
          {loading && (
            <tr><td colSpan={columnas} className="px-3 py-6 text-center text-slate-400">Cargando F.931…</td></tr>
          )}
          {!loading && filas.length === 0 && (
            <tr><td colSpan={columnas} className="px-3 py-6 text-center text-slate-500">No hay F.931 propuestos.</td></tr>
          )}
          {!loading && filas.map((f) => {
            const motivos = motivosDeFila(f);
            const bloqueantes = bloqueantesF931(motivos);
            const hecho = resultado[f.id];
            const conf = conflicto[f.id];
            const puedeAceptar = !hecho && !conf && bloqueantes.length === 0;
            return (
              <tr key={f.id} data-testid={`f931-propuesta-${f.id}`} className="hover:bg-slate-700/30 align-top">
                <td className={`${tdClass} text-slate-200`}>
                  {f.razon_social || 'Sin razón social'}
                  {hecho && (
                    <span className={`${badgeBase} ml-2 ${estadoF931Info(hecho).clase}`}>{estadoF931Info(hecho).label}</span>
                  )}
                </td>
                <td className={`${tdClass} text-slate-400 whitespace-nowrap`}>{f.cuit}</td>
                <td className={`${tdClass} text-slate-300 whitespace-nowrap`}>{periodoF931(f.periodo)}</td>
                <td className={`${tdClass} text-slate-300`}>{f.rectificativa}</td>
                <td className={`${tdClass} text-slate-200`}>{numeroAr(f.dotacion_f931)}</td>
                <td className={`${tdClass} text-slate-300 whitespace-nowrap`}>{pesosAr(f.masa_f931)}</td>
                <td className={`${tdClass} text-slate-300 whitespace-nowrap`}>{pctDosDecimales(f.alicuota_variable_f931) || '—'}</td>
                <td className={tdClass}>
                  <div className="flex flex-wrap gap-1">
                    {motivos.length === 0 && <span className="text-slate-500">—</span>}
                    {motivos.map((m) => (
                      <span
                        key={m}
                        className={`${badgeBase} ${bloqueantes.includes(m) ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/20 text-yellow-300'}`}
                        title={m}
                      >
                        {motivoF931Label(m)}
                      </span>
                    ))}
                  </div>
                  {bloqueantes.length > 0 && !hecho && (
                    <span className="block text-xs text-red-300 mt-1" data-testid="f931-no-aceptable">
                      No se puede aceptar: {bloqueantes.map(motivoF931Label).join(' · ')}
                    </span>
                  )}
                  {conf && (
                    <span role="alert" className="block text-xs text-red-300 mt-1 max-w-xs" data-testid="f931-conflicto">
                      No se puede aceptar: {conf}
                    </span>
                  )}
                </td>
                <td className={`${tdClass} text-slate-400 whitespace-nowrap`}>
                  {fechaCorta(f.created_at) || '—'}
                  <span className="block text-xs text-slate-500">{f.registrado_por}</span>
                </td>
                {esAdmin && (
                  <td className={`${tdClass} whitespace-nowrap`}>
                    {!hecho && (
                      <div className="flex gap-1">
                        {puedeAceptar && (
                          <button
                            type="button"
                            onClick={() => setAccion({ tipo: 'aceptar', fila: f })}
                            className="px-2 py-1 rounded bg-green-600/80 hover:bg-green-500 text-xs"
                          >
                            Aceptar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setAccion({ tipo: 'rechazar', fila: f })}
                          className="px-2 py-1 rounded bg-slate-700 hover:bg-red-600/80 text-xs"
                        >
                          Rechazar
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {accion && (
        <MotivoModal
          accion={accion.tipo}
          fila={accion.fila}
          onCerrar={() => setAccion(null)}
          onConfirmar={confirmar}
        />
      )}
    </div>
    </div>
  );
};

export default ArtF931Propuestas;
