interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ size = 'md' }: LogoProps) {
  const sizeClasses = {
    sm: 'h-10',
    md: 'h-12',
    lg: 'h-16'
  };

  return (
    <div className="flex items-center">
      <img 
        src="/roofer-logo.png" 
        alt="ROOFER - The Roof Docs" 
        className={`${sizeClasses[size]} w-auto`}
      />
    </div>
  );
}