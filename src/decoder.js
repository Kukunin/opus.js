var AV = require('av');

module.exports = function(config) {
  var OpusDecoder = AV.Decoder.extend(function() {
    AV.Decoder.register('opus', this);

    this.prototype.init = function() {
      this.queue = [];
      this.buflen = config.bufferLength || 4096;

      this.promise = new Promise((resolve, reject) => {
        const decoder = new Worker(config.decoderPath);

        decoder.addEventListener( "message", (e) => {
          switch( e['data']['message'] ){
          case 'ready':
            resolve(decoder);
            break;
          case 'error':
            throw new Error("Opus decoding error: " + e['data']['error']);
          case 'data':
            this.queue.shift()(e['data']['data']);
            break;
          }
        });

        decoder.postMessage( Object.assign({
          command: 'init',
          bufferLength: this.buflen,
          decoderSampleRate: this.format.originalSampleRate,
          outputBufferSampleRate: this.format.sampleRate,
          resampleQuality: config.resampleQuality || 3,
          numberOfChannels: this.format.channelsPerFrame,
          fastSound: config.fastSound
        }, this.config));
      });
    };

    this.prototype.readChunk = function() {
      if (!this.stream.available(1))
        throw new AV.UnderflowError();

      var list = this.stream.list;
      var packet = list.first;
      list.advance();

      if (this.buflen < packet.length ) {
        throw new Error("Packet size is bigger than the buffer size: " + this.buflen);
      }

      return this.promise.then((decoder) => {
        decoder.postMessage({ command: "decode", data: packet.data });

        return new Promise((resolve, reject) => this.queue.push(resolve));
      });
    };

    this.prototype.destroy = function() {
      this.queue = [];
      this.promise.then((decoder) => decoder.terminate());
      this.promise = null;
    };
  });
}
