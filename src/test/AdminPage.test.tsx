import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import AdminPage from '../pages/AdminPage';
import type { AuthContextValue } from '../contexts/auth-context';
import { AuthContext } from '../contexts/auth-context';
import type { AdminEvent } from '../lib/adminApi';
import type { ScheduledOrder } from '../pages/AdminPage';

// ── module mocks ────────────────────────────────────────────────────────────

vi.mock('../lib/adminApi', () => ({
  fetchOrders: vi.fn(),
  fetchEvents: vi.fn(),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
  updateOrderFulfillment: vi.fn(),
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

import * as adminApi from '../lib/adminApi';

// ── helpers ─────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10);

function makeSession() {
  return { access_token: 'tok' } as NonNullable<AuthContextValue['session']>;
}

function makeAuthCtx(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    session: makeSession(),
    user: null,
    isAdmin: true,
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  };
}

function renderAdmin(auth: Partial<AuthContextValue> = {}) {
  const ctx = makeAuthCtx(auth);
  return {
    ...render(
      <AuthContext.Provider value={ctx}>
        <AdminPage />
      </AuthContext.Provider>
    ),
    ctx,
  };
}

function makeOrder(overrides: Partial<ScheduledOrder> = {}): ScheduledOrder {
  return {
    id: 'o1',
    eventId: 'e1',
    eventName: 'Westwood – Lunch A',
    eventDate: TODAY,
    eventDateLabel: TODAY,
    lunchSlot: 'A',
    customerName: 'Alice',
    grade: '10',
    main: { id: 'm1', name: 'Chicken', price: 800 },
    side1: null,
    side2: null,
    createdAt: new Date().toISOString(),
    status: 'paid',
    isFulfilled: false,
    ...overrides,
  };
}

function makeEvent(overrides: Partial<AdminEvent> = {}): AdminEvent {
  return {
    id: 'ev1',
    eventDate: TODAY,
    name: 'Westwood High School',
    slot: 'Both',
    dishes: [{ id: 'd1', name: 'Chicken' }],
    ...overrides,
  };
}

// ── tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adminApi.fetchOrders).mockResolvedValue([]);
  vi.mocked(adminApi.fetchEvents).mockResolvedValue([]);
  vi.mocked(adminApi.createEvent).mockResolvedValue(makeEvent());
  vi.mocked(adminApi.updateEvent).mockResolvedValue(makeEvent());
  vi.mocked(adminApi.deleteEvent).mockResolvedValue(undefined);
  vi.mocked(adminApi.updateOrderFulfillment).mockResolvedValue(undefined);
});

describe('AdminPage – auth states', () => {
  it('shows a loading indicator while auth is resolving', () => {
    renderAdmin({ loading: true, session: null });
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders the dashboard heading when authenticated', async () => {
    renderAdmin();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument());
  });

  it('calls signOut when "Sign out" is clicked', async () => {
    const user = userEvent.setup();
    const { ctx } = renderAdmin();
    await waitFor(() => screen.getByRole('button', { name: 'Sign out' }));
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(ctx.signOut).toHaveBeenCalledOnce();
  });
});

describe('AdminPage – tab navigation', () => {
  it('opens on the Orders tab by default', async () => {
    renderAdmin();
    await waitFor(() => expect(screen.getByRole('tab', { name: /Orders/ })).toHaveAttribute('aria-selected', 'true'));
  });

  it('switches to the Events tab on click', async () => {
    const user = userEvent.setup();
    renderAdmin();
    await waitFor(() => screen.getByRole('tab', { name: /Events/ }));
    await user.click(screen.getByRole('tab', { name: /Events/ }));
    expect(screen.getByRole('tab', { name: /Events/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Events' })).toBeInTheDocument();
  });
});

describe('AdminPage – Orders panel', () => {
  it('defaults the date filter to today', async () => {
    renderAdmin();
    await waitFor(() => screen.getByLabelText('Date'));
    const input = screen.getByLabelText('Date') as HTMLInputElement;
    expect(input.value).toBe(TODAY);
  });

  it('shows "No orders match the filters" when no orders returned', async () => {
    renderAdmin();
    await waitFor(() => expect(screen.getByText('No orders match the filters.')).toBeInTheDocument());
  });

  it('renders an order row in the table', async () => {
    vi.mocked(adminApi.fetchOrders).mockResolvedValue([makeOrder()]);
    renderAdmin();
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    expect(screen.getByText('Chicken')).toBeInTheDocument();
    expect(screen.getByText('paid')).toBeInTheDocument();
  });

  it('filters out orders that do not match the selected date', async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.fetchOrders).mockResolvedValue([
      makeOrder({ id: 'o1', customerName: 'Alice', eventDate: TODAY }),
      makeOrder({ id: 'o2', customerName: 'Bob', eventDate: '2025-01-01' }),
    ]);
    renderAdmin();
    await waitFor(() => screen.getByText('Alice'));

    const dateInput = screen.getByLabelText('Date') as HTMLInputElement;
    await user.clear(dateInput);
    await user.type(dateInput, '2025-01-01');

    await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument());
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });

  it('filters orders by lunch slot', async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.fetchOrders).mockResolvedValue([
      makeOrder({ id: 'o1', customerName: 'Alice', lunchSlot: 'A', eventDate: TODAY }),
      makeOrder({ id: 'o2', customerName: 'Bob', lunchSlot: 'B', eventDate: TODAY }),
    ]);
    renderAdmin();
    await waitFor(() => screen.getByText('Alice'));

    await user.selectOptions(screen.getByLabelText('Lunch slot'), 'A');
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();
  });

  it('shows a loading indicator while fetching orders', async () => {
    let resolve!: (v: ScheduledOrder[]) => void;
    vi.mocked(adminApi.fetchOrders).mockReturnValue(new Promise((r) => { resolve = r; }));
    renderAdmin();
    expect(screen.getByText('Loading orders…')).toBeInTheDocument();
    resolve([]);
    await waitFor(() => expect(screen.queryByText('Loading orders…')).not.toBeInTheDocument());
  });

  it('shows an error message when order fetch fails', async () => {
    vi.mocked(adminApi.fetchOrders).mockRejectedValue(new Error('Network error'));
    renderAdmin();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Network error'));
  });
});

describe('AdminPage – Events panel', () => {
  async function openEventsTab() {
    const user = userEvent.setup();
    renderAdmin();
    await waitFor(() => screen.getByRole('tab', { name: /Events/ }));
    await user.click(screen.getByRole('tab', { name: /Events/ }));
    return user;
  }

  it('shows empty state when there are no events', async () => {
    await openEventsTab();
    await waitFor(() =>
      expect(screen.getByText('No events yet. Add one to show on the schedule.')).toBeInTheDocument()
    );
  });

  it('renders event cards from the API', async () => {
    vi.mocked(adminApi.fetchEvents).mockResolvedValue([makeEvent()]);
    await openEventsTab();
    await waitFor(() => expect(screen.getByText('Westwood High School')).toBeInTheDocument());
  });

  it('opens the new-event form when "+ New event" is clicked', async () => {
    const user = await openEventsTab();
    await waitFor(() => screen.getByRole('button', { name: '+ New event' }));
    await user.click(screen.getByRole('button', { name: '+ New event' }));
    expect(screen.getByRole('heading', { name: 'New event' })).toBeInTheDocument();
  });

  it('cancels the form without saving', async () => {
    const user = await openEventsTab();
    await waitFor(() => screen.getByRole('button', { name: '+ New event' }));
    await user.click(screen.getByRole('button', { name: '+ New event' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('heading', { name: 'New event' })).not.toBeInTheDocument();
  });

  it('shows validation error when event name is empty', async () => {
    const user = await openEventsTab();
    await waitFor(() => screen.getByRole('button', { name: '+ New event' }));
    await user.click(screen.getByRole('button', { name: '+ New event' }));

    // Name field starts empty — just click Save immediately
    screen.getByPlaceholderText('e.g. Westwood High School – Lunch A');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Enter an event name')
    );
    expect(adminApi.createEvent).not.toHaveBeenCalled();
  });

  it('shows validation error when no dishes are provided', async () => {
    const user = await openEventsTab();
    await waitFor(() => screen.getByRole('button', { name: '+ New event' }));
    await user.click(screen.getByRole('button', { name: '+ New event' }));

    // Name is required before dishes — fill it so we reach the dish check
    await user.type(screen.getByPlaceholderText('e.g. Westwood High School – Lunch A'), 'Test Event');

    // Remove all dish rows
    const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
    for (const btn of removeButtons) {
      await user.click(btn);
    }
    // Remove the last remaining one that gets auto-added
    const lastRemove = screen.getByRole('button', { name: 'Remove' });
    await user.click(lastRemove);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Add at least one dish')
    );
    expect(adminApi.createEvent).not.toHaveBeenCalled();
  });

  it('creates a new event when the form is valid', async () => {
    vi.mocked(adminApi.fetchEvents).mockResolvedValueOnce([]).mockResolvedValue([makeEvent()]);
    const user = await openEventsTab();
    await waitFor(() => screen.getByRole('button', { name: '+ New event' }));
    await user.click(screen.getByRole('button', { name: '+ New event' }));

    // Fill in required fields (name field starts empty)
    const nameInput = screen.getByPlaceholderText('e.g. Westwood High School – Lunch A');
    await user.type(nameInput, 'Westwood High School');

    const dishInputs = screen.getAllByPlaceholderText('Dish name');
    await user.type(dishInputs[0], 'Pasta');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(adminApi.createEvent).toHaveBeenCalledOnce());
    // Form closes after save
    expect(screen.queryByRole('heading', { name: 'New event' })).not.toBeInTheDocument();
  });

  it('opens edit form when an event card is clicked', async () => {
    vi.mocked(adminApi.fetchEvents).mockResolvedValue([makeEvent()]);
    const user = await openEventsTab();
    await waitFor(() => screen.getByText('Westwood High School'));
    // click the card body (not the Delete button) to open the edit form
    await user.click(screen.getByRole('button', { name: 'Delete event Westwood High School' })
      .closest('li')!.querySelector('.admin-event-card-main')!);
    expect(screen.getByRole('heading', { name: 'Edit event' })).toBeInTheDocument();
  });

  it('deletes an event after confirmation', async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    vi.mocked(adminApi.fetchEvents).mockResolvedValue([makeEvent()]);
    const user = await openEventsTab();
    await waitFor(() => screen.getByRole('button', { name: 'Delete event Westwood High School' }));
    await user.click(screen.getByRole('button', { name: 'Delete event Westwood High School' }));
    await waitFor(() => expect(adminApi.deleteEvent).toHaveBeenCalledWith('ev1'));
    expect(screen.queryByText('Westwood High School')).not.toBeInTheDocument();
  });

  it('does NOT delete when the confirm dialog is dismissed', async () => {
    window.confirm = vi.fn().mockReturnValue(false);
    vi.mocked(adminApi.fetchEvents).mockResolvedValue([makeEvent()]);
    const user = await openEventsTab();
    await waitFor(() => screen.getByRole('button', { name: 'Delete event Westwood High School' }));
    await user.click(screen.getByRole('button', { name: 'Delete event Westwood High School' }));
    expect(adminApi.deleteEvent).not.toHaveBeenCalled();
    expect(screen.getByText('Westwood High School')).toBeInTheDocument();
  });

  it('shows tab badge with total order count', async () => {
    vi.mocked(adminApi.fetchOrders).mockResolvedValue([makeOrder(), makeOrder({ id: 'o2' })]);
    renderAdmin();
    await waitFor(() => {
      const ordersTab = screen.getByRole('tab', { name: /Orders/ });
      expect(within(ordersTab).getByText('2 total')).toBeInTheDocument();
    });
  });
});
