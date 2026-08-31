import React, { useState } from 'react';
import BandejaTab from './BandejaTab';
import SinVincularTab from './SinVincularTab';
import RuidoTab from './RuidoTab';
import EnviadosTab from './EnviadosTab';
import CuentasTab from './CuentasTab';
import EmailDetailPanel from './EmailDetailPanel';
import VincularBuscador from './VincularBuscador';
import ComposeModal from './ComposeModal';

// Contenedor de la sección Mail: switchea sobre subTab (uno de los ids de
// MAIL_TABS, controlados por la fila 3 del header) y comparte el panel
// lateral de detalle, el buscador de vinculación y el compositor entre las
// pestañas Bandeja y Enviados.
const MailPanel = ({ token, subTab }) => {
  const [emailAbiertoId, setEmailAbiertoId] = useState(null);
  const [emailAVincular, setEmailAVincular] = useState(null);
  const [compose, setCompose] = useState(null); // { destinatarioInicial, asuntoInicial, respondeAId } | null
  const [refreshKey, setRefreshKey] = useState(0);

  const cerrarDetalle = () => setEmailAbiertoId(null);

  const responder = (detalle) => {
    setCompose({
      destinatarioInicial: detalle.remitente_email || '',
      asuntoInicial: detalle.asunto ? `Re: ${detalle.asunto.replace(/^Re:\s*/i, '')}` : '',
      respondeAId: detalle.id,
    });
  };

  const marcarComoRuido = () => setRefreshKey(k => k + 1);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Mail</h2>

      {subTab === 'mail-bandeja' && (
        <BandejaTab token={token} onAbrirEmail={setEmailAbiertoId} refreshKey={refreshKey} />
      )}
      {subTab === 'mail-sin-vincular' && <SinVincularTab token={token} />}
      {subTab === 'mail-ruido' && <RuidoTab token={token} />}
      {subTab === 'mail-enviados' && <EnviadosTab token={token} onAbrirEmail={setEmailAbiertoId} />}
      {subTab === 'mail-cuentas' && <CuentasTab token={token} />}

      {emailAbiertoId && (
        <EmailDetailPanel
          token={token}
          emailId={emailAbiertoId}
          onClose={cerrarDetalle}
          onResponder={responder}
          onVincular={(detalle) => setEmailAVincular(detalle.id)}
          onMarcadoRuido={marcarComoRuido}
        />
      )}

      {emailAVincular && (
        <VincularBuscador
          token={token}
          emailId={emailAVincular}
          onClose={() => setEmailAVincular(null)}
          onVinculado={() => setRefreshKey(k => k + 1)}
        />
      )}

      {compose && (
        <ComposeModal
          token={token}
          destinatarioInicial={compose.destinatarioInicial}
          asuntoInicial={compose.asuntoInicial}
          respondeAId={compose.respondeAId}
          onClose={() => setCompose(null)}
          onEnviado={() => setRefreshKey(k => k + 1)}
        />
      )}
    </div>
  );
};

export default MailPanel;
