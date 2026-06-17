import React, { useEffect, useRef, useState } from 'react';
import { Player, PCPart, Bullet, Enemy, Particle, AdwarePopup, PartType, EnemyType } from '../types';
import { playSound, startProceduralBGM, stopProceduralBGM } from './SoundEffects';
import AdwarePopupComponent from './AdwarePopupComponent';
import { 
  Play, Pause, RotateCcw, Volume2, VolumeX, ShieldAlert, 
  Terminal, Cpu, HardDrive, Zap, Info, HelpCircle
} from 'lucide-react';

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 650;

// Spawning ports on the edge of the circuit board
const SPARK_PORTS = [
  { name: 'PORT_USB_A',  x: 20,   y: 325,  label: 'USB INTRUSION' },
  { name: 'PORT_ETHER',  x: 500,  y: 20,   yDir: 1, label: 'LAN SPYWARE' },
  { name: 'PORT_HDMI',   x: 500,  y: 630,  yDir: -1, label: 'DISPLAY MALWARE' },
  { name: 'PORT_PCI_E',  x: 980,  y: 325,  label: 'PCI INFILTRATION' }
];

export default function GameBoard() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Core Game State (React layer for UI reactivity)
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [wave, setWave] = useState<number>(1);
  const [stability, setStability] = useState<number>(100);
  const [systemLogs, setSystemLogs] = useState<string[]>(['SYSTEM INITIALIZED', 'FIREWALL STANDBY', 'USE WASD TO MOVE, MOUSE TO AIM/SHOOT']);
  const [popups, setPopups] = useState<AdwarePopup[]>([]);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showHowTo, setShowHowTo] = useState<boolean>(false);
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>('easy');

  // Keep references to values that the canvas loop needs to access instantly without re-binding
  const stateRef = useRef({
    score: 0,
    wave: 1,
    stability: 100,
    isPlaying: false,
    isPaused: false,
    isGameOver: false,
    popups: [] as AdwarePopup[],
    keys: {} as Record<string, boolean>,
    mouse: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, isDown: false },
    lastSpawnTime: 0,
    lastWaveTime: 0,
    lastLogTime: 0,
    logs: [] as string[] ,
    difficulty: 'easy' as 'easy' | 'normal' | 'hard',
    rightClickTriggered: false,
    wheelTriggered: false,
    skills: {
      space: { lastUsed: 0, cooldown: 6000, name: 'EMPブラスト' },
      rightClick: { lastUsed: 0, cooldown: 10000, name: 'ファイアウォール', activeUntil: 0, duration: 4000 },
      wheel: { lastUsed: 0, cooldown: 5000, name: 'バースト追尾ミサイル' }
    }
  });

  // Visual effects ring drawer ref
  const visualEffectsRef = useRef<any[]>([]);

  // Track difficulty state updates in real-time
  useEffect(() => {
    stateRef.current.difficulty = difficulty;
  }, [difficulty]);

  // Game entities maintained inside mutable refs for extreme fluid frame rates
  const playerRef = useRef<Player>({
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT / 2 + 100,
    radius: 16,
    speed: 5.2,
    angle: 0,
    health: 100,
    maxHealth: 100,
    shootCooldown: 120, // ms
    lastShotTime: 0,
    invulnerableTime: 0
  });

  const partsRef = useRef<PCPart[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const particlesRef = useRef<Particle[]>([]);

  // Sound settings state sync
  useEffect(() => {
    stateRef.current.isPlaying = isPlaying;
    stateRef.current.isPaused = isPaused;
    stateRef.current.isGameOver = isGameOver;

    if (isPlaying && !isPaused && !isGameOver) {
      if (!isMuted) {
        startProceduralBGM(() => stateRef.current.stability);
      } else {
        stopProceduralBGM();
      }
    } else {
      stopProceduralBGM();
    }
  }, [isPlaying, isPaused, isGameOver, isMuted]);

  // Utility to append logs with a timestamp
  const addSystemLog = (msg: string) => {
    const time = new Date().toLocaleTimeString('ja-JP', { hour12: false });
    const formatted = `[${time}] ${msg}`;
    setSystemLogs(prev => [formatted, ...prev.slice(0, 15)]);
    stateRef.current.logs.unshift(formatted);
  };

  // Initialize PC Hardware Parts
  const initParts = () => {
    const diff = stateRef.current.difficulty || 'easy';
    const cpuHp = diff === 'easy' ? 400 : diff === 'hard' ? 200 : 250;
    const itemHp = diff === 'easy' ? 200 : diff === 'hard' ? 100 : 120;

    partsRef.current = [
      {
        id: 'CPU',
        name: 'CPU (System Core)',
        jpName: 'CPU (システム最重要コア)',
        x: 500,
        y: 325,
        width: 140,
        height: 140,
        health: cpuHp,
        maxHealth: cpuHp,
        isDestroyed: false,
        description: 'マザーボードの中核。破壊されるとUIテキストがバグ文字化します。',
        glitchEffect: 'TEXT_SCRAMBLE',
        color: '#00e1ff'
      },
      {
        id: 'GPU',
        name: 'GPU (Graphics Card)',
        jpName: 'GPU (グラフィックボード)',
        x: 180,
        y: 480,
        width: 120,
        height: 120,
        health: itemHp,
        maxHealth: itemHp,
        isDestroyed: false,
        description: '映像出力を制御。破壊されると色差・画面揺れバグが発生します。',
        glitchEffect: 'COLOR_DISTORTION',
        color: '#a000ff'
      },
      {
        id: 'RAM',
        name: 'RAM (Memory Cache)',
        jpName: 'RAM (物理メモリスロット)',
        x: 820,
        y: 160,
        width: 110,
        height: 120,
        health: itemHp,
        maxHealth: itemHp,
        isDestroyed: false,
        description: 'キャッシュ制御。破壊されると残像付きフレーム遅延(ラグ)が発生。',
        glitchEffect: 'FRAME_STUTTER',
        color: '#ffaa00'
      },
      {
        id: 'SSD',
        name: 'SSD (Storage Sector)',
        jpName: 'SSD (NVMeストレージ)',
        x: 820,
        y: 480,
        width: 120,
        height: 100,
        health: itemHp,
        maxHealth: itemHp,
        isDestroyed: false,
        description: 'ローカルファイルを格納。破壊されると大量の警告広告ポップアップが発生。',
        glitchEffect: 'ADWARE_OVERLAY',
        color: '#ff0077'
      },
      {
        id: 'PSU',
        name: 'PSU (Power Regulators)',
        jpName: 'PSU (電源レギュレータ群)',
        x: 180,
        y: 160,
        width: 110,
        height: 120,
        health: itemHp,
        maxHealth: itemHp,
        isDestroyed: false,
        description: '電力分配・コンデンサ。破壊されるとブラックアウトや点滅バグが発生。',
        glitchEffect: 'BLACKOUT_FLICKER',
        color: '#00ff3c'
      }
    ];
  };

  // Run initial state once on mount
  useEffect(() => {
    initParts();
    stateRef.current.logs = [...systemLogs];

    // Event listeners
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      stateRef.current.keys[key] = true;
      
      // Stop page scrolling with arrow keys / space
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key)) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      stateRef.current.keys[key] = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      
      // Translate true client positions directly into canvas base 1000x650 coordinates
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      if (!isNaN(mx) && isFinite(mx) && !isNaN(my) && isFinite(my)) {
        stateRef.current.mouse.x = mx;
        stateRef.current.mouse.y = my;
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        stateRef.current.mouse.isDown = true;
      } else if (e.button === 1) {
        e.preventDefault();
        stateRef.current.wheelTriggered = true;
      } else if (e.button === 2) {
        stateRef.current.rightClickTriggered = true;
      }
      // Audio context resume guard on first interaction
      playSound.glitchTick();
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        stateRef.current.mouse.isDown = false;
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (stateRef.current.isPlaying && !stateRef.current.isPaused && !stateRef.current.isGameOver) {
        e.preventDefault();
        stateRef.current.rightClickTriggered = true;
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (stateRef.current.isPlaying && !stateRef.current.isPaused && !stateRef.current.isGameOver) {
        e.preventDefault();
        stateRef.current.wheelTriggered = true;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('wheel', handleWheel);
      stopProceduralBGM();
    };
  }, []);

  // Set up game restart parameters
  const handleStartGame = () => {
    initParts();
    bulletsRef.current = [];
    enemiesRef.current = [];
    particlesRef.current = [];
    setPopups([]);
    stateRef.current.popups = [];
    stateRef.current.rightClickTriggered = false;
    stateRef.current.wheelTriggered = false;
    stateRef.current.skills.space.lastUsed = 0;
    stateRef.current.skills.rightClick.lastUsed = 0;
    stateRef.current.skills.rightClick.activeUntil = 0;
    stateRef.current.skills.wheel.lastUsed = 0;
    visualEffectsRef.current = [];
    setScore(0);
    stateRef.current.score = 0;
    setWave(1);
    stateRef.current.wave = 1;
    setStability(100);
    stateRef.current.stability = 100;

    const diff = stateRef.current.difficulty || 'easy';
    const playerSpeed = diff === 'easy' ? 6.4 : diff === 'hard' ? 4.8 : 5.2;
    const playerCd = diff === 'easy' ? 85 : diff === 'hard' ? 135 : 120;

    playerRef.current = {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2 + 100,
      radius: 16,
      speed: playerSpeed,
      angle: 0,
      health: 100,
      maxHealth: 100,
      shootCooldown: playerCd,
      lastShotTime: 0,
      invulnerableTime: 0
    };

    setIsGameOver(false);
    setIsPaused(false);
    setIsPlaying(true);
    setSystemLogs([]);
    stateRef.current.logs = [];
    addSystemLog('▶ SYSTEM BOOT: SECURE FIREWALL DEPLOYED');
    addSystemLog('▶ UPTIME STATUS: CORE STABILIZED [100%]');

    if (!isMuted) {
      startProceduralBGM(() => 100);
    }
  };

  const handlePauseToggle = () => {
    playSound.glitchTick();
    setIsPaused(prev => !prev);
  };

  const handleMuteToggle = () => {
    playSound.glitchTick();
    setIsMuted(prev => !prev);
  };

  // Helper to spawn adware popup alert
  const triggerAdwarePopup = (partName: string) => {
    playSound.popupNotification();
    
    const titles = [
      '⚠️ SECURITY CORRUPTION ALERT',
      '❌ THREAT REGISTRY INFECTED',
      '🛡️ RANSOMWARE ENCRYPTION THREAT',
      '🔴 EXCEPTION CODE: 0x00F837',
      '🛑 SYSTEM BUFFER OVERFLOW DETECTED'
    ];

    const messages = [
      `${partName} Sector has been compromised.\nRun security cleanup immediately!`,
      `CRITICAL INTRUSION:\nMalware detected in host environment path.\nPlease click OK to quarantine.`,
      `WARNING: Illegal packet flow detected.\nFirewall layers are dissolving!\nAction is highly recommended.`,
      `A cyber-virus is overwriting registry indices.\nStability is dropping rapidly.`,
      `0xCA002D: Stack corruption triggered near memory storage cache.`
    ];

    const newPopup: AdwarePopup = {
      id: Math.random().toString(36).substring(2, 9),
      title: titles[Math.floor(Math.random() * titles.length)],
      message: messages[Math.floor(Math.random() * messages.length)],
      // Place within center-safe zones of the play view area
      x: Math.random() * (CANVAS_WIDTH - 360) + 50,
      y: Math.random() * (CANVAS_HEIGHT - 220) + 50,
      width: 320,
      height: 180,
      life: 8000 // duration before self-closing optionally
    };

    setPopups(prev => {
      const updated = [...prev, newPopup];
      stateRef.current.popups = updated;
      return updated;
    });

    addSystemLog(`⚠️ SCREEN MALWARE ALERT: POPUP SPAWNED!`);
  };

  // Handle adware popup dismiss
  const handleDismissPopup = (id: string) => {
    setPopups(prev => {
      const updated = prev.filter(p => p.id !== id);
      stateRef.current.popups = updated;
      return updated;
    });
  };

  // Master Canvas Game Loop
  useEffect(() => {
    let animationId: number;
    let lastTime = performance.now();

    const loop = (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animationId = requestAnimationFrame(loop);
        return;
      }

      const dt = timestamp - lastTime;
      lastTime = timestamp;

      // Ensure parts are initialized (especially on first render/standby)
      if (partsRef.current.length === 0) {
        initParts();
      }

      // Extract parts state variables for glitches
      const parts = partsRef.current;
      const destroyedCount = parts.filter(p => p.isDestroyed).length;
      
      const cpu = parts.find(p => p.id === 'CPU');
      const gpu = parts.find(p => p.id === 'GPU');
      const ram = parts.find(p => p.id === 'RAM');
      const ssd = parts.find(p => p.id === 'SSD');
      const psu = parts.find(p => p.id === 'PSU');

      // Glitch ratios (0 = perfect heal, 1 = broken)
      const cpuGlitch = cpu ? 1 - (cpu.health / cpu.maxHealth) : 0;
      const gpuGlitch = gpu ? 1 - (gpu.health / gpu.maxHealth) : 0;
      const ramGlitch = ram ? 1 - (ram.health / ram.maxHealth) : 0;
      const ssdGlitch = ssd ? 1 - (ssd.health / ssd.maxHealth) : 0;
      const psuGlitch = psu ? 1 - (psu.health / psu.maxHealth) : 0;

      const isGameActive = stateRef.current.isPlaying && !stateRef.current.isPaused && !stateRef.current.isGameOver;

      if (isGameActive) {
        // Dynamic System Stability calculated based on overall hardware parts' status
        const totalMaxHp = parts.reduce((acc, p) => acc + p.maxHealth, 0);
        const totalCurrentHp = parts.reduce((acc, p) => acc + p.health, 0);
        const computedStability = Math.ceil((totalCurrentHp / totalMaxHp) * 100);
        
        if (computedStability !== stateRef.current.stability) {
          stateRef.current.stability = computedStability;
          setStability(computedStability);

          // Check if all parts are destroyed
          if (destroyedCount === parts.length) {
            setIsGameOver(true);
            stateRef.current.isGameOver = true;
            playSound.gameOverCrash();
            stopProceduralBGM();
          }
        }

        // Update player state, bullets, enemies
        updateGamePhysics(timestamp, dt, cpuGlitch, ramGlitch, psuGlitch, ssdGlitch, destroyedCount);
      }

      // Render EVERYTHING to Canvas (continual rendering for standby screen, pause status screen info, etc.)
      renderGameBoard(cpuGlitch, gpuGlitch, ramGlitch, psuGlitch, destroyedCount);

      animationId = requestAnimationFrame(loop);
    };

    // Physics Engine Update
    const updateGamePhysics = (
      now: number, 
      dt: number, 
      cpuGlitch: number, 
      ramGlitch: number, 
      psuGlitch: number, 
      ssdGlitch: number,
      destroyedCount: number
    ) => {
      const keys = stateRef.current.keys;
      const mouse = stateRef.current.mouse;
      const player = playerRef.current;
      const waveVal = stateRef.current.wave;

      // --- PLAYER MOVEMENT (WASD or Arrow Keys) ---
      let dx = 0;
      let dy = 0;

      if (keys['w'] || keys['arrowup']) dy -= 1;
      if (keys['s'] || keys['arrowdown']) dy += 1;
      if (keys['a'] || keys['arrowleft']) dx -= 1;
      if (keys['d'] || keys['arrowright']) dx += 1;

      // Apply normalized speed vector
      if (dx !== 0 || dy !== 0) {
        const length = Math.sqrt(dx * dx + dy * dy);
        // Under heavy RAM glitch, sluggish speed or random stuttering is introduced!
        const speedScale = 1 - (ramGlitch * 0.3) + (Math.random() < ramGlitch * 0.1 ? -0.5 : 0);
        player.x += (dx / length) * player.speed * speedScale;
        player.y += (dy / length) * player.speed * speedScale;

        // Keep inside bounds
        player.x = Math.max(player.radius + 15, Math.min(CANVAS_WIDTH - player.radius - 15, player.x));
        player.y = Math.max(player.radius + 15, Math.min(CANVAS_HEIGHT - player.radius - 15, player.y));

        // Add cyber trails particles on movement
        if (Math.random() < 0.15 + (ramGlitch * 0.3)) {
          particlesRef.current.push({
            x: player.x - (dx / length) * 8,
            y: player.y - (dy / length) * 8,
            vx: -dx * 0.5 + (Math.random() - 0.5),
            vy: -dy * 0.5 + (Math.random() - 0.5),
            color: ramGlitch > 0.5 ? '#ffaa00' : '#00e1ff',
            radius: Math.random() * 3 + 1,
            alpha: 0.8,
            life: 0,
            maxLife: 20
          });
        }
      }

      // Rotate player towards mouse cursor elegantly and defensively
      const pmx = mouse.x - player.x;
      const pmy = mouse.y - player.y;
      if (!isNaN(pmx) && !isNaN(pmy) && (pmx !== 0 || pmy !== 0)) {
        const angleRad = Math.atan2(pmy, pmx);
        if (!isNaN(angleRad) && isFinite(angleRad)) {
          player.angle = angleRad;
        }
      }

      // --- AUTO-SHOOTING WEAPONS ENGINE ---
      if (mouse.isDown && now - player.lastShotTime > player.shootCooldown) {
        player.lastShotTime = now;
        playSound.shoot(cpuGlitch);

        // Vector direction towards cursor
        const bulletSpeed = 9.5;
        const bdx = mouse.x - player.x;
        const bdy = mouse.y - player.y;
        const dist = Math.sqrt(bdx * bdx + bdy * bdy);
        
        let vx = (bdx / dist) * bulletSpeed;
        let vy = (bdy / dist) * bulletSpeed;

        // CPU damaged: random target offsets / bullet spray inaccuracy
        if (cpuGlitch > 0.2) {
          const spread = (cpuGlitch * 0.45) * (Math.random() - 0.5);
          const c = Math.cos(spread);
          const s = Math.sin(spread);
          const nvx = vx * c - vy * s;
          const nvy = vx * s + vy * c;
          vx = nvx;
          vy = nvy;
        }

        bulletsRef.current.push({
          x: player.x + Math.cos(player.angle) * 18,
          y: player.y + Math.sin(player.angle) * 18,
          vx: vx,
          vy: vy,
          radius: 4,
          isPlayerShot: true,
          damage: 25
        });

        // Left-Side / Right-Side double spray if player registers a high score or CPU is healthy
        if (stateRef.current.score > 2500 && Math.random() < 0.4 && cpuGlitch < 0.3) {
          const spreadAngle = 0.18; // approx 10 degrees wide dual shot
          const c1 = Math.cos(spreadAngle);
          const s1 = Math.sin(spreadAngle);
          bulletsRef.current.push({
            x: player.x,
            y: player.y,
            vx: vx * c1 - vy * s1,
            vy: vx * s1 + vy * c1,
            radius: 4.5,
            isPlayerShot: true,
            damage: 25
          });
        }
      }

      // --- SKILLS ENGINE: CASTING & TRIGGERS ---
      const nowTime = now;
      const skills = stateRef.current.skills;
      const activeEnemies = enemiesRef.current;

      // 1. SKILL 1: EMP BLAST (SPACEBAR)
      if (keys[' '] && nowTime - skills.space.lastUsed > skills.space.cooldown) {
        skills.space.lastUsed = nowTime;
        playSound.explode(0.1); // Play retro booming explosion sound

        addSystemLog('🛡️ SYSTEM SHIELD: [SPACE] EMP BLAST RE-ROUTED!');

        // Push visual ring expanding from player
        visualEffectsRef.current.push({
          type: 'emp',
          x: player.x,
          y: player.y,
          radius: 10,
          maxRadius: 250,
          speed: 10,
          color: '#00ffff',
          alpha: 1.0
        });

        // Massive radial damage
        enemiesRef.current.forEach((enemy) => {
          const d = Math.hypot(enemy.x - player.x, enemy.y - player.y);
          if (d <= 250) {
            enemy.health -= 140; // deal heavy damage
            // Particles
            for (let i = 0; i < 4; i++) {
              particlesRef.current.push({
                x: enemy.x,
                y: enemy.y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                color: '#00ffff',
                radius: Math.random() * 3 + 1,
                alpha: 1,
                life: 0,
                maxLife: 20
              });
            }
          }
        });

        // Clear enemy bullets inside EMP area
        bulletsRef.current = bulletsRef.current.filter((bullet) => {
          if (!bullet.isPlayerShot) {
            const d = Math.hypot(bullet.x - player.x, bullet.y - player.y);
            if (d <= 250) {
              // Convert to tiny green floating restoration dust
              particlesRef.current.push({
                x: bullet.x,
                y: bullet.y,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                color: '#00ff42',
                radius: 2,
                alpha: 0.9,
                life: 0,
                maxLife: 15
              });
              return false; // destroy bullet
            }
          }
          return true;
        });
      }

      // 2. SKILL 2: FIREWALL BARRIER SHIELD (RIGHT-CLICK)
      if (stateRef.current.rightClickTriggered) {
        stateRef.current.rightClickTriggered = false; // Reset trigger
        if (nowTime - skills.rightClick.lastUsed > skills.rightClick.cooldown) {
          skills.rightClick.lastUsed = nowTime;
          skills.rightClick.activeUntil = nowTime + skills.rightClick.duration;
          playSound.popupNotification(); // play alert chime

          addSystemLog('🔒 FIREWALL ACTIVE: SECURE BARRIER INJECTION [4S]');

          // Reboot effect circle
          visualEffectsRef.current.push({
            type: 'reboot',
            x: player.x,
            y: player.y,
            radius: 10,
            maxRadius: 70,
            speed: 5,
            color: '#bf00ff',
            alpha: 1.0
          });
        }
      }

      // Firewall continuous contact shielding checks
      const isFirewallActive = nowTime < skills.rightClick.activeUntil;
      if (isFirewallActive) {
        // Purplish particle aura
        if (Math.random() < 0.45) {
          const rAngle = Math.random() * Math.PI * 2;
          particlesRef.current.push({
            x: player.x + Math.cos(rAngle) * 55,
            y: player.y + Math.sin(rAngle) * 55,
            vx: Math.cos(rAngle) * 1.5 + (Math.random() - 0.5) * 0.5,
            vy: Math.sin(rAngle) * 1.5 + (Math.random() - 0.5) * 0.5,
            color: '#bf00ff',
            radius: Math.random() * 3 + 1,
            alpha: 1.0,
            life: 0,
            maxLife: 20
          });
        }

        // Dissolve any incoming active malware bullets near player
        bulletsRef.current = bulletsRef.current.filter((bullet) => {
          if (!bullet.isPlayerShot) {
            const d = Math.hypot(bullet.x - player.x, bullet.y - player.y);
            if (d < 58) { // barrier radius contact
              particlesRef.current.push({
                x: bullet.x,
                y: bullet.y,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                color: '#bf00ff',
                radius: 1.8,
                alpha: 0.9,
                life: 0,
                maxLife: 15
              });
              return false; // delete bullet
            }
          }
          return true;
        });

        // Continuous high damage to nearby enemies inside firewall
        enemiesRef.current.forEach((enemy) => {
          const d = Math.hypot(enemy.x - player.x, enemy.y - player.y);
          if (d < 58) {
            enemy.health -= 4.2; // intense ticking barrier damage
            if (Math.random() < 0.15) {
              playSound.hit(0.12);
            }
          }
        });
      }

      // 3. SKILL 3: CYBER HOMING MISSILES (MOUSE WHEEL / CORELINK)
      if (stateRef.current.wheelTriggered) {
        stateRef.current.wheelTriggered = false; // Reset trigger
        if (nowTime - skills.wheel.lastUsed > skills.wheel.cooldown) {
          skills.wheel.lastUsed = nowTime;
          playSound.shoot(0.3); // play shoot laser/rocket sound

          addSystemLog('🚀 RAMPAGE MISSILES: DETECTING ADVERSARY CORES...');

          // Fire 8 homing rockets in a nice spiral starting offset
          const missileCount = 8;
          for (let i = 0; i < missileCount; i++) {
            const mAngle = (Math.PI * 2 / missileCount) * i;
            bulletsRef.current.push({
              x: player.x,
              y: player.y,
              vx: Math.cos(mAngle) * 3.2,
              vy: Math.sin(mAngle) * 3.2,
              radius: 6,
              isPlayerShot: true,
              damage: 65,
              isMissile: true,
              creationTime: nowTime
            } as any);
          }
        }
      }

      // --- UPDATE VISUAL SHOCKWAVE EFFECTS ---
      const activeEffects = visualEffectsRef.current;
      visualEffectsRef.current = activeEffects.filter((fx) => {
        fx.radius += fx.speed;
        fx.alpha = Math.max(0, 1.0 - (fx.radius / fx.maxRadius));
        return fx.radius < fx.maxRadius;
      });

      // --- UPDATE BULLETS & COMPUTE AUTOMATIC HOMING ---
      bulletsRef.current = bulletsRef.current.filter((bullet: any) => {
        // Homing computations
        if (bullet.isPlayerShot && activeEnemies.length > 0) {
          // Find closest threat
          let closestEnemy: Enemy | null = null;
          let closestDist = 999999;
          for (let i = 0; i < activeEnemies.length; i++) {
            const e = activeEnemies[i];
            const d = Math.hypot(e.x - bullet.x, e.y - bullet.y);
            if (d < closestDist) {
              closestDist = d;
              closestEnemy = e;
            }
          }

          if (closestEnemy) {
            const targetDx = closestEnemy.x - bullet.x;
            const targetDy = closestEnemy.y - bullet.y;
            const targetAngle = Math.atan2(targetDy, targetDx);
            const currentAngle = Math.atan2(bullet.vy, bullet.vx);

            let angleDiff = targetAngle - currentAngle;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

            if (bullet.isMissile) {
              // High response speed and steering adjustment for skills
              const turnRate = 0.16;
              const newAngle = currentAngle + angleDiff * turnRate;
              const lifetime = nowTime - (bullet.creationTime || nowTime);
              const missileSpeed = Math.min(13.2, 4.0 + (lifetime / 90)); // accelerates cleanly
              bullet.vx = Math.cos(newAngle) * missileSpeed;
              bullet.vy = Math.sin(newAngle) * missileSpeed;

              // Leave red engine exhaust sparks
              if (Math.random() < 0.4) {
                particlesRef.current.push({
                  x: bullet.x,
                  y: bullet.y,
                  vx: -bullet.vx * 0.2 + (Math.random() - 0.5) * 0.5,
                  vy: -bullet.vy * 0.2 + (Math.random() - 0.5) * 0.5,
                  color: '#ff4c00',
                  radius: Math.random() * 2 + 1,
                  alpha: 0.8,
                  life: 0,
                  maxLife: 12
                });
              }
            } else {
              // Regular Player Bullets track threats SLIGHTLY ("玉が少しだけ追従するようにして")
              const turnRate = 0.038; // fine tracking
              const newAngle = currentAngle + angleDiff * turnRate;
              const bulletSpeed = Math.hypot(bullet.vx, bullet.vy);
              bullet.vx = Math.cos(newAngle) * bulletSpeed;
              bullet.vy = Math.sin(newAngle) * bulletSpeed;
            }
          }
        }

        bullet.x += bullet.vx;
        bullet.y += bullet.vy;

        // Return false if out of screen borders
        return bullet.x >= 0 && bullet.x <= CANVAS_WIDTH && bullet.y >= 0 && bullet.y <= CANVAS_HEIGHT;
      });

      // --- WAVES & ENEMY SPAWNER LOGIC ---
      // Waves increase dynamically by score or time
      if (now - stateRef.current.lastWaveTime > 32000) { // Every 32 seconds next wave
        stateRef.current.lastWaveTime = now;
        stateRef.current.wave += 1;
        setWave(stateRef.current.wave);
        addSystemLog(`🚨 INTRUSION WAVE INCREASED: LEVEL ${stateRef.current.wave}`);
        playSound.popupNotification();

        // SYSTEM RESTORE: Auto-backup deployed on wave transition (helps with "むずい！" feedback)
        const currentDiff = stateRef.current.difficulty || 'easy';
        player.health = Math.min(player.maxHealth, player.health + 50);

        let healedPartCount = 0;
        let revivedPartName = '';

        // On easy mode, let's try to revive one destroyed component
        if (currentDiff === 'easy') {
          const destroyedParts = partsRef.current.filter(p => p.isDestroyed);
          if (destroyedParts.length > 0) {
            const partToRevive = destroyedParts[Math.floor(Math.random() * destroyedParts.length)];
            partToRevive.isDestroyed = false;
            partToRevive.health = 100;
            revivedPartName = partToRevive.jpName;
          }
        }

        partsRef.current.forEach(p => {
          if (!p.isDestroyed) {
            const healAmt = currentDiff === 'easy' ? p.maxHealth : 50;
            p.health = Math.min(p.maxHealth, p.health + healAmt);
            healedPartCount++;
          }
        });

        addSystemLog('🛠️ SYSTEM RESTORE: Auto-backup complete.');
        if (revivedPartName) {
          addSystemLog(`⚡ BACKUP REVIVAL: ${revivedPartName} has been fully rebooted!`);
        }
        addSystemLog(`💚 REPAIR STATUS: Healed player + ${healedPartCount} surviving component cores.`);
      }

      // Dynamic spawn intervals tailored closely to wave status and destroyed PC nodes
      const spawnIntervalBase = Math.max(450, 1900 - (stateRef.current.wave * 120) - (destroyedCount * 220));
      const spawnInterval = stateRef.current.difficulty === 'easy'
        ? spawnIntervalBase * 1.5
        : stateRef.current.difficulty === 'hard'
          ? spawnIntervalBase * 0.85
          : spawnIntervalBase;

      if (now - stateRef.current.lastSpawnTime > spawnInterval) {
        stateRef.current.lastSpawnTime = now;
        spawnEnemy(waveVal, ssdGlitch);
      }

      // --- MOVE & ENGAGE ENEMIES ---
      enemiesRef.current = activeEnemies.filter((enemy) => {
        // Find targeted part
        let targetX = player.x;
        let targetY = player.y;

        let targetDestroyed = false;

        if (enemy.targetId !== 'Player') {
          const targetedPart = partsRef.current.find(p => p.id === enemy.targetId);
          if (targetedPart) {
            targetX = targetedPart.x;
            targetY = targetedPart.y;
            targetDestroyed = targetedPart.isDestroyed;
          }
        }

        // If specific hardware target is destroyed, lock onto player or redirect to next healthy hardware component
        if (targetDestroyed || enemy.targetId === 'Player') {
          const availableParts = partsRef.current.filter(p => !p.isDestroyed);
          if (availableParts.length > 0 && Math.random() < 0.4) {
            const chosen = availableParts[Math.floor(Math.random() * availableParts.length)];
            enemy.targetId = chosen.id;
            targetX = chosen.x;
            targetY = chosen.y;
          } else {
            enemy.targetId = 'Player';
            targetX = player.x;
            targetY = player.y;
          }
        }

        // Calculate heading trajectory
        const tDx = targetX - enemy.x;
        const tDy = targetY - enemy.y;
        const tDist = Math.sqrt(tDx * tDx + tDy * tDy);

        // Angle heading
        enemy.angle = Math.atan2(tDy, tDx);

        // Specialized movement behavior based on Virus Type
        if (enemy.type === 'Worm') {
          // Worm movement: Slithers / oscillates dynamically
          enemy.wave = (enemy.wave || 0) + 0.12;
          const oscOffsetX = Math.cos(enemy.wave) * 2;
          const oscOffsetY = Math.sin(enemy.wave) * 2;
          
          enemy.vx = (tDx / tDist) * enemy.speed + oscOffsetX;
          enemy.vy = (tDy / tDist) * enemy.speed + oscOffsetY;
        } else if (enemy.type === 'Spyware') {
          // Spyware targets components from a distance and shoots malicious data packets
          if (tDist > 160) {
            enemy.vx = (tDx / tDist) * enemy.speed;
            enemy.vy = (tDy / tDist) * enemy.speed;
          } else {
            // Circle/Strafes target once close
            enemy.vx = -(tDy / tDist) * (enemy.speed * 0.8);
            enemy.vy = (tDx / tDist) * (enemy.speed * 0.8);

            // Periodically shoots malware bullets!
            if (!enemy.lastShotTime) enemy.lastShotTime = now;
            const shootCooldownVal = enemy.shootCooldown || 1800;
            if (now - enemy.lastShotTime > shootCooldownVal) {
              enemy.lastShotTime = now;
              bulletsRef.current.push({
                x: enemy.x,
                y: enemy.y,
                vx: (tDx / tDist) * 3.8,
                vy: (tDy / tDist) * 3.8,
                radius: 4,
                isPlayerShot: false,
                damage: 8
              });
            }
          }
        } else {
          // Heavy Trojans / Ransomware charges straight
          enemy.vx = (tDx / tDist) * enemy.speed;
          enemy.vy = (tDy / tDist) * enemy.speed;
        }

        // Apply velocities
        enemy.x += enemy.vx;
        enemy.y += enemy.vy;

        // --- COLLISION: Bullet to Enemy ---
        bulletsRef.current.forEach((bullet: any) => {
          if (bullet.isPlayerShot) {
            const bDist = Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y);
            if (bDist < enemy.radius + bullet.radius) {
              // Register hit damage
              enemy.health -= bullet.damage;
              bullet.x = -9999; // destroy bullet

              if (bullet.isMissile) {
                playSound.explode(0.15);
                // Create larger circular particle explosion for missiles
                for (let i = 0; i < 10; i++) {
                  const angle = Math.random() * Math.PI * 2;
                  const spd = Math.random() * 4 + 1.5;
                  particlesRef.current.push({
                    x: bullet.x,
                    y: bullet.y,
                    vx: Math.cos(angle) * spd,
                    vy: Math.sin(angle) * spd,
                    color: '#ff7700',
                    radius: Math.random() * 4 + 1,
                    alpha: 1.0,
                    life: 0,
                    maxLife: 30
                  });
                }
              } else {
                playSound.hit(cpuGlitch);
              }

              // Spawn tiny virus chunks
              for (let i = 0; i < 3; i++) {
                particlesRef.current.push({
                  x: enemy.x,
                  y: enemy.y,
                  vx: (Math.random() - 0.5) * 4,
                  vy: (Math.random() - 0.5) * 4,
                  color: enemy.color,
                  radius: Math.random() * 2.5 + 1.2,
                  alpha: 1,
                  life: 0,
                  maxLife: 25
                });
              }
            }
          }
        });

        // --- COLLISION: Player to Enemy ---
        const pDist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
        if (pDist < enemy.radius + player.radius) {
          // Deal contact damage
          player.health -= enemy.damage * 0.2;
          enemy.health = 0; // virus explodes on player
          playSound.hit(0.2);

          // Knockback effect
          player.x += Math.cos(enemy.angle) * 8;
          player.y += Math.sin(enemy.angle) * 8;

          // Screen static explosion particles
          for (let i = 0; i < 6; i++) {
            particlesRef.current.push({
              x: player.x,
              y: player.y,
              vx: (Math.random() - 0.5) * 6,
              vy: (Math.random() - 0.5) * 6,
              color: '#00ffff',
              radius: Math.random() * 3.5 + 2,
              alpha: 0.9,
              life: 0,
              maxLife: 30
            });
          }
        }

        // --- COLLISION: Enemy to targeted Hardware Component ---
        if (enemy.targetId !== 'Player') {
          const piece = partsRef.current.find(p => p.id === enemy.targetId);
          if (piece && !piece.isDestroyed) {
            // Core overlapping checking
            // Match against rectangular boundary with simple box collision
            const halfW = piece.width / 2;
            const halfH = piece.height / 2;

            const inBox = (
              enemy.x >= piece.x - halfW && enemy.x <= piece.x + halfW &&
              enemy.y >= piece.y - halfH && enemy.y <= piece.y + halfH
            );

            if (inBox) {
              // Deal localized raw hardware damage
              piece.health -= enemy.damage;
              
              // Virus explodes/deteriorates while corrupting
              enemy.health = 0;

              // Register sound & splash damage sparks
              playSound.hit(0.5);
              for (let i = 0; i < 8; i++) {
                particlesRef.current.push({
                  x: enemy.x,
                  y: enemy.y,
                  vx: (Math.random() - 0.5) * 5,
                  vy: (Math.random() - 0.5) * 5,
                  color: '#ff3b30',
                  radius: Math.random() * 3 + 1,
                  alpha: 1,
                  life: 0,
                  maxLife: 24
                });
              }

              // Evaluate if destroyed
              if (piece.health <= 0) {
                piece.health = 0;
                piece.isDestroyed = true;
                playSound.explode(0.6);
                
                addSystemLog(`🚨 CRITICAL: ${piece.name} HAS BEEN DESTROYED!`);
                
                // Spawn giant smoke columns
                for (let i = 0; i < 30; i++) {
                  particlesRef.current.push({
                    x: piece.x + (Math.random() - 0.5) * piece.width,
                    y: piece.y + (Math.random() - 0.5) * piece.height,
                    vx: (Math.random() - 0.5) * 3,
                    vy: (Math.random() - 0.5) * 3,
                    color: Math.random() > 0.5 ? '#ff3b30' : '#444444',
                    radius: Math.random() * 6 + 3,
                    alpha: 1,
                    life: 0,
                    maxLife: 60
                  });
                }

                // If SSD fails, trigger a direct state popup immediately
                if (piece.id === 'SSD') {
                  triggerAdwarePopup(piece.name);
                }
              }
            }
          }
        }

        // If virus health drops to <= 0, award scores and trigger point text
        if (enemy.health <= 0) {
          stateRef.current.score += enemy.scoreValue;
          setScore(stateRef.current.score);

          // Adware popup generation chance if SSD block is already damaged
          if (ssdGlitch > 0.15 && Math.random() < ssdGlitch * 0.18) {
            triggerAdwarePopup('SSD Drive Core');
          }

          // Floating score text particle
          particlesRef.current.push({
            x: enemy.x,
            y: enemy.y - 10,
            vx: 0,
            vy: -0.8,
            color: '#00ff42',
            radius: 0.1, // text uses custom renderer
            alpha: 1,
            life: 0,
            maxLife: 35,
            text: `+${enemy.scoreValue}`
          });

          return false; // delete virus from loops
        }

        return true;
      });

      // --- ENEMY BULLETS COLLIDING WITH PLAYER & HARDWARE ---
      bulletsRef.current.forEach((bullet) => {
        if (!bullet.isPlayerShot) {
          // Check player collision
          const distToPlayer = Math.hypot(bullet.x - player.x, bullet.y - player.y);
          if (distToPlayer < player.radius + bullet.radius) {
            player.health -= bullet.damage;
            bullet.x = -9999;
            playSound.hit(0.2);

            // Flash micro-particles
            for (let i = 0; i < 3; i++) {
              particlesRef.current.push({
                x: bullet.x,
                y: bullet.y,
                vx: (Math.random() - 0.5) * 3,
                vy: (Math.random() - 0.5) * 3,
                color: '#ff3b30',
                radius: 2,
                alpha: 0.8,
                life: 0,
                maxLife: 15
              });
            }
          }

          // Check hardware target collisions
          partsRef.current.forEach((piece) => {
            if (!piece.isDestroyed) {
              const inBox = (
                bullet.x >= piece.x - piece.width / 2 && bullet.x <= piece.x + piece.width / 2 &&
                bullet.y >= piece.y - piece.height / 2 && bullet.y <= piece.y + piece.height / 2
              );
              if (inBox) {
                piece.health -= bullet.damage * 0.4;
                bullet.x = -9999;
                playSound.hit(0.4);

                if (piece.health <= 0) {
                  piece.health = 0;
                  piece.isDestroyed = true;
                  playSound.explode(0.8);
                  addSystemLog(`🚨 CRITICAL: ${piece.name} HAS DESTROYED BY MALICIOUS BULLET!`);
                }
              }
            }
          });
        }
      });

      // --- FILTER DESTROYED BULLETS ---
      bulletsRef.current = bulletsRef.current.filter(b => b.x > -100);

      // --- UPDATE PARTICLES ---
      particlesRef.current = particlesRef.current.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life += 1;
        p.alpha = 1 - p.life / p.maxLife;

        // Decelerate standard smoke/point particle velocities as they age
        p.vx *= 0.95;
        p.vy *= 0.95;

        return p.life < p.maxLife;
      });
    };

    // Spawn a customizable enemy virus near one of our motherboard connector ports
    const spawnEnemy = (waveLevel: number, ssdGlitch: number) => {
      const port = SPARK_PORTS[Math.floor(Math.random() * SPARK_PORTS.length)];
      
      // Determine virus type dynamically based on current level and random ratios
      const types: EnemyType[] = ['Worm', 'Trojan', 'Spyware'];
      if (waveLevel >= 3) types.push('Ransomware');
      
      // Random pick with weight biased towards fast slithery worms or spyware on early waves
      let chosenType: EnemyType = 'Worm';
      const rand = Math.random();
      if (waveLevel >= 4 && rand < 0.12) {
        chosenType = 'Ransomware';
      } else if (rand < 0.4) {
        chosenType = 'Worm';
      } else if (rand < 0.75) {
        chosenType = 'Trojan';
      } else {
        chosenType = 'Spyware';
      }

      // Configure individual characteristics depending on structural Malware Registry
      let radius = 10;
      let hp = 30 + waveLevel * 8;
      let speed = 1.3 + (waveLevel * 0.15);
      let damage = 22 + waveLevel * 3;
      let scoreVal = 100;
      let color = '#34c759'; // malware bright green

      if (chosenType === 'Trojan') {
        radius = 15;
        hp = 70 + waveLevel * 14;
        speed = 0.85 + (waveLevel * 0.1);
        damage = 44 + waveLevel * 5;
        scoreVal = 150;
        color = '#0055ff'; // trojan deep blue
      } else if (chosenType === 'Spyware') {
        radius = 12;
        hp = 45 + waveLevel * 10;
        speed = 1.25 + (waveLevel * 0.1);
        damage = 25 + waveLevel * 2;
        scoreVal = 200;
        color = '#bf00ff'; // spyware deep violet
      } else if (chosenType === 'Ransomware') {
        radius = 22;
        hp = 220 + waveLevel * 35;
        speed = 0.7 + (waveLevel * 0.08);
        damage = 80 + waveLevel * 10;
        scoreVal = 500;
        color = '#ff0000'; // ransomware warning red
      }

      // Apply difficulty scaling multipliers
      const diffMode = stateRef.current.difficulty || 'easy';
      let hpMult = 1.0;
      let speedMult = 1.0;
      let damageMult = 1.0;
      if (diffMode === 'easy') {
        hpMult = 0.55;
        speedMult = 0.70;
        damageMult = 0.50;
      } else if (diffMode === 'hard') {
        hpMult = 1.25;
        speedMult = 1.15;
        damageMult = 1.25;
      }

      hp = Math.ceil(hp * hpMult);
      speed = speed * speedMult;
      damage = Math.ceil(damage * damageMult);

      // Identify targeting target (highest damage targets CPU or weakest component, or is player focused)
      let target: PartType | 'Player' = 'Player';
      const intactParts = partsRef.current.filter(p => !p.isDestroyed);
      if (intactParts.length > 0 && Math.random() < 0.7) {
        // Targets healthiest or weakest or random component
        target = intactParts[Math.floor(Math.random() * intactParts.length)].id;
      }

      const offsetRadius = 25;
      const startX = port.x + (Math.random() - 0.5) * offsetRadius;
      const startY = port.y + (Math.random() - 0.5) * offsetRadius;

      enemiesRef.current.push({
        id: Math.random().toString(36).substring(2, 9),
        type: chosenType,
        x: startX,
        y: startY,
        radius: radius,
        vx: 0,
        vy: 0,
        health: hp,
        maxHealth: hp,
        speed: speed,
        damage: damage,
        scoreValue: scoreVal,
        targetId: target,
        shootCooldown: 1500 + Math.random() * 800,
        lastShotTime: 0,
        color: color,
        wave: Math.random() * Math.PI
      });

      // Spawn portal entry particles
      for (let i = 0; i < 6; i++) {
        particlesRef.current.push({
          x: startX,
          y: startY,
          vx: (Math.random() - 0.5) * 4,
          vy: (Math.random() - 0.5) * 4,
          color: color,
          radius: Math.random() * 2 + 1,
          alpha: 1,
          life: 0,
          maxLife: 20
        });
      }

      // Print threat spawn context
      if (Math.random() < 0.25 || chosenType === 'Ransomware') {
        addSystemLog(`⚠️ INTRUSION DETECTED: [${chosenType}] emerged via ${port.name}`);
      }
    };

    // Motherboard Graphics Rendering Engine (HTML Canvas fallback)
    const renderGameBoard = (
      cpuGlitch: number, 
      gpuGlitch: number, 
      ramGlitch: number, 
      psuGlitch: number,
      destroyedCount: number
    ) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const player = playerRef.current;
      const enemies = enemiesRef.current;
      const bullets = bulletsRef.current;
      const particles = particlesRef.current;
      const parts = partsRef.current;

      // RAM destroyed status: Motion trail overlay instead of complete erase
      if (ramGlitch > 0.05) {
        // If RAM is destroyed, trails increase heavily, simulating extreme buffer lag
        const alphaFade = Math.max(0.04, 0.22 - (ramGlitch * 0.18));
        ctx.fillStyle = `rgba(5, 12, 6, ${alphaFade})`;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      } else {
        // Clean high-tech circuit green black background
        ctx.fillStyle = '#030a05';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }

      // --- VISUAL BOARD BACKGROUND GRID & TRACES ---
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0, 225, 66, 0.04)';
      const step = 40;
      for (let x = 0; x < CANVAS_WIDTH; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y < CANVAS_HEIGHT; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }

      // Draw metallic physical borders of the silicon wafer
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#052a10';
      ctx.strokeRect(8, 8, CANVAS_WIDTH - 16, CANVAS_HEIGHT - 16);

      // --- THE GOLDEN CIRCUIT PATHWAYS CONNECTING COMPONENTS ---
      ctx.lineWidth = 1.5;
      parts.forEach((part) => {
        if (!part.isDestroyed) {
          ctx.strokeStyle = 'rgba(0, 225, 100, 0.12)';
          ctx.shadowBlur = 0;
        } else {
          // If destroyed, rendering lines glows red and sparks glitchily
          ctx.strokeStyle = Math.random() < 0.4 ? 'rgba(255, 59, 48, 0.2)' : 'rgba(100, 100, 100, 0.05)';
        }

        // Draw connections from all outer ports to central CPU
        SPARK_PORTS.forEach((port) => {
          ctx.beginPath();
          ctx.moveTo(port.x, port.y);
          // Standard orthagonal L-shaped tracks
          ctx.lineTo(part.x, port.y);
          ctx.lineTo(part.x, part.y);
          ctx.stroke();
        });
      });

      // --- DRAW SPARK PORTS ON EDGES ---
      SPARK_PORTS.forEach((port) => {
        ctx.fillStyle = '#102515';
        ctx.strokeStyle = '#00ff42';
        ctx.lineWidth = 2;
        ctx.fillRect(port.x - 15, port.y - 15, 30, 30);
        ctx.strokeRect(port.x - 15, port.y - 15, 30, 30);

        // LED blinking status
        ctx.beginPath();
        ctx.arc(port.x, port.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = Math.random() < 0.5 ? '#ff3b30' : '#00ff42';
        ctx.fill();

        // Port Text Label
        ctx.font = '8px var(--font-mono)';
        ctx.fillStyle = '#00ff42';
        ctx.textAlign = 'center';
        ctx.fillText(port.name, port.x, port.y < 50 ? port.y + 25 : port.y - 20);
      });

      // --- DRAW PHYSICAL HARDWARE COMPONENTS ---
      parts.forEach((part) => {
        const halfW = part.width / 2;
        const halfH = part.height / 2;

        if (!part.isDestroyed) {
          // Healthy Glow Shadow
          ctx.shadowBlur = 10;
          ctx.shadowColor = part.color;

          // Draw central board chip background
          ctx.fillStyle = 'rgba(5, 30, 15, 0.85)';
          ctx.strokeStyle = part.color;
          ctx.lineWidth = 2;
          ctx.fillRect(part.x - halfW, part.y - halfH, part.width, part.height);
          ctx.strokeRect(part.x - halfW, part.y - halfH, part.width, part.height);

          // Draw microprocessor pins decoration
          ctx.shadowBlur = 0;
          ctx.strokeStyle = '#c49a1d'; // Gold traces
          ctx.lineWidth = 1;

          // Upper and Lower pin rails
          for (let px = part.x - halfW + 10; px < part.x + halfW - 5; px += 8) {
            ctx.strokeRect(px, part.y - halfH - 4, 3, 4);
            ctx.strokeRect(px, part.y + halfH, 3, 4);
          }
          // Left and Right pin rails
          for (let py = part.y - halfH + 10; py < part.y + halfH - 5; py += 8) {
            ctx.strokeRect(part.x - halfW - 4, py, 4, 3);
            ctx.strokeRect(part.x + halfW, py, 4, 3);
          }

          // Core chip inner rectangle
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.fillRect(part.x - halfW + 15, part.y - halfH + 15, part.width - 30, part.height - 30);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.strokeRect(part.x - halfW + 15, part.y - halfH + 15, part.width - 30, part.height - 30);

          // Component Name Standard Label Render
          ctx.font = 'bold 9px var(--font-mono)';
          ctx.fillStyle = part.color;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(part.id, part.x, part.y - 12);

          // Health bar background
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.fillRect(part.x - halfW + 15, part.y + 10, part.width - 30, 6);
          
          // Glowing green/blue health ratio meter
          const hpRatio = part.health / part.maxHealth;
          ctx.fillStyle = hpRatio > 0.5 ? '#00ee44' : hpRatio > 0.25 ? '#ffaa00' : '#ff3120';
          ctx.fillRect(part.x - halfW + 15, part.y + 10, (part.width - 30) * hpRatio, 6);

          // Microtext describing status
          ctx.font = '8px var(--font-mono)';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(`${part.health}/${part.maxHealth} HP`, part.x, part.y + 24);

          // Visual Low Health Core Warnings ("わかりやすい見た目にして")
          if (hpRatio <= 0.4) {
            ctx.save();
            const pulseColor = Math.sin(Date.now() / 110) > 0 ? '#ff3b30' : 'rgba(255, 59, 48, 0.1)';
            ctx.strokeStyle = pulseColor;
            ctx.lineWidth = 2.5;
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#ff3b30';
            ctx.strokeRect(part.x - halfW - 4, part.y - halfH - 4, part.width + 8, part.height + 8);
            
            // Blinking Warning overlay text
            ctx.font = 'bold 8px var(--font-mono)';
            ctx.fillStyle = '#ff3b30';
            ctx.textAlign = 'center';
            ctx.fillText('⚠️ WARNING: SYSTEM OUTFLOW', part.x, part.y - halfH - 12);
            ctx.restore();
          }

          // Specialized dynamic animations inside component chips
          if (part.id === 'CPU') {
            // Processing pulsing line
            ctx.beginPath();
            ctx.arc(part.x, part.y - 35, 12 + Math.sin(Date.now() / 150) * 2, 0, Math.PI * 2);
            ctx.strokeStyle = '#00ff42';
            ctx.stroke();
          } else if (part.id === 'GPU') {
            // Fan spinning wireframes
            ctx.save();
            ctx.translate(part.x, part.y - 35);
            ctx.rotate(Date.now() / 150);
            ctx.strokeStyle = '#a000ff';
            ctx.beginPath();
            ctx.arc(0, 0, 15, 0, Math.PI * 2);
            ctx.stroke();
            for (let f = 0; f < 3; f++) {
              ctx.rotate(Math.PI * 2 / 3);
              ctx.strokeRect(-3, -15, 6, 12);
            }
            ctx.restore();
          }

        } else {
          // --- COMPONENT IS TOTALLY INJECTED/DESTROYED ---
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#140003';
          ctx.strokeStyle = Math.random() < 0.2 ? '#ff3b30' : '#3d0a0d';
          ctx.lineWidth = 2;
          ctx.fillRect(part.x - halfW, part.y - halfH, part.width, part.height);
          ctx.strokeRect(part.x - halfW, part.y - halfH, part.width, part.height);

          // Red glowing diagonal hazard wire stripes across destroyed card
          ctx.strokeStyle = 'rgba(255, 59, 48, 0.2)';
          ctx.lineWidth = 1;
          for (let off = -part.width; off < part.width; off += 12) {
            ctx.beginPath();
            ctx.moveTo(part.x - halfW, part.y - halfH + off);
            ctx.lineTo(part.x + halfW, part.y - halfH + off + part.width);
            ctx.stroke();
          }

          // Error / BSOD Scrambled Text
          ctx.font = 'bold 11px var(--font-mono)';
          ctx.fillStyle = '#ff3b30';
          ctx.textAlign = 'center';
          ctx.fillText('CRITICAL_ERR', part.x, part.y - 10);
          ctx.font = '8px var(--font-mono)';
          ctx.fillText('STATUS: CORRUPT', part.x, part.y + 10);
          
          // Glitching code address overlay
          if (Math.random() < 0.1) {
            ctx.font = '7px var(--font-mono)';
            ctx.fillStyle = 'rgba(255, 59, 48, 0.6)';
            ctx.fillText(`0x${(Math.random() * 0xFFFFF).toString(16).toUpperCase()}`, part.x, part.y + 25);
          }
        }
      });

      // --- DRAW PLAYER SECURITY BLOCK DRONE ---
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(player.angle);

      // Render outer shields if CPU/PSU are stable
      if (player.invulnerableTime > 0) {
        ctx.beginPath();
        ctx.arc(0, 0, player.radius + 8, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Cyber ship structure (Antivirus Security Vessel design)
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#00ff42';
      ctx.fillStyle = '#0a3a1f';
      ctx.strokeStyle = '#00ff42';
      ctx.lineWidth = 2;

      ctx.beginPath();
      // Triangle ship pointing to the right
      ctx.moveTo(18, 0);
      ctx.lineTo(-12, -14);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-12, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Reactor core fire glow in the trailing end
      ctx.fillStyle = Math.random() < 0.5 ? '#ff9a00' : '#00ffd2';
      ctx.beginPath();
      ctx.arc(-8, 0, 4, 0, Math.PI * 2);
      ctx.fill();

      // Dual side engines barrels
      ctx.fillStyle = '#10301d';
      ctx.fillRect(-2, -11, 4, 4);
      ctx.fillRect(-2, 7, 4, 4);

      ctx.restore();
      ctx.shadowBlur = 0;

      // Draw active Firewall Shield ring around the player position
      const nowTs = Date.now();
      const firewallActive_is = nowTs < stateRef.current.skills.rightClick.activeUntil;
      if (firewallActive_is) {
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#bf00ff';
        ctx.strokeStyle = '#bf00ff';
        ctx.lineWidth = 2.5;

        // Glowing secure barrier ring
        ctx.beginPath();
        ctx.arc(player.x, player.y, 55, 0, Math.PI * 2);
        ctx.stroke();

        // Pulsing secondary internal dashed honeycomb ring
        ctx.strokeStyle = 'rgba(191, 0, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(player.x, player.y, 48 + Math.sin(nowTs / 70) * 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // --- DRAW ENEMIES (VIRUSES) ---
      enemies.forEach((enemy) => {
        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        ctx.rotate(enemy.angle || 0);

        ctx.shadowBlur = 8;
        ctx.shadowColor = enemy.color;
        ctx.fillStyle = 'rgba(15, 5, 5, 0.9)';
        ctx.strokeStyle = enemy.color;
        ctx.lineWidth = 2;

        if (enemy.type === 'Worm') {
          // Snake-like malware bug with pulsing antenna
          ctx.beginPath();
          ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Spiky legs
          ctx.beginPath();
          ctx.moveTo(-enemy.radius, -5); ctx.lineTo(-enemy.radius - 5, -8);
          ctx.moveTo(-enemy.radius, 5);  ctx.lineTo(-enemy.radius - 5, 8);
          ctx.stroke();

          // Inner virus core
          ctx.fillStyle = enemy.color;
          ctx.beginPath();
          ctx.arc(3, 0, 3, 0, Math.PI * 2);
          ctx.fill();

        } else if (enemy.type === 'Trojan') {
          // Heavy microchip bug block
          ctx.fillRect(-enemy.radius, -enemy.radius, enemy.radius * 2, enemy.radius * 2);
          ctx.strokeRect(-enemy.radius, -enemy.radius, enemy.radius * 2, enemy.radius * 2);

          // Danger cross hazard inside Trojan
          ctx.strokeStyle = enemy.color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(-enemy.radius + 4, -enemy.radius + 4);
          ctx.lineTo(enemy.radius - 4, enemy.radius - 4);
          ctx.moveTo(enemy.radius - 4, -enemy.radius + 4);
          ctx.lineTo(-enemy.radius + 4, enemy.radius - 4);
          ctx.stroke();

        } else if (enemy.type === 'Spyware') {
          // Circular camera spy with rotating outer lens
          ctx.beginPath();
          ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Rotating laser sight
          ctx.save();
          ctx.rotate(Date.now() / 250);
          ctx.strokeStyle = 'rgba(191, 0, 255, 0.5)';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(enemy.radius + 12, 0);
          ctx.stroke();
          ctx.restore();

          ctx.fillStyle = '#bf00ff';
          ctx.beginPath();
          ctx.arc(0, 0, 4, 0, Math.PI * 2);
          ctx.fill();

        } else if (enemy.type === 'Ransomware') {
          // Dangerous boss hexagon lock
          ctx.beginPath();
          const r = enemy.radius;
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const px = Math.cos(angle) * r;
            const py = Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Padlock shackle icon drawn overlay
          ctx.strokeStyle = '#ff0000';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, -3, 6, Math.PI, 0);
          ctx.stroke();

          ctx.fillStyle = '#ff0000';
          ctx.fillRect(-6, 0, 12, 10);

          // Text overlay
          ctx.font = 'bold 8px var(--font-mono)';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText('LOCK', 0, 6);
        }

        ctx.restore();
        ctx.shadowBlur = 0;

        // Health meter bar drawn over each virus
        const ehRatio = enemy.health / enemy.maxHealth;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(enemy.x - 12, enemy.y - enemy.radius - 8, 24, 4);
        ctx.fillStyle = '#ff3b30';
        ctx.fillRect(enemy.x - 12, enemy.y - enemy.radius - 8, 24 * ehRatio, 4);
      });

      // --- DRAW BULLETS ---
      bullets.forEach((bullet) => {
        ctx.shadowBlur = 6;
        if (bullet.isPlayerShot) {
          // Player laser bolts (bright neon teal)
          ctx.fillStyle = '#00ffff';
          ctx.shadowColor = '#00ffff';
          ctx.beginPath();
          ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Malice malware data packets (dark purple/magenta)
          ctx.fillStyle = '#ff0077';
          ctx.shadowColor = '#ff0077';
          ctx.beginPath();
          ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.shadowBlur = 0;

      // --- DRAW PARTICLES & SCORE TEXTS ---
      particles.forEach((p) => {
        ctx.save();
        ctx.globalAlpha = p.alpha;

        if (p.text) {
          // Displaying micro-integers / damage numbers (`+100`)
          ctx.font = 'bold 10px var(--font-mono)';
          ctx.fillStyle = p.color;
          ctx.textAlign = 'center';
          ctx.fillText(p.text, p.x, p.y);
        } else {
          // Standard sparks / cloud particles
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      // --- CPU GLITCH: FLOATING BINARY DATA NOISE OVERLAY ---
      if (cpuGlitch > 0.1) {
        ctx.save();
        ctx.font = '9px var(--font-mono)';
        // Spawns columns of binary stream garbage when CPU suffers stability losses
        const codeDensity = Math.floor(cpuGlitch * 12);
        for (let i = 0; i < codeDensity; i++) {
          const streamX = Math.random() * CANVAS_WIDTH;
          const streamY = Math.random() * CANVAS_HEIGHT;
          const randText = Math.random() < 0.5 ? '01001' : '0xFA78D';
          ctx.fillStyle = `rgba(0, 225, 66, ${cpuGlitch * 0.25})`;
          ctx.fillText(randText, streamX, streamY);
        }
        ctx.restore();
      }

      // --- GPU GLITCH: DIGITAL MEMORY CORRUPTION SLICES ---
      if (gpuGlitch > 0.15 && Math.random() < gpuGlitch * 0.5) {
        // Core slice displacement algorithm
        const sliceY = Math.random() * CANVAS_HEIGHT;
        const sliceHeight = Math.random() * 80 + 15;
        const driftOffset = (Math.random() * 45 - 22.5) * gpuGlitch;
        
        ctx.save();
        // Shift a rectangular channel to simulate memory displacement
        ctx.drawImage(
          canvas,
          0, sliceY, CANVAS_WIDTH, sliceHeight, // source slice
          driftOffset, sliceY, CANVAS_WIDTH, sliceHeight // displaced target
        );
        ctx.restore();
      }

      // --- PSU GLITCH: SCREEN STATIC STATIC BURSTS ---
      if (psuGlitch > 0.1 && Math.random() < psuGlitch * 0.16) {
        ctx.fillStyle = `rgba(0, 0, 0, ${psuGlitch * 0.72})`;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Flash an analog white noise band sliding downward
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(0, Math.random() * CANVAS_HEIGHT, CANVAS_WIDTH, 12);
      }

      // --- DRAW SYSTEM SHOCKWAVE VISUAL EFFECTS (EMP, REBOOTS) ---
      visualEffectsRef.current.forEach((fx) => {
        ctx.save();
        ctx.shadowBlur = 18;
        ctx.shadowColor = fx.color;
        ctx.strokeStyle = fx.color;
        
        if (fx.type === 'emp') {
          ctx.lineWidth = 4.5 * fx.alpha;
          ctx.beginPath();
          ctx.arc(fx.x, fx.y, fx.radius, 0, Math.PI * 2);
          ctx.stroke();

          // Double ripple ring
          ctx.lineWidth = 1.5 * fx.alpha;
          ctx.beginPath();
          ctx.arc(fx.x, fx.y, fx.radius * 0.78, 0, Math.PI * 2);
          ctx.stroke();
        } else if (fx.type === 'reboot') {
          ctx.lineWidth = 3 * fx.alpha;
          ctx.beginPath();
          ctx.arc(fx.x, fx.y, fx.radius, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      });

      // --- DRAW ON-CANVAS NEON SKILLS HUD ---
      if (isPlaying && !isPaused && !isGameOver) {
        const skillsObj = stateRef.current.skills;
        const nowMs = Date.now();

        // Position bottom center horizontally
        const hudX = CANVAS_WIDTH / 2 - 210;
        const hudY = CANVAS_HEIGHT - 35;
        const widthPerSkill = 132;
        const heightSkill = 22;

        const skillsData = [
          {
            key: 'SPACE',
            jpName: 'EMP衝撃波',
            lastUsed: skillsObj.space.lastUsed,
            cooldown: skillsObj.space.cooldown,
            color: '#00ffff'
          },
          {
            key: '右クリック',
            jpName: 'ファイアウォール',
            lastUsed: skillsObj.rightClick.lastUsed,
            cooldown: skillsObj.rightClick.cooldown,
            color: '#bf00ff'
          },
          {
            key: '中/中クリック',
            jpName: '追尾ミサイル',
            lastUsed: skillsObj.wheel.lastUsed,
            cooldown: skillsObj.wheel.cooldown,
            color: '#ff8c00'
          }
        ];

        skillsData.forEach((skill, idx) => {
          const sx = hudX + idx * (widthPerSkill + 12);
          const elapsed = nowMs - skill.lastUsed;
          const isReady = elapsed >= skill.cooldown;
          const pct = isReady ? 1.0 : elapsed / skill.cooldown;

          // Draw backdrop frame
          ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
          ctx.strokeStyle = isReady ? skill.color : 'rgba(120, 120, 120, 0.35)';
          ctx.lineWidth = isReady ? 1.5 : 1;
          ctx.fillRect(sx, hudY, widthPerSkill, heightSkill);
          ctx.strokeRect(sx, hudY, widthPerSkill, heightSkill);

          if (!isReady) {
            // Draw red/orange loading bar progress overlay
            ctx.fillStyle = 'rgba(255, 59, 48, 0.25)';
            ctx.fillRect(sx + 1, hudY + 1, (widthPerSkill - 2) * pct, heightSkill - 2);
          } else if (isReady && Math.sin(nowMs / 120) > 0.2) {
            // Shiny neon pulse indicator when fully charged
            ctx.fillStyle = `${skill.color}20`;
            ctx.fillRect(sx + 1, hudY + 1, widthPerSkill - 2, heightSkill - 2);
          }

          // Hotkey symbol on left
          ctx.font = 'bold 8px var(--font-mono)';
          ctx.fillStyle = isReady ? '#ffffff' : '#777777';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(`[${skill.key}]`, sx + 6, hudY + heightSkill / 2);

          // Skill Label on right
          ctx.font = 'bold 8px var(--font-sans)';
          ctx.fillStyle = isReady ? skill.color : '#888888';
          ctx.textAlign = 'right';
          ctx.fillText(skill.jpName, sx + widthPerSkill - 6, hudY + heightSkill / 2);

          // Numeric cooldown centered
          if (!isReady) {
            ctx.font = 'bold 8px var(--font-mono)';
            ctx.fillStyle = '#ff3b30';
            ctx.textAlign = 'center';
            const leftSec = ((skill.cooldown - elapsed) / 1000).toFixed(1);
            ctx.fillText(`${leftSec}S`, sx + widthPerSkill / 2 + 5, hudY + heightSkill / 2);
          }
        });
      }
    };

    // Start the master game loop
    animationId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, []);

  // Text scrambler utility used for CPU glitches on the HTML text dashboard readouts
  const scrambleText = (originalText: string, activeGlitch: number) => {
    if (activeGlitch < 0.1) return originalText;

    const glitchChars = [
      '░', '▒', '▓', '█', 'Ø', 'Æ', '¤', '§', '¶', '†', '‡', '0', '1', 'F', 'X', '■', '▲', '◆', '?', '!', '$', '%', '*', '#', '<', '>'
    ];
    
    return originalText
      .split('')
      .map((char) => {
        // Space characters remain safe to maintain layout structures
        if (char === ' ') return char;
        // Scramble ratio depends directly on CPU physical damage
        if (Math.random() < activeGlitch * 0.45) {
          return glitchChars[Math.floor(Math.random() * glitchChars.length)];
        }
        return char;
      })
      .join('');
  };

  // Status values of parts for UI readout
  const parts = partsRef.current;
  const cpuPart = parts.find(p => p.id === 'CPU');
  const gpuPart = parts.find(p => p.id === 'GPU');
  const ramPart = parts.find(p => p.id === 'RAM');
  const ssdPart = parts.find(p => p.id === 'SSD');
  const psuPart = parts.find(p => p.id === 'PSU');

  const cpuGlitchRatio = cpuPart ? 1 - (cpuPart.health / cpuPart.maxHealth) : 0;
  const gpuGlitchRatio = gpuPart ? 1 - (gpuPart.health / gpuPart.maxHealth) : 0;
  const ramGlitchRatio = ramPart ? 1 - (ramPart.health / ramPart.maxHealth) : 0;
  const ssdGlitchRatio = ssdPart ? 1 - (ssdPart.health / ssdPart.maxHealth) : 0;
  const psuGlitchRatio = psuPart ? 1 - (psuPart.health / psuPart.maxHealth) : 0;

  return (
    <div 
      ref={containerRef}
      id="game-viewport" 
      className="relative flex flex-col items-center justify-start min-h-screen w-full bg-[#030604] py-4 px-2 md:px-6 text-[#00ff42] font-sans overflow-x-hidden crt-overlay"
    >
      {/* Glitch CRT monitor flickering layout wrapper */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,0,0,0.45))] pointer-events-none z-30"></div>

      {/* Main Terminal Header */}
      <header className="w-full max-w-5xl flex flex-col md:flex-row items-center justify-between gap-3 mb-3 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 border border-[#00ff42] bg-black/40 rounded shadow-[0_0_10px_rgba(0,255,66,0.3)] animate-pulse">
            <Terminal className="w-6 h-6 text-[#00ff42]" />
          </div>
          <div>
            <h1 
              id="app-title"
              className="text-xl md:text-2xl font-black tracking-widest text-[#00ff42] font-sans uppercase animate-glitch-skew"
              style={{
                textShadow: cpuGlitchRatio > 0.2 ? '2px -1px #00ff42, -2px 1px #ff3b30' : '0 0 5px rgba(0,255,66,0.5)'
              }}
            >
              {scrambleText('MOTHERBOARD SHIELD v1.0', cpuGlitchRatio)}
            </h1>
            <p className="text-[10px] text-gray-500 font-mono tracking-wider truncate">
              {scrambleText('FIREWALL SHELL // THREAT MONITOR ACTIVE', cpuGlitchRatio)}
            </p>
          </div>
        </div>

        {/* Global Stability Meter Dashboard */}
        <div id="stability-display" className="flex items-center gap-4 bg-black/60 border border-[#00ff42]/30 px-4 py-2 rounded font-mono shrink-0 select-none">
          <div className="text-right">
            <span className="text-[10px] text-gray-500 block leading-none">SYSTEM STABILITY</span>
            <span 
              className={`text-xl font-extrabold tracking-tight ${stability > 60 ? 'text-[#00ff42]' : stability > 30 ? 'text-[#ffaa00]' : 'text-[#ff3b30] animate-pulse'}`}
            >
              {stability}%
            </span>
          </div>
          <div className="w-24 h-3 bg-gray-900 border border-[#00ff42]/20 rounded-full overflow-hidden flex items-center">
            <div 
              className={`h-full transition-all duration-300 ${stability > 60 ? 'bg-[#00ff42]' : stability > 30 ? 'bg-[#ffaa00]' : 'bg-[#ff3b30]'}`}
              style={{ width: `${stability}%` }}
            ></div>
          </div>
        </div>
      </header>

      {/* Main Grid: Left sidebar with parts + Center canvas area + Right column with logs */}
      <main className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch z-10">
        
        {/* Left Side: Hardware Parts Status Panel (4/12 col) */}
        <section className="lg:col-span-3 flex flex-col gap-3 font-mono">
          <div className="bg-black/60 border border-[#00ff42]/30 p-3.5 rounded flex flex-col gap-3.5 h-full relative overflow-hidden backdrop-blur-sm">
            <div className="border-b border-[#00ff42]/20 pb-2 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#00ff42]" />
              <h2 className="text-sm font-bold tracking-wider text-[#00ff42]">
                {scrambleText('PC COMPONENTS', cpuGlitchRatio)}
              </h2>
            </div>

            {/* List components dynamically with health readouts and custom glitch icons */}
            <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-0.5 justify-around">
              {parts.length === 0 ? (
                <div className="text-xs text-gray-500 text-center py-6">Loading diagnostics...</div>
              ) : (
                parts.map((p) => (
                  <div 
                    key={p.id}
                    id={`part-card-${p.id}`}
                    className={`p-2.5 rounded border transition-all duration-200 ${
                      p.isDestroyed 
                        ? 'bg-red-950/20 border-red-500/40 text-red-500' 
                        : 'bg-black/40 border-[#00ff42]/20 text-[#00ff42] hover:bg-[#00ff42]/5'
                    }`}
                  >
                    <div className="flex justify-between items-center text-[11px] font-bold mb-1.5 min-w-0">
                      <span className="truncate pr-1">{scrambleText(p.jpName, cpuGlitchRatio)}</span>
                      <span className={`text-[10px] font-mono shrink-0 ${p.isDestroyed ? 'text-red-500' : 'text-cyan-400'}`}>
                        {p.isDestroyed ? scrambleText('[破損]', cpuGlitchRatio) : `${p.health}/${p.maxHealth} HP`}
                      </span>
                    </div>

                    <div className="w-full h-1.5 bg-gray-900 rounded-full overflow-hidden mb-1">
                      <div 
                        className={`h-full transition-all duration-500 ${p.isDestroyed ? 'bg-red-500' : p.health / p.maxHealth > 0.5 ? 'bg-emerald-400' : 'bg-amber-400'}`}
                        style={{ width: `${(p.health / p.maxHealth) * 100}%` }}
                      ></div>
                    </div>

                    {/* Glitch description footer */}
                    <span className="text-[9px] text-gray-500 leading-tight block description-scramble">
                      {p.isDestroyed 
                        ? `${scrambleText('SYSTEM CORRUPTION:', cpuGlitchRatio)} ${p.glitchEffect}` 
                        : p.description}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="text-[10px] text-gray-500 border-t border-[#00ff42]/10 pt-2 text-center flex items-center justify-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              <span>{scrambleText('KEEP PARTS ALIVE TO PREVENT BUG EFFECTS', cpuGlitchRatio)}</span>
            </div>
          </div>
        </section>

        {/* Center: Main Game Play Canvas and HTML overlays (6/12 col) */}
        <section className="lg:col-span-6 flex flex-col justify-start">
          <div className="relative border-2 border-[#00ff42]/30 rounded-lg overflow-hidden bg-black flex flex-col items-center justify-center shadow-[0_0_20px_rgba(0,255,66,0.15)] select-none">
            
            {/* HTML Canvas */}
            <canvas
              id="game-canvas"
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="w-full aspect-[1000/650] block cursor-crosshair relative bg-[#030604] transition-all duration-75"
              style={{
                filter: psuGlitchRatio > 0.3 && Math.random() < psuGlitchRatio * 0.1 ? 'contrast(200%) brightness(30%)' : 'none',
                transform: gpuGlitchRatio > 0.1 
                  ? `translate(${(Math.random() - 0.5) * 12 * gpuGlitchRatio}px, ${(Math.random() - 0.5) * 12 * gpuGlitchRatio}px)` 
                  : 'none'
              }}
            />

            {/* START SCREEN PANEL OVERLAY */}
            {!isPlaying && !isGameOver && (
              <div id="start-overlay" className="absolute inset-0 bg-[#030a05]/85 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6 text-center">
                <div className="animate-pulse mb-4 text-[#00ff42]">
                  <Cpu className="w-14 h-14 mx-auto stroke-[1.2]" />
                </div>
                <h2 className="text-2xl md:text-3xl font-black tracking-wider mb-2 font-sans text-[#00ff42]">
                  MOTHERBOARD DEFENDER
                </h2>
                <p className="text-xs text-gray-400 font-mono max-w-md leading-relaxed mb-4">
                  PCの基盤（マザーボード）の中で、ウイルスの侵略からPCパーツ（CPU、RAM、GPU、SSD、電源）を守り抜く2Dシューティングゲーム。
                  パーツが壊されるごとに画面や操作にバグが発生し、難易度が上がります！
                </p>

                {/* Difficulty Selector Panel */}
                <div className="mb-5 w-full max-w-md select-none">
                  <div className="text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">
                    [ SYSTEM SECURITY INTEGRITY LEVEL / 難易度設定 ]
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      id="diff-easy-btn"
                      type="button"
                      onClick={() => { playSound.glitchTick(); setDifficulty('easy'); }}
                      className={`py-1.5 px-2 rounded font-mono text-xs border cursor-pointer transition-all ${
                        difficulty === 'easy'
                          ? 'bg-[#00ff42]/10 border-[#00ff42] text-[#00ff42] shadow-[0_0_10px_rgba(0,255,66,0.25)]'
                          : 'bg-black/50 border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-300'
                      }`}
                    >
                      <div className="font-bold text-[12px] text-emerald-400">甘口 (EASY)</div>
                      <div className="text-[8px] opacity-75 mt-0.5 leading-tight">パーツ高HP / 連射1.5倍 / ウェーブ間全回復 / 破損救済</div>
                    </button>
                    <button
                      id="diff-normal-btn"
                      type="button"
                      onClick={() => { playSound.glitchTick(); setDifficulty('normal'); }}
                      className={`py-1.5 px-2 rounded font-mono text-xs border cursor-pointer transition-all ${
                        difficulty === 'normal'
                          ? 'bg-[#00e1ff]/10 border-[#00e1ff] text-[#00e1ff] shadow-[0_0_10px_rgba(0,225,255,0.25)]'
                          : 'bg-black/50 border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-300'
                      }`}
                    >
                      <div className="font-bold text-[12px] text-cyan-400">中辛 (NORMAL)</div>
                      <div className="text-[8px] opacity-75 mt-0.5 leading-tight">標準セキュリティ / 通常HP</div>
                    </button>
                    <button
                      id="diff-hard-btn"
                      type="button"
                      onClick={() => { playSound.glitchTick(); setDifficulty('hard'); }}
                      className={`py-1.5 px-2 rounded font-mono text-xs border cursor-pointer transition-all ${
                        difficulty === 'hard'
                          ? 'bg-[#ff3b30]/10 border-[#ff3b30] text-[#ff3b30] shadow-[0_0_10px_rgba(255,59,48,0.25)]'
                          : 'bg-black/50 border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-300'
                      }`}
                    >
                      <div className="font-bold text-[12px] text-red-400">辛口 (HARD)</div>
                      <div className="text-[8px] opacity-75 mt-0.5 leading-tight">俊足ウイルス / パワー破壊</div>
                    </button>
                  </div>
                </div>

                {/* Key Controls Guide */}
                <div className="w-full max-w-md border border-[#00ff42]/20 bg-black/50 p-4 rounded mb-6 text-left font-mono text-[11px] text-gray-300">
                  <div className="grid grid-cols-2 gap-3 pb-3 mb-3 border-b border-[#00ff42]/10">
                    <div>
                      <span className="text-[#00ff42] font-extrabold block">WASD / 矢印キー</span>
                      <span>自機の移動</span>
                    </div>
                    <div>
                      <span className="text-[#00ff42] font-extrabold block">左クリック</span>
                      <span>照準方向へ自動/手動射撃 (追従)</span>
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="text-[10px] text-[#00ff42]/70 font-semibold uppercase tracking-wider">
                      ★ 解放スキル (即時発動):
                    </div>
                    <div className="flex justify-between">
                      <span className="text-cyan-400 font-bold">[SPACEBAR]</span>
                      <span>EMP衝撃波 (画面内敵ダメージ&敵弾消去)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-fuchsia-400 font-bold">[右クリック]</span>
                      <span>ファイアウォール (4秒間敵弾耐久バリア)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-amber-400 font-bold">[ホイール/中クリック]</span>
                      <span>追尾ミサイル (8方向全弾ロックオン)</span>
                    </div>
                  </div>
                </div>

                <button
                  id="start-btn"
                  onClick={handleStartGame}
                  className="px-8 py-3.5 bg-[#00ff42] hover:bg-[#00ff42]/80 text-black text-sm font-black tracking-widest uppercase rounded cursor-pointer transition-all duration-150 transform hover:scale-105 active:scale-95 shadow-[0_0_20px_#00ff42]"
                >
                  ファイアウォールを起動
                </button>
              </div>
            )}

            {/* PAUSE STATUS PANEL OVERLAY */}
            {isPaused && (
              <div id="pause-overlay" className="absolute inset-0 bg-black/85 z-30 flex flex-col items-center justify-center p-6">
                <Pause className="w-12 h-12 text-[#00e1ff] mb-4 animate-bounce" />
                <h2 className="text-xl font-bold tracking-widest text-[#00e1ff] mb-4 font-mono">
                  Diagnostics Paused
                </h2>
                <div className="flex gap-4">
                  <button
                    id="resume-btn"
                    onClick={handlePauseToggle}
                    className="px-5 py-2 border border-[#00e1ff] text-[#00e1ff] font-mono hover:bg-[#00e1ff]/10 text-xs rounded transition-all cursor-pointer"
                  >
                    [ RESUME SESSION ]
                  </button>
                  <button
                    id="restart-btn-pause"
                    onClick={handleStartGame}
                    className="px-5 py-2 border border-red-500 text-red-500 font-mono hover:bg-red-500/10 text-xs rounded transition-all cursor-pointer"
                  >
                    [ REBOOT CORE ]
                  </button>
                </div>
              </div>
            )}

            {/* GAME OVER PANEL OVERLAY */}
            {isGameOver && (
              <div id="game-over-overlay" className="absolute inset-0 bg-red-950/95 z-30 flex flex-col items-center justify-center p-6 text-center animate-noise-flicker">
                <span className="text-red-500 px-3 py-1 border border-red-500 bg-red-950/50 rounded text-xs font-mono mb-4 animate-ping">
                  SYSTEM FAILURE
                </span>
                
                <h2 className="text-4xl font-extrabold tracking-widest text-red-500 mb-2 uppercase leading-none font-sans">
                  BLUE SCREEN!
                </h2>
                <p className="text-[11px] text-gray-400 font-mono max-w-sm leading-relaxed mb-6">
                  全てのPCパーツがウイルスの侵略により破壊されました。システム制御は完全にオフラインです。
                </p>

                {/* Score Summary Box */}
                <div className="bg-black/60 border border-red-500/30 px-6 py-4 rounded font-mono mb-6 max-w-xs w-full">
                  <div className="text-gray-500 text-xs mb-1">FINAL DEFENSE SCORE</div>
                  <div className="text-2xl font-black text-red-500 tracking-wider">
                    {score.toLocaleString()} PTS
                  </div>
                  <div className="text-[10px] text-gray-400 mt-2">
                    Wave Reached: {wave}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    id="reboot-btn"
                    onClick={handleStartGame}
                    className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold text-xs tracking-widest rounded cursor-pointer transition-all active:scale-95 shadow-[0_0_15px_#dc2626]"
                  >
                    [ システム再起動 (REBOOT) ]
                  </button>
                </div>
              </div>
            )}

            {/* ACTIVE ADWARE ALERTS HTML POPUPS MODULAR RENDERER */}
            <AdwarePopupComponent popups={popups} onDismiss={handleDismissPopup} />
          </div>

          {/* Quick HUD Navigation Action Controller */}
          <div className="flex items-center justify-between mt-3 font-mono text-xs text-gray-500 select-none">
            <div className="flex gap-4">
              <span className="flex items-center gap-1 text-[#00ff42]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00ff42] animate-ping"></span>
                SCORE: <strong className="text-white text-sm tracking-wide">{score}</strong>
              </span>
              <span>WAVE: <strong className="text-white">{wave}</strong></span>
            </div>

            <div className="flex gap-2">
              <button
                id="hud-mute-btn"
                onClick={handleMuteToggle}
                className="p-1 px-2 border border-gray-800 rounded hover:border-gray-600 transition-all cursor-pointer flex items-center gap-1 text-[11px]"
                title="Procedural sound toggle"
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-500" /> : <Volume2 className="w-3.5 h-3.5 text-[#00ff42]" />}
                <span className="hidden sm:inline">{isMuted ? 'UNMUTE BGM' : 'MUTE BGM'}</span>
              </button>

              <button
                id="hud-pause-btn"
                onClick={handlePauseToggle}
                className="p-1 px-2 border border-gray-800 rounded hover:border-gray-600 transition-all cursor-pointer flex items-center gap-1 text-[11px]"
                disabled={!isPlaying || isGameOver}
              >
                {isPaused ? <Play className="w-3.5 h-3.5 text-cyan-400" /> : <Pause className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{isPaused ? 'RESUME' : 'PAUSE'}</span>
              </button>

              <button
                id="hud-how-to-btn"
                onClick={() => { playSound.glitchTick(); setShowHowTo(!showHowTo); }}
                className="p-1 px-2 border border-gray-800 rounded hover:border-gray-600 transition-all cursor-pointer flex items-center gap-1 text-[11px]"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">GUIDE</span>
              </button>
            </div>
          </div>
        </section>

        {/* Right Side: Firewall Status Logs & Legend (3/12 col) */}
        <section className="lg:col-span-3 flex flex-col gap-3 font-mono">
          
          {/* Active firewall warning logger feed list */}
          <div className="bg-black/60 border border-[#00ff42]/30 p-3.5 rounded flex flex-col h-[280px] lg:h-[340px] relative overflow-hidden backdrop-blur-sm">
            <div className="border-b border-[#00ff42]/20 pb-2 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-bold tracking-wider text-[#00ff42]">
                {scrambleText('FIREWALL SECURITY LOG', cpuGlitchRatio)}
              </h2>
            </div>
            
            <div className="flex-1 overflow-y-auto mt-2 scrolling-log text-[9px] text-[#00ff42] space-y-1.5 select-text pr-1">
              {systemLogs.map((log, index) => (
                <div key={index} className="border-l-2 border-[#00ff42]/20 pl-1.5 last:border-[#00ff42]/5 font-mono leading-relaxed truncate">
                  {log}
                </div>
              ))}
              {systemLogs.length === 0 && (
                <div className="text-gray-500 italic text-center text-xs py-10">No events log yet.</div>
              )}
            </div>
          </div>

          {/* Malware Threat Intel Legend */}
          <div className="bg-black/60 border border-[#00ff42]/30 p-3.5 rounded flex flex-col flex-1 relative overflow-hidden backdrop-blur-sm">
            <div className="border-b border-[#00ff42]/20 pb-2 flex items-center gap-2">
              <Info className="w-4 h-4 text-cyan-400" />
              <h2 className="text-xs font-bold tracking-wider text-[#00ff42]">
                {scrambleText('VIRUS REGISTRY DAT', cpuGlitchRatio)}
              </h2>
            </div>
            
            <div className="flex-1 flex flex-col justify-around text-[10px] space-y-2.5 mt-3 select-none">
              <div className="flex gap-2 items-center">
                <span className="w-3.5 h-3.5 rounded bg-emerald-500 shrink-0 shadow-[0_0_5px_#10b981]"></span>
                <div className="leading-tight">
                  <div className="font-bold text-[#00ff42]">WORM (ワーム)</div>
                  <div className="text-[8.5px] text-gray-500">うねるように素早く動き、防衛機を狙う</div>
                </div>
              </div>

              <div className="flex gap-2 items-center">
                <span className="w-3.5 h-3.5 bg-blue-600 shrink-0 shadow-[0_0_5px_#2563eb]"></span>
                <div className="leading-tight">
                  <div className="font-bold text-blue-400">TROJAN (トロイの木馬)</div>
                  <div className="text-[8.5px] text-gray-500">体力が高く、PCパーツを執拗に直接攻撃する</div>
                </div>
              </div>

              <div className="flex gap-2 items-center">
                <span className="w-3.5 h-3.5 rounded-full bg-purple-600 shrink-0 shadow-[0_0_5px_#a855f7]"></span>
                <div className="leading-tight">
                  <div className="font-bold text-purple-400">SPYWARE (スパイウェア)</div>
                  <div className="text-[8.5px] text-gray-500">一定距離を保ちつつ、ウイルス弾を遠隔発射</div>
                </div>
              </div>

              <div className="flex gap-2 items-center">
                <span className="w-3.5 h-3.5 polygon bg-red-600 shrink-0 shadow-[0_0_5px_#ef4444]" style={{ clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)' }}></span>
                <div className="leading-tight">
                  <div className="font-bold text-red-500">RANSOMWARE (ランサムウェア)</div>
                  <div className="text-[8.5px] text-gray-500">高耐久のボスクラス。パーツに張り付くと瞬殺</div>
                </div>
              </div>
            </div>
          </div>

        </section>
      </main>

      {/* Guide Modals Box Popup */}
      {showHowTo && (
        <div id="guide-modal" className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-black border border-[#00ff42] p-6 max-w-xl w-full rounded font-mono shadow-[0_0_30px_rgba(0,255,66,0.3)] select-text relative">
            <h3 className="text-[#00ff42] text-lg font-bold border-b border-[#00ff42]/30 pb-2 mb-4 uppercase">
              🔥 SYSTEM HOW-TO DIAGNOSTICS GUIDE
            </h3>
            
            <div className="text-xs text-gray-300 space-y-4 leading-relaxed">
              <p>
                あなたの任務は、アンチウイルス防衛ユニットを操縦し、4つのポートから侵入してくるマルウェア（ウイルス）からマザーボードのハードウェア（CPU、GPU、RAM、SSD、電源）を死守することです。
              </p>
              
              <div className="border border-[#00ff42]/20 p-3 bg-emerald-950/10 rounded">
                <span className="font-bold text-[#00ff42] block mb-2">💥 パーツ破損によるバグ効果（Glitch System）:</span>
                <ul className="space-y-1 text-gray-400 list-disc list-inside text-[11px]">
                  <li><strong>CPUが壊れると:</strong> システムテキストやログがバグ文字化。射撃方向もランダムにブレます。</li>
                  <li><strong>GPUが壊れると:</strong> 画面の色が激しく歪み、画面の揺れが止まらなくなります。</li>
                  <li><strong>RAMが壊れると:</strong> 致命的なラグ（前フレームが残る残像効果、カクつき）が発生します。</li>
                  <li><strong>SSDが壊れると:</strong> 画面を覆い尽くす広告型警告ウィンドウが飛び出し、視界を遮ります。</li>
                  <li><strong>電源（PSU）が壊れると:</strong> 画面の静電ノイズが増幅し、時折ブラックアウトします。</li>
                </ul>
              </div>

              <div>
                <span className="font-bold text-[#00ff42]">💡 攻略のヒント:</span>
                <p className="text-gray-400 text-[11px] mt-1">
                  ウイルスの侵入ポート（USBやLANなど）から進路を予測し、PCパーツに張り付かれる前に的確に駆逐してください。SSD破損時に出現する警告ポップアップは、放置すると邪魔ですが、ヘッダーの「X」や「IGNORE」をクリックすることでクローズできます！
                </p>
              </div>
            </div>

            <div className="text-right mt-6">
              <button
                id="close-guide-btn"
                onClick={() => setShowHowTo(false)}
                className="px-6 py-2 border border-[#00ff42] hover:bg-[#00ff42]/10 text-xs font-bold text-[#00ff42] rounded cursor-pointer transition-all active:scale-95"
              >
                [ CLOSE DIAGNOSTIC GUIDE ]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer credits and details */}
      <footer className="mt-8 text-center text-[10px] text-gray-600 font-mono select-none">
        <p>{scrambleText('SYSTEM MOTHERBOARD PROTECTOR // HOSTING CONTAINER INFRASTRUCTURE', cpuGlitchRatio)}</p>
        <p className="text-[#00ff42]/40 text-[9px] mt-1">Powered by Web Audio procedural synth rhythms</p>
      </footer>
    </div>
  );
}
