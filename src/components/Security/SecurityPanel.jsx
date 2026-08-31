import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  obtenerEstado2FA,
  iniciarActivacion2FA,
  confirmarActivacion2FA,
  regenerarCodigos2FA,
  desactivar2FA
} from '../../services/twoFactorApi';

// Pantalla de Seguridad, accesible desde el badge de rol del header.
// Cubre el ciclo completo del 2FA: ver estado, activar (QR + secreto +
// confirmación), mostrar códigos de recuperación una sola vez, y desde el
// estado activo, regenerar códigos o desactivar.
const SecurityPanel = ({ token }) => {
  const [estado, setEstado] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Activación en curso
  const [activando, setActivando] = useState(false);
  const [otpauthUri, setOtpauthUri] = useState(null);
  const [secreto, setSecreto] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [codigoConfirmacion, setCodigoConfirmacion] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [errorActivacion, setErrorActivacion] = useState(null);

  // Códigos de recuperación mostrados una sola vez (activación o regeneración)
  const [codigosRecuperacion, setCodigosRecuperacion] = useState(null);
  const [confirmoGuardado, setConfirmoGuardado] = useState(false);

  // Desactivación
  const [mostrarDesactivar, setMostrarDesactivar] = useState(false);
  const [passwordDesactivar, setPasswordDesactivar] = useState('');
  const [codigoDesactivar, setCodigoDesactivar] = useState('');
  const [desactivando, setDesactivando] = useState(false);
  const [errorDesactivar, setErrorDesactivar] = useState(null);

  const [regenerando, setRegenerando] = useState(false);

  const codigosRef = useRef(null);

  const cargarEstado = async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await obtenerEstado2FA(token);
      setEstado(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargarEstado(); }, []);

  useEffect(() => {
    if (!otpauthUri) { setQrDataUrl(null); return; }
    // El QR se genera 100% en el cliente a partir de la URI otpauth:// que
    // manda el backend: el secreto nunca sale del navegador hacia terceros.
    QRCode.toDataURL(otpauthUri, { width: 220, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [otpauthUri]);

  const handleActivar = async () => {
    setActivando(true);
    setErrorActivacion(null);
    try {
      const data = await iniciarActivacion2FA(token);
      setOtpauthUri(data.otpauth_url || data.otpauth_uri || data.uri);
      setSecreto(data.secreto || data.secret);
    } catch (err) {
      setErrorActivacion(err.message);
      setActivando(false);
    }
  };

  const handleConfirmarActivacion = async (e) => {
    e.preventDefault();
    setConfirmando(true);
    setErrorActivacion(null);
    try {
      const data = await confirmarActivacion2FA(token, codigoConfirmacion.trim());
      const codigos = data.codigos_recuperacion || data.recovery_codes || [];
      setCodigosRecuperacion(codigos);
      setConfirmoGuardado(false);
      setActivando(false);
      setOtpauthUri(null);
      setSecreto(null);
      setCodigoConfirmacion('');
      await cargarEstado();
    } catch (err) {
      setErrorActivacion(err.message);
    } finally {
      setConfirmando(false);
    }
  };

  const handleRegenerar = async () => {
    if (!confirm('Esto invalida todos los códigos de recuperación anteriores. ¿Continuar?')) return;
    setRegenerando(true);
    setError(null);
    try {
      const data = await regenerarCodigos2FA(token);
      const codigos = data.codigos_recuperacion || data.recovery_codes || [];
      setCodigosRecuperacion(codigos);
      setConfirmoGuardado(false);
      await cargarEstado();
    } catch (err) {
      setError(err.message);
    } finally {
      setRegenerando(false);
    }
  };

  const handleDesactivar = async (e) => {
    e.preventDefault();
    setDesactivando(true);
    setErrorDesactivar(null);
    try {
      await desactivar2FA(token, passwordDesactivar, codigoDesactivar.trim());
      setMostrarDesactivar(false);
      setPasswordDesactivar('');
      setCodigoDesactivar('');
      await cargarEstado();
    } catch (err) {
      setErrorDesactivar(err.message);
    } finally {
      setDesactivando(false);
    }
  };

  const handleDescargarCodigos = () => {
    if (!codigosRecuperacion) return;
    const contenido = [
      'AYMA Advisors - Códigos de recuperación 2FA',
      'Cada código se puede usar una sola vez. Guardalos en un lugar seguro.',
      '',
      ...codigosRecuperacion
    ].join('\n');
    const blob = new Blob([contenido], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ayma-codigos-recuperacion-2fa.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const cerrarCodigosRecuperacion = () => {
    if (!confirmoGuardado) return;
    setCodigosRecuperacion(null);
    setConfirmoGuardado(false);
  };

  if (cargando) {
    return <div className="text-slate-400">Cargando estado de seguridad...</div>;
  }

  // Bloque de códigos de recuperación: se muestra una única vez, tapando el
  // resto de la pantalla hasta que el usuario confirma que los guardó.
  if (codigosRecuperacion) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Seguridad</h2>
        <div className="bg-amber-900/30 border-2 border-amber-500/60 rounded-xl p-6 max-w-xl">
          <h3 className="text-lg font-bold text-amber-300 mb-2">⚠️ Guardá tus códigos de recuperación</h3>
          <p className="text-slate-300 text-sm mb-4">
            Estos 10 códigos se muestran <strong>una sola vez</strong>. Cada uno sirve para un solo
            ingreso si perdés acceso a tu app de autenticación.
          </p>
          <div ref={codigosRef} className="grid grid-cols-2 gap-2 bg-slate-900/60 rounded-lg p-4 font-mono text-sm">
            {codigosRecuperacion.map((codigo, i) => (
              <div key={i} className="text-white">{codigo}</div>
            ))}
          </div>
          <button
            onClick={handleDescargarCodigos}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
          >
            Descargar
          </button>
          <label className="flex items-center gap-2 mt-6 text-sm text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmoGuardado}
              onChange={(e) => setConfirmoGuardado(e.target.checked)}
              className="w-4 h-4"
            />
            Los guardé en un lugar seguro
          </label>
          <button
            onClick={cerrarCodigosRecuperacion}
            disabled={!confirmoGuardado}
            className="mt-4 w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  const activo = !!estado?.activo;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Seguridad</h2>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm max-w-xl">
          {error}
        </div>
      )}

      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 max-w-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm">Verificación en dos pasos (2FA)</p>
            <p className={`text-xl font-semibold ${activo ? 'text-green-400' : 'text-slate-300'}`}>
              {activo ? 'Activo' : 'Inactivo'}
            </p>
          </div>
          {activo && (
            <span className="px-3 py-1 bg-green-600/20 text-green-300 rounded-full text-sm">
              {estado?.codigos_restantes ?? estado?.recovery_codes_remaining ?? 0} códigos de recuperación restantes
            </span>
          )}
        </div>

        {!activo && !activando && (
          <button
            onClick={handleActivar}
            className="mt-6 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
          >
            Activar 2FA
          </button>
        )}

        {!activo && activando && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              {qrDataUrl && (
                <img src={qrDataUrl} alt="Código QR para activar 2FA" className="rounded-lg bg-white p-2" />
              )}
              <div className="flex-1 space-y-2">
                <p className="text-slate-300 text-sm">
                  Escaneá el código con tu app de autenticación (Google Authenticator, Authy, etc.)
                </p>
                <p className="text-slate-400 text-xs">¿No podés escanear? Ingresá este secreto manualmente:</p>
                <code className="block bg-slate-900/60 rounded-lg px-3 py-2 text-sm text-blue-300 break-all">
                  {secreto}
                </code>
              </div>
            </div>

            <form onSubmit={handleConfirmarActivacion} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="Código de 6 dígitos"
                value={codigoConfirmacion}
                onChange={(e) => setCodigoConfirmacion(e.target.value.replace(/\D/g, ''))}
                className="px-4 py-2.5 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                required
              />
              <button
                type="submit"
                disabled={confirmando || codigoConfirmacion.length !== 6}
                className="px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-semibold transition"
              >
                {confirmando ? 'Confirmando...' : 'Confirmar activación'}
              </button>
              <button
                type="button"
                onClick={() => { setActivando(false); setOtpauthUri(null); setSecreto(null); setErrorActivacion(null); }}
                className="text-slate-400 hover:text-slate-300 text-sm"
              >
                Cancelar
              </button>
            </form>

            {errorActivacion && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">
                {errorActivacion}
              </div>
            )}
          </div>
        )}

        {activo && (
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={handleRegenerar}
              disabled={regenerando}
              className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg font-semibold transition"
            >
              {regenerando ? 'Regenerando...' : 'Regenerar códigos'}
            </button>
            <button
              onClick={() => setMostrarDesactivar(true)}
              className="px-5 py-2.5 bg-red-600/80 hover:bg-red-600 text-white rounded-lg font-semibold transition"
            >
              Desactivar 2FA
            </button>
          </div>
        )}

        {activo && mostrarDesactivar && (
          <form onSubmit={handleDesactivar} className="mt-6 space-y-3 border-t border-slate-700 pt-6">
            <p className="text-slate-300 text-sm">Para desactivar el 2FA, confirmá tu contraseña y un código vigente.</p>
            <input
              type="password"
              placeholder="Contraseña"
              value={passwordDesactivar}
              onChange={(e) => setPasswordDesactivar(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="Código de 6 dígitos"
              value={codigoDesactivar}
              onChange={(e) => setCodigoDesactivar(e.target.value.replace(/\D/g, ''))}
              className="w-full px-4 py-2.5 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
            {errorDesactivar && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">
                {errorDesactivar}
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={desactivando}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-semibold transition"
              >
                {desactivando ? 'Desactivando...' : 'Confirmar desactivación'}
              </button>
              <button
                type="button"
                onClick={() => { setMostrarDesactivar(false); setErrorDesactivar(null); setPasswordDesactivar(''); setCodigoDesactivar(''); }}
                className="text-slate-400 hover:text-slate-300 text-sm"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default SecurityPanel;
