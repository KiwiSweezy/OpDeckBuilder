import { ref, onMounted, onUnmounted, readonly } from 'vue'

const MOBILE_BREAKPOINT = 768

const isMobile = ref(false)
let listenerCount = 0
let mediaQuery: MediaQueryList | null = null

function update(e: MediaQueryListEvent | MediaQueryList) {
  isMobile.value = e.matches
}

/** Reactive flag: true when viewport is below the mobile breakpoint.
 *  Singleton pattern — adds a single resize listener regardless of caller count. */
export function useBreakpoint() {
  onMounted(() => {
    if (listenerCount === 0) {
      mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
      isMobile.value = mediaQuery.matches
      mediaQuery.addEventListener('change', update)
    }
    listenerCount++
  })

  onUnmounted(() => {
    listenerCount--
    if (listenerCount === 0 && mediaQuery) {
      mediaQuery.removeEventListener('change', update)
      mediaQuery = null
    }
  })

  return { isMobile: readonly(isMobile) }
}
