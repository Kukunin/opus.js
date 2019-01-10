"use strict";

var OpusDecoder = function( config, Module ){

  if ( !Module ) {
    throw new Error('Module with exports required to initialize a decoder instance');
  }

  this.config = Object.assign({
    bufferLength: 4096, // Define size of outgoing buffer
    decoderSampleRate: 48000, // Desired decoder sample rate.
    outputBufferSampleRate: 48000, // Desired output sample rate. Audio will be resampled
    resampleQuality: 3, // Value between 0 and 10 inclusive. 10 being highest quality.
    numberOfChannels: 1
  }, config );
  this.numberOfChannels = this.config.numberOfChannels;

  this._opus_decoder_create = Module._opus_decoder_create;
  this._opus_decoder_destroy = Module._opus_decoder_destroy;
  this._speex_resampler_process_interleaved_float = Module._speex_resampler_process_interleaved_float;
  this._speex_resampler_init = Module._speex_resampler_init;
  this._speex_resampler_destroy = Module._speex_resampler_destroy;
  this._opus_decode_float = Module._opus_decode_float;
  this._free = Module._free;
  this._malloc = Module._malloc;
  this.HEAPU8 = Module.HEAPU8;
  this.HEAP32 = Module.HEAP32;
  this.HEAPF32 = Module.HEAPF32;

  this.initCodec();
  this.initResampler();
  global['postMessage']({ message: "ready" });
};

OpusDecoder.prototype.decode = function( data ) {
  this.decoderBuffer.set( data );

  var outputSampleLength = this._opus_decode_float( this.decoder, this.decoderBufferPointer, data.length, this.decoderOutputPointer, this.decoderOutputMaxLength, 0);
  if(outputSampleLength < 0) {
    global['postMessage']({ message: "error", error: outputSampleLength });
    return;
  }
  var resampledLength = Math.ceil( outputSampleLength * this.config.outputBufferSampleRate / this.config.decoderSampleRate );
  this.HEAP32[ this.decoderOutputLengthPointer >> 2 ] = outputSampleLength;
  this.HEAP32[ this.resampleOutputLengthPointer >> 2 ] = resampledLength;
  this._speex_resampler_process_interleaved_float( this.resampler, this.decoderOutputPointer, this.decoderOutputLengthPointer, this.resampleOutputBufferPointer, this.resampleOutputLengthPointer );
  const subarray = this.HEAPF32.subarray(
    this.resampleOutputBufferPointer >> 2,
    (this.resampleOutputBufferPointer >> 2) + resampledLength * this.numberOfChannels
  );
  const output = Float32Array.from(subarray);
  global['postMessage']({ message: "data", data: output }, [output.buffer]);
};

OpusDecoder.prototype.initCodec = function() {
  if ( this.decoder ) {
    this._opus_decoder_destroy( this.decoder );
    this._free( this.decoderBufferPointer );
    this._free( this.decoderOutputLengthPointer );
    this._free( this.decoderOutputPointer );
  }

  var errReference = this._malloc( 4 );
  this.decoder = this._opus_decoder_create( this.config.decoderSampleRate, this.numberOfChannels, errReference );
  this._free( errReference );

  this.decoderBufferPointer = this._malloc( this.config.bufferLength );
  this.decoderBuffer = this.HEAPU8.subarray( this.decoderBufferPointer,
                                             this.decoderBufferPointer + this.config.bufferLength );
  this.decoderOutputLengthPointer = this._malloc( 4 );
  this.decoderOutputMaxLength = this.config.decoderSampleRate * this.numberOfChannels * 120 / 1000; // Max 120ms frame size
  this.decoderOutputPointer = this._malloc( this.decoderOutputMaxLength * 4 ); // 4 bytes per sample
};

OpusDecoder.prototype.initResampler = function() {

  if ( this.resampler ) {
    this._speex_resampler_destroy( this.resampler );
    this._free( this.resampleOutputLengthPointer );
    this._free( this.resampleOutputBufferPointer );
  }

  var errLocation = this._malloc( 4 );
  this.resampler = this._speex_resampler_init( this.numberOfChannels, this.config.decoderSampleRate, this.config.outputBufferSampleRate, this.config.resampleQuality, errLocation );
  this._free( errLocation );

  this.resampleOutputLengthPointer = this._malloc( 4 );
  this.resampleOutputMaxLength = Math.ceil( this.decoderOutputMaxLength * this.config.outputBufferSampleRate / this.config.decoderSampleRate );
  this.resampleOutputBufferPointer = this._malloc( this.resampleOutputMaxLength * 4 ); // 4 bytes per sample
};

const FastSound = require('fast-sound');
let decoder;

global['onmessage'] = function( e ){
  switch( e['data']['command'] ){
  case 'decode':
    if (decoder){
      decoder.decode( e['data']['data'] );
    }
    break;

  case 'init':
    FastSound(e['data']['fastSound'] || {}).then(function(lib) {
      decoder = new OpusDecoder( e['data'], lib );
    });
    break;

  default:
    // Ignore any unknown commands and continue recieving commands
  }
};
