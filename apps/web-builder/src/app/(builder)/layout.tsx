import ClientBuilderLayout from '@/app/components/wrapper-components/client-builder-layout'
import '@spsedu360/shared-ui/src/css/global.css'
import { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import React from 'react'

interface BuilderLayoutProps {
  children: React.ReactNode
}

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

const BuilderLayout = ({ children }: BuilderLayoutProps) => {
  return (
      <html lang="en" suppressHydrationWarning className="overflow-hidden">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased overflow-hidden`}
          suppressHydrationWarning
        >
          <ClientBuilderLayout>{children}</ClientBuilderLayout>
        </body>
      </html>
  )
}

export default BuilderLayout
