let audioCtx: AudioContext | null = null;

export const initAudioContext = () => {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.error("AudioContext is not supported", e);
    }
  }
  if (audioCtx?.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

const playMasterTone = (
  f1: number, 
  f2: number, 
  dur: number, 
  vol: number, 
  type: OscillatorType = 'sine', 
  delay = 0
) => {
  if (!audioCtx) return;
  const now = audioCtx.currentTime + delay;
  [1, 1.005].forEach(detune => {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f1 * detune, now);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2 * detune, now + dur);
    
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(now);
    o.stop(now + dur);
  });
};

export const playSound = {
  detect: () => {
    playMasterTone(400, 350, 0.18, 0.3);
    playMasterTone(550, 500, 0.22, 0.3, 'sine', 0.1);
  },
  update: () => {
    playMasterTone(450, 400, 0.12, 0.25);
  },
  urgent: () => {
    playMasterTone(200, 60, 0.8, 0.4, 'triangle');
    playMasterTone(205, 65, 0.8, 0.2, 'sine', 0.01);
  },
  final: () => {
    playMasterTone(320, 300, 0.25, 0.25);
    playMasterTone(240, 220, 0.4, 0.25, 'sine', 0.2);
  },
  tsunamiDanger: () => {
    playMasterTone(180, 70, 1.1, 1.0, 'sawtooth');
    playMasterTone(720, 520, 0.45, 0.95, 'square', 0.02);
    playMasterTone(180, 70, 1.1, 1.0, 'sawtooth', 0.7);
    playMasterTone(720, 520, 0.45, 0.95, 'square', 0.72);
  }
};
