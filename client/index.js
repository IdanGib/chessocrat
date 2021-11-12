
(async () => {
    const socket = io();
    const url = new URL(`${location.origin}`); 
    const roomsEl = $('#rooms');
    const form = $('#create');
    const [nameInput] = $('#name');
    socket.on('rooms', (rooms) => {
        roomsEl.html('');
        for(const r of rooms) {
            // const li = $('<li></li>');
            // li.html(`<a 
            //     class="game-card text-white bg-dark"
            //     href="/game/game.html?game=${r}"
            //     target="_blank">${r}</a>
            //     `)
            const card = $(`
            <div class="card text-dark bg-light mb-3 mx-auto" style="max-width: 18rem;">
                <div class="card-header">${r}</div>
                <div class="card-body">
                    <h5 class="card-title">Light card title</h5>
                    <p class="card-text">Some quick example text to build on the card title and make up the bulk of the card's content.</p>
                    <a href="/game/game.html?game=${r}" target="_blank" class="card-link btn btn-outline-dark">Enter</a>
                    <a href="/game/watch.html?game=${r}" target="_blank" class="card-link btn btn-outline-primary">Watch</a>
                </div>
            </div>
            `);
            roomsEl.append(card);
        }
    });
    form.submit(event => {
        event.preventDefault();
        const { value } = nameInput;
        if(value) {
            window.open(`${url}game/game.html?game=${value}`);
            nameInput.value = "";
        }
    });

  
    
})();