'use client'
import BaseLayout from '@spsedu360/shared-ui/src/components/layout/base-layout'
import React from 'react'
type ClientLayoutWrapperProps = {
  children: React.ReactNode
}

const ClientLayoutWrapper = ({ children }: ClientLayoutWrapperProps) => {
  return <BaseLayout>{children}</BaseLayout>
}

export default ClientLayoutWrapper
