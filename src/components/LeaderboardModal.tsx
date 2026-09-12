import { createSignal, createEffect, onMount, For, Show } from 'solid-js';
import { state } from '../lib/store';
import { t } from '../lib/i18n';
import { useFocusTrap } from '../lib/accessibility';
import { AvatarFrameOverlay } from './AvatarFrame';

interface LeaderboardEntry {
  rank: number;
  username: string;
  avatarUrl: string;
  avatarFrame?: string;
  defenseHighWave: number;
  bondLevel: number;
  coins: number;
  goblinsDefeated: number;
}

export function LeaderboardModal(props: { isOpen: boolean; onClose: () => void }) {
  const [filter, setFilter] = createSignal<'wave' | 'bond' | 'goblins'>('wave');
  const [leaderboard, setLeaderboard] = createSignal<LeaderboardEntry[]>([]);
  const [loading, setLoading] = createSignal(true);

  // Mock / demo global high scores integrated with active user stats
  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leaderboard?sort=${filter()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.entries) {
          setLeaderboard(data.entries);
          setLoading(false);
          return;
        }
      }
    } catch {
      // Fallback demo board
    }

    const currentUserName = state.user?.username || 'You';
    const userHighWave = state.rpg?.defenseHighWave || 0;
    const userBondLevel = state.waifu?.bondLevel || 1;
    const userGoblins = state.rpg?.defenseStats?.goblinsDefeated || 0;
    const userCoins = state.rpg?.coins || 200;

    const baseEntries: LeaderboardEntry[] = [
      { rank: 1, username: 'SakuraEmpress', avatarUrl: '', defenseHighWave: 45, bondLevel: 25, coins: 14500, goblinsDefeated: 620 },
      { rank: 2, username: 'ShadowBlade99', avatarUrl: '', defenseHighWave: 38, bondLevel: 19, coins: 9800, goblinsDefeated: 480 },
      { rank: 3, username: 'AkariDevotee', avatarUrl: '', defenseHighWave: 32, bondLevel: 22, coins: 7200, goblinsDefeated: 390 },
      { rank: 4, username: 'LunaMage', avatarUrl: '', defenseHighWave: 27, bondLevel: 14, coins: 4100, goblinsDefeated: 310 },
      { rank: 5, username: 'OtakuSupreme', avatarUrl: '', defenseHighWave: 22, bondLevel: 12, coins: 3300, goblinsDefeated: 240 },
      {
        rank: 6,
        username: currentUserName,
        avatarUrl: state.user?.avatarUrl || '',
        avatarFrame: state.waifu?.appearance?.avatarFrame || 'none',
        defenseHighWave: userHighWave,
        bondLevel: userBondLevel,
        coins: userCoins,
        goblinsDefeated: userGoblins
      }
    ];

    if (filter() === 'bond') {
      baseEntries.sort((a, b) => b.bondLevel - a.bondLevel);
    } else if (filter() === 'goblins') {
      baseEntries.sort((a, b) => b.goblinsDefeated - a.goblinsDefeated);
    } else {
      baseEntries.sort((a, b) => b.defenseHighWave - a.defenseHighWave);
    }

    baseEntries.forEach((e, i) => (e.rank = i + 1));
    setLeaderboard(baseEntries);
    setLoading(false);
  };

  createEffect(() => {
    if (props.isOpen) {
      fetchLeaderboard();
    }
  });

  const handleTabChange = (tab: 'wave' | 'bond' | 'goblins') => {
    setFilter(tab);
    fetchLeaderboard();
  };

  return (
    <Show when={props.isOpen}>
      <div
        ref={useFocusTrap(() => props.isOpen, props.onClose)}
        class="leaderboard-modal-backdrop"
        onClick={props.onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="leaderboard-modal-title"
        data-testid="leaderboard-modal"
      >
        <div class="leaderboard-modal-card" onClick={e => e.stopPropagation()}>
          <button class="modal-close-btn" onClick={props.onClose} aria-label={t('common.close')}>✕</button>

          <div class="leaderboard-modal-header">
            <span class="hall-icon">🏆</span>
            <h2 id="leaderboard-modal-title">{t('leaderboard.title')}</h2>
            <p>{t('leaderboard.subtitle')}</p>
          </div>

          <div class="leaderboard-filter-tabs">
            <button
              class={`board-tab ${filter() === 'wave' ? 'active' : ''}`}
              data-testid="leaderboard-tab-wave"
              onClick={() => handleTabChange('wave')}
            >
              🛡️ {t('leaderboard.tabDefenseWave')}
            </button>
            <button
              class={`board-tab ${filter() === 'bond' ? 'active' : ''}`}
              data-testid="leaderboard-tab-bond"
              onClick={() => handleTabChange('bond')}
            >
              💖 {t('leaderboard.tabBondLevel')}
            </button>
            <button
              class={`board-tab ${filter() === 'goblins' ? 'active' : ''}`}
              data-testid="leaderboard-tab-goblins"
              onClick={() => handleTabChange('goblins')}
            >
              👹 {t('leaderboard.tabGoblins')}
            </button>
          </div>

          <div class="leaderboard-table-container">
            <Show when={!loading()} fallback={<div class="leaderboard-loading">{t('leaderboard.loading')}</div>}>
              <table class="leaderboard-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('leaderboard.colCommander')}</th>
                    <Show when={filter() === 'wave'}>
                      <th class="text-right">{t('leaderboard.colWave')}</th>
                    </Show>
                    <Show when={filter() === 'bond'}>
                      <th class="text-right">{t('leaderboard.colBond')}</th>
                    </Show>
                    <Show when={filter() === 'goblins'}>
                      <th class="text-right">{t('leaderboard.colGoblins')}</th>
                    </Show>
                    <th class="text-right">🪙 {t('rpg.dashboard.goldCoins')}</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={leaderboard()}>
                    {entry => {
                      const isMe = entry.username === (state.user?.username || 'You');
                      return (
                        <tr class={`leaderboard-row ${isMe ? 'is-self' : ''} rank-${entry.rank}`}>
                          <td class="rank-col">
                            {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
                          </td>
                          <td class="user-col">
                            <span class="user-avatar-tiny-wrap">
                              <Show when={entry.avatarUrl} fallback={<span class="user-avatar-tiny">🌸</span>}>
                                <img
                                  src={entry.avatarUrl}
                                  alt=""
                                  class="user-avatar-tiny-img"
                                  loading="lazy"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              </Show>
                              <AvatarFrameOverlay frameId={entry.avatarFrame} class="user-avatar-tiny-frame" />
                            </span>
                            <span class="username-txt">{entry.username}</span>
                            <Show when={isMe}>
                              <span class="badge-self">{t('leaderboard.you')}</span>
                            </Show>
                          </td>
                          <Show when={filter() === 'wave'}>
                            <td class="stat-col text-right font-bold">Wave {entry.defenseHighWave}</td>
                          </Show>
                          <Show when={filter() === 'bond'}>
                            <td class="stat-col text-right font-bold">Lv. {entry.bondLevel}</td>
                          </Show>
                          <Show when={filter() === 'goblins'}>
                            <td class="stat-col text-right font-bold">{entry.goblinsDefeated} 💀</td>
                          </Show>
                          <td class="coins-col text-right">{entry.coins.toLocaleString()}</td>
                        </tr>
                      );
                    }}
                  </For>
                </tbody>
              </table>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
