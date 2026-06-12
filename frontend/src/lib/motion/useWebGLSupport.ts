import { useState } from 'react'

export interface WebGLSupport {
  supported: boolean
  contextType: 'webgl2' | 'webgl' | null
}

export function detectWebGLSupport(): WebGLSupport {
  if (typeof document === 'undefined') {
    return { supported: false, contextType: null }
  }

  const canvas = document.createElement('canvas')
  const webgl2 = canvas.getContext('webgl2')
  if (webgl2) {
    return { supported: true, contextType: 'webgl2' }
  }

  const webgl = canvas.getContext('webgl')
  if (webgl) {
    return { supported: true, contextType: 'webgl' }
  }

  return { supported: false, contextType: null }
}

export function useWebGLSupport(): WebGLSupport {
  const [support] = useState<WebGLSupport>(detectWebGLSupport)
  return support
}
