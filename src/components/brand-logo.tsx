import Link from 'next/link';

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" aria-label="My Money Maker" className="inline-block leading-none">
      <span className={`block font-black tracking-tight ${compact ? 'text-2xl' : 'text-4xl'} text-clemson-orange`}>
        MY
      </span>
      <span className={`block font-black tracking-tight ${compact ? 'text-2xl' : 'text-4xl'} text-clemson-purple`}>
        MONEY
      </span>
      <span className={`block font-black tracking-tight ${compact ? 'text-2xl' : 'text-4xl'} text-clemson-orange`}>
        MAKER
      </span>
    </Link>
  );
}
