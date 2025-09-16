export default function ErrorChip({ message }: { message: string }) {
  return (
    <span style={{
      display: 'inline-block',
      background: '#fee2e2',
      color: '#991b1b',
      border: '1px solid #fecaca',
      borderRadius: 6,
      padding: '2px 8px',
      fontSize: 12,
    }}>
      {message}
    </span>
  );
}

