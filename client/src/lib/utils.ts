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
