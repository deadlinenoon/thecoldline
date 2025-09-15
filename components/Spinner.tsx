import React from 'react';

export function Spinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  const s = `${size}px`;
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-gray-400 border-t-transparent ${className}`}
      style={{ width: s, height: s }}
      aria-label="Loading"
      role="status"
    />
  );
}

export default Spinner;

