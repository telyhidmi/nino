import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { preferredLanguage } from './preferredLanguage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { europe } from './locales/europe';
import { asia } from './locales/asia';
import { feedEn, feedLocales } from './locales/feed';
import { cameraEn, cameraLocales } from './locales/camera';
import { profileEn, profileLocales } from './locales/profile';
import { discoverEn, discoverLocales } from './locales/discover';

export type Lang = 'en' | 'ar' | 'pt' | 'es' | 'fr' | 'de' | 'it' | 'tr' | 'ru' | 'hi' | 'zh' | 'ja';
export const LANGS: { code: Lang; native: string; english: string; flag: string; hello: string }[] = [
  { code: 'en', native: 'English', english: 'English', flag: '🇺🇸', hello: 'Hello' },
  { code: 'ar', native: 'العربية', english: 'Arabic', flag: '🇸🇦', hello: 'مرحبا' },
  { code: 'pt', native: 'Português', english: 'Portuguese', flag: '🇧🇷', hello: 'Olá' },
  { code: 'es', native: 'Español', english: 'Spanish', flag: '🇪🇸', hello: 'Hola' },
  { code: 'fr', native: 'Français', english: 'French', flag: '🇫🇷', hello: 'Bonjour' },
  { code: 'de', native: 'Deutsch', english: 'German', flag: '🇩🇪', hello: 'Hallo' },
  { code: 'it', native: 'Italiano', english: 'Italian', flag: '🇮🇹', hello: 'Ciao' },
  { code: 'tr', native: 'Türkçe', english: 'Turkish', flag: '🇹🇷', hello: 'Merhaba' },
  { code: 'ru', native: 'Русский', english: 'Russian', flag: '🇷🇺', hello: 'Привет' },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi', flag: '🇮🇳', hello: 'नमस्ते' },
  { code: 'zh', native: '简体中文', english: 'Chinese Simplified', flag: '🇨🇳', hello: '你好' },
  { code: 'ja', native: '日本語', english: 'Japanese', flag: '🇯🇵', hello: 'こんにちは' },
];

const en = {
  searchLanguages: 'Search languages',
  languageSaveError: 'Could not save your language. Please try again.',
  retry: 'Try again',
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
  passwordPh: 'Must be 15 characters',
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
  continueGoogle: 'Continue with Google',
  continueApple: 'Continue with Apple',
  orEmail: 'or continue with email',
  socialCanceled: 'Sign-in canceled. You can try again.',
  socialError: 'Social sign-in could not start. Try again in a separate browser tab and allow popups.',
  socialRequirements: 'Clerk needs more account details or verification. Start over to use email registration, or contact support',
  socialLinkVerification: 'Verify your existing account before it can be linked. Start over and sign in with your original method. Clerk will only link verified accounts.',
  socialExtraVerification: 'This account needs an additional security check. Social sign-in is not complete. Start over to use your original sign-in method, or contact support.',
  socialIncomplete: 'Social sign-in is not complete. Start over and try again, or use email.',
  socialSessionTask: 'Your account has a pending security task. Access to Nino is paused until it is completed. Contact support or sign out to try another account.',
  socialReturning: 'Returning to Nino',
  socialReturnBody: 'Please return to the window where you started sign-in.',
  socialCallbackError: 'This callback could not reconnect to the original sign-in window. Close this window and try again from Nino in a separate browser tab.',
};
type Dict = typeof en;

const ar: Dict = {
  searchLanguages: 'ابحث عن لغة',
  languageSaveError: 'تعذّر حفظ لغتك. يرجى المحاولة مجددًا.',
  retry: 'حاول مجددًا',
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
  passwordPh: 'يجب أن تكون 15 حرفًا',
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
  continueGoogle: 'المتابعة باستخدام Google',
  continueApple: 'المتابعة باستخدام Apple',
  orEmail: 'أو المتابعة بالبريد الإلكتروني',
  socialCanceled: 'أُلغي تسجيل الدخول. يمكنك المحاولة مجددًا.',
  socialError: 'تعذّر بدء تسجيل الدخول. حاول في علامة تبويب منفصلة واسمح بالنوافذ المنبثقة.',
  socialRequirements: 'يطلب Clerk تفاصيل أو تحققًا إضافيًا. ابدأ من جديد للتسجيل بالبريد أو تواصل مع الدعم',
  socialLinkVerification: 'تحقق من حسابك الحالي قبل ربطه. ابدأ من جديد وسجّل بطريقتك الأصلية. يربط Clerk الحسابات المتحقق منها فقط.',
  socialExtraVerification: 'يحتاج حسابك إلى تحقق أمني إضافي. لم يكتمل الدخول. ابدأ من جديد بطريقتك الأصلية أو تواصل مع الدعم.',
  socialIncomplete: 'لم يكتمل تسجيل الدخول. ابدأ من جديد أو استخدم البريد الإلكتروني.',
  socialSessionTask: 'لحسابك مهمة أمنية معلقة. الوصول إلى نينو متوقف حتى إكمالها. تواصل مع الدعم أو سجّل الخروج لتجربة حساب آخر.',
  socialReturning: 'العودة إلى نينو',
  socialReturnBody: 'ارجع إلى النافذة التي بدأت فيها تسجيل الدخول.',
  socialCallbackError: 'تعذّر الاتصال بنافذة تسجيل الدخول الأصلية. أغلق هذه النافذة وحاول مجددًا من نينو في علامة تبويب منفصلة.',
};

const pt: Dict = {
  searchLanguages: 'Buscar idiomas',
  languageSaveError: 'Não foi possível salvar seu idioma. Tente novamente.',
  retry: 'Tentar novamente',
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
  passwordPh: 'Deve ter 15 caracteres',
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
  continueGoogle: 'Continuar com Google',
  continueApple: 'Continuar com Apple',
  orEmail: 'ou continuar com e-mail',
  socialCanceled: 'Entrada cancelada. Você pode tentar novamente.',
  socialError: 'Não foi possível iniciar. Tente em outra aba e permita pop-ups.',
  socialRequirements: 'O Clerk precisa de mais dados ou verificação. Recomece para cadastrar por e-mail ou contate o suporte',
  socialLinkVerification: 'Verifique sua conta existente antes de vinculá-la. Recomece e entre pelo método original. O Clerk vincula apenas contas verificadas.',
  socialExtraVerification: 'Esta conta precisa de uma verificação de segurança adicional. A entrada não foi concluída. Recomece pelo método original ou contate o suporte.',
  socialIncomplete: 'A entrada não foi concluída. Recomece ou use e-mail.',
  socialSessionTask: 'Sua conta tem uma tarefa de segurança pendente. O acesso ao Nino está pausado até concluí-la. Contate o suporte ou saia para tentar outra conta.',
  socialReturning: 'Voltando ao Nino',
  socialReturnBody: 'Volte à janela onde você começou a entrar.',
  socialCallbackError: 'Não foi possível reconectar à janela original. Feche esta janela e tente novamente no Nino em outra aba.',
};

const es: Dict = {
  searchLanguages: 'Buscar idiomas',
  languageSaveError: 'No se pudo guardar tu idioma. Inténtalo de nuevo.',
  retry: 'Intentar de nuevo',
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
  passwordPh: 'Debe tener 15 caracteres',
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
  continueGoogle: 'Continuar con Google',
  continueApple: 'Continuar con Apple',
  orEmail: 'o continuar con correo',
  socialCanceled: 'Inicio cancelado. Puedes intentarlo de nuevo.',
  socialError: 'No se pudo iniciar. Prueba en otra pestaña y permite ventanas emergentes.',
  socialRequirements: 'Clerk necesita más datos o verificación. Empieza de nuevo para registrarte por correo o contacta con soporte',
  socialLinkVerification: 'Verifica tu cuenta existente antes de vincularla. Empieza de nuevo con tu método original. Clerk solo vincula cuentas verificadas.',
  socialExtraVerification: 'Esta cuenta necesita una comprobación adicional. El inicio no se ha completado. Empieza de nuevo con tu método original o contacta con soporte.',
  socialIncomplete: 'El inicio no se ha completado. Empieza de nuevo o usa correo.',
  socialSessionTask: 'Tu cuenta tiene una tarea de seguridad pendiente. El acceso a Nino está pausado hasta completarla. Contacta con soporte o sal para probar otra cuenta.',
  socialReturning: 'Volviendo a Nino',
  socialReturnBody: 'Vuelve a la ventana donde comenzaste a iniciar sesión.',
  socialCallbackError: 'No se pudo reconectar con la ventana original. Cierra esta ventana e inténtalo desde Nino en otra pestaña.',
};

const BASE_DICTS: Record<Lang, Dict> = { en, ar, pt, es, ...europe, ...asia };
type InterfaceKey = keyof typeof feedEn | keyof typeof cameraEn | keyof typeof profileEn | keyof typeof discoverEn;
type AppDict = Dict & Record<InterfaceKey, string>;
function dictionary(language: Lang): AppDict {
  return {
    ...BASE_DICTS[language],
    ...feedLocales[language],
    ...cameraLocales[language],
    ...profileLocales[language],
    ...discoverLocales[language],
  };
}
const DICTS: Record<Lang, AppDict> = {
  en: dictionary('en'), ar: dictionary('ar'), pt: dictionary('pt'), es: dictionary('es'),
  fr: dictionary('fr'), de: dictionary('de'), it: dictionary('it'), tr: dictionary('tr'),
  ru: dictionary('ru'), hi: dictionary('hi'), zh: dictionary('zh'), ja: dictionary('ja'),
};
export type TKey = keyof AppDict;

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
  const [lang, setLangState] = useState<Lang>(() =>
    preferredLanguage(getLocales().map(locale => locale.languageTag), LANGS.map(l => l.code)) as Lang);
  const [languageChosen, setChosen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [l, c] = await Promise.all([AsyncStorage.getItem(LANG_KEY), AsyncStorage.getItem(CHOSEN_KEY)]);
        if (l && Object.prototype.hasOwnProperty.call(DICTS, l)) setLangState(l as Lang);
        setChosen(c === '1');
      } catch {
        // Storage may be unavailable; keep the default language usable.
        setChosen(false);
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
    await AsyncStorage.multiSet([[LANG_KEY, l], [CHOSEN_KEY, '1']]);
    setLangState(l);
    setChosen(true);
  }, []);

  const value = useMemo<Ctx>(() => {
    const t = (k: TKey) => DICTS[lang][k] ?? DICTS.en[k];
    const font = (w: 'regular' | 'medium' | 'semibold' | 'bold' = 'regular') => {
      if (rtl) return w === 'bold' ? 'Cairo_700Bold' : w === 'regular' ? 'Cairo_400Regular' : 'Cairo_600SemiBold';
      if (['ru', 'hi', 'zh', 'ja'].includes(lang)) return Platform.OS === 'ios' ? 'System' : 'sans-serif';
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
