import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@solidjs/testing-library';
import { ChatStage } from '../../src/components/ChatStage';
import { state, setState, DEFAULT_STATE } from '../../src/lib/store';

describe('ChatStage Component (ChatStage.tsx)', () => {
  beforeEach(() => {
    cleanup();
    setState(JSON.parse(JSON.stringify(DEFAULT_STATE)));
  });

  it('renders chat header with waifu companion name', () => {
    setState('waifu', 'name', 'Akari');
    render(() => <ChatStage />);

    expect(screen.getByText('Chat with Akari')).toBeInTheDocument();
  });

  it('renders chat messages from state history', () => {
    setState('chat', 'messages', [
      { id: 'm1', sender: 'user', text: 'Good morning!', timestamp: new Date().toISOString() },
      { id: 'm2', sender: 'waifu', text: 'Morning dummy! Wake up!', timestamp: new Date().toISOString() }
    ]);

    render(() => <ChatStage />);

    expect(screen.getByText('Good morning!')).toBeInTheDocument();
    expect(screen.getByText('Morning dummy! Wake up!')).toBeInTheDocument();
  });

  it('allows user to type into input and submit message form', async () => {
    const { container } = render(() => <ChatStage />);

    const input = screen.getByPlaceholderText(/Talk to Akari.../i);
    const form = container.querySelector('form.chat-input-form');

    fireEvent.input(input, { target: { value: 'Can we study together?' } });
    expect((input as HTMLInputElement).value).toBe('Can we study together?');

    fireEvent.submit(form!);

    // Should have added user message to store
    expect(state.chat.messages.some(m => m.text === 'Can we study together?')).toBe(true);
  });

  it('sends message when clicking dynamic suggestion chip', () => {
    setState('chat', 'suggestions', ['Tell me a joke', 'Review schedule']);
    render(() => <ChatStage />);

    const chip = screen.getByText('Tell me a joke');
    fireEvent.click(chip);

    expect(state.chat.messages.some(m => m.text === 'Tell me a joke')).toBe(true);
  });

  it('clears chat history when clicking the trash icon button', () => {
    setState('chat', 'messages', [
      { id: 'm1', sender: 'user', text: 'Hello', timestamp: new Date().toISOString() }
    ]);

    const { container } = render(() => <ChatStage />);
    const clearBtn = container.querySelector('#clear-chat-btn');

    fireEvent.click(clearBtn!);
    expect(state.chat.messages.length).toBe(0);
  });
});
