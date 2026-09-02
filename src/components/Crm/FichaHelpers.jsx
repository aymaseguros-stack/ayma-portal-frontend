import React from 'react';

// `valor` viene directo de campos de API sin schema estricto (ver
// EmpresaArtSection/ArtEmpresaFicha). Solo se renderiza si es un primitivo
// o un elemento React ya armado por el caller (ej. el <span> de "Vigente"
// en ArtDatos); cualquier otra cosa (objeto, array) se trata como "sin
// dato" en vez de pasarla cruda a JSX (React error #31).
const esValorRenderizable = (valor) =>
  typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean' || React.isValidElement(valor);

export const Dato = ({ label, valor, mono, full }) => {
  const seguro = esValorRenderizable(valor) ? valor : null;
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <p className="text-slate-500 text-xs uppercase tracking-wide">{label}</p>
      <p className={`mt-0.5 ${mono ? 'font-mono text-blue-400' : ''}`}>{seguro || '-'}</p>
    </div>
  );
};

export const ListaSimple = ({ items, vacio, render }) => {
  if (!items || items.length === 0) {
    return <p className="text-slate-500 text-sm text-center py-8">{vacio}</p>;
  }
  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div key={item.id || idx} className="bg-slate-700/30 rounded-lg p-3">
          {render(item)}
        </div>
      ))}
    </div>
  );
};
