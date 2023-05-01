import { getApps, initializeApp, cert } from "firebase-admin/app";

export async function initFirebaseAdmin() {
    return new Promise((resolve, reject) => {
        if (getApps().length === 0) {
            const fireconfig: any = {
                "type": "service_account",
                "project_id": "clipcook-59c6b",
                "private_key_id": "6d9ab86a84b20c9eaffb4137688a848b1c26e883",
                "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC4uWVQ/3HOJhU3\nIlLIO9Qrlon19RQ5mWTYUVmiMJq3tA8keO42R87zdrWtzTF209AiBbrnABHgOoiA\nn0dlaVrxPWPWV5xH5aJBIK0QEwqHqG/X7BSdSC5EbdqZwbEvNKfaEH9XTCQgmqMP\norvskkuP4AQp7QhuI8lg5aGMsZLiOKbZOQrUX+PdvzutJDPEI8KDzzesf3TEz6KN\n2Z07FKkf82Md9MC864OgzEJsRx6nuHY1s6jx886ZIj/XwdDr2asM34OeEycW2wZi\ntLymC6OaysnqM1H67UhzWeRxzuHMSnl5Zfh8t1AfHFUCG92bx7bpDRPD1PMcPvWZ\noaR+ARKHAgMBAAECggEANu6jC3g7PqOikXe6iGMKUD//HM5ZylssWwuuDQZJLDH2\ngtEXfbrS9yGpG1s2x3Brp4Jutz0VE8o0R5OWJrky2yR3aQk6p0LJgnaWIH6ZFghn\n4h0JcFBDugO1Cx5Hc5NECxv20l4JLEzwCrlJCyviHpHuiw07AY3Q1+jRpsYzuOPA\nmyxJyp+DTWXw9ACosvMsIIDHSDnDG/CDpsX3Rsrl41iDSs+00GeM6keEk+i84dll\n+rwt0aCwXvP0blC4onL4y9nUHdzT2oKGYtErX9Ee8d5Bc0kWuPE/xd91QGJUvWJT\n33iqgVSlM48C4Mp/C2SBoPrJmvmjC1gHOV/31V6ggQKBgQDbEShYwwK6s6Q2+o2C\nIdb8cqKLBnyrTDN6MfGjTZeo9V/y0o2ivFr3mgnIV9vp99bpNOYtSGc6emNEDJQH\nPFx+w6y5ZSbTG9UAa0eglCN8mFiVb7i3gba3rswWaezWP8OoxoDK/JHdUHvzCRJz\n83Ywb71D/dXs0rXG0FFEndnnRwKBgQDX3gQmysTky3XR+1NdWQ6xmyb585bY5XGJ\nt2aW/lAOBWxTVuIjHEoEhYn4JlhA/MX0gpE8YKBtMNsTWvxOf1ojF+Ro/yCPGXrk\naeVTBDMsSkuYYXzm7B+2mMUXSkn8ULt/sbFbqL8aFiWp/3s/hRg6Oncr3s5iFEUe\noy3Cah+awQKBgQDCzYEZXWCB8dknYqqPe9QXbUEJa91U3lAwa1U7KHaisoB+B6oX\nenNSFtJ4K1jNt6yOeJHu1qGlKMw46Q6BWLXPq+Vef4qE1A0XcE6jhtf/peGwEUcr\nN9fpgzDNBair5Mvyu4Iv/2UebsGqHvkfzvHcpKCjY4fmLoGiqAB8ifoJZQKBgDS7\n7fO0EUl7UrsLVKA3Q1mr92eUVEOEOapU/WDhm5jxRjdNwEyneoWEQeI3K9QkbA+B\nXg2L5WUHTF18GqrqfZCZI5lqyf9rUBRAsl8HZaDqPXFqT2LySAUJaQx5f31+E2/s\nbtFfdd/fjS/sU6V+1B5VbgtvkKdxIDmNz33xAuuBAoGAQ7dMICX8dLD7Yfp4SZRk\nD/+hcEEzCNL1ys2JfCHor1X5J2XvlRNKzsTG1GDM7murSQ/e7H0kDNvqMv+do3VW\neP84Vy8CfXlzoyF5UN/8LnD+fu3mrfeynI9mgaDyFbvXsdvaiOt+pHPqFu8oL7FM\nll01TI/Qwqqf2hCOviBlWw8=\n-----END PRIVATE KEY-----\n",
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