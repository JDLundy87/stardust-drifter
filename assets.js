const assets = {
    // Critical assets (loaded immediately)
    critical: {
        playerShip: 'images/player.svg',
        background: 'images/background.svg'
    },
    // Non-critical assets (lazy loaded)
    nonCritical: {
        comet: 'images/comet.svg',
        planets: [
            'images/planet1.svg',
            'images/planet2.svg',
            'images/planet3.svg',
            'images/planet4.svg'
        ],
        star: 'images/star.svg'
    }
};

// Asset loading state
const assetState = {
    loaded: new Map(),
    loading: new Map(),
    failed: new Set(),
    retryCount: new Map()
};

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms

// Enhanced image loading with retry mechanism
function loadImage(src, retryCount = 0) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        
        img.onload = () => {
            console.log(`✓ Successfully loaded: ${src}`);
            assetState.loaded.set(src, img);
            assetState.loading.delete(src);
            resolve(img);
        };
        
        img.onerror = (err) => {
            console.warn(`✗ Failed to load: ${src} (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
            
            if (retryCount < MAX_RETRIES) {
                console.log(`Retrying ${src} in ${RETRY_DELAY}ms...`);
                setTimeout(() => {
                    loadImage(src, retryCount + 1).then(resolve).catch(reject);
                }, RETRY_DELAY);
            } else {
                const errorMsg = `Failed to load image: ${src} after ${MAX_RETRIES + 1} attempts. Error: ${err.message || err}`;
                console.error(errorMsg);
                assetState.failed.add(src);
                assetState.loading.delete(src);
                reject(new Error(errorMsg));
            }
        };
        
        // Set loading state
        assetState.loading.set(src, true);
        assetState.retryCount.set(src, retryCount);
        
        img.src = src;
    });
}

// Create fallback/placeholder images
function createFallbackImage(width = 64, height = 64, color = '#FF0000', text = '?') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    // Draw background
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    
    // Draw text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `${Math.min(width, height) * 0.5}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2);
    
    const img = new Image();
    img.src = canvas.toDataURL();
    return img;
}

// Load critical assets first
function loadCriticalAssets() {
    const images = {};
    const promises = [];
    
    console.log('Loading critical assets...');
    
    for (const [key, src] of Object.entries(assets.critical)) {
        if (Array.isArray(src)) {
            const assetPromises = src.map(imageSrc => 
                loadImage(imageSrc).catch(err => {
                    console.warn(`Using fallback for ${imageSrc}:`, err.message);
                    return createFallbackImage(64, 64, '#FF6B6B', key.charAt(0).toUpperCase());
                })
            );
            promises.push(
                Promise.all(assetPromises).then(loadedImages => {
                    images[key] = loadedImages;
                })
            );
        } else {
            promises.push(
                loadImage(src)
                    .then(img => {
                        images[key] = img;
                    })
                    .catch(err => {
                        console.warn(`Using fallback for ${src}:`, err.message);
                        images[key] = createFallbackImage(64, 64, '#FF6B6B', key.charAt(0).toUpperCase());
                    })
            );
        }
    }
    
    return Promise.all(promises).then(() => {
        console.log('✓ Critical assets loaded');
        return images;
    });
}

// Lazy load non-critical assets
function lazyLoadAsset(key) {
    if (assetState.loaded.has(key) || assetState.loading.has(key)) {
        return Promise.resolve(assetState.loaded.get(key));
    }
    
    const src = assets.nonCritical[key];
    if (!src) {
        return Promise.reject(new Error(`Asset '${key}' not found`));
    }
    
    if (Array.isArray(src)) {
        const promises = src.map(imageSrc => 
            loadImage(imageSrc).catch(err => {
                console.warn(`Using fallback for ${imageSrc}:`, err.message);
                return createFallbackImage(64, 64, '#4ECDC4', key.charAt(0).toUpperCase());
            })
        );
        return Promise.all(promises);
    } else {
        return loadImage(src).catch(err => {
            console.warn(`Using fallback for ${src}:`, err.message);
            return createFallbackImage(64, 64, '#4ECDC4', key.charAt(0).toUpperCase());
        });
    }
}

// Load all non-critical assets
function loadNonCriticalAssets() {
    const images = {};
    const promises = [];
    
    console.log('Loading non-critical assets...');
    
    for (const key of Object.keys(assets.nonCritical)) {
        promises.push(
            lazyLoadAsset(key)
                .then(loadedAsset => {
                    images[key] = loadedAsset;
                })
                .catch(err => {
                    console.warn(`Failed to load ${key}, using fallback:`, err.message);
                    const fallback = Array.isArray(assets.nonCritical[key]) 
                        ? [createFallbackImage(64, 64, '#4ECDC4', key.charAt(0).toUpperCase())]
                        : createFallbackImage(64, 64, '#4ECDC4', key.charAt(0).toUpperCase());
                    images[key] = fallback;
                })
        );
    }
    
    return Promise.all(promises).then(() => {
        console.log('✓ Non-critical assets loaded');
        return images;
    });
}

// Main loading function with progressive loading
function loadImages() {
    console.log('🎮 Starting asset loading...');
    
    return loadCriticalAssets()
        .then(criticalImages => {
            console.log('🚀 Critical assets ready - game can start');
            
            // Load non-critical assets in the background
            loadNonCriticalAssets()
                .then(nonCriticalImages => {
                    Object.assign(criticalImages, nonCriticalImages);
                    console.log('🎉 All assets loaded!');
                })
                .catch(err => {
                    console.warn('Some non-critical assets failed to load:', err);
                });
            
            return criticalImages;
        })
        .catch(err => {
            console.error('❌ Critical asset loading failed:', err);
            
            // Return fallback images for critical assets
            const fallbackImages = {
                playerShip: createFallbackImage(64, 64, '#FF6B6B', 'P'),
                background: createFallbackImage(1920, 1080, '#000011', '')
            };
            
            console.log('🔄 Using fallback images for critical assets');
            return fallbackImages;
        });
}

// Get asset loading progress
function getLoadingProgress() {
    const totalAssets = Object.keys(assets.critical).length + Object.keys(assets.nonCritical).length;
    const loadedAssets = assetState.loaded.size;
    const failedAssets = assetState.failed.size;
    
    return {
        total: totalAssets,
        loaded: loadedAssets,
        failed: failedAssets,
        progress: (loadedAssets + failedAssets) / totalAssets
    };
}

// Check if a specific asset is available
function isAssetLoaded(key) {
    const criticalSrc = assets.critical[key];
    const nonCriticalSrc = assets.nonCritical[key];
    const src = criticalSrc || nonCriticalSrc;
    
    if (Array.isArray(src)) {
        return src.every(s => assetState.loaded.has(s));
    }
    return assetState.loaded.has(src);
}
