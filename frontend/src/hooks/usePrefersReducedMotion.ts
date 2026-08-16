import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function supportsMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
}

function subscribe(onChange: () => void): () => void {
  if (!supportsMatchMedia()) {
    return () => {}
  }

  const query = window.matchMedia(QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function getSnapshot(): boolean {
  if (!supportsMatchMedia()) {
    return false
  }
  return window.matchMedia(QUERY).matches
}

/*
 * OS 側の「視差効果を減らす」設定を購読する。
 *
 * index.css には同じ条件の @media があるが、あちらは CSS アニメーションしか
 * 止められない。requestAnimationFrame のループや setTimeout の自動送りは
 * JS 側で明示的に止める必要があるので、こちらで値を読む。
 *
 * 購読先はブラウザ（外部ストア）なので、useEffect + useState ではなく
 * useSyncExternalStore を使う。初回描画から正しい値が読めて、
 * 余計な再レンダーも起きない。
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
