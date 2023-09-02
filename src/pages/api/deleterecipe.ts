import type { NextApiRequest, NextApiResponse } from 'next'
import { initFirebaseAdmin } from '@/lib';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        res.status(405).json({ "message": "Error", "data": 'Method not allowed' })
    }

    const idToken = req.headers.authorization || "";
    const id = req.query.id || "";

    if (!idToken || idToken === "" || !id || id === "") {
        return res.status(400).json({ "message": "Error", "data": "Invalid parameters" });
    }

    try {
        await initFirebaseAdmin();

        const auth = getAuth();
        const decodedToken = await auth.verifyIdToken(idToken);

        if (!decodedToken) {
            res.status(401).json({ "message": "Error", "data": 'Invalid authorization token' })
        }

        const uid = decodedToken.uid;

        const db = getFirestore();

        const recipeRef = db.collection('allRecipes').doc(id.toString());
        const recipeDoc = await recipeRef.get();

        if (!recipeDoc.exists) {
            res.status(404).json({ "message": "Error", "data": 'Recipe not found' })
        }

        const recipeData: any = recipeDoc.data();

        if (!recipeData) {
            res.status(404).json({ "message": "Error", "data": 'Recipe not found' })
        }

        if (recipeData["uid"] !== uid) {
            res.status(401).json({ "message": "Error", "data": 'Unauthorized' })
        }

        await recipeRef.delete();

        res.status(200).json({ "message": "Success", "data": "Success!" })
    } catch (e: any) {
        res.status(500).json({ "message": "Error", "data": e.toString() })
    }
}
