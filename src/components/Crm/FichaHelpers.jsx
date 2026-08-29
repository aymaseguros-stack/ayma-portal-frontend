import React from 'react';

export const Dato = ({ label, valor, mono, full }) => (
  <div className={full ? 'md:col-span-2' : ''}>
    <p className="text-slate-500 text-xs uppercase tracking-wide">{label}</p>
    <p className={`mt-0.5 ${mono ? 'font-mono text-blue-400' : ''}`}>{valor || '-'}</p>
  </div>
);

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
