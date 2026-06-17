// Web Audio API Retro Sound Synthesizer & Glitch Sound Generator

let audioCtx: AudioContext | null = null;
let bgMusicInterval: any = null;
let currentBpm = 115;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export const playSound = {
  // Anti-virus laser shoot sound
  shoot(glitchAmount: number = 0) {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      // Randomize waveform and frequency slightly if glitch amount is high
      osc.type = Math.random() < glitchAmount * 0.4 ? 'sawtooth' : 'triangle';
      const startFreq = 600 - (glitchAmount * 200);
      const endFreq = 80 + (Math.random() * glitchAmount * 150);

      osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
      // Sweep pitch down for retro laser sound
      osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {
      // Audio context may not be allowed to start
    }
  },

  // Enemy hit / hurt sound
  hit(glitchAmount: number = 0) {
    try {
      const ctx = getAudioContext();
      // Use noise buffer for a satisfying crunch/hit sound
      const bufferSize = ctx.sampleRate * 0.05; // 50ms
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1000 - (glitchAmount * 400);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
    } catch (e) {}
  },

  // Part damaged / Explosion sound
  explode(glitchAmount: number = 0) {
    try {
      const ctx = getAudioContext();
      
      // Heavy low frequency rumble + explosion noise
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.5);
      
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.52);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.52);

      // Add a noise burst overlay for crunch
      const bufferSize = ctx.sampleRate * 0.4;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        // High glitch creates crackling white noise
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800 - (glitchAmount * 300), ctx.currentTime);
      
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.25, ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start();
    } catch (e) {}
  },

  // Glitch tick sound (for active static or warning screens)
  glitchTick() {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(Math.random() * 3000 + 100, ctx.currentTime);
      
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.02);

      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.02);
    } catch (e) {}
  },

  // Notification / popup spawn beep
  popupNotification() {
    try {
      const ctx = getAudioContext();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc2.frequency.setValueAtTime(1320, ctx.currentTime + 0.06); // E6

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.06);
      
      osc2.start(ctx.currentTime + 0.06);
      osc2.stop(ctx.currentTime + 0.25);
    } catch (e) {}
  },

  // Game over crash tone
  gameOverCrash() {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(20, ctx.currentTime + 1.5);

      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 1.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1.5);
    } catch (e) {}
  }
};

// Generates an interactive procedural backbeat that glitches dynamically based on stability
export function startProceduralBGM(getStability: () => number) {
  try {
    const ctx = getAudioContext();
    if (bgMusicInterval) {
      clearInterval(bgMusicInterval);
    }

    let step = 0;
    // Simple 16-step grid
    bgMusicInterval = setInterval(() => {
      const stability = getStability(); // 0 to 100
      const glitchRatio = (100 - stability) / 100; // 0 (healthy) to 1 (extremely glitched)

      const beatDuration = 60 / currentBpm / 4; // 16th note length (approx 130ms)

      // Base nodes
      // Play kick drum on 1, 5, 9, 13
      if (step % 4 === 0) {
        playSynthKick(ctx, beatDuration, glitchRatio);
      }

      // Play snare or noise burst on 5, 13 (with randomness under glitch)
      if (step % 8 === 4) {
        playSynthSnare(ctx, beatDuration, glitchRatio);
      }

      // Minimal procedural synth melody
      // If glitched, random notes play at random intervals
      const playMelodyNoteChance = 0.35 + (glitchRatio * 0.4);
      if (Math.random() < playMelodyNoteChance) {
        // Melodic notes in a cyber minor pentatonic scale (A, C, D, E, G)
        const scale = [220, 261.63, 293.66, 329.63, 392.00, 440, 523.25];
        let noteFreq = scale[Math.floor(Math.random() * scale.length)];

        if (glitchRatio > 0.4) {
          // Add microtonal detuning under heavy glitch
          noteFreq += (Math.random() * 80 - 40) * glitchRatio;
        }

        playSynthArp(ctx, noteFreq, beatDuration * 1.5, glitchRatio);
      }

      step = (step + 1) % 16;
    }, (60 / currentBpm / 4) * 1000);
  } catch (e) {}
}

export function stopProceduralBGM() {
  if (bgMusicInterval) {
    clearInterval(bgMusicInterval);
    bgMusicInterval = null;
  }
}

function playSynthKick(ctx: AudioContext, duration: number, glitch: number) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Deep thick pitch sweep
    const startFreq = 140 - (glitch * 60);
    osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + duration * 0.8);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration * 0.9);

    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch(e) {}
}

function playSynthSnare(ctx: AudioContext, duration: number, glitch: number) {
  try {
    // Noise + short high-pass sweep
    const bufferSize = ctx.sampleRate * duration * 0.8;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    // Distort high-pass frequency under glitch
    filter.frequency.value = 1200 + (glitch * 1500 * (Math.random() - 0.5));

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration * 0.8);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start();
  } catch (e) {}
}

function playSynthArp(ctx: AudioContext, frequency: number, duration: number, glitch: number) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Glitch leads to more harsh oscillators (sawtooth/square) instead of triangles
    if (glitch > 0.6) {
      osc.type = Math.random() < 0.5 ? 'sawtooth' : 'square';
    } else if (glitch > 0.3) {
      osc.type = 'square';
    } else {
      osc.type = 'triangle';
    }

    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    // Apply pitch slide/glide if highly glitched
    if (glitch > 0.5 && Math.random() < 0.5) {
      osc.frequency.exponentialRampToValueAtTime(frequency * (Math.random() < 0.5 ? 2 : 0.5), ctx.currentTime + duration);
    }

    // Filter to sweep a retro look
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800 + (glitch * 1200), ctx.currentTime);

    gain.gain.setValueAtTime(0.07, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}
