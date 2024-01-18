import type { NextApiRequest, NextApiResponse } from 'next'
import { initFirebaseAdmin } from '@/lib';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export const config = {
    api: {
      responseLimit: false,
    },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        if (req.method !== "GET") {
            res.status(405).json({ "message": "Error", "data": 'Method not allowed' })
        }

        const idToken = req.headers.authorization || "";
        const recipeId = req.query.recipeId || "";

        if (!idToken || !recipeId || idToken === "" || recipeId === "") {
            res.status(401).json({ "message": "Error", "data": 'Invalid parameters' })
        }

        await initFirebaseAdmin();

        const auth = getAuth();

        const decodedToken = await auth.verifyIdToken(idToken);

        if (!decodedToken) {
            res.status(401).json({ "message": "Error", "data": 'Invalid authorization token' })
        }

        const uid = decodedToken.uid;

        const db = getFirestore();

        const recipeRef = db.collection('allRecipes').doc(recipeId.toString());
        const recipeDoc = await recipeRef.get();

        if (!recipeDoc.exists) {
            res.status(404).json({ "message": "Error", "data": 'Recipe not found' })
        }

        const recipeData: any = recipeDoc.data();

        var theRecipeData = recipeData;

        if (!recipeData) {
            res.status(404).json({ "message": "Error", "data": 'Recipe not found' })
        }

        if (recipeData["uid"] !== uid) {
            res.status(401).json({ "message": "Error", "data": 'Unauthorized' })
        }

        res.status(200).json({ "message": "Success", "data": theRecipeData })
    } catch (e: any) {
        res.status(500).json({ "message": "Error", "data": e.toString() })
    }
}