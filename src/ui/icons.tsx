// Small hand-drawn icon set (original artwork; see ATTRIBUTION.md) replacing the Material
// Symbols Outlined glyphs used in the Stitch reference designs, so we never self-host or link a
// third-party icon font for ~13 glyphs. Same 24x24 filled-path convention as the existing
// transport icons.
import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...rest}>
      {children}
    </svg>
  );
}

export function PlayIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M7 4v16l13-8z" fill="currentColor" />
    </Icon>
  );
}

export function PauseIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor" />
    </Icon>
  );
}

export function PrevIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M6 5h2v14H6zM20 5v14L9 12z" fill="currentColor" />
    </Icon>
  );
}

export function NextIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M16 5h2v14h-2zM4 5v14l11-7z" fill="currentColor" />
    </Icon>
  );
}

export function VolumeIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M4 9v6h4l5 5V4L8 9zM16.5 12c0-1.5-.8-2.8-2-3.4v6.8c1.2-.6 2-1.9 2-3.4z" fill="currentColor" />
    </Icon>
  );
}

export function MuteIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M4 9v6h4l5 5V4L8 9zM19 9l-4 4m0-4 4 4" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" fill="none" />
    </Icon>
  );
}

export function PersonIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="8" r="3.4" fill="currentColor" />
      <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" fill="currentColor" />
    </Icon>
  );
}

export function ChevronDownIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Icon>
  );
}

export function BackIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M11 5l-7 7 7 7M4 12h16" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Icon>
  );
}

export function HearingIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path
        d="M17 7a6 6 0 1 0-10.6 4L7 13v3a3 3 0 0 0 3 3h0a3 3 0 0 0 3-3v-1"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        fill="none"
      />
      <path d="M13 9.5a2 2 0 1 0-2.5 2" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" fill="none" />
    </Icon>
  );
}

export function InfoIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={1.7} fill="none" />
      <circle cx="12" cy="8" r="1.1" fill="currentColor" />
      <path d="M12 11v6" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </Icon>
  );
}

export function CloseIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" fill="none" />
    </Icon>
  );
}

export function SearchIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="10.5" cy="10.5" r="6" stroke="currentColor" strokeWidth={1.7} fill="none" />
      <path d="M15 15l5 5" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </Icon>
  );
}
