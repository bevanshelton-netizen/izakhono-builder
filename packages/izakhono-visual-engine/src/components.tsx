import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

export interface GlassSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  intensity?: 'soft' | 'medium' | 'strong';
  children?: ReactNode;
}

export function GlassSurface({ intensity = 'medium', children, style, ...props }: GlassSurfaceProps) {
  return (
    <div
      data-izakhono-visual="glass-surface"
      data-intensity={intensity}
      style={{ ...style, WebkitBackdropFilter: 'blur(24px) saturate(140%)', backdropFilter: 'blur(24px) saturate(140%)' } as CSSProperties}
      {...props}
    >
      {children}
    </div>
  );
}

export const GlassPanel = (props: GlassSurfaceProps) => <GlassSurface {...props} />;
export const GlassButton = (props: GlassSurfaceProps) => <GlassSurface role="button" tabIndex={0} {...props} />;

export interface LiquidBackgroundProps extends HTMLAttributes<HTMLDivElement> {
  animated?: boolean;
}

export function LiquidBackground({ animated = true, children, className, ...props }: LiquidBackgroundProps) {
  return (
    <div
      data-izakhono-visual="liquid-background"
      data-animated={animated}
      className={className}
      {...props}
    >
      <div aria-hidden="true" className="iz-liquid-orb iz-liquid-orb-a" />
      <div aria-hidden="true" className="iz-liquid-orb iz-liquid-orb-b" />
      {children}
    </div>
  );
}

export function ShaderGradientScene(props: LiquidBackgroundProps) {
  return <LiquidBackground {...props} />;
}

export function LiquidLogo({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div data-izakhono-visual="liquid-logo" className={className} {...props}>
      {children}
    </div>
  );
}

export function DepthCard(props: GlassSurfaceProps) {
  return <GlassSurface data-izakhono-visual="depth-card" {...props} />;
}

export function MotionReveal({ children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-izakhono-visual="motion-reveal" {...props}>{children}</div>;
}

export function ReducedMotionBoundary({ children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-izakhono-visual="reduced-motion-boundary" {...props}>{children}</div>;
}

export function ThreeScene({ children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-izakhono-visual="three-scene" {...props}>{children}</div>;
}
