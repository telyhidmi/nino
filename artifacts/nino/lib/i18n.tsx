import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

export type Lang = 'en' | 'ar' | 'pt' | 'es';
export const LANGS: { code: Lang; native: string; flag: string; hello: string }[] = [
  { code: 'en', native: 'English', flag: '🇺🇸', hello: 'Hello' },
  { code: 'ar', native: 'العربية', flag: '🇸🇦', hello: 'مرحبا' },
  { code: 'pt', native: 'Português', flag: '🇧🇷', hello: 'Olá' },
  { code: 'es', native: 'Español', flag: '🇪🇸', hello: 'Hola' },
];

const en = {
  tagline: 'One World  ·  One Voice',
  taglineAr: 'عالم واحد صوت واحد',
  welcomeTitle: 'Different languages.\nSame people.',
  welcomeBody: 'Meet friends in every country and talk freely — Nino translates so everyone understands.',
  getStarted: 'Get started',
  haveAccount: 'I already have an account',
  chooseLanguage: 'Choose your language',
  chooseLanguageBody: 'Nino will speak to you in this language. You can change it anytime.',
  continue: 'Continue',
  createAccount: 'Create your account',
  createAccountBody: 'Join people from every corner of the world.',
  welcomeBack: 'Welcome back',
  welcomeBackBody: 'Sign in to continue your conversations.',
  email: 'Email',
  emailPh: 'you@example.com',
  password: 'Password',
  passwordPh: 'At least 8 characters',
  newPassword: 'New password',
  signUp: 'Sign up',
  signIn: 'Sign in',
  noAccount: "Don't have an account?",
  alreadyAccount: 'Already have an account?',
  forgot: 'Forgot password?',
  verifyTitle: 'Check your email',
  verifyBody: 'We sent a 6-digit code to',
  code: 'Verification code',
  verify: 'Verify',
  resend: 'Send a new code',
  codeSent: 'A new code is on its way.',
  startOver: 'Start over',
  resetTitle: 'Reset your password',
  resetBody: 'Enter your email and we will send you a reset code.',
  sendCode: 'Send code',
  resetCodeBody: 'Enter the code we emailed you and choose a new password.',
  resetPassword: 'Reset password',
  backToSignIn: 'Back to sign in',
  setupTitle: 'Set up your profile',
  setupBody: 'Tell the world who you are and which languages you speak.',
  editTitle: 'Edit profile',
  addPhoto: 'Add photo',
  changePhoto: 'Change photo',
  displayName: 'Display name',
  displayNamePh: 'How friends will see you',
  country: 'Country',
  selectCountry: 'Select your country',
  nativeLanguage: 'Native language',
  selectLanguage: 'Select a language',
  understand: 'Languages I want to understand',
  understandHint: 'Pick one or more. We translate everything else.',
  finish: 'Finish setup',
  save: 'Save changes',
  cancel: 'Cancel',
  search: 'Search',
  noResults: 'Nothing matches that search.',
  profileReady: 'Your profile is ready',
  speaks: 'Speaks',
  understands: 'Understands',
  from: 'From',
  appLanguage: 'App language',
  edit: 'Edit profile',
  signOut: 'Sign out',
  signOutConfirm: 'Sign out of Nino?',
  comingSoon: 'Feed, live rooms and chat arrive in the next update.',
  requiredName: 'Please enter a display name.',
  requiredCountry: 'Please choose your country.',
  requiredNative: 'Please choose your native language.',
  requiredUnderstand: 'Pick at least one language to understand.',
  photoDenied: 'Photo access was denied. Enable it in Settings to add a photo.',
  genericError: 'Something went wrong. Please try again.',
  humanVerification: 'After tapping Sign up, complete “Verify you are human” here if it appears. Sign-up waits for this security check. If it does not load, open the preview in a separate browser tab and try again.',
  missingFields: 'Please fill in every field.',
  secondFactor: 'This account uses two-step verification, which is not supported in this version yet.',
  memberSince: 'Member since',
};
type Dict = typeof en;

const ar: Dict = {
  tagline: 'عالم واحد  ·  صوت واحد',
  taglineAr: 'One World  ·  One Voice',
  welcomeTitle: 'لغات مختلفة.\nناس واحدة.',
  welcomeBody: 'تعرّف على أصدقاء من كل دولة وتحدث بحرية — نينو يترجم ليفهم الجميع.',
  getStarted: 'ابدأ الآن',
  haveAccount: 'لدي حساب بالفعل',
  chooseLanguage: 'اختر لغتك',
  chooseLanguageBody: 'سيتحدث نينو معك بهذه اللغة. يمكنك تغييرها في أي وقت.',
  continue: 'متابعة',
  createAccount: 'أنشئ حسابك',
  createAccountBody: 'انضم إلى أشخاص من كل أنحاء العالم.',
  welcomeBack: 'أهلاً بعودتك',
  welcomeBackBody: 'سجّل الدخول لمتابعة محادثاتك.',
  email: 'البريد الإلكتروني',
  emailPh: 'you@example.com',
  password: 'كلمة المرور',
  passwordPh: '8 أحرف على الأقل',
  newPassword: 'كلمة مرور جديدة',
  signUp: 'إنشاء حساب',
  signIn: 'تسجيل الدخول',
  noAccount: 'ليس لديك حساب؟',
  alreadyAccount: 'لديك حساب بالفعل؟',
  forgot: 'نسيت كلمة المرور؟',
  verifyTitle: 'تحقق من بريدك',
  verifyBody: 'أرسلنا رمزاً من 6 أرقام إلى',
  code: 'رمز التحقق',
  verify: 'تحقق',
  resend: 'إرسال رمز جديد',
  codeSent: 'رمز جديد في الطريق إليك.',
  startOver: 'البدء من جديد',
  resetTitle: 'إعادة تعيين كلمة المرور',
  resetBody: 'أدخل بريدك وسنرسل لك رمز إعادة التعيين.',
  sendCode: 'إرسال الرمز',
  resetCodeBody: 'أدخل الرمز الذي أرسلناه واختر كلمة مرور جديدة.',
  resetPassword: 'تعيين كلمة المرور',
  backToSignIn: 'العودة لتسجيل الدخول',
  setupTitle: 'جهّز ملفك الشخصي',
  setupBody: 'عرّف العالم بنفسك وباللغات التي تتحدثها.',
  editTitle: 'تعديل الملف الشخصي',
  addPhoto: 'أضف صورة',
  changePhoto: 'تغيير الصورة',
  displayName: 'الاسم الظاهر',
  displayNamePh: 'كيف سيراك أصدقاؤك',
  country: 'الدولة',
  selectCountry: 'اختر دولتك',
  nativeLanguage: 'اللغة الأم',
  selectLanguage: 'اختر لغة',
  understand: 'لغات أريد فهمها',
  understandHint: 'اختر لغة أو أكثر. نحن نترجم الباقي.',
  finish: 'إنهاء الإعداد',
  save: 'حفظ التغييرات',
  cancel: 'إلغاء',
  search: 'بحث',
  noResults: 'لا توجد نتائج مطابقة.',
  profileReady: 'ملفك الشخصي جاهز',
  speaks: 'يتحدث',
  understands: 'يفهم',
  from: 'من',
  appLanguage: 'لغة التطبيق',
  edit: 'تعديل الملف',
  signOut: 'تسجيل الخروج',
  signOutConfirm: 'تسجيل الخروج من نينو؟',
  comingSoon: 'الصفحة الرئيسية والبث المباشر والدردشة قادمة في التحديث القادم.',
  requiredName: 'يرجى إدخال الاسم الظاهر.',
  requiredCountry: 'يرجى اختيار دولتك.',
  requiredNative: 'يرجى اختيار لغتك الأم.',
  requiredUnderstand: 'اختر لغة واحدة على الأقل.',
  photoDenied: 'تم رفض الوصول إلى الصور. فعّله من الإعدادات لإضافة صورة.',
  genericError: 'حدث خطأ ما. حاول مرة أخرى.',
  humanVerification: 'بعد الضغط على إنشاء حساب، أكمل التحقق «أنك إنسان» هنا إذا ظهر. ينتظر التسجيل هذا الفحص الأمني. إذا لم يظهر، افتح المعاينة في علامة تبويب منفصلة وحاول مجددًا.',
  missingFields: 'يرجى ملء جميع الحقول.',
  secondFactor: 'هذا الحساب يستخدم التحقق بخطوتين، وهو غير مدعوم في هذا الإصدار بعد.',
  memberSince: 'عضو منذ',
};

const pt: Dict = {
  tagline: 'Um Mundo  ·  Uma Voz',
  taglineAr: 'عالم واحد صوت واحد',
  welcomeTitle: 'Idiomas diferentes.\nAs mesmas pessoas.',
  welcomeBody: 'Conheça amigos em todos os países e converse à vontade — o Nino traduz para todo mundo entender.',
  getStarted: 'Começar',
  haveAccount: 'Já tenho uma conta',
  chooseLanguage: 'Escolha seu idioma',
  chooseLanguageBody: 'O Nino vai falar com você neste idioma. Você pode mudar quando quiser.',
  continue: 'Continuar',
  createAccount: 'Crie sua conta',
  createAccountBody: 'Junte-se a pessoas de todos os cantos do mundo.',
  welcomeBack: 'Que bom te ver de novo',
  welcomeBackBody: 'Entre para continuar suas conversas.',
  email: 'E-mail',
  emailPh: 'voce@exemplo.com',
  password: 'Senha',
  passwordPh: 'Pelo menos 8 caracteres',
  newPassword: 'Nova senha',
  signUp: 'Cadastrar',
  signIn: 'Entrar',
  noAccount: 'Não tem uma conta?',
  alreadyAccount: 'Já tem uma conta?',
  forgot: 'Esqueceu a senha?',
  verifyTitle: 'Confira seu e-mail',
  verifyBody: 'Enviamos um código de 6 dígitos para',
  code: 'Código de verificação',
  verify: 'Verificar',
  resend: 'Enviar novo código',
  codeSent: 'Um novo código está a caminho.',
  startOver: 'Recomeçar',
  resetTitle: 'Redefinir senha',
  resetBody: 'Digite seu e-mail e enviaremos um código de redefinição.',
  sendCode: 'Enviar código',
  resetCodeBody: 'Digite o código enviado e escolha uma nova senha.',
  resetPassword: 'Redefinir senha',
  backToSignIn: 'Voltar para entrar',
  setupTitle: 'Monte seu perfil',
  setupBody: 'Conte ao mundo quem você é e quais idiomas fala.',
  editTitle: 'Editar perfil',
  addPhoto: 'Adicionar foto',
  changePhoto: 'Trocar foto',
  displayName: 'Nome de exibição',
  displayNamePh: 'Como seus amigos vão te ver',
  country: 'País',
  selectCountry: 'Selecione seu país',
  nativeLanguage: 'Idioma nativo',
  selectLanguage: 'Selecione um idioma',
  understand: 'Idiomas que quero entender',
  understandHint: 'Escolha um ou mais. Nós traduzimos o resto.',
  finish: 'Concluir',
  save: 'Salvar alterações',
  cancel: 'Cancelar',
  search: 'Buscar',
  noResults: 'Nada encontrado.',
  profileReady: 'Seu perfil está pronto',
  speaks: 'Fala',
  understands: 'Entende',
  from: 'De',
  appLanguage: 'Idioma do app',
  edit: 'Editar perfil',
  signOut: 'Sair',
  signOutConfirm: 'Sair do Nino?',
  comingSoon: 'Feed, lives e chat chegam na próxima atualização.',
  requiredName: 'Digite um nome de exibição.',
  requiredCountry: 'Escolha seu país.',
  requiredNative: 'Escolha seu idioma nativo.',
  requiredUnderstand: 'Escolha pelo menos um idioma.',
  photoDenied: 'Acesso às fotos negado. Ative nos Ajustes para adicionar uma foto.',
  genericError: 'Algo deu errado. Tente novamente.',
  humanVerification: 'Após tocar em Cadastrar, conclua “Verifique que você é humano” aqui, se aparecer. O cadastro aguarda essa verificação. Se não carregar, abra a prévia em outra aba e tente novamente.',
  missingFields: 'Preencha todos os campos.',
  secondFactor: 'Esta conta usa verificação em duas etapas, ainda não suportada nesta versão.',
  memberSince: 'Membro desde',
};

const es: Dict = {
  tagline: 'Un Mundo  ·  Una Voz',
  taglineAr: 'عالم واحد صوت واحد',
  welcomeTitle: 'Idiomas distintos.\nLa misma gente.',
  welcomeBody: 'Conoce amigos en cada país y habla con libertad — Nino traduce para que todos se entiendan.',
  getStarted: 'Empezar',
  haveAccount: 'Ya tengo una cuenta',
  chooseLanguage: 'Elige tu idioma',
  chooseLanguageBody: 'Nino te hablará en este idioma. Puedes cambiarlo cuando quieras.',
  continue: 'Continuar',
  createAccount: 'Crea tu cuenta',
  createAccountBody: 'Únete a personas de todos los rincones del mundo.',
  welcomeBack: 'Qué bueno verte',
  welcomeBackBody: 'Inicia sesión para seguir tus conversaciones.',
  email: 'Correo',
  emailPh: 'tu@ejemplo.com',
  password: 'Contraseña',
  passwordPh: 'Al menos 8 caracteres',
  newPassword: 'Nueva contraseña',
  signUp: 'Registrarme',
  signIn: 'Iniciar sesión',
  noAccount: '¿No tienes cuenta?',
  alreadyAccount: '¿Ya tienes cuenta?',
  forgot: '¿Olvidaste tu contraseña?',
  verifyTitle: 'Revisa tu correo',
  verifyBody: 'Enviamos un código de 6 dígitos a',
  code: 'Código de verificación',
  verify: 'Verificar',
  resend: 'Enviar un código nuevo',
  codeSent: 'Un código nuevo va en camino.',
  startOver: 'Empezar de nuevo',
  resetTitle: 'Restablecer contraseña',
  resetBody: 'Escribe tu correo y te enviaremos un código.',
  sendCode: 'Enviar código',
  resetCodeBody: 'Escribe el código recibido y elige una nueva contraseña.',
  resetPassword: 'Restablecer',
  backToSignIn: 'Volver a iniciar sesión',
  setupTitle: 'Arma tu perfil',
  setupBody: 'Cuéntale al mundo quién eres y qué idiomas hablas.',
  editTitle: 'Editar perfil',
  addPhoto: 'Añadir foto',
  changePhoto: 'Cambiar foto',
  displayName: 'Nombre visible',
  displayNamePh: 'Cómo te verán tus amigos',
  country: 'País',
  selectCountry: 'Selecciona tu país',
  nativeLanguage: 'Idioma nativo',
  selectLanguage: 'Selecciona un idioma',
  understand: 'Idiomas que quiero entender',
  understandHint: 'Elige uno o más. Nosotros traducimos el resto.',
  finish: 'Terminar',
  save: 'Guardar cambios',
  cancel: 'Cancelar',
  search: 'Buscar',
  noResults: 'No hay coincidencias.',
  profileReady: 'Tu perfil está listo',
  speaks: 'Habla',
  understands: 'Entiende',
  from: 'De',
  appLanguage: 'Idioma de la app',
  edit: 'Editar perfil',
  signOut: 'Cerrar sesión',
  signOutConfirm: '¿Cerrar sesión en Nino?',
  comingSoon: 'El feed, los directos y el chat llegan en la próxima actualización.',
  requiredName: 'Escribe un nombre visible.',
  requiredCountry: 'Elige tu país.',
  requiredNative: 'Elige tu idioma nativo.',
  requiredUnderstand: 'Elige al menos un idioma.',
  photoDenied: 'Se negó el acceso a fotos. Actívalo en Ajustes para añadir una foto.',
  genericError: 'Algo salió mal. Inténtalo de nuevo.',
  humanVerification: 'Después de pulsar Registrarse, completa “Verifica que eres humano” aquí si aparece. El registro espera esta comprobación. Si no carga, abre la vista previa en otra pestaña e inténtalo de nuevo.',
  missingFields: 'Completa todos los campos.',
  secondFactor: 'Esta cuenta usa verificación en dos pasos, aún no compatible en esta versión.',
  memberSince: 'Miembro desde',
};

const DICTS: Record<Lang, Dict> = { en, ar, pt, es };
export type TKey = keyof Dict;

const LANG_KEY = 'nino.appLanguage';
const CHOSEN_KEY = 'nino.languageChosen';

type Ctx = {
  lang: Lang;
  rtl: boolean;
  ready: boolean;
  languageChosen: boolean;
  t: (k: TKey) => string;
  setLang: (l: Lang) => Promise<void>;
  font: (w?: 'regular' | 'medium' | 'semibold' | 'bold') => string;
  row: 'row' | 'row-reverse';
  align: 'left' | 'right';
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');
  const [languageChosen, setChosen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [l, c] = await Promise.all([AsyncStorage.getItem(LANG_KEY), AsyncStorage.getItem(CHOSEN_KEY)]);
        if (l && l in DICTS) setLangState(l as Lang);
        setChosen(c === '1');
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const rtl = lang === 'ar';

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.dir = rtl ? 'rtl' : 'ltr';
      document.documentElement.lang = lang;
    }
  }, [rtl, lang]);

  const setLang = useCallback(async (l: Lang) => {
    setLangState(l);
    setChosen(true);
    await AsyncStorage.multiSet([[LANG_KEY, l], [CHOSEN_KEY, '1']]);
  }, []);

  const value = useMemo<Ctx>(() => {
    const t = (k: TKey) => DICTS[lang][k] ?? en[k];
    const font = (w: 'regular' | 'medium' | 'semibold' | 'bold' = 'regular') => {
      if (rtl) return w === 'bold' ? 'Cairo_700Bold' : w === 'regular' ? 'Cairo_400Regular' : 'Cairo_600SemiBold';
      return { regular: 'Poppins_400Regular', medium: 'Poppins_500Medium', semibold: 'Poppins_600SemiBold', bold: 'Poppins_700Bold' }[w];
    };
    return { lang, rtl, ready, languageChosen, t, setLang, font, row: rtl ? 'row-reverse' : 'row', align: rtl ? 'right' : 'left' };
  }, [lang, rtl, ready, languageChosen, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const c = useContext(I18nContext);
  if (!c) throw new Error('useI18n must be used inside I18nProvider');
  return c;
}
