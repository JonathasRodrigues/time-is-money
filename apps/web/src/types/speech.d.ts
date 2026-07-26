/// <reference types="vite/client" />

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionResult {
  0?: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  0?: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

interface Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}
