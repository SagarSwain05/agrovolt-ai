'use strict';
// WAV (16-bit PCM mono) → MP3, pure JS, so rural 2G/3G downloads stay small (~10× smaller).
let lamejsP = null; // ESM-only package
const lame = () => (lamejsP ||= import('@breezystack/lamejs'));

async function wavToMp3(wav, kbps = 32) {
    const lamejs = await lame();
    if (wav.toString('ascii', 0, 4) !== 'RIFF') return null;
    const channels = wav.readUInt16LE(22);
    const rate = wav.readUInt32LE(24);
    const bits = wav.readUInt16LE(34);
    if (bits !== 16 || channels !== 1) return null;
    let off = 12;
    while (off < wav.length - 8 && wav.toString('ascii', off, off + 4) !== 'data') off += 8 + wav.readUInt32LE(off + 4);
    const len = Math.min(wav.readUInt32LE(off + 4), wav.length - off - 8);
    const samples = new Int16Array(wav.buffer.slice(wav.byteOffset + off + 8, wav.byteOffset + off + 8 + len - (len % 2)));
    const enc = new lamejs.Mp3Encoder(1, rate, kbps);
    const out = [];
    for (let i = 0; i < samples.length; i += 1152) {
        const b = enc.encodeBuffer(samples.subarray(i, i + 1152));
        if (b.length) out.push(Buffer.from(b));
    }
    const end = enc.flush();
    if (end.length) out.push(Buffer.from(end));
    return Buffer.concat(out);
}

module.exports = { wavToMp3 };
