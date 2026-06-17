export interface Player {
  x: number;
  y: number;
  radius: number;
  speed: number;
  angle: number;
  health: number;
  maxHealth: number;
  shootCooldown: number;
  lastShotTime: number;
  invulnerableTime: number;
}

export type PartType = 'CPU' | 'GPU' | 'RAM' | 'SSD' | 'PSU';

export interface PCPart {
  id: PartType;
  name: string;
  jpName: string;
  x: number; // center x
  y: number; // center y
  width: number;
  height: number;
  health: number;
  maxHealth: number;
  isDestroyed: boolean;
  description: string;
  glitchEffect: string;
  color: string;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isPlayerShot: boolean;
  damage: number;
}

export type EnemyType = 'Trojan' | 'Worm' | 'Spyware' | 'Ransomware';

export interface Enemy {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  health: number;
  maxHealth: number;
  speed: number;
  damage: number;
  scoreValue: number;
  targetId: PartType | 'Player'; // Component or Player being targeted
  shootCooldown?: number;
  lastShotTime?: number;
  color: string;
  angle?: number;
  wave?: number; // for Worm movement
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  radius: number;
  alpha: number;
  life: number;
  maxLife: number;
  text?: string; // Floating numbers or glitch characters
}

export interface AdwarePopup {
  id: string;
  title: string;
  message: string;
  x: number;
  y: number;
  width: number;
  height: number;
  life: number; // time left or manual click
}

export interface GameState {
  score: number;
  wave: number;
  startTime: number;
  isPlaying: boolean;
  isPaused: boolean;
  isGameOver: boolean;
  stability: number; // 0 to 100
  keysPressed: Record<string, boolean>;
  mousePos: { x: number; y: number };
  systemLog: string[];
}
