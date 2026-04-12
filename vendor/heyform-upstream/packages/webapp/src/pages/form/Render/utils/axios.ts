import axiosStatic, { AxiosInstance, AxiosRequestConfig } from 'axios'

import { helper } from '@heyform-inc/utils'

import { getDeviceId, setDeviceId } from '@/utils'

let instance: AxiosInstance

function getInstance() {
  if (!instance) {
    instance = axiosStatic.create({
      timeout: 30_000
    })

    instance.interceptors.response.use(
      function (response) {
        if (helper.isValidArray(response.data?.errors)) {
          return Promise.reject(new Error(response.data!.errors[0].message))
        }
        return response.data.data
      },
      function (error) {
        return Promise.reject(error)
      }
    )
  }
  return instance
}

export function getAnonymousId(): string {
  let id = getDeviceId()

  if (helper.isEmpty(id)) {
    setDeviceId()
    id = getDeviceId()
  }

  return id!
}

export function axios(data: Record<string, Any> | FormData): Promise<Any> {
  const config: AxiosRequestConfig = {
    method: 'POST',
    url: '/graphql',
    headers: {
      'X-Anonymous-ID': getAnonymousId()
    },
    data
  }

  if (!helper.isFormData(data)) {
    config.headers = {
      ...config.headers,
      'Content-Type': 'application/json'
    }
  }

  return getInstance()(config)
}
