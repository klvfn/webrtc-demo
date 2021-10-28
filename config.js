const config = {
  rtcConfig: {
    iceServers: [
      {
        urls: 'stun:stun1.l.google.com:19302'
      },
      {
        urls: 'turn:numb.viagenie.ca',
        credential: 'muazkh',
        username: 'webrtc@live.com'
      }
    ]
  },
  firebaseConfig: {
    apiKey: 'AIzaSyB7-6Ki2Lzu8r5FdOoI913vfkjBBZhLgoA',
    authDomain: 'webrtc-demo-6032c.firebaseapp.com',
    projectId: 'webrtc-demo-6032c',
    storageBucket: 'webrtc-demo-6032c.appspot.com',
    messagingSenderId: '220931895626',
    appId: '1:220931895626:web:4cbab4ccdb7f146332d1b3'
  }
}

export default config
