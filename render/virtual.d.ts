declare module 'virtual:showpoint-presentation' {
  export const Video: React.FC<{content: any}>;
  export const content: {order: string[]; scenes: Record<string, {dur: number}>};
}
