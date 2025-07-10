// Get canvas and context
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Get UI elements
const scoreEl = document.getElementById('score');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreEl = document.getElementById('final-score');
const restartButton = document.getElementById('restart-button');

// --- BASE GAME CONFIGURATION (used for scaling) ---
const BASE_HEIGHT = 1080; // A base height for scaling calculations
let scale = 1;

// --- SCALABLE GAME CONFIGURATION ---
const PLAYER_RADIUS = 20;
const PLAYER_LAUNCH_POWER_DIVISOR = 20;
const PLAYER_MAX_LAUNCH_POWER = 10;
const PLANET_MIN_RADIUS = 20;
const PLANET_MAX_RADIUS = 50;
const GRAVITY = 0.5;
const COMET_START_LEVEL = 3;
const COMET_SPEED = 2;
const COMET_RADIUS = 15;
const STAR_SPAWN_RATE = 0.01;
const STAR_RADIUS = 10;
const STAR_SCORE = 100;
const STATIC_STAR_COUNT = 100;
const LEVEL_TRANSITION_DELAY = 2000; // ms
const BASE_PLANET_COUNT = 3;
const PLANET_COUNT_PER_LEVEL = 2;
const BASE_SCORE_THRESHOLD = 1000;
const SCORE_THRESHOLD_MULTIPLIER = 1.5;
const FONT_FAMILY = 'Arial';

// --- GLOBAL GAME STATE ---
let canvasWidth, canvasHeight;
let images;
let animationFrameId;
let isDragging = false;
let dragStartX, dragStartY;

// Game state can be: 'START', 'LEVEL_TRANSITION', 'PLAYING', 'GAME_OVER'
let gameState; 

let game = {
    player: {},
    planets: [],
    stars: [],
    comets: [],
    collectableStars: [],
    score: 0,
    currentLevel: 1,
};

// --- CORE FUNCTIONS ---

function resizeCanvas() {
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    scale = canvasHeight / BASE_HEIGHT;
}

function init() {
    game.score = 0;
    game.currentLevel = 1;
    gameState = 'START';
    scoreEl.textContent = `Score: ${game.score}`;
    gameOverScreen.style.display = 'none';

    game.player = {
        x: canvasWidth / 2,
        y: canvasHeight / 3,
        dx: 0,
        dy: 0,
        radius: PLAYER_RADIUS * scale,
        isMoving: false
    };

    game.planets = [];
    game.stars = [];
    game.comets = [];
    game.collectableStars = [];

    // Generate static background stars
    for (let i = 0; i < STATIC_STAR_COUNT; i++) {
        game.stars.push({
            x: Math.random() * canvasWidth,
            y: Math.random() * canvasHeight,
            radius: (Math.random() * 2 + 1) * scale
        });
    }

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    gameLoop();
}

function startLevel() {
    gameState = 'LEVEL_TRANSITION';
    game.player.x = canvasWidth / 2;
    game.player.y = canvasHeight / 3;
    game.player.dx = 0;
    game.player.dy = 0;
    game.player.isMoving = false;

    generatePlanetsForLevel();

    if (game.currentLevel >= COMET_START_LEVEL) {
        generateComet();
    }

    setTimeout(() => {
        if (gameState === 'LEVEL_TRANSITION') { // Ensure we don't start if game was reset
            gameState = 'PLAYING';
        }
    }, LEVEL_TRANSITION_DELAY);
}

function startGame() {
    if (gameState === 'START') {
        gameState = 'PLAYING';
        generatePlanetsForLevel();
    } else if (gameState === 'LEVEL_TRANSITION') {
        gameState = 'PLAYING';
    }
}

function gameOver() {
    gameState = 'GAME_OVER';
    cancelAnimationFrame(animationFrameId);
    finalScoreEl.textContent = game.score;
    gameOverScreen.style.display = 'flex';
}


// --- ENTITY GENERATION ---

function generateComet() {
    let x, y, dx, dy;
    const speed = COMET_SPEED * scale;
    const edge = Math.floor(Math.random() * 4);

    switch (edge) {
        case 0: // Top
            x = Math.random() * canvasWidth; y = 0;
            dx = (Math.random() - 0.5) * speed; dy = Math.random() * speed;
            break;
        case 1: // Right
            x = canvasWidth; y = Math.random() * canvasHeight;
            dx = -Math.random() * speed; dy = (Math.random() - 0.5) * speed;
            break;
        case 2: // Bottom
            x = Math.random() * canvasWidth; y = canvasHeight;
            dx = (Math.random() - 0.5) * speed; dy = -Math.random() * speed;
            break;
        case 3: // Left
            x = 0; y = Math.random() * canvasHeight;
            dx = Math.random() * speed; dy = (Math.random() - 0.5) * speed;
            break;
    }

    game.comets.push({ x, y, dx, dy, radius: COMET_RADIUS * scale });
}

function generatePlanetsForLevel() {
    game.planets = [];
    // Add a central planet
    game.planets.push({
        x: canvasWidth / 2,
        y: canvasHeight / 2,
        radius: (40 * scale),
        type: Math.floor(Math.random() * images.planets.length),
        dx: (Math.random() - 0.5) * 0.5 * scale,
        dy: (Math.random() - 0.5) * 0.5 * scale
    });

    const numPlanets = BASE_PLANET_COUNT + (game.currentLevel - 1) * PLANET_COUNT_PER_LEVEL;
    for (let i = 0; i < numPlanets; i++) {
        game.planets.push({
            x: Math.random() * canvasWidth,
            y: Math.random() * canvasHeight,
            radius: (Math.random() * (PLANET_MAX_RADIUS - PLANET_MIN_RADIUS) + PLANET_MIN_RADIUS) * scale,
            type: Math.floor(Math.random() * images.planets.length),
            dx: (Math.random() - 0.5) * 0.5 * scale,
            dy: (Math.random() - 0.5) * 0.5 * scale
        });
    }
}


// --- GAME LOGIC (UPDATE) ---

function update() {
    if (gameState !== 'PLAYING') return;

    updatePlanets();
    updateComets();
    updatePlayer();
    spawnCollectableStars();
    checkCollisions();
    checkLevelCompletion();
}

function updatePlanets() {
    game.planets.forEach(p => {
        p.x += p.dx;
        p.y += p.dy;
        // Bounce off walls
        if (p.x < p.radius || p.x > canvasWidth - p.radius) p.dx *= -1;
        if (p.y < p.radius || p.y > canvasHeight - p.radius) p.dy *= -1;
    });
}

function updateComets() {
    game.comets.forEach((c, index) => {
        c.x += c.dx;
        c.y += c.dy;
        // Remove if off-screen
        if (c.x < -c.radius || c.x > canvasWidth + c.radius || c.y < -c.radius || c.y > canvasHeight + c.radius) {
            game.comets.splice(index, 1);
        }
    });
}

function updatePlayer() {
    if (!game.player.isMoving) return;

    let totalGravityX = 0;
    let totalGravityY = 0;

    game.planets.forEach(p => {
        const dx = p.x - game.player.x;
        const dy = p.y - game.player.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > 1) { // Avoid division by zero
            const force = (GRAVITY * p.radius / distSq) * scale;
            totalGravityX += dx * force;
            totalGravityY += dy * force;
        }
    });

    game.player.dx += totalGravityX;
    game.player.dy += totalGravityY;
    game.player.x += game.player.dx;
    game.player.y += game.player.dy;

    game.score++;
    scoreEl.textContent = `Score: ${game.score}`;
}

function spawnCollectableStars() {
    if (Math.random() < STAR_SPAWN_RATE) {
        game.collectableStars.push({
            x: Math.random() * canvasWidth,
            y: Math.random() * canvasHeight,
            radius: STAR_RADIUS * scale
        });
    }
}

function checkCollisions() {
    const p = game.player;

    // Player vs Planets
    for (const planet of game.planets) {
        const dist = Math.hypot(p.x - planet.x, p.y - planet.y);
        if (dist < p.radius + planet.radius) {
            gameOver();
            return;
        }
    }

    // Player vs Comets
    for (const comet of game.comets) {
        const dist = Math.hypot(p.x - comet.x, p.y - comet.y);
        if (dist < p.radius + comet.radius) {
            gameOver();
            return;
        }
    }
    
    // Player vs Collectable Stars
    game.collectableStars.forEach((star, index) => {
        const dist = Math.hypot(p.x - star.x, p.y - star.y);
        if (dist < p.radius + star.radius) {
            game.score += STAR_SCORE;
            scoreEl.textContent = `Score: ${game.score}`;
            game.collectableStars.splice(index, 1);
        }
    });

    // Player vs Walls
    if (p.x < 0 || p.x > canvasWidth || p.y < 0 || p.y > canvasHeight) {
        gameOver();
    }
}

function checkLevelCompletion() {
    const requiredScore = BASE_SCORE_THRESHOLD * Math.pow(SCORE_THRESHOLD_MULTIPLIER, game.currentLevel - 1);
    if (game.score >= requiredScore) {
        game.currentLevel++;
        startLevel();
    }
}


// --- DRAWING ---

function draw() {
    ctx.drawImage(images.background, 0, 0, canvasWidth, canvasHeight);
    drawStars();
    drawPlanets();
    drawComets();
    drawCollectableStars();
    drawPlayer();
    drawTrajectoryLine();
}

function drawStars() {
    ctx.fillStyle = 'white';
    game.stars.forEach(star => {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawPlanets() {
    game.planets.forEach(p => {
        const planetImage = images.planets[p.type];
        if (planetImage) {
            ctx.drawImage(planetImage, p.x - p.radius, p.y - p.radius, p.radius * 2, p.radius * 2);
        }
    });
}

function drawComets() {
    game.comets.forEach(c => {
        ctx.drawImage(images.comet, c.x - c.radius, c.y - c.radius, c.radius * 2, c.radius * 2);
    });
}

function drawCollectableStars() {
    game.collectableStars.forEach(s => {
        ctx.drawImage(images.star, s.x - s.radius, s.y - s.radius, s.radius * 2, s.radius * 2);
    });
}

function drawPlayer() {
    const p = game.player;
    ctx.drawImage(images.playerShip, p.x - p.radius, p.y - p.radius, p.radius * 2, p.radius * 2);
}

function drawTrajectoryLine() {
    if (isDragging) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.moveTo(game.player.x, game.player.y);
        ctx.lineTo(dragStartX, dragStartY);
        ctx.stroke();
    }
}

function drawScreen(title, subtitle1, subtitle2) {
    ctx.drawImage(images.background, 0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    
    ctx.font = `${40 * scale}px ${FONT_FAMILY}`;
    ctx.fillText(title, canvasWidth / 2, canvasHeight / 2 - (30 * scale));
    
    ctx.font = `${20 * scale}px ${FONT_FAMILY}`;
    if (subtitle1) {
        ctx.fillText(subtitle1, canvasWidth / 2, canvasHeight / 2 + (20 * scale));
    }
    if (subtitle2) {
        ctx.fillText(subtitle2, canvasWidth / 2, canvasHeight / 2 + (60 * scale));
    }
}


// --- GAME LOOP ---

function gameLoop() {
    switch (gameState) {
        case 'START':
            drawScreen('Stardust Drifter', 'Click and drag to launch your ship', 'Press any key to start');
            break;
        case 'LEVEL_TRANSITION':
            drawScreen(`Level ${game.currentLevel}`, `Cumulative Score: ${game.score}`, 'Prepare for the next level...');
            break;
        case 'PLAYING':
            update();
            draw();
            break;
        case 'GAME_OVER':
            draw(); // Draw the final frame
            return; // Stop the loop
    }
    animationFrameId = requestAnimationFrame(gameLoop);
}


// --- EVENT LISTENERS ---

function handleMouseDown(e) {
    if (gameState !== 'PLAYING') {
        if (gameState === 'START' || gameState === 'LEVEL_TRANSITION') {
            startGame();
        }
        return;
    }
    isDragging = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStartX = clientX;
    dragStartY = clientY;
}

function handleMouseMove(e) {
    if (!isDragging) return;
}

function handleMouseUp(e) {
    if (!isDragging) return;
    isDragging = false;
    game.player.isMoving = true;

    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

    const angle = Math.atan2(clientY - dragStartY, clientX - dragStartX);
    const power = Math.min(
        Math.hypot(clientX - dragStartX, clientY - dragStartY) / (PLAYER_LAUNCH_POWER_DIVISOR * scale),
        PLAYER_MAX_LAUNCH_POWER * scale
    );

    game.player.dx = Math.cos(angle) * power;
    game.player.dy = Math.sin(angle) * power;
}

function handleKeyDown(e) {
    if (gameState === 'START' || gameState === 'LEVEL_TRANSITION') {
        startGame();
    }
}

window.addEventListener('resize', () => {
    resizeCanvas();
    init(); // Re-initialize the game on resize
});

canvas.addEventListener('mousedown', handleMouseDown);
canvas.addEventListener('mousemove', handleMouseMove);
canvas.addEventListener('mouseup', handleMouseUp);
restartButton.addEventListener('click', init);

// Touch events
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleMouseDown(e);
}, { passive: false });
canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    handleMouseMove(e);
}, { passive: false });
canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    handleMouseUp(e);
}, { passive: false });

window.addEventListener('keydown', handleKeyDown);


// --- INITIALIZATION ---
resizeCanvas();
loadImages().then(loadedImages => {
    images = loadedImages;
    init();
});