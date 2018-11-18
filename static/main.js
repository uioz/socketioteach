/**
* EventEmitter&&Observer的超简单实现
*/
class SimpleEventEmitter {
    constructor() {
        this._event = new Map();
        this._onceEvent = new Map();
    }
    _removeListener(mapName, eventName, callback) {
        let newArray = [];
        if (this[mapName].has(eventName)) {
            newArray = this[mapName].get(eventName).filter((value) => {
                return value !== callback;
            });
        }
        this[mapName].set(eventName, newArray);
    }
    /**
     * emit
     */
    emit(eventName, ...args) {
        if (this._event.has(eventName)) {
            for (const fun of this._event.get(eventName)) {
                fun(...args);
            }
        }
        if (this._onceEvent.has(eventName)) {
            for (const fun of this._onceEvent.get(eventName)) {
                fun(...args);
                this._removeListener('_onceEvent', eventName, fun);
            }
        }
    }
    /**
     * on
     */
    on(eventName, callback) {
        if (this._event.has(eventName)) {
            this._event.get(eventName).push(callback);
        }
        else {
            this._event.set(eventName, [callback]);
        }
    }
    /**
     * once
     */
    once(eventName, callback) {
        if (this._onceEvent.has(eventName)) {
            this._onceEvent.get(eventName).push(callback);
        }
        else {
            this._onceEvent.set(eventName, [callback]);
        }
    }
    /**
     * removeListener
     */
    removeListener(eventName, callback) {
        this._removeListener('_event', eventName, callback);
        this._removeListener('_onceEvent', eventName, callback);
    }
    /**
     * removeAllListener
     */
    removeAllListener(eventName) {
        function batch(mapName) {
            if (this[mapName].has(eventName)) {
                this[mapName].delete(eventName);
            }
        }
        ;
        batch.call(this, '_event');
        batch.call(this, '_onceEvent');
    }
}

/**
 * 1. 可用方法
 * - 构造函数
 * - connect 方法 没有建立连接的情况下调用登录,已经建立的情况下则重新连接
 * - boradCast 方法 向服务器广播消息
 * - close 方法 该方法调用后关闭连接
 * 2. 可用事件
 * - error 事件websocket错误
 * - close 连接被关闭就是原生的websocket关闭事件
 * - requesterror 登录后不符合格式的请求会触发这个事件,一旦被触发就意味着连接被关闭
 * - broadcast 由服务器向客户端广播的信息都会触发这个事件
 * - login 调用connect方法后登录成功会触发这个事件
 */
class socketPackage extends SimpleEventEmitter {
    /**
     * 创建一个客户端实例,如果指定了昵称则创建后就立即连接
     *
     * @param url 服务器地址
     * @param token 服务器签名
     * @param nickName 昵称
     */
    constructor(url, token, nickName) {
        super();
        /**
         * 保存远程主机的地址
         */
        this.url = '';
        /**
         * 保存客户端状态
         */
        this.state = {
            login: false,
            connect: false,
            tryError: false
        };
        this.openListener = () => {
            this.state.connect = true;
            if (!this.state.login) {
                this.send(socketPackage.getLoingRequest(this.nickName, this.token, this.groupName));
            }
        };
        this.closeListener = (event) => {
            this.terminate();
            this.emit('close', event);
        };
        this.errorListener = (event) => {
            if (this.state.tryError) {
                return;
            }
            this.emit('error', event);
            this.terminate();
        };
        this.messageListener = (event) => {
            const response = JSON.parse(event.data);
            if (response.type == 'login' && response.result) {
                this.auth = response.auth;
                this.groupName = response.groupName;
                this.state.login = true;
                this.emit('login', response);
                return;
            }
            // 如果result返回false意味着此时服务器已经关闭了连接
            if (!response.result) {
                this.terminate();
                this.emit('requesterror', response);
                return;
            }
            // 剩下的都是广播事件
            this.emit('broadcast', response);
        };
        this.url = url;
        this.token = token;
        if (nickName) {
            this.connect(nickName);
        }
    }
    /**
     * 获取登录类型对象
     * @param nickName 用户昵称
     * @param token 服务器id
     */
    static getLoingRequest(nickName, token, groupName) {
        const result = {
            type: 'login',
            nickName,
            token
        };
        if (groupName) {
            result.groupName = groupName;
        }
        return result;
    }
    ;
    /**
     * 获取发送消息对象
     * @param message 发送的消息
     * @param nickName 用户昵称
     * @param token 服务器签名
     * @param auth 用户凭证
     * @param groupName 要发送的群组
     */
    static getRequestMessage(message, nickName, token, auth, groupName) {
        return {
            type: 'message',
            token,
            nickName,
            auth,
            groupName,
            message
        };
    }
    ;
    ;
    /**
     * 调用后将对象转为JSON使用websocket.send方法发送
     * @param data 需要发送的数据
     */
    send(data) {
        this.webScoket.send(JSON.stringify(data));
    }
    /**
     * 调用后给内部的websocket添加监听
     */
    process() {
        if (this.state.login || this.state.connect) {
            throw "非法调用该方法只有在彻底断开连接的时候才可以调用!";
        }
        // 添加事件监听
        this.webScoket.addEventListener('open', this.openListener);
        this.webScoket.addEventListener('error', this.errorListener);
        this.webScoket.addEventListener('message', this.messageListener);
        this.webScoket.addEventListener('close', this.closeListener);
    }
    ;
    /**
     * 删除所有的监听器且不会发出错误信息,
     * 关闭socket连接且清空内部的引用
     */
    terminate() {
        this.state.tryError = true;
        // 删除所有的监听器
        this.webScoket.removeEventListener('close', this.closeListener);
        this.webScoket.removeEventListener('open', this.openListener);
        this.webScoket.removeEventListener('message', this.messageListener);
        this.webScoket.removeEventListener('error', this.errorListener);
        // 关闭连接
        this.webScoket.close();
        this.webScoket = null;
        this.state.login = this.state.connect = this.state.tryError = false;
    }
    ;
    /**
     * 调用后连接服务器,如果已经存在连接则彻底断开连接后再次连接
     */
    connect(nickName = '', groupName = '') {
        const openCode = WebSocket.OPEN, connectCode = WebSocket.CONNECTING, closeCode = WebSocket.CLOSING, codeArray = [openCode, connectCode, closeCode];
        if (this.webScoket) {
            // 如果处于连接状态则彻底关闭连接并且清空引用
            if (codeArray.indexOf(this.webScoket.readyState) !== -1) {
                this.terminate();
            }
        }
        if (nickName && typeof groupName == 'string') {
            this.nickName = nickName;
        }
        if (groupName && typeof groupName == 'string') {
            this.groupName = groupName;
        }
        if (!this.nickName) {
            throw new Error('内部没有昵称,可以在connect方法或者新建实例的时候传入');
        }
        this.webScoket = new WebSocket(this.url);
        this.process();
    }
    ;
    /**
     * 发送消息
     *
     * - 只有登录后这个方法才会真正的发送消息
     * -
     */
    broadCast(message) {
        if (this.state.login) {
            const response = socketPackage.getRequestMessage(message, this.nickName, this.token, this.auth, this.groupName);
            this.send(response);
            return true;
        }
        return false;
    }
    /**
     * 调用该方法则关闭连接且触发close事件
     *
     * - 如果没有连接或者没有登录则该方法无效
     */
    close() {
        if (this.webScoket && this.state.login) {
            this.webScoket.close();
            this.terminate();
        }
    }
};

// 参数1 url 参数2 服务器签名
const client = new socketPackage('ws://127.0.0.1:8888','helloworld');