import { useEffect, useRef, useState } from 'react'

// Wrap a block in <Reveal> and it fades and slides up smoothly the first time it scrolls into view.
// "delay" (in milliseconds) lets several blocks appear one after another.
// If the browser cannot observe scrolling, the content is simply shown.
export default function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    const element = ref.current
    if (!element || visible) return
    // Already on screen when the page opens: show it straight away
    const rect = element.getBoundingClientRect()
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true)
          observer.disconnect() // animate only once
        }
      },
      { threshold: 0.12 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [visible])

  return (
    <div
      ref={ref}
      style={{ transitionDelay: visible ? `${delay}ms` : '0ms' }}
      className={`reveal ${visible ? 'reveal-visible' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
