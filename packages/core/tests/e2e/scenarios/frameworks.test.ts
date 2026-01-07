import path from 'path';
import fs from 'fs';
import { describe, it, expect } from 'vitest';
import { createTestSandbox, runRiflebird } from '../e2e-utils';

describe('End-to-End Framework Support', () => {
  it('should generate stories for a React project', () => {
    const sandbox = createTestSandbox('react/simple');

    try {
      // Run riflebird fire command
      const { stderr, exitCode } = runRiflebird(['fire', '--all'], sandbox.cwd);

      expect(exitCode).toBe(0);
      expect(stderr).toContain('Tests generated successfully');

      // Check if story file was created in stories subdir
      const storyFile = path.join(sandbox.cwd, 'src/stories/Button.stories.tsx');
      const storyFileAdjacent = path.join(sandbox.cwd, 'src/Button.stories.tsx');

      expect(fs.existsSync(storyFile) || fs.existsSync(storyFileAdjacent)).toBe(true);
    } finally {
      sandbox.cleanup();
    }
  });

  it('should generate stories for a Vue project', () => {
    const sandbox = createTestSandbox('vue/simple');

    try {
      const { stderr, exitCode } = runRiflebird(['fire', '--all'], sandbox.cwd);

      expect(exitCode).toBe(0);
      expect(stderr).toContain('Tests generated successfully');

      // Check for Vue output in stories subdir or adjacent
      const storyFile = path.join(sandbox.cwd, 'src/components/stories/HelloWorld.stories.vue');
      const storyFileTs = path.join(sandbox.cwd, 'src/components/stories/HelloWorld.stories.ts');
      const storyFileAdj = path.join(sandbox.cwd, 'src/components/HelloWorld.stories.vue');
      const storyFileAdjTs = path.join(sandbox.cwd, 'src/components/HelloWorld.stories.ts');

      const exists =
        fs.existsSync(storyFile) ||
        fs.existsSync(storyFileTs) ||
        fs.existsSync(storyFileAdj) ||
        fs.existsSync(storyFileAdjTs);

      expect(exists).toBe(true);
    } finally {
      sandbox.cleanup();
    }
  });

  it('should generate stories for a Next.js project', () => {
    const sandbox = createTestSandbox('react/next.js');

    try {
      const { stderr, exitCode } = runRiflebird(['fire', '--all'], sandbox.cwd);

      expect(exitCode).toBe(0);
      expect(stderr).toContain('Tests generated successfully');

      // Check for Header component story
      const storyFile = path.join(sandbox.cwd, 'src/components/stories/Header.stories.tsx');
      const storyFileAdj = path.join(sandbox.cwd, 'src/components/Header.stories.tsx');

      expect(fs.existsSync(storyFile) || fs.existsSync(storyFileAdj)).toBe(true);
    } finally {
      sandbox.cleanup();
    }
  });
});
