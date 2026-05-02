let ctx: AudioContext | null = null;
let activeNodes: OscillatorNode[] = [];

export const initAudioContext = () => {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {}
  }
  if (ctx?.state === 'suspended') ctx.resume();
  return ctx;
};

export const getCtx = (): AudioContext | null => {
  if (!ctx) initAudioContext();
  if (ctx?.state === 'suspended') ctx.resume();
  return ctx;
};

function stopAll() {
  activeNodes.forEach(n => { try { n.stop(); } catch {} });
  activeNodes = [];
}

function tone(
  f1: number,
  f2: number | null,
  dur: number,
  vol: number,
  type: OscillatorType = 'sine',
  t = 0
) {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime + t;

  const o = c.createOscillator();
  const g = c.createGain();

  o.type = type;
  o.frequency.setValueAtTime(f1, now);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, now + dur);

  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(vol, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, now + dur);

  o.connect(g);
  g.connect(c.destination);

  o.start(now);
  o.stop(now + dur);

  activeNodes.push(o);
}

export const playSound = {
  detect: () => {
    stopAll();
    tone(550, 450, 0.18, 0.25);
    tone(650, 500, 0.2, 0.2, 'sine', 0.08);
  },
  update: () => {
    stopAll();
    tone(450, null, 0.08, 0.2);
  },
  caution: () => {
    stopAll();
    tone(800, 500, 0.2, 0.3);
    tone(600, 400, 0.2, 0.3, 'sine', 0.2);
  },
  alert: () => {
    stopAll();
    for (let i = 0; i < 3; i++) {
      const t = i * 0.6;
      tone(300, 1400, 0.5, 0.6, 'square', t);
      tone(310, 1410, 0.5, 0.3, 'square', t + 0.02);
    }
  },
  end: () => {
    stopAll();
    tone(500, 350, 0.18, 0.2);
    tone(400, 300, 0.2, 0.15, 'sine', 0.08);
  },
  final: () => {
    stopAll();
    tone(500, 350, 0.18, 0.2);
    tone(400, 300, 0.2, 0.15, 'sine', 0.08);
  },
  tsunamiDanger: () => {
    stopAll();
    for (let i = 0; i < 3; i++) {
      const t = i * 0.6;
      tone(300, 1400, 0.5, 0.6, 'square', t);
      tone(310, 1410, 0.5, 0.3, 'square', t + 0.02);
    }
  },
};
