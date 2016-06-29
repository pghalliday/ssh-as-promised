'use strict';

const EventEmitter = require('events');
const Connection = require('ssh2').Client;
const co = require('co');
const Rx = require('rx-lite');

const createEvent = function(type) {
  return {
    type: type,
    args: Array.prototype.slice.call(arguments, 1)
  };
};

const promiseForErrorOrValue = function(observables) {
  return new Promise((resolve, reject) => {
    const events = Rx.Observable.merge(observables).take(1);
    let error;
    let args;
    events.subscribe(event => {
      if (event.type === 'error') {
        error = event.args[0];
      } else {
        args = event.args;
      }
    }, error => {
      reject(error);
    }, () => {
      if (error) {
        reject(error);
      } else {
        resolve(args);
      }
    });
  });
}

class Client extends EventEmitter {
  constructor(options) {
    super();
    this.options = options;
    this.errorObservables = [];
  }

  info(message) {
    this.emit('info', message);
  }

  promiseForConnectionState(state) {
    const stateEvents = Rx.Observable.fromEvent(this.connection, state, createEvent.bind(null, state));
    return promiseForErrorOrValue(this.errorObservables.concat(stateEvents));
  }

  promiseForErrorOrClose() {
    const closeEvents = Rx.Observable.fromEvent(this.stream, 'close', createEvent.bind(null, 'close'));
    return promiseForErrorOrValue(this.errorObservables.concat(closeEvents));
  }

  connect(options) {
    this.info(`Connecting with options ${JSON.stringify(options)}`);
    this.connection = new Connection();
    this.connection.connect(options);
    this.errorObservables.push(Rx.Observable.fromEvent(this.connection, 'error', createEvent.bind(null, 'error')));
    return this.promiseForConnectionState('ready');
  }

  execute(command) {
    this.info(`Execute command ${command}`);
    const exec = Rx.Observable.fromNodeCallback(
      this.connection.exec.bind(this.connection),
      null,
      createEvent.bind(null, 'exec')
    );
    const execEvents = exec(command);
    const result = {
      stdout: new Buffer(0),
      stderr: new Buffer(0)
    };
    return promiseForErrorOrValue(this.errorObservables.concat(execEvents))
    .then(args => {
      this.stream = args[0];
      this.stream.on('data', data => {
        result.stdout = Buffer.concat([result.stdout, data]);
      }).stderr.on('data', data => {
        result.stderr = Buffer.concat([result.stderr, data]);
      });
      this.errorObservables.push(
        Rx.Observable.fromEvent(
          this.stream,
          'error',
          createEvent.bind(null, 'error')
        )
      );
      return this.promiseForErrorOrClose();
    })
    .then(args => {
      result.code = args[0];
      result.signal = args[1];
      return result;
    });
  }

  disconnect() {
    this.info('Disconnecting');
    this.connection.end();
    return this.promiseForConnectionState('end');
  }

  exec(command) {
    this.errorObservables = [];
    const self = this;
    return co(function* () {
      yield self.connect(self.options);
      let result;
      try {
        result = yield self.execute(command);
      } finally {
        yield self.disconnect();
      }
      return result;
    });
  }
}

module.exports = Client;
