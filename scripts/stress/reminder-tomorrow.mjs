// TODO §4 « Rappels sans projet »: a follow-up for tomorrow, made the way the voice-note sheet makes it. LOCAL copy only.
import { call } from './actions.mjs';
const f = new FormData();
const d = new Date(Date.now() + 86400000); const day = d.toISOString().slice(0, 10);
f.append('subject', 'Rappeler le encadreur');
f.append('transcript', 'Essai copie : rappeler l’encadreur pour les baguettes chêne.');
f.append('follow_up_date', day);
f.append('follow_up_label', 'Rappeler l’encadreur — baguettes chêne');
const r = await call('createVoiceNote', [f], { user: 'admin', page: '/hub' });
console.log(day, JSON.stringify({ ok: r.ok, result: r.result, error: r.error }));
