import Image from 'next/image';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  className?: string;
  /** Tamanho visual do mark (px). */
  size?: number;
  priority?: boolean;
}

/** Mark casa + pet + cifrão — assets em `/public/brand`. */
export function BrandLogo({
  className,
  size = 36,
  priority = false,
}: BrandLogoProps): React.ReactElement {
  return (
    <Image
      src="/brand/logo.png"
      alt="Time is Money"
      width={size}
      height={Math.round(size * 0.95)}
      priority={priority}
      className={cn('shrink-0 object-contain', className)}
    />
  );
}
