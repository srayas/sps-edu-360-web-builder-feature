import React from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@spsedu360/shared-ui/src/components/atoms/button'

export default function SitePage() {
  return (
    <main className="flex flex-col items-start gap-4 py-6">
      <h1 className="text-2xl font-semibold">Website Builder</h1>
      <Button asChild>
        <Link href="/builder/demo">
          Open Builder
          <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
    </main>
  )
}
