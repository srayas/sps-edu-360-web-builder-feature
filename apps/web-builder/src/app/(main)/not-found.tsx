import { Skeleton } from '@spsedu360/shared-ui/src/components/atoms/skeleton'
import React from 'react'

const NotFoundPage = () => {
  return (
    <div className="w-full  h-full flex justify-center items-center">
      <div className="flex flex-col space-y-3">
        <Skeleton className="h-[125px] w-[250px] rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-[250px]" />
          <Skeleton className="h-4 w-[200px]" />
        </div>
        <div className="space-y-2">
          <span className="mx-2 text-4xl">404</span>
          <span className="mx-2 text-2xl">Page not found</span>
        </div>
      </div>
    </div>
  )
}

export default NotFoundPage
