// TODO §4 « #équipe » voice note: the admin's note through the real createVoiceNote action (no microphone here:
// a few bytes stand in for the recording). LOCAL copy only.
import { call } from './actions.mjs';
const f = new FormData();
f.append('subject', 'Livraison vendredi #équipe');
f.append('transcript', 'Essai copie : on emballe les trois grands formats jeudi soir, livraison vendredi matin.');
f.append('duration_ms', '4200');
f.append('audio', new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01])], { type: 'audio/webm' }), 'recording.webm');
const r = await call('createVoiceNote', [f], { user: 'admin', page: '/hub' });
console.log(JSON.stringify({ ok: r.ok, status: r.status, result: r.result, error: r.error }));
