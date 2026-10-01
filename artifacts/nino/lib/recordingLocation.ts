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
  rationale: 'Location access while using the app is required to use Nino. When you record a video, your current location identifies its country for Discover. Only the country and recording time are saved, never coordinates. Background location is not used.',
  checking: 'Checking recording country… (up to 20 seconds).',
  denied: 'Location permission is required to use Nino. Allow location access while using the app to continue.',
  permissionUnavailable: 'Location permission could not be verified. Recording is blocked. Try again.',
  unavailable: 'Location permission is granted, but the recording country is unavailable. You can record and post; this video is not eligible for country Discover.',
  unlocated: 'Photos and library videos have no recording country and are not eligible for country Discover.',
  recorded: 'Recorded in {country} · visible in Discover',
  cameraReady: 'Permissions checked. Tap record again once the camera is ready.',
};
type Copy = Record<keyof typeof en, string>;
const translations: Record<Lang, Copy> = {
  en,
  ar: {
    rationale: 'إذن الموقع أثناء استخدام التطبيق مطلوب لاستخدام Nino. عند تسجيل فيديو، يُستخدم موقعك الحالي لتحديد دولته للاستكشاف. تُحفظ الدولة ووقت التسجيل فقط، لا الإحداثيات. لا يُستخدم الموقع في الخلفية.',
    checking: 'جارٍ تحديد دولة التسجيل… (حتى 20 ثانية).',
    denied: 'إذن الموقع مطلوب لاستخدام Nino. اسمح بالوصول إلى الموقع أثناء استخدام التطبيق للمتابعة.',
    permissionUnavailable: 'تعذّر التحقق من إذن الموقع. التسجيل محظور. حاول مجددًا.',
    unavailable: 'إذن الموقع ممنوح، لكن دولة التسجيل غير متاحة. يمكنك التسجيل والنشر؛ هذا الفيديو غير مؤهل لاستكشاف الدولة.',
    unlocated: 'الصور وفيديوهات المكتبة بلا دولة تسجيل وغير مؤهلة لاستكشاف الدولة.',
    recorded: 'سُجّل في {country} · يظهر في الاستكشاف',
    cameraReady: 'تم التحقق من الأذونات. اضغط التسجيل مجددًا عندما تجهز الكاميرا.',
  },
  pt: {
    rationale: 'O acesso à localização durante o uso do app é obrigatório para usar o Nino. Ao gravar um vídeo, sua localização atual identifica o país para o Descobrir. Só o país e a hora são salvos, nunca coordenadas. Não usamos localização em segundo plano.',
    checking: 'Verificando país da gravação… (até 20 segundos).',
    denied: 'A permissão de localização é obrigatória para usar o Nino. Permita o acesso durante o uso do app para continuar.',
    permissionUnavailable: 'Não foi possível verificar a permissão de localização. A gravação está bloqueada. Tente novamente.',
    unavailable: 'A permissão de localização foi concedida, mas o país da gravação está indisponível. Você pode gravar e publicar; este vídeo não é elegível para Descobrir por país.',
    unlocated: 'Fotos e vídeos da biblioteca não têm país de gravação e não são elegíveis para Descobrir por país.',
    recorded: 'Gravado em {country} · visível no Descobrir',
    cameraReady: 'Permissões verificadas. Toque em gravar novamente quando a câmera estiver pronta.',
  },
  es: {
    rationale: 'Para usar Nino es obligatorio permitir la ubicación mientras usas la app. Al grabar un vídeo, tu ubicación actual identifica su país para Descubrir. Solo se guardan el país y la hora, nunca coordenadas. No usamos la ubicación en segundo plano.',
    checking: 'Comprobando país de grabación… (hasta 20 segundos).',
    denied: 'El permiso de ubicación es obligatorio para usar Nino. Permite el acceso mientras usas la app para continuar.',
    permissionUnavailable: 'No se pudo verificar el permiso de ubicación. La grabación está bloqueada. Inténtalo de nuevo.',
    unavailable: 'El permiso de ubicación está concedido, pero el país de grabación no está disponible. Puedes grabar y publicar; este vídeo no es apto para Descubrir por país.',
    unlocated: 'Las fotos y vídeos de la biblioteca no tienen país de grabación y no son aptos para Descubrir por país.',
    recorded: 'Grabado en {country} · visible en Descubrir',
    cameraReady: 'Permisos comprobados. Toca grabar de nuevo cuando la cámara esté lista.',
  },
  fr: {
    rationale: 'L’accès à la localisation pendant l’utilisation de l’application est obligatoire pour utiliser Nino. Lors d’un enregistrement vidéo, votre position actuelle identifie le pays pour Découvrir. Seuls le pays et l’heure sont conservés, jamais les coordonnées. La localisation en arrière-plan n’est pas utilisée.',
    checking: 'Vérification du pays d’enregistrement… (20 secondes maximum).',
    denied: 'L’autorisation de localisation est obligatoire pour utiliser Nino. Autorisez l’accès pendant l’utilisation de l’application pour continuer.',
    permissionUnavailable: 'Impossible de vérifier l’autorisation de localisation. L’enregistrement est bloqué. Réessayez.',
    unavailable: 'La localisation est autorisée, mais le pays d’enregistrement est indisponible. Vous pouvez filmer et publier ; cette vidéo n’est pas éligible à Découvrir par pays.',
    unlocated: 'Les photos et vidéos de la galerie n’ont pas de pays d’enregistrement et ne sont pas éligibles à Découvrir par pays.',
    recorded: 'Enregistré en {country} · visible dans Découvrir',
    cameraReady: 'Autorisations vérifiées. Appuyez à nouveau sur enregistrer lorsque la caméra est prête.',
  },
  de: {
    rationale: 'Für Nino ist der Standortzugriff während der App-Nutzung erforderlich. Beim Aufnehmen eines Videos bestimmt dein aktueller Standort das Land für Entdecken. Nur Land und Aufnahmezeit werden gespeichert, nie Koordinaten. Der Standort wird nicht im Hintergrund verwendet.',
    checking: 'Aufnahmeland wird geprüft… (bis zu 20 Sekunden).',
    denied: 'Die Standortberechtigung ist für Nino erforderlich. Erlaube den Zugriff während der App-Nutzung, um fortzufahren.',
    permissionUnavailable: 'Die Standortberechtigung konnte nicht geprüft werden. Die Aufnahme ist gesperrt. Versuche es erneut.',
    unavailable: 'Die Standortberechtigung wurde erteilt, aber das Aufnahmeland ist nicht verfügbar. Du kannst aufnehmen und posten; dieses Video ist nicht für Entdecken nach Land verfügbar.',
    unlocated: 'Fotos und Bibliotheksvideos haben kein Aufnahmeland und sind nicht für Entdecken nach Land verfügbar.',
    recorded: 'Aufgenommen in {country} · in Entdecken sichtbar',
    cameraReady: 'Berechtigungen geprüft. Tippe erneut auf Aufnahme, sobald die Kamera bereit ist.',
  },
  it: {
    rationale: 'Per usare Nino è obbligatorio consentire la posizione durante l’uso dell’app. Quando registri un video, la posizione attuale ne identifica il paese per Scopri. Salviamo solo paese e ora, mai le coordinate. Non usiamo la posizione in background.',
    checking: 'Verifica del paese di registrazione… (fino a 20 secondi).',
    denied: 'Il permesso di posizione è obbligatorio per usare Nino. Consenti l’accesso durante l’uso dell’app per continuare.',
    permissionUnavailable: 'Impossibile verificare il permesso di posizione. La registrazione è bloccata. Riprova.',
    unavailable: 'Il permesso di posizione è concesso, ma il paese di registrazione non è disponibile. Puoi registrare e pubblicare; questo video non è idoneo a Scopri per paese.',
    unlocated: 'Foto e video della libreria non hanno paese di registrazione e non sono idonei a Scopri per paese.',
    recorded: 'Registrato in {country} · visibile in Scopri',
    cameraReady: 'Permessi verificati. Tocca di nuovo registra quando la fotocamera è pronta.',
  },
  tr: {
    rationale: 'Nino’yu kullanmak için uygulama kullanımdayken konum erişimi zorunludur. Video kaydederken mevcut konumun Keşfet için ülkeyi belirler. Yalnızca ülke ve kayıt saati saklanır, koordinatlar saklanmaz. Arka planda konum kullanılmaz.',
    checking: 'Kayıt ülkesi kontrol ediliyor… (en fazla 20 saniye).',
    denied: 'Nino’yu kullanmak için konum izni zorunludur. Devam etmek için uygulama kullanımdayken konum erişimine izin ver.',
    permissionUnavailable: 'Konum izni doğrulanamadı. Kayıt engellendi. Tekrar dene.',
    unavailable: 'Konum izni verildi ancak kayıt ülkesi bulunamadı. Kaydedip paylaşabilirsin; bu video ülkeye göre Keşfet için uygun değil.',
    unlocated: 'Fotoğraflar ve galerideki videolar kayıt ülkesi içermez ve ülkeye göre Keşfet için uygun değildir.',
    recorded: '{country} ülkesinde kaydedildi · Keşfet’te görünür',
    cameraReady: 'İzinler kontrol edildi. Kamera hazır olunca tekrar kaydet düğmesine dokun.',
  },
  ru: {
    rationale: 'Для использования Nino необходим доступ к местоположению во время использования приложения. При записи видео текущее местоположение определяет страну для Обзора. Сохраняются только страна и время, не координаты. Местоположение в фоновом режиме не используется.',
    checking: 'Определяем страну записи… (до 20 секунд).',
    denied: 'Для использования Nino необходимо разрешение на местоположение. Разрешите доступ во время использования приложения, чтобы продолжить.',
    permissionUnavailable: 'Не удалось проверить разрешение на местоположение. Запись заблокирована. Повторите попытку.',
    unavailable: 'Доступ к местоположению разрешён, но страна записи недоступна. Можно записывать и публиковать; видео не попадёт в Обзор по странам.',
    unlocated: 'У фото и видео из галереи нет страны записи, и они не попадают в Обзор по странам.',
    recorded: 'Записано в {country} · видно в Обзоре',
    cameraReady: 'Разрешения проверены. Нажмите запись снова, когда камера будет готова.',
  },
  hi: {
    rationale: 'Nino का इस्तेमाल करने के लिए ऐप के उपयोग के दौरान स्थान की अनुमति ज़रूरी है। वीडियो रिकॉर्ड करते समय वर्तमान स्थान से डिस्कवर के लिए देश पहचाना जाता है। केवल देश और रिकॉर्डिंग समय सहेजे जाते हैं, निर्देशांक नहीं। बैकग्राउंड में स्थान का इस्तेमाल नहीं होता।',
    checking: 'रिकॉर्डिंग का देश जाँच रहे हैं… (अधिकतम 20 सेकंड)।',
    denied: 'Nino का इस्तेमाल करने के लिए स्थान की अनुमति ज़रूरी है। जारी रखने के लिए ऐप के उपयोग के दौरान स्थान की अनुमति दें।',
    permissionUnavailable: 'स्थान की अनुमति की पुष्टि नहीं हो सकी। रिकॉर्डिंग रोकी गई है। फिर कोशिश करें।',
    unavailable: 'स्थान की अनुमति मिली है, लेकिन रिकॉर्डिंग का देश उपलब्ध नहीं है। रिकॉर्ड और पोस्ट कर सकते हैं; यह वीडियो देश के अनुसार डिस्कवर के योग्य नहीं है।',
    unlocated: 'फ़ोटो और लाइब्रेरी वीडियो में रिकॉर्डिंग का देश नहीं होता और वे देश के अनुसार डिस्कवर के योग्य नहीं हैं।',
    recorded: '{country} में रिकॉर्ड किया गया · डिस्कवर में दिखाई देगा',
    cameraReady: 'अनुमतियाँ जाँची गईं। कैमरा तैयार होने पर फिर रिकॉर्ड दबाएँ।',
  },
  zh: {
    rationale: '使用 Nino 必须允许在使用应用期间访问位置。录制视频时，当前位置用于确定国家，以供发现使用。只保存国家和录制时间，不保存坐标。不在后台使用位置。',
    checking: '正在确认录制国家…（最多20秒）。',
    denied: '使用 Nino 必须授予位置权限。请允许在使用应用期间访问位置以继续。',
    permissionUnavailable: '无法确认位置权限。录制已被阻止。请重试。',
    unavailable: '位置权限已授予，但无法确定录制国家。可以录制和发布，但此视频不能出现在按国家发现中。',
    unlocated: '照片和图库视频没有录制国家，不能出现在按国家发现中。',
    recorded: '录制于{country} · 可在发现中显示',
    cameraReady: '权限已检查。相机就绪后请再次点击录制。',
  },
  ja: {
    rationale: 'Ninoの利用には、アプリ使用中の位置情報へのアクセス許可が必要です。動画撮影時に現在地から「発見」用の国を特定します。保存するのは国と撮影時刻だけで、座標は保存しません。バックグラウンドで位置情報は使用しません。',
    checking: '撮影国を確認中…（最大20秒）。',
    denied: 'Ninoの利用には位置情報の許可が必要です。アプリ使用中の位置情報へのアクセスを許可して続行してください。',
    permissionUnavailable: '位置情報の許可を確認できませんでした。撮影はブロックされています。もう一度お試しください。',
    unavailable: '位置情報は許可されていますが、撮影国を取得できません。撮影・投稿はできますが、この動画は国別の「発見」の対象外です。',
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