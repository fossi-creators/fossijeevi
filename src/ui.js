/**
 * MEGA STAR – UI Manager
 * Controls DOM HUD, Menus, Modals, Dialogue Banners, and Score Displays.
 */

export class UIManager {
  constructor() {
    // Top Bar
    this.soundBtn = document.getElementById('sound-btn');
    this.soundIcon = document.getElementById('sound-icon');
    this.soundLabel = document.getElementById('sound-label');
    this.hudScore = document.getElementById('hud-score');

    // Screens
    this.menuScreen = document.getElementById('menu-screen');
    this.readyPrompt = document.getElementById('ready-prompt');
    this.gameOverScreen = document.getElementById('game-over-screen');

    // Menu Elements
    this.menuBestScore = document.getElementById('menu-best-score');
    this.playBtn = document.getElementById('play-btn');
    this.changeMusicBtn = document.getElementById('change-music-btn');

    // Game Over Elements
    this.goScore = document.getElementById('go-score');
    this.goBest = document.getElementById('go-best');
    this.goNewRecord = document.getElementById('go-new-record');
    this.goRankText = document.getElementById('go-rank-text');
    this.dialogueBanner = document.getElementById('dialogue-banner');
    this.restartBtn = document.getElementById('restart-btn');
    this.homeBtn = document.getElementById('home-btn');

    // Iconic Chiranjeevi Dialogues for Game Over
    this.dialogues = [
      '“Naa Route Separatu!”',
      '“Mokke Kada Ani Peekesthe... Pekaata Aypoddi!”',
      '“Indra The Tiger... Never Gives Up!”',
      '“Kallalo Intensity Choodu... Malli Raa!”',
      '“Boss Is Back... Fly Like A Megastar!”',
      '“Evadra Aagipoyedi... Replay Kotti Danchu!”'
    ];
  }

  init(onPlay, onRestart, onHome, onToggleSound, currentMuted, bestScore, onChangeMusic) {
    this.setBestScore(bestScore);
    this.updateSoundButton(currentMuted);

    this.playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onPlay) onPlay();
    });

    if (this.changeMusicBtn) {
      this.changeMusicBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onChangeMusic) onChangeMusic();
      });
    }

    this.restartBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onRestart) onRestart();
    });

    this.homeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onHome) onHome();
    });

    this.soundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onToggleSound) onToggleSound();
    });
  }

  updateSoundButton(isMuted) {
    if (isMuted) {
      this.soundIcon.textContent = '🔇';
      this.soundLabel.textContent = 'SOUND OFF';
      this.soundBtn.classList.add('muted');
    } else {
      this.soundIcon.textContent = '🔊';
      this.soundLabel.textContent = 'SOUND ON';
      this.soundBtn.classList.remove('muted');
    }
  }

  setBestScore(score) {
    if (this.menuBestScore) this.menuBestScore.textContent = score;
    if (this.goBest) this.goBest.textContent = score;
  }

  showMenu(bestScore) {
    this.setBestScore(bestScore);
    this.menuScreen.classList.remove('hidden');
    this.menuScreen.classList.add('active');
    this.gameOverScreen.classList.remove('active');
    this.gameOverScreen.classList.add('hidden');
    this.readyPrompt.classList.add('hidden');
    this.hudScore.classList.add('hidden');
  }

  showReadyPrompt() {
    this.menuScreen.classList.remove('active');
    this.menuScreen.classList.add('hidden');
    this.gameOverScreen.classList.remove('active');
    this.gameOverScreen.classList.add('hidden');
    this.readyPrompt.classList.remove('hidden');
    this.hudScore.classList.remove('hidden');
    this.updateScore(0);
  }

  hideReadyPrompt() {
    this.readyPrompt.classList.add('hidden');
  }

  updateScore(score) {
    this.hudScore.textContent = score;
    this.hudScore.classList.remove('pop');
    void this.hudScore.offsetWidth; // Trigger reflow for pop animation
    this.hudScore.classList.add('pop');
  }

  getRank(score) {
    if (score >= 25) return { title: 'MEGASTAR', icon: '👑' };
    if (score >= 15) return { title: 'SUPREME HERO', icon: '⚡' };
    if (score >= 8) return { title: 'POWER STAR', icon: '⭐' };
    return { title: 'RISING STAR', icon: '✨' };
  }

  showGameOver(score, bestScore, isNewRecord) {
    this.hideReadyPrompt();
    this.menuScreen.classList.remove('active');
    this.menuScreen.classList.add('hidden');

    if (this.goScore) this.goScore.textContent = score;
    if (this.goBest) this.goBest.textContent = bestScore;

    if (this.goNewRecord) {
      if (isNewRecord) {
        this.goNewRecord.classList.remove('hidden');
      } else {
        this.goNewRecord.classList.add('hidden');
      }
    }

    const rank = this.getRank(score);
    const rankEl = document.getElementById('go-rank');
    if (rankEl) {
      const iconEl = rankEl.querySelector('.rank-icon') || document.getElementById('go-rank-icon');
      if (iconEl) iconEl.textContent = rank.icon;
      if (this.goRankText) this.goRankText.textContent = rank.title;
    }

    // Pick random iconic Telugu dialogue
    const randomQuote = this.dialogues[Math.floor(Math.random() * this.dialogues.length)];
    if (this.dialogueBanner) {
      const dialogueTextEl = this.dialogueBanner.querySelector('.dialogue-text');
      if (dialogueTextEl) {
        dialogueTextEl.textContent = randomQuote;
      }
    }

    this.gameOverScreen.classList.remove('hidden');
    this.gameOverScreen.classList.add('active');
  }
}
