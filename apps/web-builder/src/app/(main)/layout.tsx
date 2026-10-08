import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import '@spsedu360/shared-ui/src/css/global.css'
import ClientLayoutWrapper from '../components/wrapper-components/client-layout-wrapper'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Web site builder | Srayas P',
  description: 'The App to build and host a web site',
  icons: { icon: '/favicon/favicon.ico' },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
      <html lang="en" suppressHydrationWarning className="overflow-hidden">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased overflow-hidden`}
          suppressHydrationWarning
        >
          <ClientLayoutWrapper>{children}</ClientLayoutWrapper>
        </body>
      </html>
  )
}
