import React, { useEffect, useState } from 'react';
import { catalogoCompanias } from './oportunidadCatalogos';

// C-16 - a quién se le adjudica la venta, de una lista cerrada.
//
// EL CATÁLOGO NO PUEDE SER UNA CONSTANTE DEL FRONTEND: son las filas de
// `proveedores` (ASEGURADORA/ART, ACTIVO) que Dirección da de alta por API.
// Hardcodearlas obligaría a un deploy para poder cerrar una venta con una
// compañía nueva, que es la forma más rápida de que alguien vuelva a pedir el
// campo de texto libre.
//
// Es el MISMO conjunto contra el que valida `PATCH /oportunidades/{id}/cerrar`:
// lo que no está acá es un 422 al confirmar el cierre.

const inputClass = 'w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm';

const SelectorCompania = ({ token, valor, onChange, deshabilitado = false, label = 'Compañía ganadora' }) => {
  const [companias, setCompanias] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vigente = true;
    catalogoCompanias(token)
      .then((data) => { if (vigente) { setCompanias(data.companias || []); setError(null); } })
      .catch((err) => { if (vigente) { setCompanias([]); setError(err.message); } });
    return () => { vigente = false; };
  }, [token]);

  // Un valor ya guardado que el padrón no tiene (un cierre viejo, texto libre
  // de antes de C-16) se OFRECE igual, marcado. Descartarlo obligaría a
  // pisarlo para poder guardar cualquier otra cosa de la ficha, y el cierre
  // quedaría adjudicado a otra compañía por un descuido de la pantalla.
  const fueraDelPadron = Boolean(
    valor && companias && !companias.some((c) => c.nombre === valor),
  );

  return (
    <div>
      <label className="block text-slate-400 text-sm mb-2" htmlFor="compania-ganadora">{label}</label>
      <select
        id="compania-ganadora"
        value={valor || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={deshabilitado || companias === null}
        className={inputClass}
      >
        <option value="">{companias === null ? 'Cargando compañías...' : 'Elegí la compañía...'}</option>
        {fueraDelPadron && (
          <option value={valor}>{valor} — fuera del padrón</option>
        )}
        {(companias || []).map((c) => (
          <option key={c.id} value={c.nombre}>
            {c.nombre}{c.cuit ? '' : ' (sin CUIT cargado)'}
          </option>
        ))}
      </select>

      {error && (
        <p className="text-red-300 text-xs mt-1">No se pudo leer el padrón de compañías: {error}</p>
      )}

      {/* El mensaje dice DÓNDE se resuelve, no sólo que falta: quien cierra la
          venta no tiene por qué saber que las compañías viven en el padrón de
          proveedores de Dirección. */}
      <p className="text-slate-500 text-xs mt-1">
        ¿No está la compañía? Cargala en <strong>Dirección → Proveedores</strong> (tipo Aseguradora
        o ART, estado Activo) y volvé a abrir este cierre.
      </p>

      {fueraDelPadron && (
        <p className="text-amber-300/90 text-xs mt-1">
          La compañía guardada no está en el padrón. Elegí la del padrón para que la venta cuente
          en producción, o cargala en Dirección → Proveedores.
        </p>
      )}
    </div>
  );
};

export default SelectorCompania;
