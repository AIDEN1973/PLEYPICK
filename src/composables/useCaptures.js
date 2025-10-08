import { ref } from 'vue'

export function useCaptures() {
  const uploading = ref(false)
  const error = ref(null)

  const uploadCapture = async ({ setNum, partId, imageData }) => {
    uploading.value = true
    error.value = null
    try {
      const res = await fetch('/api/captures/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setNum, partId, imageData })
      })
      const json = await res.json()
      if (!res.ok || !json?.success) throw new Error(json?.error || 'upload failed')
      return json
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      uploading.value = false
    }
  }

  const getSetReport = async (setNum) => {
    error.value = null
    try {
      const res = await fetch(`/api/captures/report/${encodeURIComponent(setNum)}`, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' }
      })
      const json = await res.json()
      if (!res.ok || !json?.success) throw new Error(json?.error || 'report failed')
      return json
    } catch (e) {
      error.value = e.message
      throw e
    }
  }

  return { uploading, error, uploadCapture, getSetReport }
}


