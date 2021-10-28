import { initializeApp, getApps, getApp } from 'firebase/app'
import config from '../../config'

let app
if (getApps().length <= 0) {
  app = initializeApp(config.firebaseConfig)
} else {
  app = getApp()
}

export default app
