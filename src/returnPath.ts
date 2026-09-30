const home = '/home'

// Only same-app paths may come back through the login redirect.
export function returnPath(value: string | null | undefined): string {
  if (value == null || value === '') return home
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return home
  if (value.includes('\\') || value.includes('://')) return home
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code <= 31 || code === 127) return home
  }
  const cut = value.search(/[?#]/)
  const path = cut === -1 ? value : value.slice(0, cut)
  if (path === '/login' || path.startsWith('/login/')) return home
  if (path.split('/').includes('..')) return home
  return value
}

export function loginHref(here: string): string {
  return `/login?next=${encodeURIComponent(returnPath(here))}`
}
