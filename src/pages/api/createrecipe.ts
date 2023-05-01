import type { NextApiRequest, NextApiResponse } from 'next'
import * as cheerio from 'cheerio';
import { initFirebaseAdmin } from '@/lib';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        res.status(405).json({ "message": "Error", "data": 'Method not allowed' })
    }

    const url = req.query.url || "";
    const idToken = req.headers.authorization || "";

    if (!url || !idToken || url === "" || idToken === "") {
        return res.status(400).json({ "message": "Invalid parameters", "data": null });
    }

    let recipeJson: any;

    try {
        const fetchRequest = await fetch(url.toString());

        const fetchResponse = await fetchRequest.text();

        const $ = cheerio.load(fetchResponse);

        const recipe = $('script[type="application/ld+json"]').html();

        recipeJson = JSON.parse(recipe || "{}");

        if (Array.isArray(recipeJson)) {
            recipeJson = recipeJson[0];
        }

        const imageUrl = recipeJson.image.url;
        const imageUrlData = await fetch(imageUrl);
        const buffer = await imageUrlData.arrayBuffer();
        const stringifiedBuffer = Buffer.from(buffer).toString('base64');
        const contentType = imageUrlData.headers.get('content-type');
        recipeJson.image.url = `data:${contentType};base64,${stringifiedBuffer}`;

        if (!recipeJson["recipeInstructions"] || !recipeJson["recipeIngredient"] || !recipeJson["name"] || !recipeJson["recipeYield"]) {
            throw new Error("Invalid recipe");
        }
    } catch (e: any) {
        res.status(400).json({ "message": `Error: That recipe cannot be parsed! Sorry!`, "data": null });
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

        const docRef = await db.collection('recipes').add(recipeJson);

        res.status(200).json({ "message": "Success", "data": docRef.id })
    } catch (e: any) {
        res.status(500).json({ "message": "Error", "data": e.toString() })
    }
}
