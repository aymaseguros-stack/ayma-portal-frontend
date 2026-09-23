import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../Icons';
import Modal from '../Modal';
import { fechaHora } from '../../utils/fechas';
import {
  listarAdjuntos, anularAdjunto, subirAdjuntos,
} from './adjuntosApi';
import { SelectorAdjuntos, FilaAdjunto, AvisoDuplicadosAdjuntos } from './AdjuntosUI';
import { OpcionesCategorias } from './categoriasAdjunto';
import ExpedienteDocumentos from './ExpedienteDocumentos';

// Pestaña "Documentos" de las fichas de persona, empresa y oportunidad: todos
// los adjuntos de esa entidad (los de sus interacciones incluidos, porque el
// backend hereda las FKs al subir), con filtros, alta sin interacción y
// anulación con confirmación. DELETE anula: la fila y el archivo quedan como
// rastro de auditoría.
// `mostrarExpediente` (D-C26): sobre una OPORTUNIDAD, debajo de los adjuntos
// del timeline se dibuja además el expediente (`documentos`), que es otra
// tabla y el único de los dos módulos que tiene el reemplazo de documentos.
// No se mezclan en una sola lista: "marcar como reemplazado" sobre un adjunto
// del CRM sería un botón que contesta 404.
const DocumentosTab = ({ token, filtro, onCambio, mostrarExpediente = false }) => {
  const [adjuntos, setAdjuntos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [categoria, setCategoria] = useState('');
  const [desde, setDesde] = useState('');
  const [subidoPor, setSubidoPor] = useState('');
  const [soloDeInteraccion, setSoloDeInteraccion] = useState('');

  const [mostrarSubida, setMostrarSubida] = useState(false);
  const [elegidos, setElegidos] = useState([]);
  const [subiendo, setSubiendo] = useState(false);
  const [errorSubida, setErrorSubida] = useState(null);
  const [duplicados, setDuplicados] = useState([]);
  const [aAnular, setAAnular] = useState(null);

  const cargar = async () => {
    setCargando(true);
    setError(null);
    try {
      setAdjuntos(await listarAdjuntos(token, filtro));
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro.persona_id, filtro.empresa_id, filtro.oportunidad_id, filtro.interaccion_id]);

  const autores = useMemo(
    () => [...new Set(adjuntos.map((a) => a.subido_por).filter(Boolean))],
    [adjuntos],
  );

  const visibles = adjuntos.filter((a) => {
    if (categoria && a.categoria !== categoria) return false;
    if (subidoPor && a.subido_por !== subidoPor) return false;
    if (desde && String(a.creado_en || '').slice(0, 10) < desde) return false;
    if (soloDeInteraccion === 'con' && !a.interaccion_id) return false;
    if (soloDeInteraccion === 'sin' && a.interaccion_id) return false;
    return true;
  });

  const subir = async () => {
    setSubiendo(true);
    setErrorSubida(null);
    try {
      const { duplicados: dup } = await subirAdjuntos(token, elegidos, filtro);
      setDuplicados(dup);
      setElegidos([]);
      setMostrarSubida(false);
      await cargar();
      onCambio?.();
    } catch (err) {
      setErrorSubida(err.message);
    } finally {
      setSubiendo(false);
    }
  };

  const confirmarAnular = async () => {
    const adjunto = aAnular;
    setAAnular(null);
    try {
      await anularAdjunto(token, adjunto.id);
      await cargar();
      onCambio?.();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-slate-400 text-xs mb-1">Categoría</label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
          >
            <option value="">Todas</option>
            <OpcionesCategorias />
          </select>
        </div>
        <div>
          <label className="block text-slate-400 text-xs mb-1">Desde</label>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-slate-400 text-xs mb-1">Subido por</label>
          <select
            value={subidoPor}
            onChange={(e) => setSubidoPor(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
          >
            <option value="">Cualquiera</option>
            {autores.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-slate-400 text-xs mb-1">Interacción</label>
          <select
            value={soloDeInteraccion}
            onChange={(e) => setSoloDeInteraccion(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
          >
            <option value="">Todos</option>
            <option value="con">De una interacción</option>
            <option value="sin">Sin interacción</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => { setErrorSubida(null); setDuplicados([]); setMostrarSubida(true); }}
          className="ml-auto inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm"
        >
          <Icon name="plus" size={14} />
          Adjuntar
        </button>
      </div>

      {duplicados.length > 0 && <AvisoDuplicadosAdjuntos duplicados={duplicados} />}

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">{error}</div>
      )}

      {cargando ? (
        <p className="text-slate-400 text-center py-8">Cargando documentos...</p>
      ) : visibles.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-8">Sin documentos</p>
      ) : (
        <ul className="divide-y divide-slate-700 border border-slate-700 rounded-lg">
          {visibles.map((a) => (
            <li key={a.id}>
              <FilaAdjunto token={token} adjunto={a} onAnular={setAAnular} onReintentado={cargar} />
              <p className="text-slate-500 text-xs px-3 pb-2">
                {fechaHora(a.creado_en) || ''}
                {a.interaccion_id ? ' · de una interacción' : ' · sin interacción'}
              </p>
            </li>
          ))}
        </ul>
      )}

      {mostrarSubida && (
        <Modal title="Adjuntar documentos" onClose={() => setMostrarSubida(false)} maxWidth="max-w-lg" zClass="z-[60]">
          <div className="space-y-5">
            <SelectorAdjuntos elegidos={elegidos} onElegidos={setElegidos} deshabilitado={subiendo} />
            {errorSubida && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">{errorSubida}</div>
            )}
            <div className="flex gap-4 pt-2">
              <button type="button" onClick={() => setMostrarSubida(false)} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition">
                Cancelar
              </button>
              <button
                type="button"
                onClick={subir}
                disabled={subiendo || elegidos.length === 0}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-semibold transition"
              >
                {subiendo ? 'Subiendo...' : 'Subir'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {mostrarExpediente && filtro.oportunidad_id && (
        <div className="pt-4 border-t border-slate-700">
          <ExpedienteDocumentos
            token={token}
            oportunidadId={filtro.oportunidad_id}
            onCambio={onCambio}
          />
        </div>
      )}

      {aAnular && (
        <Modal title="Anular adjunto" onClose={() => setAAnular(null)} maxWidth="max-w-md" zClass="z-[60]">
          <div className="space-y-5">
            <p className="text-sm text-slate-300">
              ¿Anular <span className="font-medium">{aAnular.nombre_original}</span>? El archivo no se borra: queda
              anulado como rastro de auditoría y deja de poder descargarse.
            </p>
            <div className="flex gap-4">
              <button type="button" onClick={() => setAAnular(null)} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition">
                Cancelar
              </button>
              <button type="button" onClick={confirmarAnular} className="flex-1 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition">
                Anular
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default DocumentosTab;
