import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { WaifuDefenseGame } from '../../src/components/WaifuDefenseGame';
import { setLanguage } from '../../src/lib/i18n';

describe('Tower Defense Tower Role Tags (Issue #15)', () => {
  beforeEach(() => {
    localStorage.clear();
    setLanguage('en');
  });

  const selectPlot = (canvas: HTMLCanvasElement, x = 90, y = 160) => {
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 480,
      right: 800,
      bottom: 480,
      x: 0,
      y: 0,
      toJSON: () => {}
    } as DOMRect);

    fireEvent.click(canvas, {
      clientX: x,
      clientY: y
    });
  };

  it('renders Attack and Support tags in the tower construction deck when a plot is selected', () => {
    const { container } = render(() => <WaifuDefenseGame />);
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas).toBeInTheDocument();

    // Select Plot #1 at (90, 160)
    selectPlot(canvas, 90, 160);

    // Build buttons for all 4 towers should be visible
    const archerBtn = screen.getByTestId('btn-build-archer');
    const frostBtn = screen.getByTestId('btn-build-frost');
    const thunderBtn = screen.getByTestId('btn-build-thunder');
    const sanctuaryBtn = screen.getByTestId('btn-build-sanctuary');

    expect(archerBtn).toBeInTheDocument();
    expect(frostBtn).toBeInTheDocument();
    expect(thunderBtn).toBeInTheDocument();
    expect(sanctuaryBtn).toBeInTheDocument();

    // Verify offensive towers display the Attack tag with .role-attack class
    const archerTag = archerBtn.querySelector('.tower-role-tag');
    expect(archerTag).toHaveTextContent('Attack');
    expect(archerTag).toHaveClass('role-attack');

    const frostTag = frostBtn.querySelector('.tower-role-tag');
    expect(frostTag).toHaveTextContent('Attack');
    expect(frostTag).toHaveClass('role-attack');

    const thunderTag = thunderBtn.querySelector('.tower-role-tag');
    expect(thunderTag).toHaveTextContent('Attack');
    expect(thunderTag).toHaveClass('role-attack');

    // Verify sanctuary tower displays the Support tag with .role-support class
    const sanctuaryTag = sanctuaryBtn.querySelector('.tower-role-tag');
    expect(sanctuaryTag).toHaveTextContent('Support');
    expect(sanctuaryTag).toHaveClass('role-support');
  });

  it('translates tower role tags to Japanese (攻撃 and 支援) when language is set to ja', () => {
    setLanguage('ja');
    const { container } = render(() => <WaifuDefenseGame />);
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;

    // Select Plot #1
    selectPlot(canvas, 90, 160);

    const archerBtn = screen.getByTestId('btn-build-archer');
    const sanctuaryBtn = screen.getByTestId('btn-build-sanctuary');

    expect(archerBtn.querySelector('.tower-role-tag')).toHaveTextContent('攻撃');
    expect(sanctuaryBtn.querySelector('.tower-role-tag')).toHaveTextContent('支援');
  });

  it('displays the role tag in the tower upgrade / inspection panel after a tower is placed', () => {
    const { container } = render(() => <WaifuDefenseGame />);
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;

    // Select Plot #1
    selectPlot(canvas, 90, 160);

    // Build Spirit Beacon (sanctuary - support tower)
    const sanctuaryBtn = screen.getByTestId('btn-build-sanctuary');
    fireEvent.click(sanctuaryBtn);

    // The upgrade panel should now be visible for this plot
    const upgradePanel = screen.getByTestId('tower-upgrade-panel');
    expect(upgradePanel).toBeInTheDocument();

    // Verify the inspector displays the Support tag
    const roleTag = upgradePanel.querySelector('.tower-role-tag');
    expect(roleTag).toBeInTheDocument();
    expect(roleTag).toHaveTextContent('Support');
    expect(roleTag).toHaveClass('role-support');
  });

  it('refreshes the upgrade button cost after upgrading a tower (Issue: stale cost)', () => {
    const { container } = render(() => <WaifuDefenseGame />);
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;

    // Select Plot #1 and build an Archer (base cost 50, upgrade Lv1->2 = 60)
    selectPlot(canvas, 90, 160);
    const archerBtn = screen.getByTestId('btn-build-archer');
    fireEvent.click(archerBtn);

    const upgradeBtn = container.querySelector('.btn-upgrade') as HTMLButtonElement;
    expect(upgradeBtn).toBeInTheDocument();
    expect(upgradeBtn.textContent).toContain('Lv2');
    expect(upgradeBtn.textContent).toContain('60');

    // After upgrading, the displayed cost must jump to the Lv2->3 price (120),
    // proving the panel re-rendered with the new tower state.
    fireEvent.click(upgradeBtn);
    expect(upgradeBtn.textContent).toContain('Lv3');
    expect(upgradeBtn.textContent).toContain('120');
  });
});
