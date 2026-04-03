import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

describe('ErrorBoundary', () => {
  it('shows a fallback UI when a child throws', () => {
    const Bomb = () => {
      throw new Error('boom');
    };

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Unexpected error/i)).toBeInTheDocument();
    expect(screen.getAllByText(/boom/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reload page/i })).toBeInTheDocument();
  });
});

