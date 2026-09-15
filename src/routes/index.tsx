import { Show } from 'solid-js';
import { state } from '../lib/store';
import { CompanionStage } from '../components/CompanionStage';
import { DmHome } from '../components/dm/DmHome';

export default function HomePage() {
  return (
    <Show when={state.user} fallback={<CompanionStage />}>
      <DmHome />
    </Show>
  );
}