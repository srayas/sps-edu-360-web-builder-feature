import { NextRequest, NextResponse } from 'next/server'

export default function middleware(req: NextRequest) {
  const url = req.nextUrl
  const searchParams = url.searchParams.toString()
  const pathWithSearchParams = `${url.pathname}${searchParams.length > 0 ? `?${searchParams}` : ''}`
  const domain = process.env.NEXT_PUBLIC_DOMAIN?.split(':')[0]
  const customSubDomain =
    domain && url.hostname.endsWith(`.${domain}`)
      ? url.hostname.slice(0, -(domain.length + 1))
      : undefined

  if (customSubDomain) {
    return NextResponse.rewrite(
      new URL(`/${customSubDomain}${pathWithSearchParams}`, req.url),
    )
  }
  if (
    url.pathname.startsWith('/sign-in') ||
    url.pathname.startsWith('/sign-up') ||
    url.pathname === '/callback'
  ) {
    return NextResponse.redirect(new URL('/site', req.url))
  }
  if (
    url.pathname === '/' ||
    (url.pathname === '/site' && url.host === process.env.NEXT_PUBLIC_DOMAIN)
  ) {
    return NextResponse.rewrite(new URL('/site', req.url))
  }
  if (url.pathname.startsWith('/funnel')) {
    return NextResponse.rewrite(new URL(`${pathWithSearchParams}`, req.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/'],
}
