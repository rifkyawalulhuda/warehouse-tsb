import axios, { type AxiosError, type AxiosRequestConfig } from 'axios'

/** Semua respons API dibungkus `{ data: ... }`. */
type Envelope<T> = { data: T }

export type ApiErrorBody = {
  error: { code: string; message: string; details?: unknown }
}

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

/** Pesan error yang aman ditampilkan ke pengguna. */
export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.error?.message ?? error.message
  }
  if (error instanceof Error) return error.message
  return 'Terjadi kesalahan yang tidak diketahui'
}

export function apiErrorCode(error: unknown): string | null {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.error?.code ?? null
  }
  return null
}

export function isUnauthorized(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 401
}

/* ------------------------------------------------------------------ */
/* Refresh token                                                       */
/* ------------------------------------------------------------------ */

let refreshing: Promise<boolean> | null = null

/**
 * Access token hanya berumur 15 menit. Saat satu request gagal 401, kita coba
 * perpanjang sesi sekali; permintaan lain yang gagal bersamaan menunggu
 * promise yang sama supaya tidak membanjiri endpoint refresh.
 */
export async function refreshSession(): Promise<boolean> {
  refreshing ??= axios
    .post<Envelope<unknown>>('/api/auth/refresh', null, {
      withCredentials: true,
    })
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      refreshing = null
    })

  return refreshing
}

type RetriableConfig = AxiosRequestConfig & { _retried?: boolean }

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined
    const url = config?.url ?? ''
    const isAuthCall =
      url.includes('/auth/login') || url.includes('/auth/refresh')

    if (
      error.response?.status !== 401 ||
      !config ||
      config._retried ||
      isAuthCall
    ) {
      return Promise.reject(error)
    }

    config._retried = true
    const ok = await refreshSession()
    if (!ok) return Promise.reject(error)
    return api.request(config)
  }
)

/* ------------------------------------------------------------------ */
/* Helper                                                              */
/* ------------------------------------------------------------------ */

export async function getData<T>(url: string, config?: AxiosRequestConfig) {
  const { data } = await api.get<Envelope<T>>(url, config)
  return data.data
}

export async function postData<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig
) {
  const { data } = await api.post<Envelope<T>>(url, body, config)
  return data.data
}

export async function patchData<T>(url: string, body?: unknown) {
  const { data } = await api.patch<Envelope<T>>(url, body)
  return data.data
}

export async function putData<T>(url: string, body?: unknown) {
  const { data } = await api.put<Envelope<T>>(url, body)
  return data.data
}

export async function deleteData<T>(url: string) {
  const { data } = await api.delete<Envelope<T>>(url)
  return data.data
}
