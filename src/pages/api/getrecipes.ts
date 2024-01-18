import type { NextApiRequest, NextApiResponse } from 'next'
import { initFirebaseAdmin } from '@/lib';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        if (req.method !== "GET") {
            res.status(405).json({ "message": "Error", "data": 'Method not allowed' })
        }

        const idToken = req.headers.authorization || "";

        if (!idToken || idToken === "") {
            res.status(401).json({ "message": "Error", "data": 'Invalid parameters' })
        }

        await initFirebaseAdmin();

        const auth = getAuth();

        const decodedToken = await auth.verifyIdToken(idToken);

        if (!decodedToken) {
            res.status(401).json({ "message": "Error", "data": 'Invalid authorization token' })
        }

        // const uid = decodedToken.uid;
        const uid = "2l4VIC5PP8MK8f8xQ8NHtLqs5uS2";

        const db = getFirestore();

        const recipeRef = db.collection('allRecipes').where("uid", "==", uid);
        const recipeSnapshot = await recipeRef.get();
        let data: any = [];

        recipeSnapshot.forEach((doc) => {
            const recipeData = doc.data();

            data.push({
                id: doc.id,
                title: recipeData.title,
                image: recipeData.image
            });
        });

        res.status(200).json({ "message": "Success", "data": data })
    } catch (e: any) {
        res.status(500).json({ "message": "Error", "data": e.toString() })
    }
}