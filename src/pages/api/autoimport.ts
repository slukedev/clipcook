import type { NextApiRequest, NextApiResponse } from 'next'
import * as cheerio from 'cheerio';
import parseIsoDuration from 'parse-iso-duration';
import Fraction from 'fraction.js';

export const config = {
    api: {
      responseLimit: false,
    },
}

function parseMs(ms: number) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    const secondsLeft = seconds % 60;
    const minutesLeft = minutes % 60;

    let timeString = "";

    if (hours > 0) {
        timeString += `${hours} hour${hours > 1 ? "s" : ""}, `;
    }

    if (minutesLeft > 0) {
        timeString += `${minutesLeft} minute${minutesLeft > 1 ? "s" : ""}, `;
    }

    if (secondsLeft > 0) {
        timeString += `${secondsLeft} second${secondsLeft > 1 ? "s" : ""}, `;
    }

    return timeString.slice(0, -2);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "GET") {
        res.status(405).json({ "message": "Error", "data": 'Method not allowed' })
    }

    const url = req.query.url || "";
    const idToken = req.headers.authorization || "";

    if (!url || !idToken || url === "" || idToken === "") {
        return res.status(400).json({ "message": "Error", "data": "Invalid parameters" });
    }

    let unparsedRecipeJson: any;
    let recipeJson: any = {};

    try {
        const fetchRequest = await fetch(url.toString());

        const fetchResponse = await fetchRequest.text();

        const $ = cheerio.load(fetchResponse);

        const recipe = $('script[type="application/ld+json"]').html();

        unparsedRecipeJson = JSON.parse(recipe || "{}");

        if (Array.isArray(unparsedRecipeJson)) {
            unparsedRecipeJson = unparsedRecipeJson[0];
        }

        try {
            const imageUrl = unparsedRecipeJson.image.url;
            const imageUrlData = await fetch(imageUrl);
            const buffer = await imageUrlData.arrayBuffer();
            const stringifiedBuffer = Buffer.from(buffer).toString('base64');
            const contentType = imageUrlData.headers.get('content-type');

            recipeJson["image"] = `data:${contentType};base64,${stringifiedBuffer}`;
        } catch (e: any) { }

        try {
            unparsedRecipeJson["headline"].toString();
            recipeJson["title"] = unparsedRecipeJson["headline"];
        } catch (e: any) { }

        try {
            unparsedRecipeJson["description"].toString();
            recipeJson["description"] = unparsedRecipeJson["description"];
        } catch (e: any) { }

        try {
            unparsedRecipeJson["recipeYield"][0].toString();
            recipeJson["servings"] = unparsedRecipeJson["recipeYield"][0];
        } catch (e: any) { }

        try {
            unparsedRecipeJson["prepTime"].toString();
            recipeJson["prepTime"] = parseMs(parseIsoDuration(unparsedRecipeJson["prepTime"]));
        } catch (e: any) { }

        try {
            unparsedRecipeJson["cookTime"].toString();
            recipeJson["cookTime"] = parseMs(parseIsoDuration(unparsedRecipeJson["cookTime"]));
        } catch (e: any) { }

        try {
            unparsedRecipeJson["totalTime"].toString();
            recipeJson["totalTime"] = parseMs(parseIsoDuration(unparsedRecipeJson["totalTime"]));
        } catch (e: any) { }

        try {
            unparsedRecipeJson["recipeIngredient"].toString();
            recipeJson["ingredients"] = unparsedRecipeJson["recipeIngredient"];
            recipeJson["ingredients"] = recipeJson["ingredients"].map((ingredient: string) => {
                return ingredient.replace(/-?\d+(\.\d+)?/g, n => eval(new Fraction(n).simplify(0.001).toFraction(true)))
            });
        } catch (e: any) { }

        try {
            unparsedRecipeJson["recipeInstructions"][0].toString();
            recipeJson["instructions"] = [];

            unparsedRecipeJson["recipeInstructions"].forEach((instruction: any) => {
                recipeJson["instructions"].push(instruction["text"]);
            });
        } catch (e: any) { }
    } catch (e: any) {
        res.status(400).json({ "message": "Error", "data": "Error: That recipe cannot be parsed! Sorry!" });
    }

    res.status(200).json({ "message": "Success", "data": recipeJson })
}
