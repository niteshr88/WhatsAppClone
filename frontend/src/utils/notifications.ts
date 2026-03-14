export type BrowserNotificationPermission = NotificationPermission | "unsupported";
export type BrowserPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

const NOTIFICATION_SERVICE_WORKER_PATH = "/notifications-sw.js";

let serviceWorkerRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  return Notification.permission;
}

export function buildConversationUrl(conversationId: number) {
  return `/chat?conversationId=${conversationId}`;
}

export async function registerNotificationServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  if (!serviceWorkerRegistrationPromise) {
    serviceWorkerRegistrationPromise = navigator.serviceWorker
      .register(NOTIFICATION_SERVICE_WORKER_PATH)
      .then(() => navigator.serviceWorker.ready)
      .catch(() => null);
  }

  return serviceWorkerRegistrationPromise;
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  const permission = await Notification.requestPermission();

  if (permission === "granted") {
    await registerNotificationServiceWorker();
  }

  return permission;
}

export async function ensureBrowserPushSubscription(vapidPublicKey: string): Promise<BrowserPushSubscription | null> {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    Notification.permission !== "granted"
  ) {
    return null;
  }

  const registration = await registerNotificationServiceWorker();

  if (!registration) {
    return null;
  }

  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });
  }

  const json = subscription.toJSON();
  const keys = json.keys ?? {};

  if (!subscription.endpoint || !keys.p256dh || !keys.auth) {
    return null;
  }

  return {
    endpoint: subscription.endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth
  };
}

type ChatNotificationOptions = {
  title: string;
  body: string;
  conversationId: number;
  icon?: string | null;
};

export async function showChatNotification({ title, body, conversationId, icon }: ChatNotificationOptions) {
  if (getBrowserNotificationPermission() !== "granted") {
    return;
  }

  const notificationOptions: NotificationOptions = {
    body,
    tag: `pulsechat-conversation-${conversationId}`,
    data: {
      url: buildConversationUrl(conversationId)
    },
    icon: icon ?? undefined,
    badge: icon ?? undefined
  };

  const registration = await registerNotificationServiceWorker();

  if (registration) {
    await registration.showNotification(title, notificationOptions);
    return;
  }

  new Notification(title, notificationOptions);
}

function urlBase64ToUint8Array(base64String: string) {
  const normalized = `${base64String}${"=".repeat((4 - (base64String.length % 4)) % 4)}`
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(normalized);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}
