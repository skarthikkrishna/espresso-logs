import { defineConfig, devices } from '@playwright/test';
import baseConfig from './playwright.config';

const viewports = [
  { label: '375', width: 375, height: 812 },
  { label: '768', width: 768, height: 1024 },
  { label: '1280', width: 1280, height: 720 },
] as const;

export default defineConfig({
  ...baseConfig,
  reporter: [
    ['json', { outputFile: 'baselines/baseline-regression-results.json' }],
    ['list'],
  ],
  use: {
    ...baseConfig.use,
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  },
  projects: viewports.flatMap(({ label, width, height }) => [
    {
      name: `chromium-${label}`,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width, height },
      },
    },
    {
      name: `webkit-${label}`,
      use: {
        ...devices['Desktop Safari'],
        viewport: { width, height },
      },
    },
  ]),
});
