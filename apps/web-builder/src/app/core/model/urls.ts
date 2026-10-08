/**
 * URL allow-listing for anything a user can type into the builder.
 * Media URLs may be http(s) or same-origin paths; links may additionally be anchors,
 * mailto: and tel:. Everything else (javascript:, data:, protocol-relative…) is dropped.
 */
export function safeUrl(value: unknown, media = false): string {
  const trimmed = String(value ?? '').trim()
  if (!trimmed || trimmed.length > 4000) return ''
  if (/^(https?:\/\/|\/(?!\/)|\.\.?\/)/i.test(trimmed)) return trimmed
  if (!media && /^(#|mailto:|tel:)/i.test(trimmed)) return trimmed
  return ''
}

/** Endpoints a form may submit to: https, or same-origin paths. */
export function safeEndpoint(value: unknown): string {
  const trimmed = String(value ?? '').trim()
  return /^(https:\/\/|\/(?!\/))/i.test(trimmed) && trimmed.length <= 2000
    ? trimmed
    : ''
}
