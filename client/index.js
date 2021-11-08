
(async () => {
    const socket = io();
    const url = new URL(`${location.origin}`); 
    const roomsUl = $('#rooms');
    const form = $('#create');
    const [nameInput] = $('#name');
    socket.on('rooms', (rooms) => {
        roomsUl.html('');
        for(const r of rooms) {
            const li = $('<li></li>');
            li.html(`<a 
                class="game-card text-white bg-dark"
                href="/game/game.html?game=${r}"
                target="_blank">${r}</a>`)
            roomsUl.append(li);
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