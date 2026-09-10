import { onMount, onCleanup, createEffect } from 'solid-js';
import { state } from '../lib/store';

export function SakuraCanvas() {
  let canvasRef: HTMLCanvasElement | undefined;
  let animId: number | null = null;

  onMount(() => {
    if (!canvasRef) return;
    const canvas = canvasRef;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    const petals: any[] = [];
    const maxPetals = 35;

    const createPetal = (randomY = false) => ({
      x: Math.random() * width,
      y: randomY ? Math.random() * height : -20,
      size: 8 + Math.random() * 8,
      speedX: 0.5 + Math.random() * 1.5,
      speedY: 1.0 + Math.random() * 1.5,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 2,
      opacity: 0.4 + Math.random() * 0.45,
      flip: Math.random() * Math.PI,
      flipSpeed: 0.02 + Math.random() * 0.03
    });

    for (let i = 0; i < maxPetals; i++) {
      petals.push(createPetal(true));
    }

    const render = () => {
      if (!state.settings.sakuraParticles) {
        ctx.clearRect(0, 0, width, height);
        animId = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < petals.length; i++) {
        const p = petals[i];
        p.x += p.speedX;
        p.y += p.speedY;
        p.rotation += p.rotationSpeed;
        p.flip += p.flipSpeed;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.scale(1, Math.sin(p.flip));

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-p.size / 2, -p.size / 2, -p.size / 2, p.size / 2, 0, p.size);
        ctx.bezierCurveTo(p.size / 2, p.size / 2, p.size / 2, -p.size / 2, 0, 0);

        ctx.fillStyle = `rgba(255, 183, 197, ${p.opacity})`;
        ctx.fill();
        ctx.restore();

        if (p.y > height + 20 || p.x > width + 20) {
          petals[i] = createPetal(false);
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    onCleanup(() => {
      window.removeEventListener('resize', onResize);
      if (animId) cancelAnimationFrame(animId);
    });
  });

  return <canvas ref={canvasRef} class="particles-canvas" id="particles-canvas" />;
}
