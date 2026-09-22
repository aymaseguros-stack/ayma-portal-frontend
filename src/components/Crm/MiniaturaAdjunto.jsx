import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../Icons';
import { descargarAdjuntoSolicitud, estaEnVuelo, fallo, SUBIDA_TEXTO } from './emisionApi';

// La miniatura de una foto de inspección o del DNI (C-6i punto 1).
//
// NO ES UN `<img src>`. El binario vive detrás de un stream AUTENTICADO
// (son datos personales, Ley 25.326): una URL en el DOM sería compartible,
// cacheable y no llevaría el Bearer. Se baja el blob con el token y se
// dibuja desde un object URL local.
//
// NO SE BAJA HASTA QUE ALGUIEN LA PIDE. Seis fotos de celular son varios MB
// y el detalle de la solicitud se abre muchas veces sólo para ver el estado:
// bajarlas al montar sería tráfico y latencia por algo que nadie miró. El
// primer render es un botón; el fetch lo dispara el clic.
//
// EL OBJECT URL SE LIBERA SIEMPRE. Sin el revoke, cada apertura del modal
// deja el blob retenido en memoria hasta recargar la página, y con seis
// fotos por solicitud eso se nota en una sesión de revisión larga.
const MiniaturaAdjunto = ({ token, adjunto, onError }) => {
  const [url, setUrl] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [ampliada, setAmpliada] = useState(false);
  const urlRef = useRef(null);
  const vivoRef = useRef(true);

  const liberar = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  useEffect(() => {
    vivoRef.current = true;
    return () => { vivoRef.current = false; liberar(); };
  }, [liberar]);

  const enVuelo = estaEnVuelo(adjunto);
  const fallida = fallo(adjunto);
  const disponible = adjunto?.en_drive && !enVuelo && !fallida && !adjunto?.purgado_en;

  const cargar = async () => {
    if (cargando || url) return;                 // guarda de reentrada
    setCargando(true);
    try {
      const blob = await descargarAdjuntoSolicitud(token, adjunto);
      const nueva = URL.createObjectURL(blob);
      // El componente puede haberse desmontado mientras bajaba: sin esta
      // guarda el object URL queda creado y sin nadie que lo libere.
      if (!vivoRef.current) { URL.revokeObjectURL(nueva); return; }
      liberar();
      urlRef.current = nueva;
      setUrl(nueva);
    } catch (err) {
      onError?.(err.message);
    } finally {
      if (vivoRef.current) setCargando(false);
    }
  };

  if (!disponible) {
    return (
      <div
        className="w-16 h-16 shrink-0 rounded-lg bg-slate-900/60 border border-slate-700 flex items-center justify-center text-slate-600"
        title={SUBIDA_TEXTO[adjunto?.subida_estado] || 'Sin vista previa'}
      >
        <Icon name={fallida ? 'exclamation-triangle' : 'clock'} size={18} />
      </div>
    );
  }

  if (!url) {
    return (
      <button
        type="button"
        onClick={cargar}
        disabled={cargando}
        aria-label={`Ver miniatura de ${adjunto.nombre_original}`}
        className="w-16 h-16 shrink-0 rounded-lg bg-slate-900/60 border border-slate-700 hover:border-slate-500 disabled:opacity-50 flex items-center justify-center text-slate-400 transition"
      >
        {cargando ? <Icon name="arrow-path" size={18} /> : <Icon name="magnifying-glass" size={18} />}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAmpliada(true)}
        aria-label={`Ampliar ${adjunto.nombre_original}`}
        className="w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-slate-700 hover:border-slate-500 transition"
      >
        <img src={url} alt={adjunto.nombre_original} className="w-full h-full object-cover" />
      </button>
      {ampliada && (
        // El mismo object URL, no una descarga nueva: ampliar no vuelve a
        // pedirle el archivo al backend ni deja un segundo blob colgado.
        <div
          className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-6"
          role="dialog"
          aria-label={adjunto.nombre_original}
          onClick={() => setAmpliada(false)}
        >
          <img src={url} alt={adjunto.nombre_original} className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </>
  );
};

export default MiniaturaAdjunto;
