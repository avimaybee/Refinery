import React, { useRef, useState, useEffect } from 'react'

interface Todo {
  id: number
  text: string
  description?: string
  dueDate?: string
  priority?: 'high' | 'medium' | 'low'
}

interface Props {
  todo: Todo
  onDelete: (id: number) => void
  onComplete: (id: number) => void
}

const priorityColor = (p?: string) => {
  if (p === 'high') return 'bg-red-500'
  if (p === 'medium') return 'bg-orange-400'
  return 'bg-blue-400'
}

const formatDate = (d?: string) => {
  if (!d) return ''
  try {
    const dt = new Date(d)
    const mm = String(dt.getMonth() + 1).padStart(2, '0')
    const dd = String(dt.getDate()).padStart(2, '0')
    const yy = String(dt.getFullYear())
    return `${mm}/${dd}/${yy}`
  } catch {
    return d
  }
}

const truncate = (s?: string, n = 120) => {
  if (!s) return ''
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

const SwipeableCard: React.FC<Props> = ({ todo, onDelete, onComplete }) => {
  const ref = useRef<HTMLDivElement | null>(null)
  const startX = useRef(0)
  const currentX = useRef(0)
  const dragging = useRef(false)
  const [offset, setOffset] = useState(0)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    currentX.current = 0
    setOffset(0)
  }, [todo.id])

  const handleStart = (clientX: number) => {
    dragging.current = true
    startX.current = clientX
    setAnimating(false)
  }

  const handleMove = (clientX: number) => {
    if (!dragging.current || !ref.current) return
    const dx = clientX - startX.current
    currentX.current = dx
    // limit small vertical accidental moves not handled here
    setOffset(dx)
  }

  const handleEnd = () => {
    if (!ref.current) return
    dragging.current = false
    const width = ref.current.offsetWidth
    const threshold = width * 0.35
    const dx = currentX.current
    const abs = Math.abs(dx)
    if (abs >= threshold) {
      const toRight = dx > 0
      const off = (toRight ? width : -width) - (toRight ? 20 : -20)
      setAnimating(true)
      setOffset(off)
      // give animation time then call action
      setTimeout(() => {
        if (toRight) {
          // complete
          try { navigator.vibrate?.(10) } catch {}
          onComplete(todo.id)
        } else {
          try { navigator.vibrate?.(10) } catch {}
          onDelete(todo.id)
        }
      }, 220)
    } else {
      // snap back
      setAnimating(true)
      setOffset(0)
      setTimeout(() => setAnimating(false), 220)
    }
    currentX.current = 0
  }

  // Pointer events
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const onPointerDown = (e: PointerEvent) => {
      (e.target as Element).setPointerCapture?.(e.pointerId)
      handleStart(e.clientX)
    }
    const onPointerMove = (e: PointerEvent) => handleMove(e.clientX)
    const onPointerUp = (_e: PointerEvent) => handleEnd()
    node.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      node.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [ref.current])

  // Touch handlers fallback (some browsers still use pointer but keep for safety)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const onTouchStart = (e: TouchEvent) => handleStart(e.touches[0].clientX)
    const onTouchMove = (e: TouchEvent) => handleMove(e.touches[0].clientX)
    const onTouchEnd = () => handleEnd()
    node.addEventListener('touchstart', onTouchStart)
    window.addEventListener('touchmove', onTouchMove)
    window.addEventListener('touchend', onTouchEnd)
    return () => {
      node.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [ref.current])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      setAnimating(true)
      setOffset(-300)
      setTimeout(() => onDelete(todo.id), 180)
    } else if (e.key === 'ArrowRight') {
      setAnimating(true)
      setOffset(300)
      setTimeout(() => onComplete(todo.id), 180)
    }
  }

  const style: React.CSSProperties = {
    transform: `translateX(${offset}px)`,
    transition: animating ? 'transform 220ms ease-out' : undefined,
  }

  return (
    <div className="relative">
      {/* Background actions */}
      <div className="absolute inset-0 rounded-lg overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-between px-6">
          <div className="flex items-center gap-3 text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 opacity-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d=""/></svg>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden" />
          </div>
        </div>
      </div>

      {/* Red left / green right reveal layers */}
      <div className="absolute inset-0 rounded-lg pointer-events-none">
        <div className="absolute left-0 top-0 bottom-0 w-full flex items-center">
          <div className="w-full h-full flex items-center justify-start px-6" style={{ background: '#FF4D4D', borderRadius: 10 }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="white"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22"/></svg>
          </div>
        </div>
        <div className="absolute left-0 top-0 bottom-0 w-full flex items-center">
          <div className="w-full h-full flex items-center justify-end px-6" style={{ background: '#52C41A', borderRadius: 10 }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="white"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
          </div>
        </div>
      </div>

      <div
        ref={ref}
        role="article"
        tabIndex={0}
        aria-label={`Task: ${todo.text}. Press left to delete, right to complete.`}
        onKeyDown={handleKeyDown}
        style={style}
        className="relative bg-white rounded-lg shadow-md p-4 mb-3 touch-pan-y"
      >
        <div className="flex items-start gap-3">
          <div className={`mt-1 w-3 h-3 rounded-full ${priorityColor(todo.priority)}`} aria-hidden />
          <div className="flex-1">
            <div className="flex justify-between items-start gap-2">
              <h3 className="text-lg font-semibold text-gray-900">{todo.text}</h3>
              <div className="text-sm text-gray-500">{formatDate(todo.dueDate)}</div>
            </div>
            {todo.description ? (
              <p className="mt-2 text-sm text-gray-600">{truncate(todo.description, 140)}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SwipeableCard
