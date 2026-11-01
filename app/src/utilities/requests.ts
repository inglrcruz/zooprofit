import { API_BASE_URL } from '@/constants/config'
import { useGlobalStore } from '@/stores/global.store'
import axios from 'axios'

// Without a limit, a request on a dead signal hangs instead of failing.
axios.defaults.timeout = 15000

/**
 * Request to perform POST
 * 
 * @param {string} route 
 * @param {object} params 
 * @returns {Promise<any>}
 */
export const postRequest = (route: string, params: object, token: string = ""): Promise<any> => {
    if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    return axios.post(API_BASE_URL + route, params)
}

/**
 * Request to perform PATCH
 * 
 * @param {string} route 
 * @param {object} params 
 * @returns {Promise<any>}
 */
export const patchRequest = (route: string, params: object, token: string = ""): Promise<any> => {
    if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    return axios.patch(API_BASE_URL + route, params)
}

/**
 * Request to perform PUT
 * 
 * @param {string} route 
 * @param {object} params 
 * @returns {Promise<any>}
 */
export const putRequest = (route: string, params: object, token: string = ""): Promise<any> => {
    if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    return axios.put(API_BASE_URL + route, params)
}

/**
 * Request to perform GET
 * 
 * @param {string} route 
 * @returns {Promise<any>}
 */
export const getRequest = (route: string, token: string = ""): Promise<any> => {
    if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    return axios.get(API_BASE_URL + route)
}

/**
 * Request to perform DELETE
 * 
 * @param {string} route
 * @returns {Promise<any>}
 */
export const removeRequest = (route: string, token: string = ""): Promise<any> => {
    if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    return axios.delete(API_BASE_URL + route)
}

/**
 * Builds a query string from a params object, skipping empty/undefined/'all' values.
 *
 * @param {Record<string, any>} params
 * @returns {string}
 */
export const buildQuery = (params: Record<string, any>): string => {
    const query = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== 'all')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    return query ? `?${query}` : ''
}

/**
 * True when the API rejected the session itself (expired or missing token),
 * as opposed to a failed sign-in, which is also a 401.
 *
 * @param {any} error
 * @returns {boolean}
 */
export const isSessionExpired = (error: any): boolean => {
    const { response, config } = error ?? {}
    return response?.status === 401 && !String(config?.url ?? '').includes('/auth/')
}

/**
 * Message to show for a failed request: the API's own, or a network one.
 *
 * @param {any} error
 * @returns {string}
 */
export const errorMessage = (error: any): string => {
    const { response } = error ?? {}
    if (!response) return 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.'
    if (response.status === 429) return response.data?.error ?? 'Demasiados intentos, espera un momento.'
    return response.data?.error ?? 'Ocurrió un error inesperado.'
}

/**
 * Handles errors by triggering an alert.
 *
 * @param {any} error - The error object, typically containing a response property.
 */
export const errorResponse = (error: any) => {
    // Session expiry is handled globally by the auth store's axios
    // interceptor, which shows its own alert and redirects.
    if (isSessionExpired(error)) return
    useGlobalStore.getState().showAlert({
        title: 'Ups, algo salió mal',
        message: errorMessage(error),
        type: 'error'
    })
}
