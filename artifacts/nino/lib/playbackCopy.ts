import { useI18n, type Lang } from './i18n';

type Copy = { play: string; pause: string; soundOn: string; soundOff: string; turnOn: string; turnOff: string; noAudio: string; progress: string };

const m: Record<Lang, Copy> = {
  en: { play: 'Play video', pause: 'Pause video', soundOn: 'Sound on', soundOff: 'Sound off', turnOn: 'Turn sound on', turnOff: 'Turn sound off', noAudio: 'No audio', progress: 'Video progress' },
  ar: { play: 'تشغيل الفيديو', pause: 'إيقاف الفيديو مؤقتًا', soundOn: 'الصوت مفعّل', soundOff: 'الصوت مكتوم', turnOn: 'تشغيل الصوت', turnOff: 'كتم الصوت', noAudio: 'بلا صوت', progress: 'تقدّم الفيديو' },
  pt: { play: 'Reproduzir vídeo', pause: 'Pausar vídeo', soundOn: 'Som ligado', soundOff: 'Som desligado', turnOn: 'Ligar som', turnOff: 'Desligar som', noAudio: 'Sem áudio', progress: 'Progresso do vídeo' },
  es: { play: 'Reproducir vídeo', pause: 'Pausar vídeo', soundOn: 'Sonido activado', soundOff: 'Sonido desactivado', turnOn: 'Activar sonido', turnOff: 'Silenciar', noAudio: 'Sin audio', progress: 'Progreso del vídeo' },
  fr: { play: 'Lire la vidéo', pause: 'Mettre en pause', soundOn: 'Son activé', soundOff: 'Son coupé', turnOn: 'Activer le son', turnOff: 'Couper le son', noAudio: 'Sans audio', progress: 'Progression de la vidéo' },
  de: { play: 'Video abspielen', pause: 'Video pausieren', soundOn: 'Ton an', soundOff: 'Ton aus', turnOn: 'Ton einschalten', turnOff: 'Ton ausschalten', noAudio: 'Kein Ton', progress: 'Videofortschritt' },
  it: { play: 'Riproduci video', pause: 'Metti in pausa', soundOn: 'Audio attivo', soundOff: 'Audio disattivato', turnOn: 'Attiva audio', turnOff: 'Disattiva audio', noAudio: 'Senza audio', progress: 'Avanzamento video' },
  tr: { play: 'Videoyu oynat', pause: 'Videoyu duraklat', soundOn: 'Ses açık', soundOff: 'Ses kapalı', turnOn: 'Sesi aç', turnOff: 'Sesi kapat', noAudio: 'Ses yok', progress: 'Video ilerlemesi' },
  ru: { play: 'Воспроизвести видео', pause: 'Приостановить видео', soundOn: 'Звук включён', soundOff: 'Звук выключен', turnOn: 'Включить звук', turnOff: 'Выключить звук', noAudio: 'Без звука', progress: 'Ход видео' },
  hi: { play: 'वीडियो चलाएँ', pause: 'वीडियो रोकें', soundOn: 'आवाज़ चालू', soundOff: 'आवाज़ बंद', turnOn: 'आवाज़ चालू करें', turnOff: 'आवाज़ बंद करें', noAudio: 'ऑडियो नहीं', progress: 'वीडियो प्रगति' },
  zh: { play: '播放视频', pause: '暂停视频', soundOn: '声音已开', soundOff: '声音已关', turnOn: '打开声音', turnOff: '关闭声音', noAudio: '无音频', progress: '视频进度' },
  ja: { play: '動画を再生', pause: '動画を一時停止', soundOn: 'サウンドオン', soundOff: 'サウンドオフ', turnOn: 'サウンドをオン', turnOff: 'サウンドをオフ', noAudio: '音声なし', progress: '再生位置' },
};

export function usePlaybackCopy() {
  return m[useI18n().lang];
}
