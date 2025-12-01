import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, Bell, Phone, MessageCircle, ChevronRight, Clock } from 'lucide-react';

const AlertasVencimientos = ({ onCerrar }) => {
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

  useEffect(() => {
    cargarAlertas();
    // Verificar cada 5 minutos
    const interval = setInterval(cargarAlertas, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const cargarAlertas = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/admin/vencimientos?dias=15`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAlertas(data.vencimientos || []);
      }
    } catch (err) {
      console.error('Error cargando alertas:', err);
    } finally {
      setLoading(false);
    }
  };

  const abrirWhatsApp = (venc) => {
    const telefono = venc.cliente?.whatsapp?.replace(/\D/g, '') || venc.cliente?.telefono?.replace(/\D/g, '');
    const mensaje = encodeURIComponent(
      `Hola ${venc.cliente?.nombre}! Te escribimos de AYMA Advisors. Tu póliza ${venc.poliza?.numero_poliza} vence el ${new Date(venc.poliza?.fecha_vencimiento).toLocaleDateString('es-AR')}. ¿Coordinamos la renovación?`
    );
    window.open(`https://wa.me/54${telefono}?text=${mensaje}`, '_blank');
  };

  const llamar = (venc) => {
    const telefono = venc.cliente?.telefono?.replace(/\D/g, '');
    window.open(`tel:+54${telefono}`, '_self');
  };

  // Clasificar por urgencia
  const urgentes = alertas.filter(a => a.dias_restantes <= 7);
  const proximos = alertas.filter(a => a.dias_restantes > 7 && a.dias_restantes <= 15);

  if (loading) return null;
  if (alertas.length === 0) return null;

  return (
    <>
      {/* Banner de Alerta Fijo */}
      {urgentes.length > 0 && (
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-3 rounded-xl shadow-lg mb-6 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-full">
                <AlertTriangle size={24} />
              </div>
              <div>
                <div className="font-bold text-lg">
                  ⚠️ {urgentes.length} póliza{urgentes.length > 1 ? 's' : ''} con vencimiento URGENTE
                </div>
                <div className="text-red-100 text-sm">
                  Requieren atención inmediata (menos de 7 días)
                </div>
              </div>
            </div>
            <button
              onClick={() => setExpandido(!expandido)}
              className="px-4 py-2 bg-white text-red-600 rounded-lg font-medium hover:bg-red-50 transition flex items-center gap-2"
            >
              {expandido ? 'Ocultar' : 'Ver Detalle'}
              <ChevronRight size={18} className={`transition-transform ${expandido ? 'rotate-90' : ''}`} />
            </button>
          </div>
        </div>
      )}

      {/* Panel Expandido de Alertas */}
      {expandido && (
        <div className="bg-white rounded-xl shadow-lg border-2 border-red-200 mb-6 overflow-hidden">
          <div className="bg-red-50 px-6 py-4 border-b border-red-200">
            <h3 className="font-bold text-red-800 flex items-center gap-2">
              <Bell size={20} />
              Centro de Alertas - Vencimientos Críticos
            </h3>
          </div>
          
          {/* Urgentes (≤7 días) */}
          {urgentes.length > 0 && (
            <div className="p-4">
              <h4 className="text-sm font-semibold text-red-600 mb-3 flex items-center gap-2">
                <Clock size={16} />
                URGENTE - Menos de 7 días
              </h4>
              <div className="space-y-2">
                {urgentes.map((venc, idx) => (
                  <AlertaItem 
                    key={idx} 
                    venc={venc} 
                    tipo="urgente"
                    onWhatsApp={() => abrirWhatsApp(venc)}
                    onLlamar={() => llamar(venc)}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Próximos (8-15 días) */}
          {proximos.length > 0 && (
            <div className="p-4 bg-yellow-50 border-t">
              <h4 className="text-sm font-semibold text-yellow-700 mb-3 flex items-center gap-2">
                <Clock size={16} />
                PRÓXIMOS - 8 a 15 días
              </h4>
              <div className="space-y-2">
                {proximos.map((venc, idx) => (
                  <AlertaItem 
                    key={idx} 
                    venc={venc} 
                    tipo="proximo"
                    onWhatsApp={() => abrirWhatsApp(venc)}
                    onLlamar={() => llamar(venc)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Botón cerrar */}
          <div className="p-4 bg-gray-50 border-t flex justify-end">
            <button
              onClick={() => setExpandido(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition"
            >
              Cerrar Panel
            </button>
          </div>
        </div>
      )}

      {/* Indicador flotante cuando hay alertas pero está cerrado */}
      {!expandido && alertas.length > 0 && (
        <button
          onClick={() => setExpandido(true)}
          className="fixed bottom-6 right-6 bg-red-600 text-white p-4 rounded-full shadow-xl hover:bg-red-700 transition z-50 flex items-center gap-2"
        >
          <Bell size={24} />
          <span className="bg-white text-red-600 px-2 py-1 rounded-full text-sm font-bold">
            {alertas.length}
          </span>
        </button>
      )}
    </>
  );
};

// Componente individual de alerta
const AlertaItem = ({ venc, tipo, onWhatsApp, onLlamar }) => {
  const bgColor = tipo === 'urgente' ? 'bg-red-100 border-red-300' : 'bg-yellow-100 border-yellow-300';
  const textColor = tipo === 'urgente' ? 'text-red-800' : 'text-yellow-800';
  const diasColor = tipo === 'urgente' ? 'bg-red-600' : 'bg-yellow-600';

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${bgColor}`}>
      <div className="flex items-center gap-4">
        <div className={`${diasColor} text-white px-3 py-1 rounded-full text-sm font-bold`}>
          {venc.dias_restantes}d
        </div>
        <div>
          <div className={`font-medium ${textColor}`}>
            {venc.cliente?.nombre} {venc.cliente?.apellido}
          </div>
          <div className="text-sm text-gray-600">
            Póliza: {venc.poliza?.numero_poliza} • {venc.poliza?.compania}
          </div>
          <div className="text-xs text-gray-500">
            Vence: {new Date(venc.poliza?.fecha_vencimiento).toLocaleDateString('es-AR')} • 
            Prima: ${venc.poliza?.premio_total?.toLocaleString('es-AR')}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <button
          onClick={onWhatsApp}
          className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
          title="WhatsApp"
        >
          <MessageCircle size={18} />
        </button>
        <button
          onClick={onLlamar}
          className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          title="Llamar"
        >
          <Phone size={18} />
        </button>
      </div>
    </div>
  );
};

export default AlertasVencimientos;
