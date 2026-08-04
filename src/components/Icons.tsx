import type { ReactNode, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { children?: ReactNode }

const Icon = ({ children, ...props }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    {children}
  </svg>
)

export const PlayIcon = (props: IconProps) => (
  <Icon {...props}><path d="m8 5 11 7-11 7Z" /></Icon>
)

export const PauseIcon = (props: IconProps) => (
  <Icon {...props}><path d="M9 5v14M15 5v14" /></Icon>
)

export const RewindIcon = (props: IconProps) => (
  <Icon {...props}><path d="m11 7-5 5 5 5v-4.8c4.5-.7 6.5 1.5 7 4.8.9-5.7-1.8-8.5-7-8.1Z" /></Icon>
)

export const VolumeIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M11 5 6.5 9H3v6h3.5l4.5 4Z" />
    <path d="M15 9.2a4 4 0 0 1 0 5.6M18 6.5a8 8 0 0 1 0 11" />
  </Icon>
)

export const LibraryIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 4v16M9 4v16M14 5.5l3-1 4.5 14-3 1Z" />
  </Icon>
)

export const UploadIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
    <path d="M5 14v5h14v-5" />
  </Icon>
)

export const MusicIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9 18V5l10-2v13" />
    <ellipse cx="6.5" cy="18" rx="2.5" ry="2" />
    <ellipse cx="16.5" cy="16" rx="2.5" ry="2" />
  </Icon>
)

export const YouTubeIcon = (props: IconProps) => (
  <Icon {...props} fill="currentColor" stroke="none">
    <path d="M21.58 7.19a2.87 2.87 0 0 0-2.02-2.03C17.78 4.68 12 4.68 12 4.68s-5.78 0-7.56.48A2.87 2.87 0 0 0 2.42 7.2 30 30 0 0 0 1.94 12c0 1.63.16 3.25.48 4.81a2.87 2.87 0 0 0 2.02 2.03c1.78.48 7.56.48 7.56.48s5.78 0 7.56-.48a2.87 2.87 0 0 0 2.02-2.03c.32-1.56.48-3.18.48-4.81s-.16-3.25-.48-4.81ZM10 15.12V8.88L15.2 12 10 15.12Z" />
  </Icon>
)

export const CloseIcon = (props: IconProps) => (
  <Icon {...props}><path d="m6 6 12 12M18 6 6 18" /></Icon>
)

export const CheckIcon = (props: IconProps) => (
  <Icon {...props}><path d="m5 12 4 4L19 6" /></Icon>
)

export const ChevronDownIcon = (props: IconProps) => (
  <Icon {...props}><path d="m6 9 6 6 6-6" /></Icon>
)

export const ChevronLeftIcon = (props: IconProps) => (
  <Icon {...props}><path d="m15 18-6-6 6-6" /></Icon>
)

export const ChevronRightIcon = (props: IconProps) => (
  <Icon {...props}><path d="m9 6 6 6-6 6" /></Icon>
)

export const FollowIcon = (props: IconProps) => (
  <Icon {...props}><circle cx="12" cy="12" r="7" /><path d="M12 8v8M8 12h8" /></Icon>
)

export const InfoIcon = (props: IconProps) => (
  <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Icon>
)

export const AlertIcon = (props: IconProps) => (
  <Icon {...props}><path d="M12 3 2.5 20h19Z" /><path d="M12 9v4M12 17h.01" /></Icon>
)

export const ArrowLeftIcon = (props: IconProps) => (
  <Icon {...props}><path d="m15 18-6-6 6-6" /></Icon>
)

export const UndoIcon = (props: IconProps) => (
  <Icon {...props}><path d="M9 8H4V3" /><path d="M4.5 8A8 8 0 1 1 4 15" /></Icon>
)

export const DownloadIcon = (props: IconProps) => (
  <Icon {...props}><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14" /></Icon>
)

export const TimerIcon = (props: IconProps) => (
  <Icon {...props}><circle cx="12" cy="13" r="8" /><path d="M9 2h6M12 13l3-2M12 5V2" /></Icon>
)

export const HeartIcon = (props: IconProps) => (
  <Icon {...props}><path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.5a5.5 5.5 0 0 0 0-7.8Z" /></Icon>
)

export const SearchIcon = (props: IconProps) => (
  <Icon {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></Icon>
)

export const PlusIcon = (props: IconProps) => (
  <Icon {...props}><path d="M12 5v14M5 12h14" /></Icon>
)

export const UserIcon = (props: IconProps) => (
  <Icon {...props}><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></Icon>
)

export const BookIcon = (props: IconProps) => (
  <Icon {...props}><path d="M4 4.5A3.5 3.5 0 0 1 7.5 8H12v12H7.5A3.5 3.5 0 0 0 4 23Z" /><path d="M20 4.5A3.5 3.5 0 0 0 16.5 8H12v12h4.5A3.5 3.5 0 0 1 20 23Z" /></Icon>
)
