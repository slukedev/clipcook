import type { NextApiRequest, NextApiResponse } from 'next'
import * as cheerio from 'cheerio';
import { initFirebaseAdmin } from '@/lib';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        res.status(405).json({ "message": "Error", "data": 'Method not allowed' })
    }

    const idToken = req.headers.authorization || "";

    if (!idToken || idToken === "") {
        return res.status(400).json({ "message": "Error", "data": "Invalid parameters" });
    }

    let recipeJson: any;

    try {
        recipeJson = JSON.parse(req.body).recipe;

        if (!recipeJson || !recipeJson.image || !recipeJson.title || !recipeJson.description || !recipeJson.servings || !recipeJson.prepTime || !recipeJson.cookTime || !recipeJson.totalTime || !recipeJson.ingredients || !recipeJson.instructions) {
            return res.status(400).json({ "message": "Error", "data": "Invalid recipe" });
        }
    } catch (e: any) {
        return res.status(400).json({ "message": "Error", "data": "Invalid recipe" });
    }

    try {
        await initFirebaseAdmin();

        const auth = getAuth();
        const decodedToken = await auth.verifyIdToken(idToken);

        if (!decodedToken) {
            res.status(401).json({ "message": "Error", "data": 'Invalid authorization token' })
        }

        const uid = decodedToken.uid;
        recipeJson["uid"] = uid;

        const db = getFirestore();

        const docRef = await db.collection('allRecipes').add(recipeJson);

        res.status(200).json({ "message": "Success", "data": docRef.id })
    } catch (e: any) {
        res.status(500).json({ "message": "Error", "data": e.toString() })
    }
}
