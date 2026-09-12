import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPhoneNumber(phone?: string | null) {
  if (!phone) return ''

  const digits = phone.replace(/\D/g, '')
  const normalized = digits.length === 11 && digits.startsWith('1')
    ? digits.slice(1)
    : digits

  if (normalized.length !== 10) {
    return phone
  }

  return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}`
}

/**
 * Props that make a non-button element behave like one for a keyboard user.
 *
 * There are ~17 clickable `<div>`s in this app (calendar cells, candidate
 * cards, row targets) that a mouse can reach and a keyboard cannot. Wrapping
 * each in a real <button> would fight the layout in most of them, so this gives
 * them the three things a button gets for free: focusability, an announced
 * role, and Enter/Space activation.
 *
 * Spread it LAST so an explicit role or tabIndex on the element still wins:
 *   <div {...clickable(() => select(day))} className="...">
 */
export function clickable(onActivate: () => void, opts?: { disabled?: boolean; label?: string }) {
  if (opts?.disabled) {
    return { 'aria-disabled': true as const }
  }
  return {
    role: 'button' as const,
    tabIndex: 0,
    ...(opts?.label ? { 'aria-label': opts.label } : {}),
    onClick: onActivate,
    onKeyDown: (e: import('react').KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onActivate()
      }
    },
  }
}
