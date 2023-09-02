import Head from 'next/head'
import styles from '@/styles/Home.module.scss'
import { useState } from 'react';
import { Main } from '@/components/main';
import { Input } from '@/components/input';
import { Modal } from '@/components/modal';
import { Ripple } from '@/components/ripple';
import { Button } from '@/components/button';
import { AuthAction, useUser, withUser, withUserTokenSSR } from 'next-firebase-auth'
import { Spinner } from '@/components/spinner';
import { useRouter } from 'next/router';
import { Textarea } from '@/components/textarea';

function getNumberWithOrdinal(n: number) {
    var s = ["th", "st", "nd", "rd"],
        v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function Home() {
    const user = useUser();
    const router = useRouter();
    const [ingredients, setIngredients] = useState<string[]>([""])
    const [instructions, setInstructions] = useState<string[]>([""])
    const [autoimportOpen, setAutoimportOpen] = useState(false)
    const [creating, setCreating] = useState(false);
    const [clipping, setClipping] = useState(false);
    const [image, setImage] = useState<any>(false);

    function changeIngredient(index: number, value: string) {
        let newIngredients = [...ingredients]
        newIngredients[index] = value
        setIngredients(newIngredients)
    }

    function changeInstruction(index: number, value: string) {
        let newInstructions = [...instructions]
        newInstructions[index] = value
        setInstructions(newInstructions)
    }


    function changeImage() {
        const file = (document.getElementById("image") as HTMLInputElement).files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            setImage(e.target?.result);
        }
        reader.readAsDataURL(file);
    }

    async function clip(e: any) {
        e.preventDefault();

        const url = (document.getElementById("clipurl") as HTMLInputElement).value;

        setClipping(true);

        const idToken = await user.getIdToken();

        const headers = new Headers();
        headers.append("authorization", idToken || "");

        const req = await fetch("/api/autoimport?" + new URLSearchParams({
            url: url
        }), {
            method: "GET",
            headers: headers
        });

        const res = await req.json();

        if (res.message != "Success" || !res.data) {
            setClipping(false);

            return alert(res.data)
        }

        const recipe = res.data;

        (document.getElementById("title") as HTMLInputElement).value = recipe.title;
        (document.getElementById("description") as HTMLInputElement).value = recipe.description;
        (document.getElementById("servings") as HTMLInputElement).value = recipe.servings;
        (document.getElementById("prepTime") as HTMLInputElement).value = recipe.prepTime;
        (document.getElementById("cookTime") as HTMLInputElement).value = recipe.cookTime;
        (document.getElementById("totalTime") as HTMLInputElement).value = recipe.totalTime;
        setImage(recipe.image);

        setIngredients(recipe.ingredients);
        setInstructions(recipe.instructions);

        (document.getElementById("notes") as HTMLInputElement).value = "Clipped from " + url + "\n";

        setClipping(false);

        setAutoimportOpen(false);
    }

    async function create() {
        const title = (document.getElementById("title") as HTMLInputElement).value;
        const description = (document.getElementById("description") as HTMLInputElement).value;
        const servings = (document.getElementById("servings") as HTMLInputElement).value;
        const prepTime = (document.getElementById("prepTime") as HTMLInputElement).value;
        const cookTime = (document.getElementById("cookTime") as HTMLInputElement).value;
        const totalTime = (document.getElementById("totalTime") as HTMLInputElement).value;
        const notes = (document.getElementById("notes") as HTMLInputElement).value;
        const finalImage = image;
        var finalIngredients = [...ingredients]
        var finalInstructions = [...instructions]

        finalIngredients = finalIngredients.filter((ingredient) => ingredient != "");
        finalInstructions = finalInstructions.filter((instruction) => instruction != "");

        console.log(title != "", description != "", servings != "", prepTime != "", cookTime != "", totalTime != "", finalImage != false, finalIngredients.length >= 1, finalInstructions.length >= 1)

        if (title != "" && description != "" && servings != "" && prepTime != "" && cookTime != "" && totalTime != "" && finalImage != false && finalIngredients.length >= 1 && finalInstructions.length >= 1) {
            setCreating(true);

            const recipe = {
                recipe: {
                    image: finalImage,
                    title: title,
                    description: description,
                    servings: servings,
                    prepTime: prepTime,
                    cookTime: cookTime,
                    totalTime: totalTime,
                    notes: notes,
                    ingredients: finalIngredients,
                    instructions: finalInstructions
                }
            }

            const idToken = await user.getIdToken();

            const headers = new Headers();
            headers.append("authorization", idToken || "");

            const req = await fetch("/api/createrecipe", {
                method: "POST",
                headers: headers,
                body: JSON.stringify(recipe)
            });

            const res = await req.json();

            if (res.message != "Success" || !res.data) {
                setCreating(false);

                await new Promise(resolve => setTimeout(resolve, 250));

                (document.getElementById("title") as HTMLInputElement).value = title;
                (document.getElementById("description") as HTMLInputElement).value = description;
                (document.getElementById("servings") as HTMLInputElement).value = servings;
                (document.getElementById("prepTime") as HTMLInputElement).value = prepTime;
                (document.getElementById("cookTime") as HTMLInputElement).value = cookTime;
                (document.getElementById("totalTime") as HTMLInputElement).value = totalTime;
                (document.getElementById("notes") as HTMLInputElement).value = notes;

                return alert(res.data)
            }

            router.push(`/recipe/${res.data}`)
        } else {
            return alert("Please fill out all required fields")
        }
    }

    return (
        <>
            <Head>
                <title>ClipCook</title>
                <meta name="description" content="A recipe clipper, based on the Material You design system!" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/favicon.ico" />
                <meta name="theme-color" content="#D0BCFF" />
            </Head>
            <Main pageName="create" photoUrl={user.photoURL || undefined}>
                {
                    creating ? (
                        <div className={styles.loading} style={{ marginTop: 25 }}>
                            <h1>Creating</h1>
                            <Spinner />
                            <p>Belle is going to love this! (except if it is sardines in spaghetti)</p>
                        </div>
                    ) : (
                        <>
                            <h1>Create a recipe</h1>

                            <Button onClick={() => setAutoimportOpen(true)}>Autoimport from URL</Button>

                            <h2>Recipe Information</h2>

                            <div className={styles.imageUploadContainer}>
                                <Ripple feather="25px" speedms={500}>
                                    <button className={styles.imageUploadButton} onClick={() => document.getElementById("image")?.click()}>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        {image ? <img style={{ width: "101%" }} src={image} alt="Image" /> : <span>Upload Image</span>}
                                    </button>
                                </Ripple>
                            </div>

                            <input onChange={() => changeImage()} style={{ display: "none" }} hidden type="file" accept="image/*" name="image" id="image" />

                            <div className={styles.createInputs}>
                                <div className={styles.inputGroup}>
                                    <Input id="title" fullwidth label="Recipe Title" placeholder="Ex: Meats" type="text" name="title" icon="title" autoComplete="off" />
                                    <Input id="servings" label="Servings" placeholder="Ex: 10" type="number" name="servings" icon="people" autoComplete="off" />
                                </div>
                                <div className={styles.inputGroup}>
                                    <Textarea id="description" fullwidth label="Recipe Description" placeholder="Ex: A good thing" type="text" name="description" icon="description" autoComplete="off" />
                                </div>
                                <div className={styles.inputGroup}>
                                    <Input fullwidth id="prepTime" label="Prep Time" placeholder="Ex: 10 minutes" type="text" name="prepTime" icon="timer" autoComplete="off" />
                                    <Input fullwidth id="cookTime" label="Cook Time" placeholder="Ex: 10 minutes" type="text" name="cookTime" icon="timer" autoComplete="off" />
                                    <Input fullwidth id="totalTime" label="Total Time" placeholder="Ex: 10 minutes" type="text" name="totalTime" icon="timer" autoComplete="off" />
                                </div>
                                <Textarea id="notes" fullwidth label="Recipe Notes" placeholder="Ex: https://google.com/" type="text" name="title" icon="title" autoComplete="off" />
                            </div>

                            <h2>Ingredients (Please use decimals instead of fractions)</h2>
                            <div className={styles.createInputs}>
                                {
                                    ingredients.map((ingredient, index) => {
                                        return <Input defaultValue={ingredient} key={index} onChange={(e) => changeIngredient(index, (e.target as HTMLInputElement).value)} label="Ingredient" placeholder="Ex: 1 cup of flour" type="text" name="ingredients" icon="icecream" autoComplete="off" />
                                    })
                                }
                                <Button onClick={() => setIngredients([...ingredients, ""])}>Add Ingredient</Button>
                            </div>

                            <h2>Instructions</h2>
                            <div className={styles.createInputs}>
                                {
                                    instructions.map((instruction, index) => {
                                        return (
                                            <Input key={index} defaultValue={instruction} fullwidth onChange={(e) => changeInstruction(index, (e.target as HTMLInputElement).value)} label={`${getNumberWithOrdinal(index + 1)} step`} placeholder="Ex: Mix the flour" type="text" name="ingredients" icon="task" autoComplete="off" />
                                        )
                                    })
                                }
                                <Button onClick={() => setInstructions([...instructions, ""])}>Add Step</Button>
                            </div>

                            <div className={styles.createDiv}>
                                <Button onClick={() => create()}>Create Recipe!</Button>
                            </div>
                            <Modal opened={autoimportOpen} title="Clip URL" closefunction={() => !clipping ? setAutoimportOpen(false) : null}>
                                <form onSubmit={clip}>
                                    {
                                        clipping ? (
                                            <div style={{ display: "block", marginLeft: "auto", marginRight: "auto", width: "fit-content" }}>
                                                <Spinner />
                                            </div>
                                        ) : (
                                            <>
                                                <Input type="url" label="URL" name="url" id="clipurl" icon="attachment" fullwidth autoComplete="off" />
                                                <div style={{ width: "100%", height: 24 }}></div>
                                                <Button>Clip</Button>
                                            </>
                                        )
                                    }

                                </form>
                            </Modal>
                        </>
                    )
                }
            </Main>
        </>
    )
}

export const getServerSideProps = withUserTokenSSR({ whenUnauthed: AuthAction.REDIRECT_TO_LOGIN })()
export default withUser({ whenUnauthedBeforeInit: AuthAction.REDIRECT_TO_LOGIN })(Home)