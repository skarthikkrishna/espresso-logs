import '@testing-library/jest-dom'

// crypto.randomUUID polyfill — jsdom does not implement it in all environments.
// configurable + writable are both required so vi.spyOn / mockReturnValueOnce work.
if (typeof crypto.randomUUID === 'undefined') {
  Object.defineProperty(crypto, 'randomUUID', {
    value: () => '00000000-0000-4000-8000-000000000000',
    configurable: true,   // required for vi.spyOn
    writable: true,       // required for vi.mockReturnValueOnce
  })
}
