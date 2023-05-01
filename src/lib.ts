import { getApps, initializeApp, cert } from "firebase-admin/app";

export async function initFirebaseAdmin() {
    return new Promise((resolve, reject) => {
        if (getApps().length === 0) {
            const fireconfig: any = {
                "type": "service_account",
                "project_id": "clipcook-59c6b",
                "private_key_id": "REDACTED",
                "private_key": "REDACTED\n",
                "client_email": "firebase-adminsdk-njxv6@clipcook-59c6b.iam.gserviceaccount.com",
                "client_id": "110827421961773605472",
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-njxv6%40clipcook-59c6b.iam.gserviceaccount.com"
            };

            initializeApp({
                credential: cert(fireconfig)
            });
        }

        resolve("done")
    });
}