const assets = {
    playerShip: 'images/player.svg',
    comet: 'images/comet.svg',
    planets: [
        'images/planet1.svg',
        'images/planet2.svg',
        'images/planet3.svg',
        'images/planet4.svg'
    ],
    star: 'images/star.svg',
    background: 'images/background.svg'
};

function loadImages() {
    const images = {};
    const promises = [];

    const loadImage = (src) => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(`Failed to load image: ${src}. Error: ${err}`);
        img.src = src;
    });

    for (const key in assets) {
        if (Array.isArray(assets[key])) {
            const assetPromises = assets[key].map(src => loadImage(src));
            promises.push(
                Promise.all(assetPromises).then(loadedImages => {
                    images[key] = loadedImages;
                })
            );
        } else {
            promises.push(
                loadImage(assets[key]).then(img => {
                    images[key] = img;
                })
            );
        }
    }

    return Promise.all(promises).then(() => images);
}