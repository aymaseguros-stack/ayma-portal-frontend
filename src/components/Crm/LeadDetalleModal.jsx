import React, { useState } from 'react';
import Modal from '../Modal';
import Timeline from './Timeline';
import { Dato } from './FichaHelpers';
import { fechaHora } from '../../utils/fechas';

// C-13 - El CRM guardaba datos del lead que no mostraba.
//
// El PR #175 del backend cerró el agujero del ALTA: `LeadCreate` declaraba tres
// campos de atribución y Pydantic descartaba el resto EN SILENCIO, así que el
// `mensaje` del formulario, el `session_token` del chatbot y media atribución
// (utm_content, utm_term, fbclid, gclid, page_url, canal) se perdían sin error
// y sin log. Ya se persisten.
//
// Lo que faltaba era la otra mitad: un dato guardado que no se muestra es, para
// quien tiene que llamar al lead, un dato que no existe. La tabla mostraba seis
// columnas; todo lo demás sólo estaba en la base. Acá se muestra completo.
//
// LA HORA. La tabla usa `fechaCorta` (dd/mm/aaaa) y con eso no se puede
// priorizar: un lead que entró hace veinte minutos y otro de esta mañana se ven
// iguales. `created_at` es un instante, así que va con `fechaHora`.

const TABS = [
  { id: 'datos', label: 'Datos' },
  { id: 'atribucion', label: 'Atribución' },
  { id: 'actividad', label: 'Actividad' },
];

// Campos que el backend expone hoy en `LeadResponse`. Los del vehículo
// (`vehiculo_marca`, `vehiculo_modelo`, `vehiculo_anio`) se persisten en la
// tabla `leads` pero TODAVÍA NO están en ese schema, así que sólo se pintan
// cuando vienen: en cuanto el backend los agregue, aparecen sin tocar esto, y
// mientras tanto no se muestra un "—" que haga creer que el lead no los trajo.
const tieneVehiculo = (lead) => Boolean(
  lead.vehiculo_marca || lead.vehiculo_modelo || lead.vehiculo_anio
  || lead.vehiculo_tipo || lead.vehiculo_version,
);

const LeadDetalleModal = ({ token, lead, onClose }) => {
  const [tab, setTab] = useState('datos');

  return (
    <Modal title={`Lead · ${lead.nombre || 'sin nombre'}`} onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-1 bg-slate-700 rounded text-xs font-medium">{lead.estado}</span>
          <span className="px-2 py-1 bg-slate-700/60 text-slate-300 rounded text-xs">{lead.origen}</span>
          {lead.canal && <span className="px-2 py-1 bg-slate-700/60 text-slate-300 rounded text-xs">{lead.canal}</span>}
          <span className="ml-auto text-slate-400 text-xs">{fechaHora(lead.created_at)}</span>
        </div>

        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                tab === t.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'datos' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <Dato label="Nombre" valor={lead.nombre} />
            <Dato label="Teléfono" valor={lead.telefono} />
            <Dato label="Email" valor={lead.email} />
            <Dato label="Código postal" valor={lead.codigo_postal} />
            <Dato label="Tipo de seguro" valor={lead.tipo_seguro} />
            <Dato label="Cobertura" valor={lead.cobertura} />
            <Dato label="Ingresó" valor={fechaHora(lead.created_at)} />
            <Dato label="Estado" valor={lead.estado} />
            {tieneVehiculo(lead) && (
              <>
                <Dato label="Marca" valor={lead.vehiculo_marca} />
                <Dato label="Modelo" valor={lead.vehiculo_modelo} />
                <Dato label="Año" valor={lead.vehiculo_anio} />
                <Dato label="Tipo de vehículo" valor={lead.vehiculo_tipo} />
                <Dato label="Versión" valor={lead.vehiculo_version} />
              </>
            )}
            <Dato label="Mensaje" valor={lead.mensaje} full />
            <Dato label="Notas" valor={lead.notas} full />
          </div>
        )}

        {tab === 'atribucion' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <Dato label="Origen" valor={lead.origen} />
            <Dato label="Canal" valor={lead.canal} />
            <Dato label="utm_source" valor={lead.utm_source} />
            <Dato label="utm_medium" valor={lead.utm_medium} />
            <Dato label="utm_campaign" valor={lead.utm_campaign} />
            <Dato label="utm_content" valor={lead.utm_content} />
            <Dato label="utm_term" valor={lead.utm_term} />
            <Dato label="fbclid" valor={lead.fbclid} />
            <Dato label="gclid" valor={lead.gclid} />
            <Dato label="session_token" valor={lead.session_token} />
            <Dato label="page_url" valor={lead.page_url} full />
          </div>
        )}

        {tab === 'actividad' && (
          <Timeline token={token} tipo="lead" id={lead.id} destinatarioEmail={lead.email} />
        )}
      </div>
    </Modal>
  );
};

export default LeadDetalleModal;
