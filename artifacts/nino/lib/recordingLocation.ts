import * as Location from 'expo-location';
import { RecordingLocationCountryCode, type RecordingLocation } from '@workspace/api-client-react';
import { countryBy } from './data';
import { useI18n, type Lang } from './i18n';

export type { RecordingLocation } from '@workspace/api-client-react';
export type LocationNotice = 'denied' | 'unavailable' | 'unlocated';

// Expo's one-shot APIs cannot be aborted. Discard their late results and release
// our timers/listeners on timeout or cancellation; coordinates never leave here.
function bounded<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const finish = (action: () => void) => {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
      action();
    };
    const cancel = () => finish(() => reject(new Error('Country lookup canceled')));
    const timer = setTimeout(() => finish(() => reject(new Error('Country lookup timed out'))), 10_000);
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) { cancel(); return; }
    operation.then((value) => finish(() => resolve(value)), (error: unknown) => finish(() => reject(error)));
  });
}

export async function captureRecordingCountry(signal: AbortSignal): Promise<RecordingLocation['countryCode'] | undefined> {
  const position = await bounded(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), signal);
  if (signal.aborted) return;
  const coordinates = Object.freeze({ latitude: position.coords.latitude, longitude: position.coords.longitude });
  const addresses = await bounded(Location.reverseGeocodeAsync(coordinates), signal);
  if (signal.aborted) return;
  const code = addresses[0]?.isoCountryCode?.trim().toUpperCase();
  return Object.values(RecordingLocationCountryCode).find((value) => value === code);
}

const en = {
  rationale: 'Optional country tag: when you record a video, Nino uses your current location for country Discover. Only the country and recording time are saved, never coordinates. You can decline and still post.',
  checking: 'Checking recording country… (up to 20 seconds).',
  denied: 'Location permission is off. You can still record and post, but this video is not eligible for country Discover.',
  unavailable: 'Recording country unavailable. You can still post, but this video is not eligible for country Discover.',
  unlocated: 'Photos and library videos have no recording country and are not eligible for country Discover.',
  recorded: 'Recorded in {country} · visible in Discover',
  cameraReady: 'Permissions checked. Tap record again once the camera is ready.',
};
type Copy = Record<keyof typeof en, string>;
const translations: Record<Lang, Copy> = {
  en,
  ar: {
    rationale: 'وسم الدولة اختياري: عند تسجيل فيديو، يستخدم Nino موقعك الحالي لاستكشاف الدولة. تُحفظ الدولة ووقت التسجيل فقط، لا الإحداثيات. يمكنك الرفض والنشر.',
    checking: 'جارٍ تحديد دولة التسجيل… (حتى 20 ثانية).',
    denied: 'إذن الموقع معطّل. يمكنك التسجيل والنشر، لكن الفيديو غير مؤهل لاستكشاف الدولة.',
    unavailable: 'دولة التسجيل غير متاحة. يمكنك النشر، لكن الفيديو غير مؤهل لاستكشاف الدولة.',
    unlocated: 'الصور وفيديوهات المكتبة بلا دولة تسجيل وغير مؤهلة لاستكشاف الدولة.',
    recorded: 'سُجّل في {country} · يظهر في الاستكشاف',
    cameraReady: 'تم التحقق من الأذونات. اضغط التسجيل مجددًا عندما تجهز الكاميرا.',
  },
  pt: {
    rationale: 'País opcional: ao gravar um vídeo, o Nino usa sua localização atual para o Descobrir por país. Só o país e a hora são salvos, nunca coordenadas. Você pode recusar e publicar.',
    checking: 'Verificando país da gravação… (até 20 segundos).',
    denied: 'Permissão de localização desativada. Você pode gravar e publicar, mas este vídeo não é elegível para Descobrir por país.',
    unavailable: 'País da gravação indisponível. Você pode publicar, mas este vídeo não é elegível para Descobrir por país.',
    unlocated: 'Fotos e vídeos da biblioteca não têm país de gravação e não são elegíveis para Descobrir por país.',
    recorded: 'Gravado em {country} · visível no Descobrir',
    cameraReady: 'Permissões verificadas. Toque em gravar novamente quando a câmera estiver pronta.',
  },
  es: {
    rationale: 'País opcional: al grabar un vídeo, Nino usa tu ubicación actual para Descubrir por país. Solo se guardan el país y la hora, nunca coordenadas. Puedes rechazarlo y publicar.',
    checking: 'Comprobando país de grabación… (hasta 20 segundos).',
    denied: 'Permiso de ubicación desactivado. Puedes grabar y publicar, pero este vídeo no es apto para Descubrir por país.',
    unavailable: 'País de grabación no disponible. Puedes publicar, pero este vídeo no es apto para Descubrir por país.',
    unlocated: 'Las fotos y vídeos de la biblioteca no tienen país de grabación y no son aptos para Descubrir por país.',
    recorded: 'Grabado en {country} · visible en Descubrir',
    cameraReady: 'Permisos comprobados. Toca grabar de nuevo cuando la cámara esté lista.',
  },
  fr: {
    rationale: 'Pays facultatif : à l’enregistrement d’une vidéo, Nino utilise votre position actuelle pour Découvrir par pays. Seuls le pays et l’heure sont conservés, jamais les coordonnées. Vous pouvez refuser et publier.',
    checking: 'Vérification du pays d’enregistrement… (20 secondes maximum).',
    denied: 'Autorisation de localisation désactivée. Vous pouvez filmer et publier, mais cette vidéo n’est pas éligible à Découvrir par pays.',
    unavailable: 'Pays d’enregistrement indisponible. Vous pouvez publier, mais cette vidéo n’est pas éligible à Découvrir par pays.',
    unlocated: 'Les photos et vidéos de la galerie n’ont pas de pays d’enregistrement et ne sont pas éligibles à Découvrir par pays.',
    recorded: 'Enregistré en {country} · visible dans Découvrir',
    cameraReady: 'Autorisations vérifiées. Appuyez à nouveau sur enregistrer lorsque la caméra est prête.',
  },
  de: {
    rationale: 'Optionales Länder-Tag: Beim Aufnehmen eines Videos verwendet Nino deinen aktuellen Standort für Entdecken nach Land. Nur Land und Aufnahmezeit werden gespeichert, nie Koordinaten. Du kannst ablehnen und trotzdem posten.',
    checking: 'Aufnahmeland wird geprüft… (bis zu 20 Sekunden).',
    denied: 'Standortberechtigung ist aus. Du kannst aufnehmen und posten, aber dieses Video ist nicht für Entdecken nach Land verfügbar.',
    unavailable: 'Aufnahmeland nicht verfügbar. Du kannst posten, aber dieses Video ist nicht für Entdecken nach Land verfügbar.',
    unlocated: 'Fotos und Bibliotheksvideos haben kein Aufnahmeland und sind nicht für Entdecken nach Land verfügbar.',
    recorded: 'Aufgenommen in {country} · in Entdecken sichtbar',
    cameraReady: 'Berechtigungen geprüft. Tippe erneut auf Aufnahme, sobald die Kamera bereit ist.',
  },
  it: {
    rationale: 'Paese facoltativo: quando registri un video, Nino usa la posizione attuale per Scopri per paese. Salviamo solo paese e ora, mai le coordinate. Puoi rifiutare e pubblicare.',
    checking: 'Verifica del paese di registrazione… (fino a 20 secondi).',
    denied: 'Permesso di posizione disattivato. Puoi registrare e pubblicare, ma questo video non è idoneo a Scopri per paese.',
    unavailable: 'Paese di registrazione non disponibile. Puoi pubblicare, ma questo video non è idoneo a Scopri per paese.',
    unlocated: 'Foto e video della libreria non hanno paese di registrazione e non sono idonei a Scopri per paese.',
    recorded: 'Registrato in {country} · visibile in Scopri',
    cameraReady: 'Permessi verificati. Tocca di nuovo registra quando la fotocamera è pronta.',
  },
  tr: {
    rationale: 'İsteğe bağlı ülke etiketi: Nino video kaydederken ülkeye göre Keşfet için mevcut konumunu kullanır. Yalnızca ülke ve kayıt saati saklanır, koordinatlar saklanmaz. Reddedip paylaşabilirsin.',
    checking: 'Kayıt ülkesi kontrol ediliyor… (en fazla 20 saniye).',
    denied: 'Konum izni kapalı. Kaydedip paylaşabilirsin ancak bu video ülkeye göre Keşfet için uygun değil.',
    unavailable: 'Kayıt ülkesi bulunamadı. Paylaşabilirsin ancak bu video ülkeye göre Keşfet için uygun değil.',
    unlocated: 'Fotoğraflar ve galerideki videolar kayıt ülkesi içermez ve ülkeye göre Keşfet için uygun değildir.',
    recorded: '{country} ülkesinde kaydedildi · Keşfet’te görünür',
    cameraReady: 'İzinler kontrol edildi. Kamera hazır olunca tekrar kaydet düğmesine dokun.',
  },
  ru: {
    rationale: 'Страна необязательна: при записи видео Nino использует текущее местоположение для Обзора по странам. Сохраняются только страна и время, не координаты. Можно отказаться и публиковать.',
    checking: 'Определяем страну записи… (до 20 секунд).',
    denied: 'Доступ к местоположению отключён. Можно записывать и публиковать, но видео не попадёт в Обзор по странам.',
    unavailable: 'Страна записи недоступна. Можно публиковать, но видео не попадёт в Обзор по странам.',
    unlocated: 'У фото и видео из галереи нет страны записи, и они не попадают в Обзор по странам.',
    recorded: 'Записано в {country} · видно в Обзоре',
    cameraReady: 'Разрешения проверены. Нажмите запись снова, когда камера будет готова.',
  },
  hi: {
    rationale: 'देश टैग वैकल्पिक है: वीडियो रिकॉर्ड करते समय Nino देश के अनुसार डिस्कवर के लिए वर्तमान स्थान इस्तेमाल करता है। केवल देश और रिकॉर्डिंग समय सहेजे जाते हैं, निर्देशांक नहीं। मना करके भी पोस्ट कर सकते हैं।',
    checking: 'रिकॉर्डिंग का देश जाँच रहे हैं… (अधिकतम 20 सेकंड)।',
    denied: 'स्थान की अनुमति बंद है। रिकॉर्ड और पोस्ट कर सकते हैं, लेकिन यह वीडियो देश के अनुसार डिस्कवर के योग्य नहीं है।',
    unavailable: 'रिकॉर्डिंग का देश उपलब्ध नहीं है। पोस्ट कर सकते हैं, लेकिन यह वीडियो देश के अनुसार डिस्कवर के योग्य नहीं है।',
    unlocated: 'फ़ोटो और लाइब्रेरी वीडियो में रिकॉर्डिंग का देश नहीं होता और वे देश के अनुसार डिस्कवर के योग्य नहीं हैं।',
    recorded: '{country} में रिकॉर्ड किया गया · डिस्कवर में दिखाई देगा',
    cameraReady: 'अनुमतियाँ जाँची गईं। कैमरा तैयार होने पर फिर रिकॉर्ड दबाएँ।',
  },
  zh: {
    rationale: '国家标签可选：录制视频时，Nino 使用当前位置供按国家发现使用。只保存国家和录制时间，不保存坐标。拒绝后仍可发布。',
    checking: '正在确认录制国家…（最多20秒）。',
    denied: '位置权限已关闭。仍可录制和发布，但此视频不能出现在按国家发现中。',
    unavailable: '无法确定录制国家。仍可发布，但此视频不能出现在按国家发现中。',
    unlocated: '照片和图库视频没有录制国家，不能出现在按国家发现中。',
    recorded: '录制于{country} · 可在发现中显示',
    cameraReady: '权限已检查。相机就绪后请再次点击录制。',
  },
  ja: {
    rationale: '国タグは任意です。動画撮影時にNinoは現在地を国別の「発見」に使います。保存するのは国と撮影時刻だけで、座標は保存しません。拒否しても投稿できます。',
    checking: '撮影国を確認中…（最大20秒）。',
    denied: '位置情報の許可がオフです。撮影・投稿はできますが、この動画は国別の「発見」の対象外です。',
    unavailable: '撮影国を取得できません。投稿はできますが、この動画は国別の「発見」の対象外です。',
    unlocated: '写真やライブラリの動画には撮影国がなく、国別の「発見」の対象外です。',
    recorded: '{country}で撮影 · 「発見」に表示',
    cameraReady: '許可を確認しました。カメラの準備ができたらもう一度撮影を押してください。',
  },
};

export function useRecordingLocationCopy() {
  const { lang } = useI18n();
  const copy = translations[lang];
  return {
    ...copy,
    countryNotice: (code: string) => {
      let name = countryBy(code)?.name ?? code;
      try { name = new Intl.DisplayNames([lang], { type: 'region' }).of(code) ?? name; } catch { /* Older native Intl: use country name or ISO code. */ }
      return copy.recorded.replace('{country}', name);
    },
  };
}