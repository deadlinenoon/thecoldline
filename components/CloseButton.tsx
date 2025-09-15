import Link from 'next/link';
import React from 'react';

type Props = { href?: string; onClick?: () => void; label?: string };
export default function CloseButton({ href = '/', onClick, label = 'Close' }: Props){
  const base =
    "absolute right-3 top-3 h-8 w-8 rounded-md grid place-items-center border border-cyan-300/50 text-cyan-200 hover:bg-cyan-300/10 focus:outline-none z-50";
  if (onClick) {
    return <button aria-label={label} title={label} className={base} onClick={onClick}><span aria-hidden="true">×</span></button>;
  }
  return (
    <Link href={href} aria-label={label} className={base} title={label}>
      <span aria-hidden="true">×</span>
    </Link>
  );
}

