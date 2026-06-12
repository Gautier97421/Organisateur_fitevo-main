"use client"

import { useState } from "react"

interface UserAvatarProps {
  userId?: string | null
  name: string
  size?: "xs" | "sm" | "md" | "lg"
  hasPhoto?: boolean
  className?: string
}

const sizeClasses = {
  xs: "w-6 h-6 text-xs",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function UserAvatar({ userId, name, size = "md", hasPhoto, className = "" }: UserAvatarProps) {
  const [imgError, setImgError] = useState(false)
  const showPhoto = !!userId && hasPhoto !== false && !imgError

  return (
    <div className={`${sizeClasses[size]} rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center bg-gray-500 text-white font-medium ${className}`}>
      {showPhoto ? (
        <img
          src={`/api/users/${userId}/photo`}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        initials(name)
      )}
    </div>
  )
}
