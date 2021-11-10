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

  
    const modal = new AppModal();

    modal.open({ 
        title: 'Welcome!', 
        body: 'Please act in respectful manners and have fun!'
    });

   

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
            modal.openStatic({
                listener: {
                    name: 'click',
                    handler: event => {
                        const { piece }  = event.target.dataset;
                        modal.closeStatic();
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
    const move = $('#move');
    const turnEl = $('#turn');
    const mymove = $('#mymove');
    const votesContainerEl = $('#votes_container');

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

    function cleanAllSelectedSquares() {
        $('.selected').removeClass('selected');
        while(selected.pop());
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
           cleanAllSelectedSquares();
        }

        mymove.html(selected.map(s => `<div class="${chess.orientation()}-vote">${s}</div>`)
        .join(`<i class="bi bi-arrow-right mx-2" style="font-size: 1.6rem;"></i>`));
    });
    
    function checkMessage(in_check) {
        pillMsgEl.html(in_check ? messages.check : '' );
    }

    function getSide() {
        return chess.orientation() === 'white' ? 'w' : 'b';
    }

 

    function getVotesCount(moveVotes) {
        const results = {};
     
        for(const mv of moveVotes) {
            const { from, to } = mv.vote.move;
            if(!from || !to) {
                continue;
            }
            const r = `${from}${to}`;
            if(results[r]) {
                results[r].count++;
            } else {
                results[r] = { from, to, count: 1 };
            }
        }
      
        return Object.values(results).sort((v1, v2) => v2.count - v1.count);
    }

    function updateVotesContainer(moveVotes) {
        const votesCount = getVotesCount(moveVotes);
        const vhtml = votesCount.map(
            v =>  `<tr>
                <td class="text-center">
                    <span>${v.from}</span>
                    <i class="bi bi-arrow-right mx-2"></i>
                    <span>${v.to}</span> 
                </td>
                <td class="text-center">
                    ${v.count}
                </td>
            </tr>`
          ).join('');
         
        votesContainerEl.html(vhtml);
    }

    function updateVotesRatio(ratio) {
        const votesInfoMsge = `Votes ${Math.round(ratio * 100)}%`;
        votes_info.text(votesInfoMsge);
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
        const moveVotes = mygroup.filter(p => Boolean(p.vote.move));
        const isMyTurn = me.side === turn;

        const ratio = moveVotes.length / mygroup.length;
        if(!ratio) {
            cleanAllSelectedSquares();
        }
        updateVotesRatio(ratio);
        updateVotesContainer(moveVotes);

        turnEl.attr('class', '');
        turnEl.addClass(turn);
        sizeEl.text(size);
        checkMessage(check);
        chess.position(fen);

        if(over) {
            openGameOverModal(over, turn);
        }

        if(promotion && isMyTurn) {
           const promotion = await openPromotionModal();
           socket.emit('vote', { ...me.vote, promotion  })
        }
    });
    socket.emit('join', game);
})();