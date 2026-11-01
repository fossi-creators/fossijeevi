import './style.css';
import { Game } from './game.js';

// Initialize MEGA STAR game once DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  game.start();

  // Expose instance for debugging/testing
  window.__megastarGame = game;
});
