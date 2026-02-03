"use client"

import { Suspense } from "react"
import { CreatePasswordForm } from "./create-password-form"

export default function CreatePasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>}>
      <CreatePasswordForm />
    </Suspense>
  )
}
