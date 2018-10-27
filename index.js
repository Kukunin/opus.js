const OggDemuxer  = require('./src/demuxer');
const OpusDecoder = require('./src/decoder');
const FastSound = require('fast-sound');

module.exports = function(fastSound) {
  return FastSound(fastSound).then(function(Opus) {
    OpusDecoder(Opus);
  });
};
