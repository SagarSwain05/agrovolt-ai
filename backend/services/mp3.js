'use strict';
// WAV → MP3 (≈10× smaller for rural 2G/3G). Prefers a native ffmpeg binary
// (ffmpeg-static — ~100× faster on Render's shared CPU); falls back to lamejs.
const { spawn } = require('child_process');

let ffmpegPath = null;
try { ffmpegPath = require('ffmpeg-static'); } catch { /* not installed */ }

function ffmpegMp3(wav, kbps) {
    return new Promise((resolve, reject) => {
        const p = spawn(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-f', 'wav', '-i', 'pipe:0', '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', `${kbps}k`, '-f', 'mp3', 'pipe:1']);
        const out = [];
        let err = '';
        p.stdout.on('data', (d) => out.push(d));
        p.stderr.on('data', (d) => { err += d; });
        p.on('error', reject);
        p.on('close', (code) => (code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(`ffmpeg ${code}: ${err.slice(0, 200)}`))));
        p.stdin.on('error', () => { });
        p.stdin.end(wav);
    });
}

let lamejsP = null; // ESM-only package
const lame = () => (lamejsP ||= import('@breezystack/lamejs'));

async function lameMp3(wav, kbps) {
    const lamejs = await lame();
    if (wav.toString('ascii', 0, 4) !== 'RIFF') return null;
    const channels = wav.readUInt16LE(22), rate = wav.readUInt32LE(24), bits = wav.readUInt16LE(34);
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

async function wavToMp3(wav, kbps = 32) {
    if (ffmpegPath) {
        try { return await ffmpegMp3(wav, kbps); } catch (e) { console.error('[mp3] ffmpeg failed, using lamejs:', e.message); }
    }
    return lameMp3(wav, kbps);
}

module.exports = { wavToMp3 };
