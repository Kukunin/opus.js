var AV = require('av');
const FastSound = require('fast-sound');

module.exports = function(config) {
  var OpusDecoder = AV.Decoder.extend(function() {
    AV.Decoder.register('opus', this);

    this.prototype.init = function() {
      this.buflen = 4096;
      this.outlen = 4096;

      this.promise = new Promise((resolve) => {
        FastSound(config).then((Opus) => {

          this.buf = Opus._malloc(this.buflen);
          this.opus = Opus._opus_decoder_create(this.format.sampleRate, this.format.channelsPerFrame, this.buf);
          this.outbuf = Opus._malloc(this.outlen * this.format.channelsPerFrame * 4);
          this.f32 = this.outbuf >> 2;
          Opus.then = undefined; // to avoid infinite resolving loop
          resolve(Opus);
        });
      });
    };

    this.prototype.readChunk = function() {
      if (!this.stream.available(1))
        throw new AV.UnderflowError();

      var list = this.stream.list;
      var packet = list.first;
      list.advance();

      return this.promise.then((Opus) => {
        if (this.buflen < packet.length) {
            this.buf = Opus._realloc(this.buf, packet.length);
            this.buflen = packet.length;
        }

        Opus.HEAPU8.set(packet.data, this.buf);

        var len = Opus._opus_decode_float(this.opus, this.buf, packet.length, this.outbuf, this.outlen, 0);
        if (len < 0)
            throw new Error("Opus decoding error: " + len);

        var samples = Opus.HEAPF32.subarray(this.f32, this.f32 + len * this.format.channelsPerFrame);
        return new Float32Array(samples);
      });
    };

    this.prototype.destroy = function() {
      this._super();

      this.promise.then((Opus) => {
        Opus._free(this.buf);
        Opus._free(this.outbuf);
        Opus._opus_decoder_destroy(this.opus);
        this.opus = null;
      });
      this.promise = null;

      this.buf = null;
      this.outbuf = null;
    };
  });
}
