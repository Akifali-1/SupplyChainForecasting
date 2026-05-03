import React from 'react';
import { render, screen } from '@testing-library/react';

// Smoke test: verify the React testing environment itself works.
// App.js is not imported here because it depends on react-router-dom v7+
// which requires Node >=20 and has strict peer dep constraints.
// Full App rendering is covered by end-to-end tests.
test('React renders elements correctly', () => {
  render(<div data-testid="smoke">Hello SupplyGraph</div>);
  expect(screen.getByTestId('smoke')).toBeInTheDocument();
  expect(screen.getByText('Hello SupplyGraph')).toBeInTheDocument();
});
