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

    const loadImage = (src) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    };

    promises.push(loadImage(assets.playerShip).then(img => images.player = img));
    promises.push(loadImage(assets.comet).then(img => images.comet = img));

    const planetPromises = assets.planets.map(planetSrc => loadImage(planetSrc));
    promises.push(Promise.all(planetPromises).then(planetImgs => images.planets = planetImgs));

    promises.push(loadImage(assets.star).then(img => images.star = img));
    promises.push(loadImage(assets.background).then(img => images.background = img));

    return Promise.all(promises).then(() => images);
}