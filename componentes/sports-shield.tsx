"use client";

import { useId } from "react";

export function SportsLaurels() {
  return <g fill="currentColor">
    {[false, true].map(mirror => <g key={String(mirror)} transform={mirror ? "translate(160 0) scale(-1 1)" : undefined}>
      <path d="M78 108C49 106 24 86 15 54" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M19 70C8 64 9 54 10 47c6 6 10 14 9 23ZM25 83C13 81 7 74 5 67c8 1 17 8 20 16ZM34 93C22 94 13 89 9 82c10 0 18 4 25 11ZM48 102C35 107 25 102 20 97c11-3 20 0 28 5ZM62 107C50 115 39 111 33 107c10-5 20-4 29 0ZM22 77c-2-10 1-16 6-20 2 9 0 16-6 20ZM31 88c-2-11 2-18 6-21 3 9 0 17-6 21ZM43 98c-2-10 3-17 9-20 1 8-2 15-9 20ZM56 104c1-9 6-13 13-14-1 8-6 13-13 14Z"/>
    </g>)}
  </g>;
}

export function SportsShield({ reward = false }: { reward?: boolean }) {
  const rim = useId();
  const face = useId();
  const glint = useId();

  return <svg aria-hidden="true" viewBox="0 0 160 118" className="sports-shield">
    <defs>
      <linearGradient id={rim} x1="0" y1="0" x2=".85" y2="1">
        <stop stopColor="#a96005"/><stop offset=".25" stopColor="#fff4b7"/><stop offset=".43" stopColor="#ffd75a"/><stop offset=".63" stopColor="#a75c04"/><stop offset=".79" stopColor="#ffcb3e"/><stop offset="1" stopColor="#fff6b7"/>
      </linearGradient>
      <linearGradient id={face} x2="1" y2="1"><stop stopColor="#8a550a"/><stop offset=".38" stopColor="#332008"/><stop offset=".8" stopColor="#0f0b06"/><stop offset="1" stopColor="#6c4105"/></linearGradient>
      <radialGradient id={glint}><stop stopColor="#ffd340" stopOpacity=".55"/><stop offset="1" stopColor="#c77700" stopOpacity="0"/></radialGradient>
    </defs>
    <ellipse cx="80" cy="61" rx="78" ry="55" fill={`url(#${glint})`}/>
    <g className="sports-shield-laurels"><SportsLaurels /></g>
    <path d="M80 6Q58 23 29 26l3 26c3 23 20 43 48 59 28-16 45-36 48-59l3-26Q102 23 80 6Z" fill={`url(#${face})`} stroke={`url(#${rim})`} strokeWidth="4"/>
    <path d="M80 13Q59 28 37 31l3 21c3 19 17 36 40 51 23-15 37-32 40-51l3-21Q101 28 80 13Z" fill="none" stroke={`url(#${rim})`} strokeWidth="1.6"/>
    {reward
      ? <path d="M66 42h28v8h10v5c0 9-6 14-13 15-2 4-5 7-9 8v7h10v5H68v-5h10v-7c-4-1-7-4-9-8-7-1-13-6-13-15v-5h10Zm0 12h-6c0 6 3 10 8 11Zm28 0-2 11c5-1 8-5 8-11Z" fill={`url(#${rim})`}/>
      : <g>
        <path d="m80 30 7.5 18 20 1.8-15.2 13 4.5 20L80 72.2 63.2 83l4.5-20-15.2-13 20-2Z" fill={`url(#${rim})`} stroke="#ffda71" strokeWidth=".6"/>
        <path d="m80 30 .1 27 7.4-9Zm27.5 19.8L80 57l12.3 5.8ZM96.8 83 80 57l.1 15.2ZM63.2 83 80 57l-12.3 6Zm-10.7-33L80 57l-7.5-9Z" fill="#ffe799" opacity=".72"/>
      </g>}
  </svg>;
}
