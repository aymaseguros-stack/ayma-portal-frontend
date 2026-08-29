import React from 'react';
import { Icon } from './Icons';

// Grilla de pólizas reutilizada por "Pólizas", "ART" e "Integral Comercio"
// (estas últimas dos son la misma vista con un filtro de ramo fijo).
const PolizasGrid = ({ titulo, polizas, emptyText }) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{titulo}</h2>
        <span className="text-slate-400">{polizas.length} póliza(s)</span>
      </div>

      {polizas.length === 0 ? (
        <div className="bg-slate-800/50 rounded-xl p-12 text-center border border-slate-700">
          <Icon name="document-text" size={48} className="text-slate-600 mx-auto" />
          <p className="text-slate-400 mt-4">{emptyText}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {polizas.map(poliza => (
            <div key={poliza.id} className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden hover:border-blue-500/50 transition">
              <div className="bg-slate-700/50 px-6 py-4 flex justify-between items-center">
                <div>
                  <p className="text-blue-400 font-bold">Póliza {poliza.numero_poliza}</p>
                  <p className="text-slate-400 text-sm">{poliza.compania}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  poliza.estado === 'vigente'
                    ? 'bg-green-600/30 text-green-300'
                    : 'bg-red-600/30 text-red-300'
                }`}>
                  {poliza.estado}
                </span>
              </div>

              <div className="p-6 space-y-4">
                {poliza.vehiculo && (
                  <div className="flex items-center gap-3 bg-slate-700/30 rounded-lg p-3">
                    <Icon name="truck" size={24} className="text-slate-400" />
                    <div>
                      <p className="font-semibold">{poliza.vehiculo.marca} {poliza.vehiculo.modelo}</p>
                      <p className="text-slate-400 text-sm">{poliza.vehiculo.dominio} • {poliza.vehiculo.anio}</p>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Cobertura</p>
                    <p className="font-medium">{poliza.tipo_cobertura}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Suma Asegurada</p>
                    <p className="font-medium">${poliza.suma_asegurada?.toLocaleString('es-AR')}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Premio Total</p>
                    <p className="font-bold text-green-400">${poliza.premio_total?.toLocaleString('es-AR')}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Vencimiento</p>
                    <p className="font-medium">{new Date(poliza.fecha_vencimiento).toLocaleDateString('es-AR')}</p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-3 bg-slate-700/30 flex justify-between items-center">
                <span className="text-xs text-slate-500">
                  Vigencia: {new Date(poliza.fecha_inicio).toLocaleDateString('es-AR')} - {new Date(poliza.fecha_vencimiento).toLocaleDateString('es-AR')}
                </span>
                <button className="text-blue-400 hover:text-blue-300 text-sm font-medium">
                  Ver PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PolizasGrid;
