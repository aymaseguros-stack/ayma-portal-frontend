import React, { useEffect, useState } from 'react';
import { Icon } from '../Icons';
import Modal from '../Modal';
import { fechaCorta } from '../../utils/fechas';
import {
  listarDocumentos, subirDocumento, marcarReemplazado,
  TIPOS_DOCUMENTO, TIPO_DOCUMENTO_LABEL,
} from './documentosApi';

// D-C26: el expediente de la oportunidad (`documentos`) y el reemplazo de
// documentos.
//
// POR QUÉ ES UNA SECCIÓN Y NO OTRA PESTAÑA. La pestaña "Documentos" de la
// ficha muestra `crm_adjuntos` -lo que cuelga del timeline-, y el reemplazo de
// D-C26 vive en `documentos`, que es otra tabla y otro módulo. Separarlas en
// dos pestañas obligaría a saber de antemano en cuál de las dos está el
// archivo que uno busca; juntarlas en una sola lista haría que "marcar como
// reemplazado" apareciera sobre adjuntos que no lo soportan. Queda una sola
// pestaña con dos secciones rotuladas.
//
// EL REEMPLAZO ES UN OFRECIMIENTO, NUNCA UN AUTOMATISMO. La definitiva puede
// venir de una compañía distinta a la del provisorio (se cotizó en dos, emitió
// la otra): marcar sola convertiría un documento vigente en histórico sin que
// nadie lo decidiera. El backend dice cuáles PUEDE reemplazar; lo declara una
// persona.
const ExpedienteDocumentos = ({ token, oportunidadId, onCambio }) => {
  const [documentos, setDocumentos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [mostrarSubida, setMostrarSubida] = useState(false);
  const [form, setForm] = useState({ archivo: null, tipo: 'POLIZA', descripcion: '', fecha_documento: '' });
  const [subiendo, setSubiendo] = useState(false);
  const [errorSubida, setErrorSubida] = useState(null);

  // El ofrecimiento que devolvió la última subida: {subido, reemplazables}.
  const [ofrecimiento, setOfrecimiento] = useState(null);
  const [marcando, setMarcando] = useState(null);
  const [aviso, setAviso] = useState(null);

  const cargar = async () => {
    setCargando(true);
    setError(null);
    try {
      setDocumentos(await listarDocumentos(token, { oportunidad_id: oportunidadId }));
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  // Se recarga al cambiar de oportunidad. `cargar` se redefine en cada render
  // y meterlo en las dependencias volvería a pedir la ficha en bucle.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, [oportunidadId]);

  const porId = Object.fromEntries(documentos.map((d) => [d.id, d]));

  const subir = async () => {
    if (!form.archivo) { setErrorSubida('Elegí un archivo'); return; }
    setSubiendo(true);
    setErrorSubida(null);
    try {
      const subido = await subirDocumento(token, form, { oportunidad_id: oportunidadId });
      setMostrarSubida(false);
      setForm({ archivo: null, tipo: 'POLIZA', descripcion: '', fecha_documento: '' });
      await cargar();
      onCambio?.();
      // Lista vacía y no `null` cuando no hay nada que ofrecer: se dibuja la
      // misma pantalla en los dos casos.
      if ((subido.reemplazables || []).length > 0) {
        setOfrecimiento({ subido, reemplazables: subido.reemplazables });
      }
    } catch (err) {
      setErrorSubida(err.message);
    } finally {
      setSubiendo(false);
    }
  };

  const marcar = async (viejoId, nuevoId) => {
    setMarcando(viejoId);
    setError(null);
    try {
      const r = await marcarReemplazado(token, viejoId, nuevoId);
      setAviso(r.mensaje);
      setOfrecimiento((prev) => {
        if (!prev) return null;
        const quedan = prev.reemplazables.filter((d) => d.id !== viejoId);
        return quedan.length ? { ...prev, reemplazables: quedan } : null;
      });
      await cargar();
      onCambio?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setMarcando(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h4 className="font-semibold text-sm">Expediente (documentos)</h4>
          <p className="text-slate-500 text-xs">
            Póliza, certificado provisorio, F.931 y demás documentación con retención legal.
            Distinto de los adjuntos del timeline.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setErrorSubida(null); setMostrarSubida(true); }}
          className="inline-flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition text-sm"
        >
          <Icon name="plus" size={14} />
          Subir documento
        </button>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">{error}</div>
      )}
      {aviso && (
        <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-4 py-2 rounded-lg text-sm">{aviso}</div>
      )}

      {/* EL OFRECIMIENTO. Aparece con la definitiva recién subida y las dos a
          la vista: es el único momento en que alguien puede decidirlo con
          conocimiento. */}
      {ofrecimiento && (
        <div className="bg-blue-500/10 border border-blue-500/40 rounded-lg p-4 space-y-3 text-sm">
          <p className="text-blue-200">
            Subiste <span className="font-medium">{ofrecimiento.subido.nombre_archivo}</span>
            {' '}({TIPO_DOCUMENTO_LABEL[ofrecimiento.subido.tipo] || ofrecimiento.subido.tipo}).
            ¿Deja histórico a alguno de estos?
          </p>
          <ul className="space-y-2">
            {ofrecimiento.reemplazables.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2 bg-slate-800/60 rounded px-3 py-2">
                <span className="font-medium">{d.nombre_archivo}</span>
                <span className="text-xs text-slate-400">
                  {TIPO_DOCUMENTO_LABEL[d.tipo] || d.tipo}
                  {d.fecha_documento && ` · ${fechaCorta(d.fecha_documento)}`}
                </span>
                <button
                  type="button"
                  onClick={() => marcar(d.id, ofrecimiento.subido.id)}
                  disabled={marcando === d.id}
                  className="ml-auto px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded transition text-xs font-medium"
                >
                  {marcando === d.id
                    ? 'Marcando...'
                    : `Marcar el ${(TIPO_DOCUMENTO_LABEL[d.tipo] || d.tipo).toLowerCase()} como reemplazado por esta ${(TIPO_DOCUMENTO_LABEL[ofrecimiento.subido.tipo] || ofrecimiento.subido.tipo).toLowerCase()}`}
                </button>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOfrecimiento(null)}
              className="text-slate-400 hover:text-white text-xs underline"
            >
              No reemplaza a ninguno
            </button>
            <span className="text-slate-500 text-xs">
              Nada se borra: el documento reemplazado queda en el expediente con su retención.
            </span>
          </div>
        </div>
      )}

      {cargando ? (
        <p className="text-slate-400 text-sm py-4">Cargando el expediente...</p>
      ) : documentos.length === 0 ? (
        <p className="text-slate-500 text-sm py-4">Sin documentos en el expediente</p>
      ) : (
        <ul className="divide-y divide-slate-700 border border-slate-700 rounded-lg">
          {documentos.map((d) => {
            const reemplazado = Boolean(d.reemplazado_por_id);
            const porQuien = porId[d.reemplazado_por_id];
            return (
              <li key={d.id} className={`px-3 py-2 text-sm ${reemplazado ? 'opacity-70' : ''}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`font-medium ${reemplazado ? 'line-through text-slate-400' : ''}`}>
                    {d.nombre_archivo}
                  </span>
                  <span className="px-2 py-0.5 bg-slate-700 rounded text-xs">
                    {TIPO_DOCUMENTO_LABEL[d.tipo] || d.tipo}
                  </span>
                  {reemplazado && (
                    <span
                      className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded text-xs"
                      title="El documento sigue en el expediente con su retención legal: sólo dejó de contar como vigente"
                    >
                      Reemplazado por {porQuien
                        ? (TIPO_DOCUMENTO_LABEL[porQuien.tipo] || porQuien.tipo).toLowerCase()
                        : 'otro documento'}
                      {d.reemplazado_en && ` · ${fechaCorta(d.reemplazado_en)}`}
                    </span>
                  )}
                </div>
                {d.descripcion && <p className="text-slate-500 text-xs mt-0.5">{d.descripcion}</p>}
              </li>
            );
          })}
        </ul>
      )}

      {mostrarSubida && (
        <Modal title="Subir documento al expediente" onClose={() => setMostrarSubida(false)} maxWidth="max-w-lg" zClass="z-[60]">
          <div className="space-y-5">
            <div>
              <label className="block text-slate-400 text-sm mb-2" htmlFor="doc-tipo">Tipo *</label>
              <select
                id="doc-tipo"
                value={form.tipo}
                onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
              >
                {TIPOS_DOCUMENTO.map((t) => (
                  <option key={t} value={t}>{TIPO_DOCUMENTO_LABEL[t] || t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-2" htmlFor="doc-archivo">Archivo *</label>
              <input
                id="doc-archivo"
                type="file"
                onChange={(e) => setForm((p) => ({ ...p, archivo: e.target.files?.[0] || null }))}
                className="w-full text-sm text-slate-300"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-2" htmlFor="doc-fecha">Fecha del documento</label>
              <input
                id="doc-fecha"
                type="date"
                value={form.fecha_documento}
                onChange={(e) => setForm((p) => ({ ...p, fecha_documento: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-2" htmlFor="doc-desc">Descripción</label>
              <input
                id="doc-desc"
                type="text"
                value={form.descripcion}
                onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
              />
            </div>
            {errorSubida && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">{errorSubida}</div>
            )}
            <div className="flex gap-4">
              <button type="button" onClick={() => setMostrarSubida(false)} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition">
                Cancelar
              </button>
              <button
                type="button"
                onClick={subir}
                disabled={subiendo}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-semibold transition"
              >
                {subiendo ? 'Subiendo...' : 'Subir'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ExpedienteDocumentos;
