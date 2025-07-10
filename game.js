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

// Performance optimization constants
const MAX_COLLISION_DISTANCE = 200; // Maximum distance to check for collisions
const COLLISION_CHECK_FREQUENCY = 1; // Check collisions every N frames

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

// Performance tracking
let frameCount = 0;

// --- HELPER FUNCTIONS ---

// Calculate squared distance between two entities (faster than actual distance)
function getDistanceSquared(entity1, entity2) {
    const dx = entity1.x - entity2.x;
    const dy = entity1.y - entity2.y;
    return dx * dx + dy * dy;
}

// Calculate distance between two entities
function getDistance(entity1, entity2) {
    return Math.hypot(entity1.x - entity2.x, entity1.y - entity2.y);
}

// Check if two entities are colliding (optimized with squared distance)
function areColliding(entity1, entity2) {
    const radiusSum = entity1.radius + entity2.radius;
    const distanceSquared = getDistanceSquared(entity1, entity2);
    return distanceSquared < (radiusSum * radiusSum);
}

// Fast AABB (Axis-Aligned Bounding Box) collision check
function areAABBColliding(entity1, entity2) {
    return Math.abs(entity1.x - entity2.x) < (entity1.radius + entity2.radius) &&
           Math.abs(entity1.y - entity2.y) < (entity1.radius + entity2.radius);
}

// Optimized collision check with AABB pre-filter
function areCollidingOptimized(entity1, entity2) {
    // First check AABB (faster)
    if (!areAABBColliding(entity1, entity2)) {
        return false;
    }
    // Then check circular collision
    return areColliding(entity1, entity2);
}

// Move entity and handle wall bouncing
function updateEntityWithBounce(entity, maxWidth, maxHeight) {
    entity.x += entity.dx;
    entity.y += entity.dy;
    
    // Bounce off walls
    if (entity.x < entity.radius || entity.x > maxWidth - entity.radius) {
        entity.dx *= -1;
    }
    if (entity.y < entity.radius || entity.y > maxHeight - entity.radius) {
        entity.dy *= -1;
    }
}

// Check if entity is off-screen
function isOffScreen(entity, maxWidth, maxHeight) {
    return entity.x < -entity.radius || 
           entity.x > maxWidth + entity.radius || 
           entity.y < -entity.radius || 
           entity.y > maxHeight + entity.radius;
}

// Update score display
function updateScore(score) {
    scoreEl.textContent = `Score: ${score}`;
}

// Check player collision with a group of entities (optimized)
function checkPlayerCollisionWithEntities(entities, onCollision) {
    for (let i = entities.length - 1; i >= 0; i--) {
        const entity = entities[i];
        if (areCollidingOptimized(game.player, entity)) {
            onCollision(entity, i);
        }
    }
}

// Check player collision with entities that cause game over (optimized)
function checkPlayerCollisionWithDangerousEntities(entities) {
    for (const entity of entities) {
        if (areCollidingOptimized(game.player, entity)) {
            gameOver();
            return true;
        }
    }
    return false;
}

// Optimized collision detection using spatial grid
function checkPlayerCollisionWithEntitiesOptimized(entities, onCollision) {
    if (!spatialGrid || entities.length === 0) {
        return checkPlayerCollisionWithEntities(entities, onCollision);
    }

    const nearbyEntities = spatialGrid.getNearbyEntities(game.player);
    const relevantEntities = nearbyEntities.filter(entity => entities.includes(entity));
    
    for (let i = relevantEntities.length - 1; i >= 0; i--) {
        const entity = relevantEntities[i];
        if (areCollidingOptimized(game.player, entity)) {
            const index = entities.indexOf(entity);
            if (index !== -1) {
                onCollision(entity, index);
            }
        }
    }
}

// Optimized dangerous collision check using spatial grid
function checkPlayerCollisionWithDangerousEntitiesOptimized(entities) {
    if (!spatialGrid || entities.length === 0) {
        return checkPlayerCollisionWithDangerousEntities(entities);
    }

    const nearbyEntities = spatialGrid.getNearbyEntities(game.player);
    const relevantEntities = nearbyEntities.filter(entity => {
        if (!entities.includes(entity)) return false;
        
        // Distance culling - skip entities that are too far away
        const maxDistance = MAX_COLLISION_DISTANCE * scale;
        const distanceSquared = getDistanceSquared(game.player, entity);
        return distanceSquared < (maxDistance * maxDistance);
    });
    
    for (const entity of relevantEntities) {
        if (areCollidingOptimized(game.player, entity)) {
            gameOver();
            return true;
        }
    }
    return false;
}

// Fast collision check with distance culling
function checkPlayerCollisionWithEntitiesOptimizedFast(entities, onCollision) {
    if (!spatialGrid || entities.length === 0) {
        return checkPlayerCollisionWithEntities(entities, onCollision);
    }

    const nearbyEntities = spatialGrid.getNearbyEntities(game.player);
    const relevantEntities = nearbyEntities.filter(entity => {
        if (!entities.includes(entity)) return false;
        
        // Distance culling - skip entities that are too far away
        const maxDistance = MAX_COLLISION_DISTANCE * scale;
        const distanceSquared = getDistanceSquared(game.player, entity);
        return distanceSquared < (maxDistance * maxDistance);
    });
    
    for (let i = relevantEntities.length - 1; i >= 0; i--) {
        const entity = relevantEntities[i];
        if (areCollidingOptimized(game.player, entity)) {
            const index = entities.indexOf(entity);
            if (index !== -1) {
                onCollision(entity, index);
            }
        }
    }
}

// Generate a random planet
function createRandomPlanet() {
    return {
        x: Math.random() * canvasWidth,
        y: Math.random() * canvasHeight,
        radius: (Math.random() * (PLANET_MAX_RADIUS - PLANET_MIN_RADIUS) + PLANET_MIN_RADIUS) * scale,
        type: Math.floor(Math.random() * images.planets.length),
        dx: (Math.random() - 0.5) * 0.5 * scale,
        dy: (Math.random() - 0.5) * 0.5 * scale
    };
}

// Generate static background stars
function generateStaticStars() {
    for (let i = 0; i < STATIC_STAR_COUNT; i++) {
        game.stars.push({
            x: Math.random() * canvasWidth,
            y: Math.random() * canvasHeight,
            radius: (Math.random() * 2 + 1) * scale
        });
    }
}

// Spatial partitioning for collision optimization
class SpatialGrid {
    constructor(width, height, cellSize) {
        this.width = width;
        this.height = height;
        this.cellSize = cellSize;
        this.cols = Math.ceil(width / cellSize);
        this.rows = Math.ceil(height / cellSize);
        this.grid = [];
        this.clear();
    }

    clear() {
        this.grid = [];
        for (let i = 0; i < this.cols * this.rows; i++) {
            this.grid[i] = [];
        }
    }

    getCell(x, y) {
        const col = Math.floor(x / this.cellSize);
        const row = Math.floor(y / this.cellSize);
        if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
            return col + row * this.cols;
        }
        return -1;
    }

    insert(entity) {
        // Insert entity into all cells it might occupy
        const minX = Math.max(0, Math.floor((entity.x - entity.radius) / this.cellSize));
        const maxX = Math.min(this.cols - 1, Math.floor((entity.x + entity.radius) / this.cellSize));
        const minY = Math.max(0, Math.floor((entity.y - entity.radius) / this.cellSize));
        const maxY = Math.min(this.rows - 1, Math.floor((entity.y + entity.radius) / this.cellSize));

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                const cellIndex = x + y * this.cols;
                this.grid[cellIndex].push(entity);
            }
        }
    }

    getNearbyEntities(entity) {
        const nearby = new Set();
        const minX = Math.max(0, Math.floor((entity.x - entity.radius) / this.cellSize));
        const maxX = Math.min(this.cols - 1, Math.floor((entity.x + entity.radius) / this.cellSize));
        const minY = Math.max(0, Math.floor((entity.y - entity.radius) / this.cellSize));
        const maxY = Math.min(this.rows - 1, Math.floor((entity.y + entity.radius) / this.cellSize));

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                const cellIndex = x + y * this.cols;
                this.grid[cellIndex].forEach(e => nearby.add(e));
            }
        }
        return Array.from(nearby);
    }
}

// Global spatial grid
let spatialGrid;

// Draw entity with image
function drawEntity(entity, image) {
    ctx.drawImage(image, 
                 entity.x - entity.radius, 
                 entity.y - entity.radius, 
                 entity.radius * 2, 
                 entity.radius * 2);
}

// --- CORE FUNCTIONS ---

function resizeCanvas() {
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    scale = canvasHeight / BASE_HEIGHT;
    
    // Initialize spatial grid for collision optimization
    const cellSize = Math.max(PLANET_MAX_RADIUS * 2 * scale, 100);
    spatialGrid = new SpatialGrid(canvasWidth, canvasHeight, cellSize);
}

function init() {
    game.score = 0;
    game.currentLevel = 1;
    gameState = 'START';
    updateScore(game.score);
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
    game.effects = [];

    generateStaticStars();
    
    // Lazy load non-critical assets if not already loaded
    ensureNonCriticalAssetsLoaded();

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
        game.planets.push(createRandomPlanet());
    }
}


// --- GAME LOGIC (UPDATE) ---

function update() {
    if (gameState !== 'PLAYING') return;

    updatePlanets();
    updateComets();
    updatePlayer();
    spawnCollectableStars();
    updateEffects(); // Update visual effects
    checkCollisions();
    checkLevelCompletion();
}

function updatePlanets() {
    game.planets.forEach(p => {
        updateEntityWithBounce(p, canvasWidth, canvasHeight);
    });
}

function updateComets() {
    game.comets.forEach((c, index) => {
        c.x += c.dx;
        c.y += c.dy;
        // Remove if off-screen
        if (isOffScreen(c, canvasWidth, canvasHeight)) {
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
    updateScore(game.score);
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

function updateSpatialGrid() {
    if (!spatialGrid) return;
    
    spatialGrid.clear();
    
    // Insert all collidable entities into spatial grid
    game.planets.forEach(planet => spatialGrid.insert(planet));
    game.comets.forEach(comet => spatialGrid.insert(comet));
    game.collectableStars.forEach(star => spatialGrid.insert(star));
}

function checkCollisions() {
    const p = game.player;
    frameCount++;

    // Update spatial grid less frequently for better performance
    if (frameCount % COLLISION_CHECK_FREQUENCY === 0) {
        updateSpatialGrid();
    }

    // Player vs Planets (optimized)
    if (checkPlayerCollisionWithDangerousEntitiesOptimized(game.planets)) {
        return;
    }

    // Player vs Comets (optimized)
    if (checkPlayerCollisionWithDangerousEntitiesOptimized(game.comets)) {
        return;
    }
    
    // Player vs Collectable Stars
    checkPlayerCollisionWithEntities(game.collectableStars, (star, index) => {
        game.score += STAR_SCORE;
        updateScore(game.score);
        game.collectableStars.splice(index, 1);
    });

    // Player vs Walls (most critical check, always run)
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
    // Use background if available, otherwise fallback
    if (images.background) {
        ctx.drawImage(images.background, 0, 0, canvasWidth, canvasHeight);
    } else {
        ctx.fillStyle = '#000011';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }
    
    drawStars();
    drawPlanets();
    drawComets();
    drawCollectableStars();
    drawPlayer();
    drawTrajectoryLine();
    drawEffects(); // Draw visual effects
}

// Ensure non-critical assets are loaded when needed
function ensureNonCriticalAssetsLoaded() {
    // Check if non-critical assets are loaded, if not, load them
    if (typeof lazyLoadAsset === 'function') {
        ['comet', 'planets', 'star'].forEach(assetKey => {
            if (!images[assetKey]) {
                lazyLoadAsset(assetKey)
                    .then(asset => {
                        images[assetKey] = asset;
                        console.log(`✓ Lazy loaded: ${assetKey}`);
                    })
                    .catch(err => {
                        console.warn(`Failed to lazy load ${assetKey}:`, err);
                        // Create fallback
                        if (assetKey === 'planets') {
                            images[assetKey] = [createFallbackImage(64, 64, '#4ECDC4', 'P')];
                        } else {
                            images[assetKey] = createFallbackImage(64, 64, '#4ECDC4', assetKey.charAt(0).toUpperCase());
                        }
                    });
            }
        });
    }
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
            drawEntity(p, planetImage);
        }
    });
}

function drawComets() {
    game.comets.forEach(c => {
        drawEntity(c, images.comet);
    });
}

function drawCollectableStars() {
    game.collectableStars.forEach(s => {
        drawEntity(s, images.star);
    });
}

function drawPlayer() {
    drawEntity(game.player, images.playerShip);
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


// --- VISUAL FEEDBACK FUNCTIONS ---

// Show loading screen with progress
function showLoadingScreen(progress = 0) {
    ctx.fillStyle = '#000011';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.font = `${32 * scale}px ${FONT_FAMILY}`;
    ctx.fillText('Loading Stardust Drifter...', canvasWidth / 2, canvasHeight / 2 - 60 * scale);
    
    // Progress bar
    const barWidth = 400 * scale;
    const barHeight = 20 * scale;
    const barX = (canvasWidth - barWidth) / 2;
    const barY = canvasHeight / 2;
    
    // Background
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
    
    // Progress fill
    ctx.fillStyle = '#00FFFF';
    ctx.fillRect(barX, barY, barWidth * progress, barHeight);
    
    ctx.font = `${16 * scale}px ${FONT_FAMILY}`;
    ctx.fillText(`${Math.round(progress * 100)}%`, canvasWidth / 2, barY + barHeight + 30 * scale);
}

// Enhanced visual effects system
function createEffect(type, x, y, options = {}) {
    const effect = {
        type: type,
        x: x,
        y: y,
        timer: options.duration || 60,
        maxTimer: options.duration || 60,
        alpha: 1.0,
        scale: options.scale || 1.0,
        color: options.color || '#FFFFFF',
        text: options.text || '',
        velocity: options.velocity || { x: 0, y: -2 },
        ...options
    };
    
    if (!game.effects) game.effects = [];
    game.effects.push(effect);
    return effect;
}

// Show score feedback animation
function showScoreEffect(x, y, score) {
    createEffect('score', x, y, {
        text: `+${score}`,
        color: '#FFD700',
        duration: 80,
        velocity: { x: 0, y: -3 },
        scale: 1.5
    });
}

// Show collision effect
function showCollisionEffect(x, y, type = 'normal') {
    const effects = {
        normal: { color: '#FF4444', text: '💥', duration: 30 },
        comet: { color: '#FF6B00', text: '☄️', duration: 40 },
        planet: { color: '#8A2BE2', text: '🌍', duration: 35 }
    };
    
    const config = effects[type] || effects.normal;
    
    // Main collision effect
    createEffect('collision', x, y, {
        ...config,
        scale: 2.0,
        velocity: { x: 0, y: 0 }
    });
    
    // Particle burst effect
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const speed = 3 + Math.random() * 2;
        createEffect('particle', x, y, {
            color: config.color,
            duration: 20 + Math.random() * 20,
            velocity: {
                x: Math.cos(angle) * speed,
                y: Math.sin(angle) * speed
            },
            scale: 0.5 + Math.random() * 0.5
        });
    }
}

// Show level completion effect
function showLevelCompleteEffect() {
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    
    // Main level complete text
    createEffect('levelComplete', centerX, centerY - 50 * scale, {
        text: `LEVEL ${game.currentLevel - 1} COMPLETE!`,
        color: '#00FF00',
        duration: 120,
        scale: 2.5,
        velocity: { x: 0, y: 0 }
    });
    
    // Celebration particles
    for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 100 + Math.random() * 100;
        const x = centerX + Math.cos(angle) * distance;
        const y = centerY + Math.sin(angle) * distance;
        
        createEffect('celebration', x, y, {
            color: `hsl(${Math.random() * 360}, 100%, 60%)`,
            text: ['✨', '⭐', '🎉', '🎊'][Math.floor(Math.random() * 4)],
            duration: 60 + Math.random() * 60,
            velocity: {
                x: (Math.random() - 0.5) * 4,
                y: (Math.random() - 0.5) * 4
            },
            scale: 1 + Math.random()
        });
    }
}

// Show power-up or special effect
function showPowerUpEffect(x, y, type) {
    const effects = {
        star: { color: '#FFD700', text: '⭐', duration: 60 },
        bonus: { color: '#00FFFF', text: '💎', duration: 80 },
        speed: { color: '#FF69B4', text: '⚡', duration: 50 }
    };
    
    const config = effects[type] || effects.star;
    
    // Pulsing effect
    createEffect('powerup', x, y, {
        ...config,
        scale: 1.5,
        velocity: { x: 0, y: -1 },
        pulse: true
    });
    
    // Ring effect
    createEffect('ring', x, y, {
        color: config.color,
        duration: 40,
        scale: 0.5,
        velocity: { x: 0, y: 0 },
        expanding: true
    });
}

// Show screen shake effect
function showScreenShake(intensity = 5, duration = 20) {
    if (!game.screenShake) {
        game.screenShake = {
            intensity: intensity,
            duration: duration,
            x: 0,
            y: 0
        };
    }
}

// Show trail effect for moving objects
function showTrailEffect(entity, color = '#FFFFFF') {
    if (Math.random() < 0.3) { // Don't create trail every frame
        createEffect('trail', entity.x, entity.y, {
            color: color,
            duration: 15,
            scale: entity.radius / 20,
            velocity: { x: 0, y: 0 }
        });
    }
}

// Update and draw visual effects
function updateEffects() {
    if (!game.effects) return;
    
    game.effects.forEach((effect, index) => {
        effect.timer--;
        effect.y += effect.velocity.y;
        effect.x += effect.velocity.x;
        effect.alpha = effect.timer / 60;
        
        if (effect.timer <= 0) {
            game.effects.splice(index, 1);
        }
    });
}

function drawEffects() {
    if (!game.effects) return;
    
    game.effects.forEach(effect => {
        ctx.save();
        ctx.globalAlpha = effect.alpha;
        ctx.fillStyle = effect.color || '#FFD700';
        ctx.font = `${(effect.scale || 1) * 24 * scale}px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        
        if (effect.text) {
            ctx.fillText(effect.text, effect.x, effect.y);
        } else if (effect.score) {
            ctx.fillText(`+${effect.score}`, effect.x, effect.y);
        }
        ctx.restore();
    });
}

// --- ASSET LOADING WITH PROGRESS ---

let loadingProgress = 0;
let isLoadingComplete = false;

function updateLoadingProgress() {
    if (typeof getLoadingProgress === 'function') {
        const progress = getLoadingProgress();
        loadingProgress = progress.progress;
    }
}

function gameLoadingLoop() {
    updateLoadingProgress();
    showLoadingScreen(loadingProgress);
    
    if (!isLoadingComplete) {
        requestAnimationFrame(gameLoadingLoop);
    }
}

// --- INITIALIZATION ---
resizeCanvas();

// Start loading screen
gameLoadingLoop();

loadImages()
    .then(loadedImages => {
        images = loadedImages;
        isLoadingComplete = true;
        
        // Initialize game after assets are loaded
        setTimeout(() => {
            init();
        }, 500); // Small delay to show completion
    })
    .catch(error => {
        console.error('Failed to load game assets:', error);
        isLoadingComplete = true;
        
        // Show error message but still try to start game with fallbacks
        ctx.fillStyle = '#FF0000';
        ctx.textAlign = 'center';
        ctx.font = `${24 * scale}px ${FONT_FAMILY}`;
        ctx.fillText('Some assets failed to load. Using fallbacks.', canvasWidth / 2, canvasHeight / 2 + 100 * scale);
        
        setTimeout(() => {
            if (loadedImages) {
                images = loadedImages;
            } else {
                // Create minimal fallback images using canvas
                const createSimpleFallback = (w, h, color, text) => {
                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = color;
                    ctx.fillRect(0, 0, w, h);
                    if (text) {
                        ctx.fillStyle = '#FFFFFF';
                        ctx.font = `${Math.min(w, h) * 0.3}px Arial`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(text, w / 2, h / 2);
                    }
                    const img = new Image();
                    img.src = canvas.toDataURL();
                    return img;
                };
                
                images = {
                    playerShip: createSimpleFallback(64, 64, '#FF6B6B', 'P'),
                    background: createSimpleFallback(1920, 1080, '#000011', '')
                };
            }
            init();
        }, 2000);
    });
