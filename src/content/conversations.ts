/**
 * Conversaciones ramificadas predefinidas. NO son inteligencia artificial:
 * el interlocutor elige su siguiente frase según palabras clave de tu respuesta.
 */
import type { Conversation } from '../types/content';
import { MORE_CONVERSATIONS } from './conversations-more';

const BASE: Conversation[] = [
  {
    id: 'meet-someone',
    title: 'Conocer a alguien',
    level: 'A1',
    module: 'a1',
    situation: 'Una pausa en un meetup de tecnología. Emma se acerca a hablar contigo.',
    partner: 'Emma',
    goal: 'Presentarte, decir de dónde eres, a qué te dedicas y por qué aprendes inglés.',
    start: 'n1',
    nodes: [
      { id: 'n1', say: "Hi! I'm Emma. I don't think we've met. What's your name?", sayEs: '¡Hola! Soy Emma. Creo que no nos conocemos. ¿Cómo te llamas?', hint: 'Saluda y di tu nombre.', frame: "Hi, Emma. I'm ___. Nice to ___ you.", model: "Hi, Emma. I'm Diego. Nice to meet you.", targets: ['hi-im', 'nice-to-meet-you'], next: 'n2' },
      {
        id: 'n2', say: 'Nice to meet you too! So, where are you from?', sayEs: '¡Mucho gusto también! Entonces, ¿de dónde eres?', hint: 'Di tu país o tu ciudad de origen.', frame: "I'm from ___.", model: "I'm from Colombia.", targets: ['im-from'],
        branches: [{ match: ['colombia', 'medellin', 'medellín', 'bogota', 'bogotá', 'cali', 'barranquilla', 'cartagena', 'bucaramanga', 'pereira'], next: 'n3c', react: "Oh, Colombia! People say it's beautiful." }],
        next: 'n3',
      },
      { id: 'n3c', say: 'Which city do you live in now?', sayEs: '¿En qué ciudad vives ahora?', hint: 'Usa «I live in…».', frame: 'I live in ___. It\'s ___.', model: "I live in Medellín. It's warm all year.", targets: ['i-live-in'], next: 'n4' },
      { id: 'n3', say: 'Cool! And where do you live now?', sayEs: '¡Genial! ¿Y dónde vives ahora?', hint: 'Usa «I live in…».', frame: 'I live in ___.', model: 'I live in Bogotá with my family.', targets: ['i-live-in'], next: 'n4' },
      {
        id: 'n4', say: 'And what do you do?', sayEs: '¿Y a qué te dedicas?', hint: 'Di tu trabajo o lo que estudias.', frame: 'I work as a ___. / I\'m studying ___.', model: 'I work as a junior developer.', targets: ['i-work-as', 'im-studying'],
        branches: [
          { match: ['develop', 'programm', 'engineer', 'software', 'code', 'coding', 'support', 'tech', 'java', 'web', 'qa', 'data'], next: 'n5tech', react: 'Oh, a tech person!' },
          { match: ['student', 'study', 'studying', 'learning', 'university', 'college'], next: 'n5study' },
        ],
        next: 'n5other',
      },
      { id: 'n5tech', say: 'What programming languages or tools do you use?', sayEs: '¿Qué lenguajes de programación o herramientas usas?', hint: 'Nombra uno o dos lenguajes o herramientas.', frame: 'I use ___ and ___.', model: 'I use Java and a little JavaScript.', minWords: 3, next: 'n6' },
      { id: 'n5study', say: 'Great! What are you studying?', sayEs: '¡Genial! ¿Qué estudias?', hint: 'Usa «I\'m studying…».', frame: "I'm studying ___.", model: "I'm studying software engineering.", targets: ['im-studying'], next: 'n6' },
      { id: 'n5other', say: 'Interesting! Do you like your job?', sayEs: '¡Interesante! ¿Te gusta tu trabajo?', hint: 'Responde sí o no y da una razón corta.', frame: 'Yes, I ___ it because ___.', model: 'Yes, I like it because I help people.', minWords: 4, next: 'n6' },
      { id: 'n6', say: 'Your English is pretty good. Why are you learning English?', sayEs: 'Tu inglés es bastante bueno. ¿Por qué estás aprendiendo inglés?', hint: 'Di una razón: trabajo, viajes, documentación…', frame: 'I\'m learning English because I want to ___.', model: "I'm learning English because I want to work for an international company.", minWords: 6, next: 'n7' },
      { id: 'n7', say: "That's a great reason. Well, it was nice talking to you!", sayEs: 'Es una gran razón. Bueno, ¡fue un gusto hablar contigo!', hint: 'Despídete de forma amable.', frame: 'Nice to meet you ___. See ___!', model: 'Nice to meet you too. See you later!', targets: ['see-you-later', 'nice-to-meet-you'] },
    ],
  },
  {
    id: 'too-fast',
    title: '¿Puedes repetir?',
    level: 'A1',
    module: 'a1',
    situation: 'Primer día de trabajo. Tu líder técnica te explica tareas muy rápido.',
    partner: 'Rachel',
    goal: 'Pedir repetición, pedir que hablen despacio y preguntar significados hasta entender las tareas.',
    start: 'n1',
    nodes: [
      {
        id: 'n1', say: 'Hey! So for onboarding you need to set up your VPN, request repo access, and join the stand-up at nine-thirty, okay?', sayEs: '¡Hola! Para el onboarding necesitas configurar tu VPN, pedir acceso al repositorio y unirte al stand-up a las nueve y media, ¿ok?',
        hint: 'Fue muy rápido. Pide que hable más despacio o que repita.', frame: 'Sorry, could you speak more ___, please?', model: 'Sorry, could you speak more slowly, please?', targets: ['speak-more-slowly', 'could-you-repeat'],
        branches: [{ match: ['slow', 'repeat', 'again', 'sorry', 'pardon'], next: 'n2', react: 'Oh, sorry! Of course.' }],
        next: 'n1b',
      },
      { id: 'n1b', say: 'Okay? Is everything clear?', sayEs: '¿Ok? ¿Está todo claro?', hint: 'Si no entendiste todo, dilo y pide que repita.', frame: "Not really. Could you ___ that, please?", model: 'Not really. Could you repeat that, please?', targets: ['could-you-repeat'], next: 'n2' },
      { id: 'n2', say: 'Sure. First: set up your VPN. Second: request access to the code repository. Third: join the stand-up at nine-thirty.', sayEs: 'Claro. Primero: configura tu VPN. Segundo: pide acceso al repositorio de código. Tercero: únete al stand-up a las nueve y media.', hint: 'Pregunta qué significa una palabra que no conoces (por ejemplo, stand-up).', frame: 'What does "___" mean?', model: 'What does "stand-up" mean?', targets: ['what-does-mean'],
        branches: [{ match: ['mean', 'what is', "what's a", 'meaning'], next: 'n3' }],
        next: 'n4',
      },
      { id: 'n3', say: "Good question! A stand-up is a short daily meeting. Everyone says what they did yesterday and what they're doing today.", sayEs: '¡Buena pregunta! Un stand-up es una reunión diaria corta. Cada persona dice qué hizo ayer y qué hará hoy.', hint: 'Agradece y confirma que entendiste.', frame: 'Got it, ___. ', model: 'Got it, thanks!', minWords: 2, next: 'n4' },
      { id: 'n4', say: 'Great. Can you tell me the three things you need to do?', sayEs: 'Genial. ¿Me dices las tres cosas que tienes que hacer?', hint: 'Enumera: VPN, acceso al repositorio y stand-up.', frame: 'I need to set up ___, request ___, and join ___.', model: 'I need to set up my VPN, request access to the repository, and join the stand-up at nine-thirty.', minWords: 8, next: 'n5' },
      { id: 'n5', say: 'Perfect! Welcome aboard. See you at the stand-up.', sayEs: '¡Perfecto! Bienvenido. Nos vemos en el stand-up.', hint: 'Agradece y despídete.', frame: 'Thank you! See ___.', model: 'Thank you! See you later.', targets: ['see-you-later'] },
    ],
  },
];

export const CONVERSATIONS: Conversation[] = [...BASE, ...MORE_CONVERSATIONS];
