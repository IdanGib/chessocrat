class AppToast {
    toast = $(`
    <div class="position-fixed top-0 start-50 translate-middle-x p-3">
        <div class="toast" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-header">
                <strong class="me-auto">Bootstrap</strong>
                <small>11 mins ago</small>
                <button data-action="close" type="button" class="btn-close" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                Hello, world! This is a toast message.
            </div>
        </div>
    </div>
    `);
    constructor(id) {
        if(id) {
            this.toast.on('click', event => {
                const action = event.target.dataset;
                if(action === 'close') {
                    this.toast.hide();
                }
            });
    
            $('#' + id).append(this.toast);
        }
    }
    open() {
        this.toast.show();
    }
    close() {
        this.toast.hide();
    }
}

class AppModal {
    modal = $(`
    <div id="m-container">
        <button 
            id="modal_trigger" 
            type="button" 
            class="visually-hidden" 
            data-bs-toggle="modal" 
            data-bs-target="#appModal"></button>
        <div class="modal fade" id="appModal" tabindex="-1" 
            aria-labelledby="appModalLabel" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" 
                    id="appModalLabel">
                <span id="modal_title"></span>
                </h5>
                <button type="button"
                    class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
                <div id="modal_body" class="modal-body">
                    
                </div>
            </div>
        </div>
        </div>
        </div>
    `);
    constructor(id) {
        $('#' + id).append(this.modal);
        
    }

    close() {
        // TODO 
    }

    open({
        title,
        body,
        listener
    }) {
        $('#modal_trigger').click();
        const { name, handler } = listener || {};
        if(name && handler) {
            $('#appModal').on(name, handler);
        }
        $('#modal_title').html(title || '');
        $('#modal_body').html(body|| '');
      
    }
}
