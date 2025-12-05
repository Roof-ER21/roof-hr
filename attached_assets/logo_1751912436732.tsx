
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

const sizeClasses = {
  sm: 'h-8 w-auto',
  md: 'h-12 w-auto',
  lg: 'h-16 w-auto',
  xl: 'h-24 w-auto'
};

export function Logo({ className, size = 'md', showText = true }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Image
        src="/roof-er-logo.png"
        alt="Roof-ER Logo"
        width={100}
        height={100}
        className={cn(sizeClasses[size], 'object-contain')}
        priority
      />
      {showText && (
        <div className="flex flex-col">
          <span className="font-bold text-xl text-secondary-950">Roof-ER</span>
          <span className="text-sm text-secondary-600 font-medium">THE ROOF DOCS</span>
        </div>
      )}
    </div>
  );
}
