import { useI18n, type Lang } from './i18n';

const copy: Record<Lang, [string, string, string, string]> = {
  en: ['Block messages', 'Unblock messages', 'Messaging is blocked. Neither person can send messages.', 'You can send more after a reply or when either person follows the other.'],
  ar: ['حظر الرسائل', 'إلغاء حظر الرسائل', 'الرسائل محظورة. لا يمكن لأي منكما إرسال رسائل.', 'يمكنكما إرسال المزيد بعد الرد أو عندما يتابع أحدكما الآخر.'],
  pt: ['Bloquear mensagens', 'Desbloquear mensagens', 'Mensagens bloqueadas. Nenhuma das pessoas pode enviar.', 'Envie mais após uma resposta ou quando um seguir o outro.'],
  es: ['Bloquear mensajes', 'Desbloquear mensajes', 'Mensajes bloqueados. Ninguna persona puede enviar.', 'Envía más tras una respuesta o cuando una persona siga a la otra.'],
  fr: ['Bloquer les messages', 'Débloquer les messages', 'Messages bloqués. Personne ne peut en envoyer.', 'Envoyez davantage après une réponse ou si une personne suit l’autre.'],
  de: ['Nachrichten blockieren', 'Nachrichten freigeben', 'Nachrichten sind blockiert. Niemand kann senden.', 'Nach einer Antwort oder wenn eine Person der anderen folgt, sind weitere Nachrichten möglich.'],
  it: ['Blocca messaggi', 'Sblocca messaggi', 'Messaggi bloccati. Nessuno dei due può inviare.', 'Invia altri messaggi dopo una risposta o quando uno segue l’altro.'],
  tr: ['Mesajları engelle', 'Mesaj engelini kaldır', 'Mesajlaşma engellendi. İki kişi de mesaj gönderemez.', 'Yanıttan sonra veya biriniz diğerini takip ettiğinde daha fazla mesaj gönderebilirsiniz.'],
  ru: ['Заблокировать сообщения', 'Разблокировать сообщения', 'Переписка заблокирована. Никто не может отправлять сообщения.', 'После ответа или подписки одного из вас на другого можно отправлять больше сообщений.'],
  hi: ['संदेश ब्लॉक करें', 'संदेश अनब्लॉक करें', 'संदेश ब्लॉक हैं। दोनों में से कोई संदेश नहीं भेज सकता।', 'जवाब मिलने पर या किसी एक के दूसरे को फ़ॉलो करने पर और संदेश भेज सकते हैं।'],
  zh: ['屏蔽消息', '解除消息屏蔽', '消息已屏蔽，双方都无法发送。', '收到回复后，或一方关注另一方后，即可继续发送。'],
  ja: ['メッセージをブロック', 'ブロックを解除', 'ブロック中のため、双方とも送信できません。', '返信があるか、どちらかが相手をフォローすると、続けて送信できます。'],
};
export function useBlockCopy() {
  const { lang } = useI18n();
  const [block, unblock, blocked, requestHint] = copy[lang];
  const more: Record<Lang, string> = {
    en: 'More options', ar: 'المزيد من الخيارات', pt: 'Mais opções', es: 'Más opciones',
    fr: 'Plus d’options', de: 'Weitere Optionen', it: 'Altre opzioni', tr: 'Diğer seçenekler',
    ru: 'Другие действия', hi: 'और विकल्प', zh: '更多选项', ja: 'その他のオプション',
  };
  return { block, unblock, blocked, requestHint, more: more[lang] };
}
