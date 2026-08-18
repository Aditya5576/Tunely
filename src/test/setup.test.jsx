import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

function SmokeComponent() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <span data-testid="count">{count}</span>
      <button onClick={() => setCount(c => c + 1)}>Increment</button>
    </div>
  );
}

describe('Frontend Test Infrastructure Smoke Test', () => {
  it('verifies jsdom, React Testing Library, jest-dom, and user-event integration', async () => {
    // 1. Verify jsdom environment
    expect(typeof window).toBe('object');
    expect(typeof document).toBe('object');

    // 2. Verify React Testing Library render
    render(<SmokeComponent />);

    // 3. Verify jest-dom matcher
    const countEl = screen.getByTestId('count');
    const btnEl = screen.getByRole('button', { name: /increment/i });
    expect(countEl).toBeInTheDocument();
    expect(countEl).toHaveTextContent('0');

    // 4. Verify user-event interaction
    await userEvent.click(btnEl);
    expect(countEl).toHaveTextContent('1');
  });
});
