import type { MinimalPairSet } from '../types/content';

/** Sonidos que más afectan a la comprensión para hispanohablantes. */
export const MINIMAL_PAIRS: MinimalPairSet[] = [
  {
    id: 'ih-ee',
    title: 'ship / sheep',
    sound: '/ɪ/ corta vs. /iː/ larga',
    tip: 'La /ɪ/ de ship es corta y relajada, entre «i» y «e». La /iː/ de sheep es una «i» larga y con sonrisa. En español solo hay una «i», por eso cuesta.',
    pairs: [['ship', 'sheep'], ['live', 'leave'], ['sit', 'seat'], ['fill', 'feel'], ['bit', 'beat'], ['still', 'steal']],
    sentences: ['I live here, but I want to leave.', 'Please sit in this seat.', 'Can you feel it? Fill the form.'],
  },
  {
    id: 'b-v',
    title: 'berry / very',
    sound: '/b/ vs. /v/',
    tip: 'En inglés la /v/ se hace con los dientes de arriba sobre el labio de abajo, y vibra. La /b/ cierra los dos labios. En español suenan igual; en inglés cambian el significado.',
    pairs: [['berry', 'very'], ['ban', 'van'], ['best', 'vest'], ['boat', 'vote'], ['bet', 'vet']],
    sentences: ['This is very good.', 'I have a van, not a bus.', 'Vote for the best idea.'],
  },
  {
    id: 'sh-ch',
    title: 'share / chair',
    sound: '/ʃ/ vs. /tʃ/',
    tip: '/ʃ/ (sh) es un sonido continuo, como pedir silencio: «shhh». /tʃ/ (ch) empieza con un pequeño golpe, como la «ch» del español.',
    pairs: [['share', 'chair'], ['ship', 'chip'], ['sheep', 'cheap'], ['wash', 'watch'], ['shoes', 'choose']],
    sentences: ['Please share your screen.', 'Choose your shoes.', 'I watch TV while I wash the dishes.'],
  },
  {
    id: 'th',
    title: 'think / sink',
    sound: '/θ/ vs. /s/ y /t/',
    tip: 'Para /θ/ (th) pon la punta de la lengua entre los dientes y sopla, como la «z» de España. No es «t» ni «s».',
    pairs: [['think', 'sink'], ['thank', 'tank'], ['three', 'tree'], ['thin', 'tin'], ['path', 'pass']],
    sentences: ['Thank you, I think so.', 'Three things this Thursday.', 'I think the method works.'],
  },
  {
    id: 'j-y',
    title: 'jet / yet',
    sound: '/dʒ/ vs. /j/',
    tip: '/dʒ/ (j, g) es como «ch» pero con voz: «dyet». /j/ (y) es suave, como la «i» de «hielo».',
    pairs: [['jet', 'yet'], ['jam', 'yam'], ['jello', 'yellow'], ['joke', 'yolk'], ['juice', 'use']],
    sentences: ['Not yet, the job is not ready.', 'Do you use orange juice?', 'Yes, I just joined.'],
  },
  {
    id: 'ae-uh',
    title: 'cat / cut',
    sound: '/æ/ vs. /ʌ/',
    tip: '/æ/ (cat) se abre mucho la boca, entre «a» y «e». /ʌ/ (cut) es una «a» corta y relajada, casi sin mover la boca.',
    pairs: [['cat', 'cut'], ['bag', 'bug'], ['hat', 'hut'], ['cap', 'cup'], ['ran', 'run']],
    sentences: ['I found a bug in my bag.', 'I ran, but now I run every day.', 'A cup and a cap.'],
  },
  {
    id: 'h',
    title: 'hat / at',
    sound: '/h/ suave',
    tip: 'La h inglesa es solo aire, muy suave, no como la «j» española. Y no la omitas: hold y old son palabras distintas.',
    pairs: [['hat', 'at'], ['hold', 'old'], ['heat', 'eat'], ['hair', 'air'], ['hand', 'and']],
    sentences: ['Hold the old phone.', 'How are you? Happy holidays!', 'Have a nice weekend.'],
  },
  {
    id: 'final-s',
    title: 'work / works',
    sound: 'S final (tercera persona y plurales)',
    tip: 'La -s final cambia el significado y la gramática. Pronúnciala clara: works, needs, uses /ˈjuːzɪz/.',
    pairs: [['work', 'works'], ['need', 'needs'], ['want', 'wants'], ['use', 'uses'], ['live', 'lives']],
    sentences: ['She works from home.', 'He needs more time.', 'It uses a database.'],
  },
];

export interface RhythmItem {
  text: string;
  focus: string;
}

/** Ritmo, acento y contracciones frecuentes en el inglés estadounidense. */
export const RHYTHM: RhythmItem[] = [
  { text: "I'm working on it.", focus: 'I\'m suena «aim». Las palabras importantes (WORK) llevan el acento.' },
  { text: "I don't know.", focus: 'Rápido y unido: «ai-dóun-nóu». Don\'t casi sin t.' },
  { text: "I didn't see it.", focus: 'didn\'t suena «dídn». La t final casi desaparece.' },
  { text: "I've been there.", focus: 'I\'ve = «aiv». been es débil: «bin».' },
  { text: "We're almost done.", focus: 'We\'re suena «wir». Acento en AL-most y DONE.' },
  { text: "What do you mean?", focus: 'What do you se une: «wadaya». Acento en MEAN.' },
  { text: "Can you help me?", focus: 'can es débil: «kn». HELP lleva el acento.' },
  { text: "I can't come today.", focus: 'can\'t es fuerte y largo: «kænt». Así se distingue de can.' },
  { text: "I'm going to call you.", focus: 'En habla rápida: «I\'m gonna call you».' },
  { text: "I would've told you.", focus: 'would\'ve = «wúd-uv», nunca «would of».' },
  { text: 'Could you send it to me?', focus: 'Could you = «cúdyu». send-it se une: «sén-dit».' },
  { text: 'Let me check.', focus: 'Let me = «lémi». Acento en CHECK.' },
  { text: 'DEVeloper, deVELopment', focus: 'El acento cambia entre palabras de la misma familia: DE-ve-lo-per pero de-VE-lop-ment.' },
  { text: 'Wanted, worked, played', focus: '-ed suena /ɪd/ solo tras t/d (wanted). Tras sonidos sordos suena /t/ (worked); tras sonoros /d/ (played).' },
];
