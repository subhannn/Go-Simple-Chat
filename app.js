new Vue({
    el: '#app',

    data: {
        ws: null, // Our websocket
        newMsg: '', // Holds new messages to be sent to the server
        chatContent: '', // A running list of chat messages displayed on the screen
        email: null, // Email address used for grabbing an avatar
        username: null, // Our username
        joined: false, // True if email and username have been filled in,
        channel: 'broadcast'
    },

    created: function() {
        var self = this;
        var user_chat = Cookies.get('user_chat')

        if (location.protocol != 'https:'){
            this.ws = new WebSocket('ws://' + window.location.host + '/ws');
        }else{
            this.ws = new WebSocket('wss://' + window.location.host + '/ws');
        }
        this.ws.onopen = function(){
            if(typeof user_chat == 'undefined'){
                $('#registerModal').modal({
                    backdrop: 'static',
                })

                $('#registerForm').on('submit', function(e){
                    e.preventDefault()
                    var username = $('#username').val()
                    self.ws.send(
                        JSON.stringify({
                            action: 'register',
                            username: username
                        })
                    );
                    $('#registerModal').modal('hide')
                    Cookies.set('user_chat', username, { expires: 31 });
                    self.username = username

                    $('#logout').show()
                    self.loadMessage()
                })
            }else{
                self.ws.send(
                    JSON.stringify({
                        action: 'login',
                        username: user_chat,
                    })
                );
                self.username = user_chat

                $('#logout').show()
                self.loadMessage()
            }

            $('#logout').on('click', function (e) {
                e.preventDefault()

                if(confirm("Are you sure to logout?")){
                    self.ws.send(
                        JSON.stringify({
                            action: 'logout',
                            username: user_chat,
                        })
                    );
                    Cookies.remove('user_chat')
                    store.clearAll()
                    window.location.reload()
                }
            })
        }
        this.ws.addEventListener('message', function(e) {
            var msg = JSON.parse(e.data);
            if(msg.action == 'register' || msg.action == 'login'){
                self.join(msg.username, msg.users)
                $('#user_'+msg.username).removeClass('offline')
            }else if(msg.action == 'logout'){
                $('#user_'+msg.username).remove()
            }else if(msg.action == 'offline'){
                $('#user_'+msg.username).addClass('offline')
            }else{
                self.newMessage(msg)
            }
        });
    },

    methods: {
        join: function(username, users){
            var self = this
            $.each(users, function(idx, val){
                if($('#user_'+val).length == 0 && self.username != val){
                    var $ele = $('<li class="nav-item user" id="user_'+val+'"> \
                        <a href="#" class="nav-link user_online" data-channel="'+val+'">'+val+'<span class="unread" style="display:none;">0</span>\
                    </a></li>')
                    if(data = store.get(val)){
                        if(data.unread > 0){
                            $ele.find('.unread').text(data.unread).show()
                        }
                    }

                    $('#listUser').append($ele)
                }
            })

            $('.user_online').on('click', function(e){
                e.preventDefault();
                $('.user_online').removeClass('active')
                $(this).addClass('active')
                self.channel = $(this).data('channel')
                $('[data-msg-channel').attr('data-msg-channel', self.channel)
                $(this).find('.unread')
                    .text('0')
                    .hide()
                self.loadMessage()
            })
        },
        loadMessage: function(){
            var self = this
            $('#container-msg').html('')
            if(data = store.get(this.channel)){
                data.unread = 0;
                store.set(this.channel, data)

                $.each(data.messages, function (idx, message) {
                    var className = 'self tri-right right-top'
                    if(message.username != self.username){
                        var className = 'sender tri-right left-top'
                    }
                    $('#container-msg').append('<li class="msg-container clearfix"><div class="'+className+'">\
                        <span>'+message.username+'</span> \
                        <div class="body">'+message.message+'</div> \
                    </div></li>')

                    $('.container-message').animate({scrollTop: $('.container-message').prop("scrollHeight")}, 200);
                })
            }
        },
        newMessage: function(message){
            console.log(message)
            var className = 'self tri-right right-top'
            if(message.username != this.username){
                var className = 'sender tri-right left-top'
            }
            $('[data-msg-channel="'+message.channel+'"]').append('<li class="msg-container clearfix"><div class="'+className+'"> \
                <span>'+message.username+'</span> \
                <div class="body">'+message.message+'</div> \
            </div></li>')

            $('.container-message').animate({scrollTop: $('.container-message').prop("scrollHeight")}, 200);

            var data = {};
            if(data = store.get(message.channel)){
                if(message.channel != this.channel){
                    data.unread += 1
                }

                data.messages.push({
                    username: message.username,
                    message: message.message,
                    time: message.time,
                })
                store.set(message.channel, data)
            }else{
                data = {
                    channel: message.channel,
                    unread: message.channel != this.channel?1:0,
                    messages: [
                        {
                            username: message.username,
                            message: message.message,
                            time: message.time,
                        }
                    ]
                };
                store.set(message.channel, data)
            }
            if(message.channel != this.channel){
                $('[data-channel="'+message.channel+'"]').find('.unread').text(data.unread).show()
            }
        },
        send: function(){
            this.ws.send(JSON.stringify({
                username: this.username,
                message: $('[name="message"]').val(),
                channel: this.channel,
                time: Date.now()
            }))
            $('[name="message"]').val('')
            $('[name="message"]').focus()
        }
    }
});