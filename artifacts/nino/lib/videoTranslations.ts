import { useI18n, type Lang } from './i18n';

const messages: Record<Lang, { preparing: string; failed: string }> = {
  en: { preparing: 'Preparing video for playback… The first play may take a moment.', failed: 'Video could not play. Tap Retry. If it still fails, try another browser or upload an H.264 MP4.' },
  ar: { preparing: 'جارٍ تجهيز الفيديو… قد يستغرق التشغيل الأول قليلًا.', failed: 'تعذّر تشغيل الفيديو. اضغط إعادة المحاولة. إذا استمر الخطأ، جرّب متصفحًا آخر أو ارفع ملف MP4 بترميز H.264.' },
  pt: { preparing: 'Preparando vídeo… A primeira reprodução pode demorar um pouco.', failed: 'Não foi possível reproduzir. Toque em Tentar novamente. Se persistir, use outro navegador ou envie um MP4 H.264.' },
  es: { preparing: 'Preparando vídeo… La primera reproducción puede tardar un momento.', failed: 'No se pudo reproducir. Pulsa Reintentar. Si persiste, prueba otro navegador o sube un MP4 H.264.' },
  fr: { preparing: 'Préparation de la vidéo… La première lecture peut prendre un moment.', failed: 'Lecture impossible. Réessayez. Si le problème persiste, utilisez un autre navigateur ou importez un MP4 H.264.' },
  de: { preparing: 'Video wird vorbereitet… Die erste Wiedergabe kann etwas dauern.', failed: 'Wiedergabe fehlgeschlagen. Erneut versuchen. Falls das Problem bleibt, einen anderen Browser nutzen oder H.264-MP4 hochladen.' },
  it: { preparing: 'Preparazione video… La prima riproduzione può richiedere qualche istante.', failed: 'Riproduzione non riuscita. Riprova. Se il problema persiste, usa un altro browser o carica un MP4 H.264.' },
  tr: { preparing: 'Video hazırlanıyor… İlk oynatma biraz zaman alabilir.', failed: 'Video oynatılamadı. Tekrar deneyin. Sorun sürerse başka bir tarayıcı kullanın veya H.264 MP4 yükleyin.' },
  ru: { preparing: 'Подготовка видео… Первый запуск может занять некоторое время.', failed: 'Не удалось воспроизвести видео. Повторите попытку. Если ошибка остаётся, используйте другой браузер или загрузите MP4 H.264.' },
  hi: { preparing: 'वीडियो तैयार हो रहा है… पहली बार चलने में थोड़ा समय लग सकता है।', failed: 'वीडियो नहीं चला। फिर कोशिश करें। समस्या बनी रहे तो दूसरा ब्राउज़र आज़माएँ या H.264 MP4 अपलोड करें।' },
  zh: { preparing: '正在准备视频…首次播放可能需要一点时间。', failed: '视频无法播放。请重试。若仍失败，请尝试其他浏览器或上传 H.264 MP4。' },
  ja: { preparing: '動画を準備中…初回の再生には少し時間がかかる場合があります。', failed: '動画を再生できませんでした。再試行してください。解決しない場合は別のブラウザーを使うか、H.264 MP4 をアップロードしてください。' },
};
export function useVideoCopy() {
  const { lang } = useI18n();
  return messages[lang];
}
