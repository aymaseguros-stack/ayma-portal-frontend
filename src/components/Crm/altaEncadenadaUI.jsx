import React from 'react';
import { Icon } from '../Icons';
import { etiquetaEntidad, ROLES_VINCULO } from './altaEncadenada';

// Piezas compartidas por los formularios de alta encadenada (persona, empresa,
// oportunidad). Separadas de AltaEncadenada.jsx para no importar en círculo: el
// host importa los formularios, y los formularios importan esto.

// "+ Nueva persona" / "+ Nueva empresa" al lado del selector correspondiente.
// No se renderiza en el último nivel de la pila (profundidad máxima 3).
export const BotonAnidar = ({ tipo, onClick, disabled = false }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg text-xs font-medium transition whitespace-nowrap"
  >
    <Icon name="plus" size={14} />
    {tipo === 'empresa' ? 'Nueva empresa' : 'Nueva persona'}
  </button>
);

// Entidades que van a quedar enlazadas cuando se guarde este formulario: las
// que se crearon en un nivel de más arriba, o la que venía precargada desde el
// formulario de origen.
export const ChipsVinculos = ({ tipo, items, onQuitar, vacio }) => {
  if (!items || items.length === 0) {
    return vacio ? <p className="text-slate-500 text-sm">{vacio}</p> : null;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item.id}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600/20 border border-blue-500/40 rounded-full text-sm"
        >
          {etiquetaEntidad(tipo, item)}
          {onQuitar && (
            <button
              type="button"
              onClick={() => onQuitar(item.id)}
              className="text-slate-400 hover:text-white"
              aria-label={`Quitar ${etiquetaEntidad(tipo, item)}`}
            >
              <Icon name="x-mark" size={14} />
            </button>
          )}
        </span>
      ))}
    </div>
  );
};

// Aviso de posible duplicado: antes de crear, si ya existe una entidad con ese
// CUIT / documento / teléfono / mail, se ofrece usar la existente.
export const AvisoDuplicados = ({ tipo, duplicados, onUsarExistente, onCrearIgual, trabajando }) => (
  <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-lg p-4 space-y-3">
    <p className="text-yellow-200 text-sm font-medium">
      {duplicados.length === 1
        ? `Ya existe ${tipo === 'empresa' ? 'una empresa' : 'una persona'} con esos datos.`
        : `Ya existen ${duplicados.length} registros con esos datos.`}
    </p>
    <div className="space-y-2">
      {duplicados.map(({ entidad, motivo }) => (
        <div key={entidad.id} className="flex items-center justify-between gap-3 bg-slate-800/60 rounded-lg px-3 py-2">
          <span className="text-sm">
            {etiquetaEntidad(tipo, entidad)}
            <span className="text-slate-500 text-xs ml-2">mismo {motivo}</span>
          </span>
          <button
            type="button"
            disabled={trabajando}
            onClick={() => onUsarExistente(entidad)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-xs font-semibold transition whitespace-nowrap"
          >
            Usar la existente
          </button>
        </div>
      ))}
    </div>
    <button
      type="button"
      disabled={trabajando}
      onClick={onCrearIgual}
      className="text-slate-400 hover:text-white text-xs underline"
    >
      Crear de todas formas
    </button>
  </div>
);

// Rol del vínculo + los dos atributos que lo califican. Sin valor por
// defecto y obligatorio: antes el enlace automático asumía TITULAR y
// contacto principal, y así se cargaban gerentes y contadores como titulares
// de la empresa. Quien enlaza es quien sabe qué rol tiene esa persona.
export const CamposVinculo = ({ valor, onChange, deshabilitado = false, etiquetaRol = 'Rol del vínculo *' }) => (
  <div className="space-y-2">
    <div>
      <label className="block text-slate-400 text-sm mb-2">{etiquetaRol}</label>
      <select
        value={valor.rol}
        disabled={deshabilitado}
        onChange={(e) => onChange({ ...valor, rol: e.target.value })}
        className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
        required
      >
        <option value="">Elegí un rol...</option>
        {ROLES_VINCULO.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
    </div>
    <label className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg cursor-pointer hover:bg-slate-700/50 transition">
      <input
        type="checkbox"
        checked={valor.es_decisor}
        disabled={deshabilitado}
        onChange={(e) => onChange({ ...valor, es_decisor: e.target.checked })}
        className="w-4 h-4 rounded"
      />
      <span className="text-sm">Es quien decide</span>
    </label>
    <label className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg cursor-pointer hover:bg-slate-700/50 transition">
      <input
        type="checkbox"
        checked={valor.es_contacto_principal}
        disabled={deshabilitado}
        onChange={(e) => onChange({ ...valor, es_contacto_principal: e.target.checked })}
        className="w-4 h-4 rounded"
      />
      <span className="text-sm">Contacto principal</span>
    </label>
  </div>
);
