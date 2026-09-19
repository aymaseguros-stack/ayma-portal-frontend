import React from 'react';
import { Icon } from '../Icons';
import { CLASES_ESTADO, CLASES_SEMAFORO, PUNTO_SEMAFORO, etiqueta } from './direccionConstantes';

// Piezas compartidas por las cuatro pantallas de Dirección. Misma estética
// que el resto del portal (tema oscuro, slate-800/50 + border slate-700).

// Cartel de error VISIBLE. Nunca se reemplaza un fallo por un cero: si la
// carga falló, la pantalla lo dice con el status HTTP y el detalle que mandó
// el backend, y no pinta datos vacíos como si fueran datos.
export const ErrorCarga = ({ mensaje, que = 'los datos', onReintentar }) => (
  <div role="alert" className="bg-red-500/15 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
    <Icon name="exclamation-triangle" className="text-red-400 shrink-0 mt-0.5" />
    <div className="min-w-0">
      <p className="text-red-200 text-sm">No se pudieron cargar {que}. {mensaje}</p>
      {onReintentar && (
        <button onClick={onReintentar} className="mt-2 text-red-200 underline text-xs hover:text-white">
          Reintentar
        </button>
      )}
    </div>
  </div>
);

// Estado vacío explícito: "todavía no hay X", no un cero suelto.
export const EstadoVacio = ({ titulo, detalle, icono = 'document-text', accion }) => (
  <div className="text-center py-12 px-4">
    <Icon name={icono} size={40} className="text-slate-600 mx-auto" />
    <p className="text-slate-300 font-medium mt-3">{titulo}</p>
    {detalle && <p className="text-slate-500 text-sm mt-1">{detalle}</p>}
    {accion && <div className="mt-4">{accion}</div>}
  </div>
);

export const Cargando = ({ texto = 'Cargando…' }) => (
  <div className="py-10 text-center text-slate-400 text-sm animate-pulse">{texto}</div>
);

export const Badge = ({ valor, className = '' }) => {
  if (valor === null || valor === undefined || valor === '') return <span className="text-slate-500">—</span>;
  const clase = CLASES_ESTADO[valor] || 'bg-slate-700/60 text-slate-300';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${clase} ${className}`}>
      {etiqueta(valor)}
    </span>
  );
};

export const PuntoSemaforo = ({ color }) => (
  <span
    aria-label={`Semáforo ${color || 'sin dato'}`}
    className={`inline-block w-3 h-3 rounded-full shrink-0 ${PUNTO_SEMAFORO[color] || 'bg-slate-600'}`}
  />
);

export const ChipSemaforo = ({ color }) => (
  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${CLASES_SEMAFORO[color] || 'bg-slate-700/60 text-slate-300 border-slate-600'}`}>
    {color || 'SIN DATO'}
  </span>
);

// Tarjeta/tabla contenedoras: un solo lugar donde vive el estilo.
export const Panel = ({ titulo, subtitulo, acciones, children, className = '' }) => (
  <section className={`bg-slate-800/50 rounded-xl border border-slate-700 ${className}`}>
    {(titulo || acciones) && (
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          {titulo && <h3 className="font-semibold text-white">{titulo}</h3>}
          {subtitulo && <p className="text-slate-400 text-xs mt-0.5">{subtitulo}</p>}
        </div>
        {acciones}
      </div>
    )}
    {children}
  </section>
);

// Tabla con scroll horizontal PROPIO: la página nunca scrollea de costado,
// scrollea la tabla (requisito de 1280/1024/768).
export const Tabla = ({ columnas, children }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase">
        <tr>
          {columnas.map((c) => (
            <th key={c} className="px-4 py-2.5 text-left font-medium whitespace-nowrap">{c}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-700/60">{children}</tbody>
    </table>
  </div>
);

export const botonPrimario =
  'px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed';
export const botonSecundario =
  'px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition disabled:opacity-50';
export const inputClase =
  'w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm focus:outline-none focus:border-blue-500';

export const Campo = ({ label, children, ayuda }) => (
  <label className="block">
    <span className="block text-slate-400 text-xs mb-1">{label}</span>
    {children}
    {ayuda && <span className="block text-slate-500 text-[11px] mt-1">{ayuda}</span>}
  </label>
);

// Aviso del 409 por código duplicado: muestra el siguiente código libre que
// devolvió el backend y lo aplica con un click. Sin esto, quien carga tiene
// que adivinar o ir a listar la tabla.
export const AvisoConflictoCodigo = ({ conflicto, onUsarSugerido }) => {
  if (!conflicto) return null;
  return (
    <div role="alert" className="bg-yellow-500/15 border border-yellow-500/50 rounded-lg p-3 text-sm">
      <p className="text-yellow-100">{conflicto.mensaje}</p>
      {conflicto.siguienteLibre ? (
        <p className="text-yellow-200/90 mt-2 flex items-center gap-2 flex-wrap">
          <span>Código libre sugerido:</span>
          <code className="px-1.5 py-0.5 rounded bg-slate-900 text-yellow-200">{conflicto.siguienteLibre}</code>
          <button
            type="button"
            onClick={() => onUsarSugerido(conflicto.siguienteLibre)}
            className="px-2 py-1 rounded-md bg-yellow-500/30 hover:bg-yellow-500/50 text-yellow-100 text-xs font-medium transition"
          >
            Usar este código
          </button>
        </p>
      ) : (
        <p className="text-yellow-200/80 mt-1 text-xs">El backend no sugirió un código libre; elegí otro a mano.</p>
      )}
    </div>
  );
};
