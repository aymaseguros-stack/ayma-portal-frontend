import { describe, it, expect, beforeEach, vi } from 'vitest'
import { dashboardService, polizasService, vehiculosService } from '../api'
import { mockDashboardData, mockScoringData, mockPolizas, mockVehiculos } from '../../tests/utils/testUtils'

describe('API Services', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('API Interceptor', () => {
    it('should add Bearer token to requests when token exists', async () => {
      localStorage.setItem('token', 'test-token-123')

      const data = await dashboardService.getResumen()

      expect(data).toEqual(mockDashboardData)
    })

    it('should make request without token when token does not exist', async () => {
      localStorage.removeItem('token')

      // This should still work with our mock server
      await expect(dashboardService.getResumen()).rejects.toThrow()
    })
  })

  describe('dashboardService', () => {
    beforeEach(() => {
      localStorage.setItem('token', 'test-token')
    })

    it('should get dashboard resumen', async () => {
      const data = await dashboardService.getResumen()

      expect(data).toEqual(mockDashboardData)
      expect(data.total_usuarios).toBe(10)
      expect(data.total_clientes).toBe(50)
    })

    it('should get scoring data', async () => {
      const data = await dashboardService.getScoring()

      expect(data).toEqual(mockScoringData)
      expect(data.scoring_total).toBe(85)
    })

    it('should get actividades', async () => {
      const data = await dashboardService.getActividades()

      expect(Array.isArray(data)).toBe(true)
    })

    it('should fail without authentication', async () => {
      localStorage.removeItem('token')

      await expect(dashboardService.getResumen()).rejects.toThrow()
    })
  })

  describe('polizasService', () => {
    beforeEach(() => {
      localStorage.setItem('token', 'test-token')
    })

    it('should list all polizas', async () => {
      const data = await polizasService.listar()

      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBe(2)
      expect(data[0].numero_poliza).toBe('POL-001')
      expect(data[1].numero_poliza).toBe('POL-002')
    })

    it('should get single poliza by id', async () => {
      const data = await polizasService.obtener(1)

      expect(data).toBeDefined()
      expect(data.id).toBe(1)
      expect(data.numero_poliza).toBe('POL-001')
      expect(data.titular_nombre).toBe('Juan')
    })

    it('should return 404 for non-existent poliza', async () => {
      await expect(polizasService.obtener(999)).rejects.toThrow()
    })

    it('should fail without authentication', async () => {
      localStorage.removeItem('token')

      await expect(polizasService.listar()).rejects.toThrow()
    })
  })

  describe('vehiculosService', () => {
    beforeEach(() => {
      localStorage.setItem('token', 'test-token')
    })

    it('should list all vehiculos', async () => {
      const data = await vehiculosService.listar()

      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBe(2)
      expect(data[0].dominio).toBe('ABC123')
      expect(data[1].dominio).toBe('XYZ789')
    })

    it('should get single vehiculo by id', async () => {
      const data = await vehiculosService.obtener(1)

      expect(data).toBeDefined()
      expect(data.id).toBe(1)
      expect(data.descripcion_completa).toBe('Ford Focus 2020')
      expect(data.tiene_poliza_vigente).toBe(true)
    })

    it('should return 404 for non-existent vehiculo', async () => {
      await expect(vehiculosService.obtener(999)).rejects.toThrow()
    })

    it('should fail without authentication', async () => {
      localStorage.removeItem('token')

      await expect(vehiculosService.listar()).rejects.toThrow()
    })
  })

  describe('Data Validation', () => {
    beforeEach(() => {
      localStorage.setItem('token', 'test-token')
    })

    it('should return polizas with required fields', async () => {
      const polizas = await polizasService.listar()

      polizas.forEach(poliza => {
        expect(poliza).toHaveProperty('id')
        expect(poliza).toHaveProperty('numero_poliza')
        expect(poliza).toHaveProperty('compania')
        expect(poliza).toHaveProperty('premio_total')
        expect(poliza).toHaveProperty('fecha_vencimiento')
      })
    })

    it('should return vehiculos with required fields', async () => {
      const vehiculos = await vehiculosService.listar()

      vehiculos.forEach(vehiculo => {
        expect(vehiculo).toHaveProperty('id')
        expect(vehiculo).toHaveProperty('dominio')
        expect(vehiculo).toHaveProperty('descripcion_completa')
        expect(vehiculo).toHaveProperty('anio')
        expect(vehiculo).toHaveProperty('tiene_poliza_vigente')
      })
    })
  })
})
