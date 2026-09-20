import React, { useRef, useState } from 'react';
import { Icon } from '../Icons';
import {
  MAX_ARCHIVOS, formatBytes, iconoDeMime, tituloCategoria,
  validarSeleccion, descargarAdjunto,
} from './adjuntosApi';
import { OpcionesCategorias } from './categoriasAdjunto';

// Piezas de UI compartidas por los adjuntos del CRM: el selector (botón +
// arrastrar y soltar, con categoría por archivo) y la lista de adjuntos ya
// subidos con su descarga autenticada.

// Zona para elegir archivos antes de subirlos. `elegidos` / `onElegidos` los
// maneja el formulario de arriba, porque la subida ocurre DESPUÉS de guardar
// la interacción (necesita su id).
export const SelectorAdjuntos = ({ elegidos, onElegidos, deshabilitado = false }) => {
  const inputRef = useRef(null);
  const [errores, setErrores] = useState([]);
  const [sobre, setSobre] = useState(false);

  const agregar = async (lista) => {
    const archivos = Array.from(lista || []);
    if (archivos.length === 0) return;
    const { aceptados, errores: motivos } = await validarSeleccion(archivos, elegidos);
    setErrores(motivos);
    if (aceptados.length > 0) onElegidos([...elegidos, ...aceptados]);
  };

  const soltar = (e) => {
    e.preventDefault();
    setSobre(false);
    if (!deshabilitado) agregar(e.dataTransfer?.files);
  };

  const cambiarCategoria = (id, categoria) =>
    onElegidos(elegidos.map((it) => (it.id === id ? { ...it, categoria } : it)));

  return (
    <div className="space-y-2">
      <label className="block text-slate-400 text-sm">Adjuntos</label>
      <div
        onDragOver={(e) => { e.preventDefault(); setSobre(true); }}
        onDragLeave={() => setSobre(false)}
        onDrop={soltar}
        className={`rounded-lg border border-dashed px-4 py-5 text-center transition ${
          sobre ? 'border-blue-400 bg-blue-500/10' : 'border-slate-600 bg-slate-700/20'
        }`}
      >
        <p className="text-slate-400 text-sm">Arrastrá archivos acá o</p>
        <button
          type="button"
          disabled={deshabilitado || elegidos.length >= MAX_ARCHIVOS}
          onClick={() => inputRef.current?.click()}
          className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg text-xs font-medium transition"
        >
          <Icon name="plus" size={14} />
          Elegir archivos
        </button>
        <p className="text-slate-500 text-xs mt-2">PDF, JPG o PNG · hasta 10 MB cada uno · máximo 5 por interacción</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="application/pdf,image/png,image/jpeg"
          aria-label="Elegir archivos"
          className="hidden"
          onChange={(e) => { agregar(e.target.files); e.target.value = ''; }}
        />
      </div>

      {errores.length > 0 && (
        <ul className="bg-red-500/15 border border-red-500/40 text-red-200 rounded-lg px-4 py-2 text-xs space-y-1">
          {errores.map((motivo) => <li key={motivo}>{motivo}</li>)}
        </ul>
      )}

      {elegidos.length > 0 && (
        <ul className="divide-y divide-slate-700 border border-slate-700 rounded-lg">
          {elegidos.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-3 py-2">
              <Icon name={iconoDeMime(item.mime)} className="text-blue-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{item.nombre}</p>
                <p className="text-slate-500 text-xs">{formatBytes(item.tamano)}</p>
              </div>
              <select
                value={item.categoria}
                aria-label={`Categoría de ${item.nombre}`}
                onChange={(e) => cambiarCategoria(item.id, e.target.value)}
                className="px-2 py-1 rounded-lg bg-slate-700 border border-slate-600 text-white text-xs"
              >
                <OpcionesCategorias />
              </select>
              <button
                type="button"
                aria-label={`Quitar ${item.nombre}`}
                onClick={() => onElegidos(elegidos.filter((it) => it.id !== item.id))}
                className="text-slate-400 hover:text-white shrink-0"
              >
                <Icon name="x-mark" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// Un adjunto ya subido. La descarga siempre va por el stream autenticado
// (fetch + blob): nunca un href al backend ni una URL de Drive.
export const FilaAdjunto = ({ token, adjunto, onAnular, compacto = false }) => {
  const [error, setError] = useState(null);
  const [bajando, setBajando] = useState(false);

  const bajar = async () => {
    setBajando(true);
    setError(null);
    try {
      await descargarAdjunto(token, adjunto);
    } catch (err) {
      setError(err.message === 'Adjunto anulado' ? 'Adjunto anulado' : err.message);
    } finally {
      setBajando(false);
    }
  };

  return (
    <div className={`flex items-center gap-3 ${compacto ? 'px-2 py-1.5' : 'px-3 py-2'}`}>
      <Icon name={iconoDeMime(adjunto.mime)} className="text-blue-400 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm truncate">{adjunto.nombre_original}</p>
        <p className="text-slate-500 text-xs">
          {tituloCategoria(adjunto.categoria)} · {formatBytes(adjunto.tamano_bytes)}
          {adjunto.anulado_en ? ' · anulado' : ''}
        </p>
        {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
      </div>
      <button
        type="button"
        onClick={bajar}
        disabled={bajando}
        className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg text-xs font-medium transition whitespace-nowrap"
      >
        {bajando ? 'Descargando...' : 'Descargar'}
      </button>
      {onAnular && !adjunto.anulado_en && (
        <button
          type="button"
          onClick={() => onAnular(adjunto)}
          className="px-2.5 py-1.5 bg-slate-700 hover:bg-red-600/40 rounded-lg text-xs font-medium transition whitespace-nowrap"
        >
          Anular
        </button>
      )}
    </div>
  );
};

// Aviso de una subida que falló después de guardar la interacción: la
// interacción NO se pierde, y el lote se reintenta entero (la subida es
// atómica por lote: si un archivo es inválido no entra ninguno).
export const AvisoSubidaFallida = ({ mensaje, onReintentar, reintentando }) => (
  <div className="bg-yellow-500/15 border border-yellow-500/40 text-yellow-100 px-4 py-3 rounded-lg text-sm space-y-2">
    <p className="font-medium">Interacción guardada, adjuntos no subidos.</p>
    <p className="text-yellow-200/80 text-xs">
      {mensaje} La subida es atómica por lote: si un archivo es inválido no entra ninguno.
    </p>
    <button
      type="button"
      onClick={onReintentar}
      disabled={reintentando}
      className="px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 disabled:opacity-50 rounded-lg text-xs font-semibold transition"
    >
      {reintentando ? 'Reintentando...' : 'Reintentar'}
    </button>
  </div>
);

export const AvisoDuplicadosAdjuntos = ({ duplicados }) => (
  <div className="bg-sky-500/15 border border-sky-500/40 text-sky-100 px-4 py-2 rounded-lg text-sm">
    {duplicados.length === 1
      ? `"${duplicados[0].nombre_original}" ya estaba adjuntado en esta entidad (mismo archivo). Se subió igual.`
      : `${duplicados.length} archivos ya estaban adjuntados en esta entidad (mismo archivo). Se subieron igual.`}
  </div>
);
