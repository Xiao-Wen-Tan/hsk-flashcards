// An audio worklet, which is a small script that runs inside the browser's sound engine. It hands
// every block of 128 microphone samples to the page (ui/mic.js), so a try is recorded as raw
// numbers. It is loaded with audioWorklet.addModule() and has no imports.
class PcmTap extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) this.port.postMessage(channel.slice(0));
    return true;
  }
}

registerProcessor('pcm-tap', PcmTap);
