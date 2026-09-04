import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../Icons';
import { listarDocumentosArt, subirDocumentoArt, marcarDocumentoArtConseguido } from './artCarteraApi';

// Checklist fijo de documentos ART - el backend soporta también "OTRO"
// (TIPOS_EMPRESA_DOCUMENTO en app/models/crm/empresa_documento.py) pero acá
// solo se listan los dos que pide la ficha; "OTRO" no tiene un lugar fijo
// en este checklist.
const DOCUMENTOS_ART_TIPOS = [
  { id: 'FORM_931', label: 'Formulario 931' },
  { id: 'POLIZA_ACTUAL', label: 'Póliza actual' },
];

// Checklist visual de documentos ART (empresa_documento) - fetch propio,
// independiente del resto de la ficha: GET /art/empresas/{cuit}/documentos
// (app/api/v1/art_consultas.py::listar_documentos_empresa_art) devuelve
// TODAS las filas ordenadas created_at desc (APPEND-ONLY), así que la
// primera fila de cada tipo es la vigente - nunca se reordena acá.
const ArtDocumentosChecklist = ({ token, cuit }) => {
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendiente, setPendiente] = useState(null); // { tipo, accion: 'subir' | 'conseguido' }
  const [tipoParaSubir, setTipoParaSubir] = useState(null);
  const inputArchivoRef = useRef(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDocumentos(await listarDocumentosArt(token, cuit));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, cuit]);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirSelectorArchivo = (tipo) => {
    setTipoParaSubir(tipo);
    inputArchivoRef.current?.click();
  };

  const onArchivoSeleccionado = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo si falla
    if (!archivo || !tipoParaSubir) return;

    const tipo = tipoParaSubir;
    setPendiente({ tipo, accion: 'subir' });
    setError(null);
    try {
      await subirDocumentoArt(token, cuit, { tipo, archivo });
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setPendiente(null);
      setTipoParaSubir(null);
    }
  };

  const marcarConseguido = async (tipo) => {
    setPendiente({ tipo, accion: 'conseguido' });
    setError(null);
    try {
      await marcarDocumentoArtConseguido(token, cuit, tipo);
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setPendiente(null);
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Documentos</h3>
      </div>

      <input
        ref={inputArchivoRef}
        type="file"
        className="hidden"
        onChange={onArchivoSeleccionado}
        accept=".pdf,.jpg,.jpeg,.png"
      />

      {error && (
        <div className="mx-6 mt-4 bg-red-500/15 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-slate-500 text-sm text-center py-8">Cargando documentos...</p>
      ) : (
        <div className="divide-y divide-slate-700">
          {DOCUMENTOS_ART_TIPOS.map(({ id: tipo, label }) => {
            // Primera fila de este tipo = vigente (el backend ya ordena created_at desc).
            const vigente = documentos.find((d) => d.tipo === tipo);
            const subiendo = pendiente?.tipo === tipo && pendiente.accion === 'subir';
            const marcando = pendiente?.tipo === tipo && pendiente.accion === 'conseguido';
            const enCurso = subiendo || marcando;

            return (
              <div key={tipo} className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    name={vigente?.conseguido ? 'check-badge' : 'clock'}
                    className={vigente?.conseguido ? 'text-green-400 shrink-0' : 'text-slate-500 shrink-0'}
                    size={20}
                  />
                  <div className="min-w-0">
                    <p className="font-medium">{label}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {vigente?.nombre_archivo
                        ? vigente.nombre_archivo
                        : vigente?.conseguido
                          ? 'Conseguido (sin archivo adjunto)'
                          : 'Pendiente'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    disabled={enCurso}
                    onClick={() => abrirSelectorArchivo(tipo)}
                    className="text-sm text-blue-400 hover:text-blue-300 disabled:opacity-50 transition"
                  >
                    {subiendo ? 'Subiendo...' : vigente?.archivo_drive_id ? 'Subir otra versión' : 'Subir archivo'}
                  </button>
                  {!vigente?.conseguido && (
                    <button
                      type="button"
                      disabled={enCurso}
                      onClick={() => marcarConseguido(tipo)}
                      className="text-sm text-slate-400 hover:text-white disabled:opacity-50 transition"
                    >
                      {marcando ? 'Guardando...' : 'Marcar conseguido'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ArtDocumentosChecklist;
