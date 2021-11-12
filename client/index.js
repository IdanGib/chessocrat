
(async () => {
    const socket = io();
    const url = new URL(`${location.origin}`); 
    const roomsEl = $('#rooms');
    const form = $('#create');
    const [nameInput] = $('#name');

    // async function getRoomsInfo() {
    //     const res = await fetch(`${location.origin}/rooms/info`);
    //     return await res.json();
    // }

    socket.on('rooms', async (rooms) => {
        roomsEl.html('');
        for(const r of rooms) {
            const card = $(`
            <div class="card text-dark bg-light m-3" style="max-width: 18rem;">
                <div class="card-header">${r}</div>
                <div class="card-body">
                    <h5 class="card-title"></h5>
                    <p class="card-text"></p>
                    <a href="/game/game.html?game=${r}" target="_blank" class="card-link btn btn-outline-dark">Enter</a>
                    <a href="/watch.html?game=${r}" target="_blank" class="card-link btn btn-outline-primary">Watch</a>
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