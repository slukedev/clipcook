import Head from 'next/head'
import styles from '@/styles/Home.module.scss'
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon"
import { Ripple } from '@/components/ripple';
import { Checkbox } from '@/components/checkbox';
import { Button } from '@/components/button';
import { Review } from '@/components/review';
import { Spinner } from '@/components/spinner';
import { useRouter } from 'next/router';
import { Modal } from '@/components/modal';
import { Input } from '@/components/input';
import { Main } from '@/components/main';
import parseIsoDuration from 'parse-iso-duration';
import { Rating } from '@/components/rating';
import { AuthAction, useAuthUser, withAuthUser, withAuthUserTokenSSR, } from 'next-firebase-auth'
import { AnimatePresence, motion } from "framer-motion";
import Qty, { getAliases } from 'js-quantities';
import { hexFromArgb, themeFromImage } from "@material/material-color-utilities";

function hexToRgb(hex: string) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(
            result[3],
            16
        )}`
        : null;
}

let accentColor: string;
var themeGenerated = false;

export function Home(props: any) {
    const user = useAuthUser();
    const [step, setStep] = useState(1);
    const [servingsModal, setServingsModal] = useState(false);
    const [helpMenu, setHelpMenu] = useState<string | false>(false);
    const [helpMenuOutput, setHelpMenuOutput] = useState<any>(false);
    const [recipe, setRecipe] = useState<any>(false);

    const router = useRouter();
    const { id } = router.query;

    function checkInnerCheckbox(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        try {
            const checkbox = e.currentTarget.querySelector("input[type='checkbox']") as HTMLInputElement;

            checkbox.checked = !checkbox.checked;
        } catch (err) { }
    }

    function nextStep() {
        if (step < recipe.recipeInstructions.length) {
            setStep(step + 1);
        }
    }

    function prevStep() {
        if (step > 1) {
            setStep(step - 1);
        }
    }

    function servingsChange(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();

        const servings = parseInt((document.getElementById("servings") as HTMLInputElement)!.value.toString() || "-1");
        setServingsModal(false);

        if (servings > 0 && servings <= 100) {
            var newScale = servings / Number(recipe.recipeYield[0]);

            newScale = Math.round(newScale * 1000) / 1000;

            scaleRecipe(newScale);
        }
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

    function scaleRecipe(scale: number) {
        const scaledRecipe = JSON.parse(JSON.stringify(recipe));

        scaledRecipe.recipeYield[0] = [Math.round(Number(scaledRecipe.recipeYield[0]) * scale).toString()];
        scaledRecipe.recipeYield[1] = scale;

        scaledRecipe.recipeIngredient = scaledRecipe.recipeIngredient.map((ingredient: string) => {
            const amountRegex = /(\d+\/\d+|\d+\.\d+|\d+)/g;
            const amount = ingredient.match(amountRegex);

            if (amount !== null) {
                const amountType = ingredient.replace(amountRegex, "").replace(/\s/g, "");
                var newAmount = Number(amount[0]) * scale;

                newAmount = Math.round(newAmount * 1000) / 1000;

                return ingredient.replace(amountRegex, newAmount.toString()).replace(amountType, amountType);
            }

            return ingredient;
        });

        setRecipe(scaledRecipe);
    }

    function openHelpMenu() {
        setHelpMenu("home");
        setHelpMenuOutput(false);
    }

    function closeHelpMenu() {
        setHelpMenu(false);
        setHelpMenuOutput(false);
    }

    function changePage(name: string) {
        setHelpMenu(name);
        setHelpMenuOutput(false);
    }

    function convertValues() {
        try {
            const qty = new Qty((document.getElementById("convertValue") as HTMLInputElement).value);
            const possibleUnits = Qty.getUnits();
            const conversion: any = [];

            possibleUnits.forEach((unit: any) => {
                if (qty.isCompatible(unit)) {
                    const val = qty.to(unit).toPrec(0.0000001);
                    const obj: any = {};

                    obj["value"] = val.scalar;

                    let largestUnit = unit;
                    getAliases(unit).forEach((alias) => {
                        if (alias.length > largestUnit.length) {
                            largestUnit = alias;
                        }
                    });

                    obj["unit"] = largestUnit;

                    conversion.push(obj);
                }
            });

            setHelpMenuOutput(conversion);
        } catch (err: any) {
            setHelpMenuOutput([]);
        }
    }

    async function askQuestion() {
        try {
            setHelpMenuOutput("!!loading!!");

            const message = (document.getElementById("questionValue") as HTMLInputElement).value;

            const req = await fetch("https://api.betterapi.net/youdotcom/chat?" + new URLSearchParams({
                message: message,
                key: ""
            }));

            const res = await req.json();

            setHelpMenuOutput(res.message);
        } catch (err: any) {
            setHelpMenuOutput("Sorry, something went wrong (Belle might've eaten the wires). Just pressing the button again in a few seconds should fix this issue!");
        }
    }

    async function loadRecipe() {
        themeGenerated = false;

        const idToken = await user.getIdToken();

        const headers = new Headers();
        headers.append("authorization", idToken || "");

        const req = await fetch("/api/getrecipe?" + new URLSearchParams({
            recipeId: (id || "").toString()
        }), {
            method: "GET",
            headers: headers
        });

        const res = await req.json();

        setRecipe(res.data);

        genImage();
    }

    useEffect(() => {
        loadRecipe();

        if (!("wakeLock" in navigator)) {
            return;
        }

        try {
            if (document.visibilityState === "visible") {
                const wakeLockManager: any = navigator.wakeLock;
                const wakeLock = wakeLockManager.request("screen");
                wakeLock.start();
            }
        } catch (e: any) {
            console.log(e.toString())
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function genImage() {
        if (!themeGenerated && typeof document != "undefined" && document.getElementById("recipeImage") != null) {
            console.log("Generating theme... ")

            const imageElement = document.getElementById("recipeImage") as HTMLImageElement;
            const generatedTheme = await themeFromImage(imageElement);
            let theme = generatedTheme.schemes.dark;

            console.log(theme)

            accentColor = hexFromArgb(theme.primary);

            Object.keys(Object.entries(theme)[0][1]).forEach((prop: any) => {
                const color = Object.entries(theme)[0][1][prop];
                let colorCssName = prop.replace(/[^a-z]/g, function (letter: string) {
                    return "-" + letter.toLowerCase();
                });
                const colorHex = hexFromArgb(color);
                const colorRgb = hexToRgb(colorHex);

                document.body.style.setProperty(`--md-sys-color-${colorCssName}`, colorHex);
                document.body.style.setProperty(`--md-sys-color-${colorCssName}-dark`, colorHex);
                document.body.style.setProperty(`--md-sys-color-${colorCssName}-rgb`, colorRgb);
                document.body.style.setProperty(`--md-sys-color-${colorCssName}-rgb-dark`, colorRgb);

                console.log(hexFromArgb(color));
            });

            themeGenerated = true;
        }
    }

    if (!themeGenerated) {
        genImage();
    }

    return (
        <>
            <Head>
                <title>FoodMate - {recipe.name || "recipe"}</title>
                <meta name="description" content="A recipe clipper, based on the Material You design system!" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/favicon.ico" />
                <meta name="theme-color" content={accentColor || `#D0BCFF`} />
            </Head>

            <Main pageName="recipe" photoUrl={user.photoURL || undefined} useSvgLogo={true}>
                {
                    !recipe ? (
                        <motion.div key="loading" initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ease: "easeInOut", duration: 0.3 }} exit={{ opacity: 0 }} className={styles.loading}>
                            <h1>Loading recipe...</h1>
                            <Spinner />
                            <p>I wonder if Belle would approve...</p>
                        </motion.div>
                    ) : typeof recipe == "string" ? (
                        <motion.div key="error" initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ease: "easeInOut", duration: 0.3 }} exit={{ opacity: 0 }} className={styles.loading}>
                            <h1>Error, it looks like our kitchen assistant, Belle, has gotten into the recipes again.</h1>
                            <p>{recipe}</p>
                        </motion.div>
                    ) : (
                        <motion.div key="recipe" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ ease: "easeInOut", duration: 0.3 }} exit={{ opacity: 0 }}>
                            <div className={styles.header}>
                                <div>
                                    <h1>{recipe.name}</h1>
                                    <p>{recipe.description}</p>
                                    {
                                        recipe.aggregateRating ? (
                                            <div className={styles.otherinfo}>
                                                <div className={styles.rating}>
                                                    <Rating rating={Number(recipe.aggregateRating.ratingValue)} />
                                                    <span className={styles.recipeRatingCount}>{recipe.aggregateRating.ratingValue} ({Number(recipe.aggregateRating.ratingCount).toLocaleString()})</span>
                                                </div>
                                            </div>
                                        ) : null
                                    }

                                    <div className={styles.externalInfo}>
                                        {
                                            recipe.prepTime ? (
                                                <div className={styles.chip}>
                                                    <Icon className={styles.icon} name="countertops" fill="0" iconsize="18" />
                                                    <span>Prep Time: {parseMs(parseIsoDuration(recipe.prepTime))}</span>
                                                </div>
                                            ) : null
                                        }
                                        {
                                            recipe.cookTime ? (
                                                <div className={styles.chip}>
                                                    <Icon className={styles.icon} name="cooking" fill="0" iconsize="18" />
                                                    <span>Cook Time: {parseMs(parseIsoDuration(recipe.cookTime))}</span>
                                                </div>
                                            ) : null
                                        }
                                        {
                                            recipe.totalTime ? (
                                                <div className={styles.chip}>
                                                    <Icon className={styles.icon} name="schedule" fill="0" iconsize="18" />
                                                    <span>Total Time: {parseMs(parseIsoDuration(recipe.totalTime))}</span>
                                                </div>
                                            ) : null
                                        }
                                        <div className={styles.chip}>
                                            <Icon className={styles.icon} name="people" fill="0" iconsize="18" />
                                            <span>Servings: {recipe.recipeYield[0] + `${recipe.recipeYield[1] ? ` (${recipe.recipeYield[1]}x)` : ""}`}</span>
                                        </div>
                                    </div>
                                    <div className={styles.actions}>
                                        <Button onClick={() => setServingsModal(true)}>Change Servings</Button>
                                        <a target="_blank" href={recipe.mainEntityOfPage.breadcrumb.itemListElement[recipe.mainEntityOfPage.breadcrumb.itemListElement.length - 1].item["@id"]}>
                                            <Button>View Original Page</Button>
                                        </a>
                                    </div>
                                </div>
                                <div className={styles.image}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img id="recipeImage" src={recipe.image.url} alt={recipe.name} onLoad={genImage} />
                                </div>
                            </div>
                            <div className={styles.container}>
                                <h1 className={styles.title}>Ingredients</h1>
                                <div className={styles.ingredients}>
                                    {
                                        recipe.recipeIngredient.map((ingredient: any, index: number) => {
                                            return (
                                                <Ripple key={index.toString()} feather="10px" style={{ width: "100%", borderRadius: 8 }}>
                                                    <div className={styles.ingredient} onClick={checkInnerCheckbox}>
                                                        <div className={styles.ingredientName}>
                                                            <span>{ingredient}</span>
                                                        </div>
                                                        <div className={styles.ingredientCheckbox}>
                                                            <Checkbox readOnly disabled style={{ pointerEvents: "none" }} inputid={index.toString()} />
                                                        </div>
                                                    </div>
                                                </Ripple>
                                            )
                                        })
                                    }
                                </div>
                            </div>
                            <div className={styles.container}>
                                <h1 className={styles.title}>Directions</h1>

                                <span className={styles.direction}>{recipe.recipeInstructions[step - 1].text}</span>

                                <div className={styles.progress}>
                                    <div className={styles.progressbar} style={{ width: `${(step / recipe.recipeInstructions.length) * 100}%` }}></div>
                                </div>

                                <div className={styles.directionNavigator}>
                                    <Button onClick={prevStep} disabled={step <= 1}>Previous</Button>
                                    <h2>Step {step.toString()}/{recipe.recipeInstructions.length.toString()}</h2>
                                    <Button onClick={nextStep} disabled={step >= recipe.recipeInstructions.length}>{step >= recipe.recipeInstructions.length ? "Finished" : step == recipe.recipeInstructions.length - 1 ? "Finish" : "Next"}</Button>
                                </div>
                            </div>
                            {
                                recipe.nutrition ? (
                                    <div className={styles.container}>
                                        <h1 className={styles.title}>Nutrition</h1>

                                        <div className={styles.nutrition}>
                                            {
                                                Object.keys(recipe.nutrition).map((key: any, index: number) => {
                                                    if (key.charAt(0) == "@") return;

                                                    const nutrition: any = Object.values(recipe.nutrition)[index];

                                                    return (
                                                        <div key={key} className={styles.nutritionItem}>
                                                            <h2>{key.charAt(0).toUpperCase() + key.replace(/([A-Z])/g, " $1").slice(1)}</h2>
                                                            <span>{nutrition}</span>
                                                        </div>
                                                    )
                                                })
                                            }
                                        </div>
                                    </div>
                                ) : null}
                            {
                                !recipe.review || recipe.review.length < 0 ? null : (
                                    <div className={styles.container}>
                                        <h1 className={styles.title}>Comments</h1>
                                        {
                                            recipe.review.map((comment: any, index: number) => {
                                                return <Review key={index.toString()} review={comment.reviewBody} rating={comment.reviewRating.ratingValue} />
                                            })
                                        }
                                    </div>
                                )
                            }
                        </motion.div>
                    )
                }
            </Main>
            {!recipe || typeof recipe == "string" ? null : (
                <Modal opened={servingsModal} title="Change Servings" closefunction={() => setServingsModal(false)}>
                    <form onSubmit={servingsChange}>
                        <Input type="number" pattern="[0-9]*" onChange={(e) => {
                            const value = parseInt((e.target as HTMLInputElement).value);
                            if (value < 1) {
                                (e.target as HTMLInputElement).value = "1";
                            } else if (value > 100) {
                                (e.target as HTMLInputElement).value = "100";
                            }
                        }} inputMode="numeric" label="Servings" name="servings" id="servings" icon="people" min={1} max={100} fullwidth defaultValue={recipe.recipeYield[0]} />
                        <div style={{ width: "100%", height: 24 }}></div>
                        <Button>Set Servings</Button>
                    </form>
                </Modal>
            )}

            <div className={styles.fab}>
                <Ripple feather="5px" speedms={500}>
                    <button onClick={openHelpMenu}>
                        <Icon name="help" iconsize="24" />
                    </button>
                </Ripple>
            </div>

            <AnimatePresence>
                {
                    helpMenu ? (
                        <motion.div key="helpmenu" initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ease: "easeInOut", duration: 0.1 }} exit={{ opacity: 0 }} className={`${styles.sheet} ${styles.options}`}>
                            <div className={styles.top}>
                                {
                                    helpMenu != "home" ? <Button onClick={() => changePage("home")}>Back</Button> : null
                                }
                                <span>Help Menu</span>
                                <Button onClick={closeHelpMenu}>Close</Button>
                            </div>
                            <AnimatePresence mode="popLayout">
                                {
                                    helpMenu == "home" ? (
                                        <motion.div key="home" initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ ease: "easeInOut", duration: 0.3 }} exit={{ x: -30, opacity: 0 }}>
                                            <Button onClick={() => changePage("convert")}>Convert Measurement</Button>
                                            <Button onClick={() => changePage("ai")}>Ask An AI</Button>
                                        </motion.div>
                                    ) : helpMenu == "ai" ? (
                                        <motion.div key="ai" initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ ease: "easeInOut", duration: 0.3 }} exit={{ x: -30, opacity: 0 }}>
                                            <div className={styles.initialValue}>
                                                <Input id="questionValue" autoComplete="off" label="Question" name="questionValue" type="text" placeholder="Ex: What is a substitute for baking soda?" icon="chat" />
                                                <Button onClick={askQuestion}>Ask!</Button>
                                            </div>
                                            <div style={{ textAlign: "center" }}>
                                                {
                                                    typeof helpMenuOutput != "string" ? null : helpMenuOutput == "!!loading!!" ? (
                                                        <>
                                                            <p>Asking...</p>
                                                            <Spinner style={{ width: 100, height: 100, display: "block", marginLeft: "auto", marginRight: "auto" }} />
                                                            <p>Hopefully this AI is smarter than Belle!</p>
                                                        </>
                                                    ) : (
                                                        <p style={{ whiteSpace: 'pre-wrap' }}>{helpMenuOutput.toString()}</p>
                                                    )
                                                }
                                            </div>
                                        </motion.div>
                                    ) : helpMenu == "convert" ? (
                                        <motion.div key="convert" initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ ease: "easeInOut", duration: 0.3 }} exit={{ x: -30, opacity: 0 }}>
                                            <div className={styles.initialValue}>
                                                <Input id="convertValue" autoComplete="off" label="Value" name="convertValue" type="text" placeholder="Ex: 10 tablespoons" icon="scale" />
                                                <Button onClick={convertValues}>Convert!</Button>
                                            </div>
                                            <div>
                                                {
                                                    typeof helpMenuOutput == "boolean" ? null : helpMenuOutput.length == 0 ? (
                                                        <h1>That unit was not found</h1>
                                                    ) : (
                                                        <ul style={{ width: "auto !important" }}>
                                                            {
                                                                helpMenuOutput.map((item: any, index: number) => (
                                                                    <li key={index}>{item.value} {item.unit}</li>
                                                                ))
                                                            }
                                                        </ul>
                                                    )
                                                }
                                            </div>
                                        </motion.div>
                                    ) : null
                                }
                            </AnimatePresence>
                        </motion.div>
                    ) : null
                }
            </AnimatePresence>
        </>
    )
}

export const getServerSideProps = withAuthUserTokenSSR({ whenUnauthed: AuthAction.REDIRECT_TO_LOGIN })()
export default withAuthUser({ whenUnauthedBeforeInit: AuthAction.REDIRECT_TO_LOGIN, })(Home)