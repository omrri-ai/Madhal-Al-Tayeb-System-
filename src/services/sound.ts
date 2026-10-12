/**
 * Web Audio API notification sound generator
 * Provides crisp, gentle, and reliable notification sounds without external audio assets.
 */

export const playNotificationSound = (type: 'alert' | 'success' | 'bell' = 'bell'): void => {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    if (type === 'bell' || type === 'alert') {
      // Gentle two-tone bell chime
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now); // E5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(880, now);
      osc2.frequency.exponentialRampToValueAtTime(1318.51, now + 0.2); // E6

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.25, now + 0.04);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now + 0.08);

      osc1.stop(now + 0.6);
      osc2.stop(now + 0.6);
    } else {
      // Success chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2); // G5

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.5);
    }

    // Trigger device gentle vibration if supported
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([80, 40, 80]);
    }
  } catch {
    // Graceful fallback for audio restrictions
  }
};
