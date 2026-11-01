/**
 * MEGA STAR – Audio Manager
 * Handles BGM looping, scoring SFX, loss dialogue, and audio autoplay unlocks.
 */

// Dynamic cache-busting timestamp generated on page load so browsers never cache old audio files
const AUDIO_CACHE_BUSTER = 'v=' + Date.now();

class AudioManager {
  constructor() {
    this.muted = localStorage.getItem('megastar_sound_muted') === 'true';
    this.audioContext = null;
    this.loseDialoguePlayed = false;
    this.hasUserInteracted = false;

    // Available background music tracks
    this.tracks = [
      { id: 'background-music', name: 'Original', src: '/assets/background-music.mp3' },
      { id: 'mana-shankara-varaprasad', name: 'Mana Shankara Varaprasad', src: '/assets/mana-shankara-varaprasad.mp3' }
    ];

    const savedTrackId = localStorage.getItem('megastar_music_track');
    this.currentTrackIndex = savedTrackId === 'mana-shankara-varaprasad' ? 1 : 0;

    // Single Audio element for BGM guarantees that two tracks can never play simultaneously
    this.bgm = new Audio(`${this.tracks[this.currentTrackIndex].src}?${AUDIO_CACHE_BUSTER}`);
    this.bgm.loop = true;
    this.bgm.preload = 'auto';
    this.bgm.load(); // Force browser to immediately fetch and decode updated file

    this.scoreAudio = new Audio(`/assets/score.mp3?${AUDIO_CACHE_BUSTER}`);
    this.scoreAudio.preload = 'auto';

    this.loseAudio = new Audio(`/assets/good-night.mp3?${AUDIO_CACHE_BUSTER}`);
    this.loseAudio.preload = 'auto';
    this.loseAudio.load();

    // Set volumes
    this.bgm.volume = 0.55;
    this.scoreAudio.volume = 0.8;
    this.loseAudio.volume = 0.95;

    // Apply mute state
    this.applyMuteState();
  }

  /**
   * Unlock Web Audio API & audio elements on first user interaction
   */
  unlockAudio() {
    if (!this.hasUserInteracted) {
      this.hasUserInteracted = true;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx && !this.audioContext) {
        this.audioContext = new AudioCtx();
      }
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }
    }
  }

  applyMuteState() {
    this.bgm.muted = this.muted;
    this.scoreAudio.muted = this.muted;
    this.loseAudio.muted = this.muted;
  }

  toggleMute() {
    this.unlockAudio();
    this.muted = !this.muted;
    localStorage.setItem('megastar_sound_muted', this.muted);
    this.applyMuteState();

    if (this.muted) {
      this.bgm.pause();
    } else {
      // If we are currently in an active game, resume BGM
      if (window.__gameState === 'PLAYING') {
        this.bgm.play().catch(() => {});
      }
    }
    return !this.muted;
  }

  isMuted() {
    return this.muted;
  }

  /**
   * Switch between Original (background-music.mp3) and New (mana-shankara-varaprasad.mp3).
   * Stops previous track completely before starting the new one to guarantee no overlap.
   */
  changeMusic() {
    this.unlockAudio();

    // 1. Stop previous track completely before switching (Requirement 6)
    this.stopBgm();

    // 2. Alternate between tracks (Requirements 3 & 4)
    this.currentTrackIndex = this.currentTrackIndex === 0 ? 1 : 0;
    const selectedTrack = this.tracks[this.currentTrackIndex];
    localStorage.setItem('megastar_music_track', selectedTrack.id);

    // 3. Set new track source, preserve looping and volume (Requirements 5 & 7)
    this.bgm.src = `${selectedTrack.src}?v=${Date.now()}`;
    this.bgm.loop = true;
    this.bgm.volume = 0.55;
    this.bgm.load();

    // 4. Play newly selected track if not muted
    if (!this.muted) {
      this.playBgm();
    }

    return selectedTrack;
  }

  getCurrentTrack() {
    return this.tracks[this.currentTrackIndex];
  }

  playBgm() {
    this.unlockAudio();
    this.loseDialoguePlayed = false;
    if (this.muted) return;

    const currentTrack = this.tracks[this.currentTrackIndex];
    if (this.bgm.error || !this.bgm.src || !this.bgm.src.includes(currentTrack.src)) {
      this.bgm.src = `${currentTrack.src}?v=${Date.now()}`;
      this.bgm.loop = true;
      this.bgm.volume = 0.55;
      this.bgm.load();
    }

    this.bgm.currentTime = 0;
    const playPromise = this.bgm.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        // Autoplay policy prevented playback until gesture
        console.warn('BGM play awaiting user gesture:', err.message);
      });
    }
  }

  pauseBgm() {
    try {
      this.bgm.pause();
    } catch (e) {}
  }

  stopBgm() {
    try {
      this.bgm.pause();
      this.bgm.currentTime = 0;
    } catch (e) {}
  }

  /**
   * Flight input sound handled exclusively by horse-sound-effect.mp3
   */
  playFlap() {
    // Only the horse sound plays on flight input; generic flap swoosh disabled
  }

  /**
   * Play score sound effect
   */
  playScore() {
    if (this.muted) return;
    this.unlockAudio();

    // Play file sound
    try {
      this.scoreAudio.currentTime = 0;
      this.scoreAudio.play().catch(() => {
        this.playSynthesizedScore();
      });
    } catch (e) {
      this.playSynthesizedScore();
    }
  }

  playSynthesizedScore() {
    if (this.muted || !this.audioContext || this.audioContext.state !== 'running') return;
    try {
      const ctx = this.audioContext;
      const now = ctx.currentTime;
      [659.25, 880.0, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);

        gain.gain.setValueAtTime(0, now + i * 0.08);
        gain.gain.linearRampToValueAtTime(0.25, now + i * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.28);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.3);
      });
    } catch (e) {}
  }

  /**
   * Play loss dialogue exactly once when game ends
   */
  playLoseDialogue() {
    if (this.loseDialoguePlayed) return; // Strict single-play guard
    this.loseDialoguePlayed = true;

    // Immediately stop or pause background music
    this.pauseBgm();

    if (this.muted) return;
    this.unlockAudio();

    // Verify and ensure good-night.mp3 is loaded
    if (!this.loseAudio || !this.loseAudio.src || !this.loseAudio.src.includes('good-night.mp3') || this.loseAudio.error) {
      this.loseAudio = new Audio(`/assets/good-night.mp3?${AUDIO_CACHE_BUSTER}`);
      this.loseAudio.preload = 'auto';
      this.loseAudio.volume = 0.95;
      this.loseAudio.muted = this.muted;
      this.loseAudio.load();
    }

    // Play dialogue audio file
    try {
      this.loseAudio.currentTime = 0;
      const playPromise = this.loseAudio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('[AudioManager] good-night.mp3 played successfully on Game Over');
          })
          .catch((err) => {
            console.error('[AudioManager] Playback error playing good-night.mp3:', err);
            this.playSynthesizedImpact();
          });
      }
    } catch (err) {
      console.error('[AudioManager] Exception calling play() on good-night.mp3:', err);
      this.playSynthesizedImpact();
    }
  }

  /**
   * Fallback impact sound when audio element is unavailable
   */
  playSynthesizedImpact() {
    if (this.muted || !this.audioContext || this.audioContext.state !== 'running') return;
    try {
      const ctx = this.audioContext;
      const now = ctx.currentTime;

      // Deep thud
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.4);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.52);
    } catch (e) {}
  }

  resetForNewGame() {
    this.loseDialoguePlayed = false;
    try {
      this.loseAudio.pause();
      this.loseAudio.currentTime = 0;
    } catch (e) {}
  }
}

export const audio = new AudioManager();
