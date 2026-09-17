import { describe, it, expect, vi, afterEach } from 'vitest';
import { extraerRol, esRolAdmin, normalizarRol, ROLES_VALIDOS } from './roles';

afterEach(() => vi.restoreAllMocks());

describe('normalizarRol', () => {
  it('normaliza mayúsculas y espacios', () => {
    expect(normalizarRol(' admin ')).toBe('ADMIN');
  });

  it('quita el prefijo TipoUsuario. que deja str() en Python', () => {
    expect(normalizarRol('TipoUsuario.ADMIN')).toBe('ADMIN');
    expect(normalizarRol('TIPOUSUARIO.EMPLEADO')).toBe('EMPLEADO');
  });

  it('rechaza lo que no es un rol canónico', () => {
    expect(ROLES_VALIDOS).toEqual(['ADMIN', 'EMPLEADO', 'CLIENTE']);
    expect(normalizarRol('ADMINISTRADOR')).toBeNull();
    expect(normalizarRol('7f3a-uuid')).toBeNull();
    expect(normalizarRol(null)).toBeNull();
    expect(normalizarRol(undefined)).toBeNull();
  });
});

describe('extraerRol', () => {
  it('toma la primera fuente válida', () => {
    expect(extraerRol('TipoUsuario.ADMIN', 'CLIENTE')).toBe('ADMIN');
  });

  it('sigue al siguiente fallback si la fuente no es un rol válido', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(extraerRol('[object Object]', 'ADMIN')).toBe('ADMIN');
    expect(warn).toHaveBeenCalled();
  });

  it('avisa por consola cuando no reconoce ningún rol', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(extraerRol('ADMINISTRADOR')).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it('ignora vacíos sin avisar', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(extraerRol(null, undefined, '', 'CLIENTE')).toBe('CLIENTE');
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('esRolAdmin', () => {
  it('solo ADMIN', () => {
    expect(esRolAdmin('ADMIN')).toBe(true);
    expect(esRolAdmin('TipoUsuario.ADMIN')).toBe(true);
    expect(esRolAdmin('EMPLEADO')).toBe(false);
    expect(esRolAdmin(null)).toBe(false);
  });
});
