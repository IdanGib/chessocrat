(async () => {

    const url = new URL(`${location.href}`); 
    const game = url.searchParams.get("game");

    const err = $('#err');
  
    const messages = {
        err: `<div class="alert alert-danger text-center" role="alert"> No game</div>`,
        check: `<span class="badge rounded-pill bg-danger">Check!</span>`
    }

    if(!game) {
        err.html('');
        return err.html(messages.err);
    }

    const modal = new AppModal('modal');

    function openGameOverModal(over, turn) {
        modal.open({
            title: over,
            body: `
              <div class="text-center">${
                  turn === 'w' ? 'Blacks win!' : 'Whites win!'
              }</div>
            `
        });
    }

    function openPromotionModal() {
        return new Promise(resolve => {
            modal.open({
                listener: {
                    name: 'click',
                    handler: event => {
                        const { piece }  = event.target.dataset;
                        resolve(piece);
                    }
                },
                title: "Choose piece",
                body: `
                    <div class="text-center">
                        <img class="mx-2 p-1 promotion-piece" data-piece="q" style="width:64px;height:64px;" src="chesspieces/wQ.png">
                        <img class="mx-2 p-1 promotion-piece" data-piece="r" style="width:64px;height:64px;" src="chesspieces/wR.png">
                        <img class="mx-2 p-1 promotion-piece" data-piece="n" style="width:64px;height:64px;" src="chesspieces/wN.png">
                        <img class="mx-2 p-1 promotion-piece" data-piece="b" style="width:64px;height:64px;" src="chesspieces/wB.png">
                    </div>
                `
            });
        });
    
    }

    const gameEl = $('#game');
    gameEl.html(game);
    
    const votes_info = $('#votes_info');

    const ROOM_SPACE = "/games";
    const socket = io(ROOM_SPACE);

    const chess = Chessboard('board', {
       pieceTheme: "chesspieces/{piece}.png"
    }); 

    const sizeEl = $('#size');
    const board = $('#board');
    const pillMsgEl = $('#pill-msg');
    const msgEl = $('#msg');
    const move = $('#move');
    const turnEl = $('#turn');
    const mymove = $('#mymove');
    const votesEl = $('#votes_container');
    const selected = [];

    function voteMove() {
        const [ from, to ] = selected;
        if(from && to) {
            const move = { from, to };
            socket.emit('vote', { move });
        }
    }


    window.addEventListener('keypress', event => {
        if(event.key === 'Enter' && selected.length === 2) {
            voteMove();
        }
    });

    move.submit(event => {
        event.preventDefault();
        voteMove();
    });

    function getSquareFromElement(el) {
        if(!el) {
            return;
        }
        const { square } = el.dataset;
        if(square) {
            return { square, element: el };
        }
        const [ p ] = $(el).parent();
        if(p) {
            return { square: p.dataset.square, element: p };
        }
    }

    board.on('click', event => {
        const { square, element } = getSquareFromElement(event.target);
        if(!square || !element) {
            return;
        }
        $(element).addClass('selected');
        if(selected.length < 2 && !selected.includes(square)) {
            selected.push(square);
        } else {
            $('.selected').removeClass('selected');
            while(selected.pop());
        }

        mymove.html(selected.map(s => `<div class="${chess.orientation()}-vote">${s}</div>`)
        .join(`<i class="bi bi-arrow-right mx-2" style="font-size: 1.6rem;"></i>`));
    });
    
    function gameOver(over) {
        alert(over);
    }

    function chessMessage(in_check) {
        pillMsgEl.html(in_check ? messages.check : '' );
    }

    function getSide() {
        return chess.orientation() === 'white' ? 'w' : 'b';
    }

    socket.on('state', async ({ 
        players,
        turn, 
        over,
        check,
        fen,
        size,
        promotion
    }) => {     
        const me = players.find(p => p.id === socket.id);

        if(!me) {
            return;
        }
        const orientation = (me.side === 'w') ? 'white' : 'black';
        if(orientation !== chess.orientation()) {
            chess.orientation(orientation);
        }
        const mygroup = players.filter(p => p.side === getSide() );
        const isMyTurn = me.side === turn;
        const { from: mfrom, to: mto } = me.vote.move || {};
        if(mfrom && mto) {
            const myvote = `
            <div class="rounded-3 bg-light" style="font-size: 1.6rem;">
                <span>${mfrom}</span>
                <i class="bi bi-arrow-right mx-2"></i>
                <span>${mto}</span>
            <div>
            `;
            msgEl.html(myvote);
        }
        
        const moveVotes = mygroup.filter(p => Boolean(p.vote.move));
        
        const ratio = moveVotes.length / mygroup.length;
        const votesInfoMsge = `Votes ${Math.round(ratio * 100)}%`;
        votes_info.text(votesInfoMsge);

        const vhtml = moveVotes.map(
            pl =>  `<div class="text-center" style="font-size: 1.6rem;">
                      <span>${pl.vote.move.from}</span>
                      <i class="bi bi-arrow-right mx-2"></i>
                      <span>${pl.vote.move.to}</span>
                  </div>`
          ).join('');
         
        votesEl.html(vhtml);
        turnEl.attr('class', '');
        turnEl.addClass(turn);

    

        sizeEl.text(size);

        chessMessage(check);
        chess.position(fen);

        if(over) {
            openGameOverModal(over, turn);
        }

        if(promotion) {
           const promotion = await openPromotionModal();
           socket.emit('vote', { ...me.vote, promotion  })
        }
    
    });
    socket.emit('join', game);
})();