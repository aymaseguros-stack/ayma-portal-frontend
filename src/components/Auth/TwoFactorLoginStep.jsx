import React, { useEffect, useRef, useState } from 'react';
import { verificarLogin2FA } from '../../services/twoFactorApi';

const MAX_INTENTOS = 5;

// Segunda pantalla del login en dos pasos. Se muestra cuando /auth/login
// devuelve {requiere_2fa: true, token_temporal}. Acepta pegar el código
// completo (autofocus + paste sobre el primer input) y permite alternar a
// "código de recuperación" (texto libre, sin el límite de 6 dígitos).
const TwoFactorLoginStep = ({ tokenTemporal, onSuccess, onVolver }) => {
  const [modoRecuperacion, setModoRecuperacion] = useState(false);
  const [digitos, setDigitos] = useState(Array(6).fill(''));
  const [codigoRecuperacion, setCodigoRecuperacion] = useState('');
  const [intentosRestantes, setIntentosRestantes] = useState(MAX_INTENTOS);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputsRef = useRef([]);
  const recuperacionRef = useRef(null);

  useEffect(() => {
    if (modoRecuperacion) {
      recuperacionRef.current?.focus();
    } else {
      inputsRef.current[0]?.focus();
    }
  }, [modoRecuperacion]);

  const extraerIntentosRestantes = (body) => {
    const valor = body?.intentos_restantes ?? body?.remaining_attempts ?? body?.attempts_left;
    return typeof valor === 'number' ? valor : null;
  };

  const enviarCodigo = async (codigo) => {
    if (!codigo || loading) return;
    setLoading(true);
    setError(null);
    try {
      const data = await verificarLogin2FA(tokenTemporal, codigo);
      onSuccess(data);
    } catch (err) {
      const restantes = extraerIntentosRestantes(err.body);
      setIntentosRestantes(prev => (restantes !== null ? restantes : Math.max(prev - 1, 0)));
      setError(err.body?.detail || err.message || 'Código inválido');
      if (!modoRecuperacion) {
        setDigitos(Array(6).fill(''));
        inputsRef.current[0]?.focus();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDigitoChange = (index, value) => {
    const limpio = value.replace(/\D/g, '');
    if (!limpio) {
      const nuevos = [...digitos];
      nuevos[index] = '';
      setDigitos(nuevos);
      return;
    }
    // Pegar el código completo sobre cualquier casillero: se distribuye
    // dígito por dígito a partir de esa posición.
    const nuevos = [...digitos];
    const caracteres = limpio.split('');
    caracteres.forEach((char, offset) => {
      if (index + offset < 6) nuevos[index + offset] = char;
    });
    setDigitos(nuevos);
    const siguiente = Math.min(index + caracteres.length, 5);
    inputsRef.current[siguiente]?.focus();
    const completo = nuevos.join('');
    if (completo.length === 6) enviarCodigo(completo);
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digitos[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handleSubmitRecuperacion = (e) => {
    e.preventDefault();
    enviarCodigo(codigoRecuperacion.trim());
  };

  const sinIntentos = intentosRestantes <= 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md border border-white/20 shadow-2xl">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Verificación en dos pasos</h1>
          <p className="text-blue-200 text-sm">
            {modoRecuperacion
              ? 'Ingresá uno de tus códigos de recuperación'
              : 'Ingresá el código de 6 dígitos de tu app de autenticación'}
          </p>
        </div>

        {!modoRecuperacion ? (
          <div className="flex justify-center gap-2 mb-4" onPaste={(e) => {
            e.preventDefault();
            handleDigitoChange(0, e.clipboardData.getData('text'));
          }}>
            {digitos.map((digito, i) => (
              <input
                key={i}
                ref={(el) => { inputsRef.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={digito}
                disabled={loading || sinIntentos}
                onChange={(e) => handleDigitoChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="w-11 h-14 text-center text-2xl font-bold rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
              />
            ))}
          </div>
        ) : (
          <form onSubmit={handleSubmitRecuperacion} className="space-y-4 mb-4">
            <input
              ref={recuperacionRef}
              type="text"
              placeholder="Código de recuperación"
              value={codigoRecuperacion}
              disabled={loading || sinIntentos}
              onChange={(e) => setCodigoRecuperacion(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || sinIntentos || !codigoRecuperacion.trim()}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Verificando...' : 'Verificar'}
            </button>
          </form>
        )}

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <p className="text-center text-sm text-slate-300 mb-4">
          Intentos restantes: <span className={intentosRestantes <= 1 ? 'text-red-300 font-semibold' : 'font-semibold'}>{intentosRestantes}</span> / {MAX_INTENTOS}
        </p>

        {sinIntentos && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm mb-4 text-center">
            Superaste el máximo de intentos. Volvé a iniciar sesión.
          </div>
        )}

        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => { setModoRecuperacion(!modoRecuperacion); setError(null); }}
            className="text-blue-300 hover:text-blue-200 text-sm underline"
          >
            {modoRecuperacion ? 'Usar código de la app de autenticación' : 'Usar código de recuperación'}
          </button>
          <button
            type="button"
            onClick={onVolver}
            className="text-slate-400 hover:text-slate-300 text-sm"
          >
            Volver al login
          </button>
        </div>
      </div>
    </div>
  );
};

export default TwoFactorLoginStep;
