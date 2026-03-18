import * as React from "react"
import { cn } from "@/lib/utils"

function getInitials(name) {
  if (!name) return "?"
  const parts = name.split(" ")
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

const colors = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-red-500",
  "bg-yellow-500",
  "bg-teal-500",
]

function getColorFromName(name) {
  if (!name) return colors[0]
  const charCode = name.charCodeAt(0) + (name.length > 1 ? name.charCodeAt(1) : 0)
  return colors[charCode % colors.length]
}

const Avatar = React.forwardRef(({ className, name, ...props }, ref) => {
  const [src, setSrc] = React.useState(props.src)
  const initials = getInitials(name || props.alt)
  const bgColor = getColorFromName(name || props.alt)

  React.useEffect(() => {
    setSrc(props.src)
  }, [props.src])

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    >
      {src ? (
        <img
          className="aspect-square h-full w-full object-cover"
          src={src}
          alt={name || "Avatar"}
          onError={() => setSrc(null)}
        />
      ) : (
        <div className={cn("flex h-full w-full items-center justify-center text-sm font-medium text-white", bgColor)}>
          {initials}
        </div>
      )}
    </div>
  )
})
Avatar.displayName = "Avatar"

const AvatarFallback = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium",
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = "AvatarFallback"

export { Avatar, AvatarFallback }
