importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "AIzaSyD8yO9df9lq4dzNtN36uyDkrLVhL7OP_Eg",
  authDomain: "solucell-painel.firebaseapp.com",
  projectId: "solucell-painel",
  storageBucket: "solucell-painel.firebasestorage.app",
  messagingSenderId: "49336250894",
  appId: "1:49336250894:web:b5e416b0918964cea7825f",
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Lida com mensagens quando o navegador está fechado ou em segundo plano
messaging.onBackgroundMessage((payload) => {
  console.log("Mensagem recebida em segundo plano: ", payload);

  const notificationTitle = payload.notification?.title || "Nova Venda Realizada!";
  const notificationOptions = {
    body: payload.notification?.body || "Uma nova venda foi registada no sistema.",
    icon: "/icon.png", // Certifique-se de que este arquivo existe na pasta public
    badge: "/icon.png",
    data: payload.data, // Mantém dados extras se existirem
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});