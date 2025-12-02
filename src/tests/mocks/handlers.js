import { http, HttpResponse } from 'msw'
import { mockUsers, mockDashboardData, mockScoringData, mockPolizas, mockVehiculos } from '../utils/testUtils'

const API_URL = 'https://ayma-portal-backend.onrender.com'

export const handlers = [
  // Auth endpoints
  http.post(`${API_URL}/api/v1/auth/login`, async ({ request }) => {
    const body = await request.json()
    const { email, password } = body

    // Find matching user
    const user = Object.values(mockUsers).find(u => u.email === email && u.password === password)

    if (user) {
      return HttpResponse.json({
        access_token: user.access_token,
        email: user.email,
        tipo_usuario: user.tipo_usuario
      })
    }

    return HttpResponse.json(
      { detail: 'Email o contraseña incorrectos' },
      { status: 401 }
    )
  }),

  // Dashboard endpoints
  http.get(`${API_URL}/api/v1/dashboard/`, ({ request }) => {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      )
    }

    return HttpResponse.json(mockDashboardData)
  }),

  http.get(`${API_URL}/api/v1/dashboard/scoring`, ({ request }) => {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      )
    }

    return HttpResponse.json(mockScoringData)
  }),

  http.get(`${API_URL}/api/v1/dashboard/actividades`, ({ request }) => {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      )
    }

    return HttpResponse.json([])
  }),

  // Polizas endpoints
  http.get(`${API_URL}/api/v1/polizas/`, ({ request }) => {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      )
    }

    return HttpResponse.json(mockPolizas)
  }),

  http.get(`${API_URL}/api/v1/polizas/:id`, ({ request, params }) => {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      )
    }

    const poliza = mockPolizas.find(p => p.id === parseInt(params.id))

    if (poliza) {
      return HttpResponse.json(poliza)
    }

    return HttpResponse.json(
      { detail: 'Poliza not found' },
      { status: 404 }
    )
  }),

  // Vehiculos endpoints
  http.get(`${API_URL}/api/v1/vehiculos/`, ({ request }) => {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      )
    }

    return HttpResponse.json(mockVehiculos)
  }),

  http.get(`${API_URL}/api/v1/vehiculos/:id`, ({ request, params }) => {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      )
    }

    const vehiculo = mockVehiculos.find(v => v.id === parseInt(params.id))

    if (vehiculo) {
      return HttpResponse.json(vehiculo)
    }

    return HttpResponse.json(
      { detail: 'Vehiculo not found' },
      { status: 404 }
    )
  })
]
