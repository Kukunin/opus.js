const OggDemuxer  = require('./src/demuxer');
const OpusDecoder = require('./src/decoder');

module.exports = function(config) {
  return OpusDecoder(config);
};
