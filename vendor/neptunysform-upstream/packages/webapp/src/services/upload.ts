import { FileUploadValue } from '@neptunysform-inc/shared-types-enums'
import axios from 'axios'

function normalizeUploadedUrl(url: string) {
  if (!url) {
    return url
  }

  try {
    const parsed = new URL(url)

    if (parsed.pathname.startsWith('/static/upload/')) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`
    }
  } catch {
    if (url.startsWith('/static/upload/')) {
      return url
    }
  }

  return url
}

export class UploadService {
  static async upload(file: File): Promise<FileUploadValue> {
    const formData = new FormData()
    formData.append('file', file)

    const result = await axios.post('/api/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })

    return {
      ...result.data,
      url: normalizeUploadedUrl(result.data.url)
    }
  }
}
