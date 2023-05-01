// ./initAuth.js
import { init } from 'next-firebase-auth'

const initAuth = () => {
    init({
        authPageURL: '/continue',
        appPageURL: '/',
        loginAPIEndpoint: '/api/login',
        logoutAPIEndpoint: '/api/logout',
        onLoginRequestError: (err) => {
            console.error(err)
        },
        onLogoutRequestError: (err) => {
            console.error(err)
        },
        firebaseAdminInitConfig: {
            credential: {
                projectId: 'clipcook-59c6b',
                clientEmail: 'firebase-adminsdk-njxv6@clipcook-59c6b.iam.gserviceaccount.com',
                // The private key must not be accessible on the client side.
                privateKey: process.env.FIREBASE_PRIVATE_KEY
                    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/gm, "\n")
                    : ""
            },
            databaseURL: 'https://my-example-app.firebaseio.com',
        },
        // Use application default credentials (takes precedence over firebaseAdminInitConfig if set)
        // useFirebaseAdminDefaultCredential: true,
        firebaseClientInitConfig: {
            apiKey: "AIzaSyAlg5bcO368inwAQwIBNlespVC3mPfs8Qw",
            authDomain: "clipcook-59c6b.firebaseapp.com",
            projectId: "clipcook-59c6b",
            storageBucket: "clipcook-59c6b.appspot.com",
            messagingSenderId: "958728612297",
            appId: "1:958728612297:web:04335a54632029b2726018"
        },
        cookies: {
            name: 'ClipCook', // required
            httpOnly: true,
            maxAge: 14 * 60 * 60 * 24 * 1000, // 14 days
            overwrite: true,
            path: '/',
            sameSite: 'strict',
            secure: process.env.NODE_ENV === "production" ? true : false, // set this to false in local (non-HTTPS) development
            signed: false,
        },
        onVerifyTokenError: (err) => {
            console.error(err)
        },
        onTokenRefreshError: (err) => {
            console.error(err)
        },
    })
}

export default initAuth