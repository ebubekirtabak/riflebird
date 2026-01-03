export type FrameworkConfig = {
  aliases: string[];
  tscArgs: string[];
};

export const FRAMEWORK_CONFIGS: Record<string, FrameworkConfig> = {
  react: {
    aliases: [
      'react',
      'next.js',
      'nextjs',
      'remix',
      'gatsby',
      'vue',
      'nuxt',
      'nuxtjs',
      'svelte',
      'svelte-kit',
      'sveltekit',
      'preact',
      'qwik',
      'qwikcity',
    ],
    tscArgs: ['--jsx', 'react-jsx'],
  },
  angular: {
    aliases: ['angular'],
    tscArgs: ['--experimentalDecorators', '--emitDecoratorMetadata'],
  },
  solid: {
    aliases: ['solid', 'solidjs', 'solid-start'],
    tscArgs: ['--jsx', 'preserve'],
  },
  webcomponents: {
    aliases: ['web-components', 'webcomponents', 'lit', 'lit-html', 'lit-element'],
    tscArgs: [],
  },
};
