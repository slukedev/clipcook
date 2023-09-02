import Head from 'next/head'
import styles from '@/styles/Home.module.scss'
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon"
import { Ripple } from '@/components/ripple';
import { Checkbox } from '@/components/checkbox';
import { Button } from '@/components/button';
import { Spinner } from '@/components/spinner';
import { useRouter } from 'next/router';
import { Modal } from '@/components/modal';
import { Input } from '@/components/input';
import { Main } from '@/components/main';
import { AuthAction, useUser, withUser, withUserTokenSSR } from 'next-firebase-auth'
import { AnimatePresence, motion } from "framer-motion";
import Qty, { getAliases } from 'js-quantities';
import { hexFromArgb, themeFromImage } from "@material/material-color-utilities";
import Fraction from 'fraction.js';
import Link from 'next/link';

function hexToRgb(hex: string) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(
            result[3],
            16
        )}`
        : null;
}

function unescape(str: string) {
    return str.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
}

let accentColor: string;
var themeGenerated = false;

export function Home(props: any) {
    const user = useUser();
    const [servingsModal, setServingsModal] = useState(false);
    const [helpMenu, setHelpMenu] = useState<string | false>(false);
    const [helpMenuOutput, setHelpMenuOutput] = useState<any>(false);
    const [recipe, setRecipe] = useState<any>(false);
    const [servings, setServings] = useState(-1);
    const [servingsScale, setServingsScale] = useState(1);

    const router = useRouter();
    const { id } = router.query;

    function checkInnerCheckbox(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        try {
            const checkbox = e.currentTarget.querySelector("input[type='checkbox']") as HTMLInputElement;
            let text;

            if (e.currentTarget.classList.contains("instruction")) {
                text = e.currentTarget.querySelector(".instruction") as HTMLSpanElement;
            } else {
                text = e.currentTarget.querySelector("span") as HTMLSpanElement;
            }

            if (!checkbox.checked) {
                text.setAttribute('style', 'color: var(--primary); text-decoration: line-through;');
            } else {
                text.setAttribute('style', '');
            }

            checkbox.checked = !checkbox.checked;
        } catch (err) { }
    }

    function servingsChange(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();

        const servings = parseInt((document.getElementById("servings") as HTMLInputElement)!.value.toString() || "-1");
        setServingsModal(false);

        setServingsScale(servingsScale)

        if (servings > 0 && servings <= 100) {
            var newScale = servings / Number(recipe.servings);

            newScale = Math.round(newScale * 1000) / 1000;

            setServingsScale(newScale);
        }

        setServings(servings);
    }

    function getIngredientScale(ingredient: string) {
        const amountRegex = /(\d+\/\d+|\d+\.\d+|\d+)/g;
        const amount = ingredient.match(amountRegex);

        if (amount !== null) {
            const amountType = ingredient.replace(amountRegex, "").replace(/\s/g, "");
            var newAmount = Number(amount[0]) * servingsScale;

            newAmount = Math.round(newAmount * 1000) / 1000;

            return ingredient.replace(amountRegex, newAmount.toString()).replace(amountType, amountType);
        }

        return ingredient;
    }

    function openHelpMenu() {
        setHelpMenu("home");
        setHelpMenuOutput(false);
    }

    function closeHelpMenu() {
        setHelpMenu(false);
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

    async function loadRecipe() {
        themeGenerated = false;

        const idToken = await user.getIdToken();

        const headers = new Headers();
        headers.append("authorization", idToken || "");

        console.log("Loading")

        const req = await fetch("/api/getrecipe?" + new URLSearchParams({
            recipeId: (id || "").toString()
        }), {
            method: "GET",
            headers: headers
        });

        const res = await req.json();

        setRecipe(res.data);

        setServings(res.data.servings);

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
                <title>ClipCook - {recipe.title || "recipe"}</title>
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
                                    <h1>{recipe.title}</h1>
                                    <p>{recipe.description}</p>
                                    <div className={styles.externalInfo}>
                                        <div className={styles.chip}>
                                            <Icon className={styles.icon} name="countertops" fill="0" iconsize="18" />
                                            <span>Prep Time: {recipe.prepTime}</span>
                                        </div>
                                        <div className={styles.chip}>
                                            <Icon className={styles.icon} name="cooking" fill="0" iconsize="18" />
                                            <span>Cook Time: {recipe.cookTime}</span>
                                        </div>
                                        <div className={styles.chip}>
                                            <Icon className={styles.icon} name="schedule" fill="0" iconsize="18" />
                                            <span>Total Time: {recipe.totalTime}</span>
                                        </div>
                                        <div className={styles.chip}>
                                            <Icon className={styles.icon} name="people" fill="0" iconsize="18" />
                                            <span>Servings: {servings + `${servingsScale != 1 ? ` (${servingsScale}x)` : ""}`}</span>
                                        </div>
                                    </div>
                                    <div className={styles.actions}>
                                        <Button onClick={() => setServingsModal(true)}>Change Servings</Button>
                                        <Link href={`/edit/${id}`} passHref>
                                            <Button>Edit Recipe</Button>
                                        </Link>
                                    </div>
                                </div>
                                <div style={{ borderRadius: "16px 0 0 16px" }} className={styles.image}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img style={{ borderRadius: "16px 0 0 16px" }} id="recipeImage" src={recipe.image} alt={recipe.title} onLoad={genImage} />
                                </div>
                            </div>
                            <div className={styles.container}>
                                <h1 className={styles.title}>Ingredients</h1>
                                <div className={styles.ingredients}>
                                    {
                                        recipe.ingredients.map((ingredient: any, index: number) => {
                                            return (
                                                <Ripple key={index.toString()} feather="10px" style={{ width: "100%", borderRadius: 8 }}>
                                                    <div className={styles.ingredient} onClick={checkInnerCheckbox}>
                                                        <div className={styles.ingredientName}>
                                                            <span>{unescape(getIngredientScale(ingredient)).replace(/-?\d+(\.\d+)?/g, n => new Fraction(n).simplify(0.001).toFraction(true))}</span>
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

                                <div className={styles.ingredients}>
                                    {
                                        recipe.instructions.map((ingredient: any, index: number) => {
                                            return (
                                                <Ripple key={index.toString()} feather="10px" style={{ width: "100%", borderRadius: 8 }}>
                                                    <div className={`${styles.ingredient} instruction`} onClick={checkInnerCheckbox}>
                                                        <div className={styles.directionNumber}>
                                                            <span className={`${styles.number} number`}>{index + 1}</span>
                                                            <svg width="120" height="120">
                                                                <path d="M0.839206 40.5976C-4.14625 17.3914 16.4721 -3.42453 40.5835 0.47246L54.2854 2.68703C58.0691 3.29855 61.931 3.29855 65.7146 2.68703L79.4165 0.47246C103.528 -3.42453 124.146 17.3914 119.161 40.5976L116.514 52.9168C115.54 57.4515 115.54 62.1322 116.514 66.6669L119.251 79.4036C124.211 102.496 103.809 123.261 79.7848 119.573L65.436 117.37C61.8344 116.817 58.1656 116.817 54.564 117.37L40.2152 119.573C16.1906 123.261 -4.21146 102.496 0.749499 79.4036L3.48578 66.6669C4.45997 62.1322 4.45998 57.4515 3.48578 52.9168L0.839206 40.5976Z" />
                                                            </svg>
                                                        </div>
                                                        <div className={styles.ingredientName}>
                                                            <span className="instruction">{ingredient}</span>
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
                            {
                                recipe.notes.length > 0 ? (
                                    <div className={styles.container}>
                                        <h1 className={styles.title}>Notes</h1>

                                        <p>{recipe.notes}</p>
                                    </div>
                                ) : null
                            }
                        </motion.div>
                    )
                }
            </Main >
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
                        }} inputMode="numeric" label="Servings" name="servings" id="servings" icon="people" min={1} max={100} fullwidth defaultValue={servings.toString()} />
                        <div style={{ width: "100%", height: 24 }}></div>
                        <Button>Set Servings</Button>
                    </form>
                </Modal>
            )
            }

            <div className={styles.fab}>
                <Ripple feather="5px" speedms={500}>
                    <button onClick={openHelpMenu}>
                        <Icon name="scale" iconsize="24" />
                    </button>
                </Ripple>
            </div>

            <AnimatePresence>
                {
                    helpMenu ? (
                        <motion.div key="helpmenu" initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ease: "easeInOut", duration: 0.1 }} exit={{ opacity: 0 }} className={`${styles.sheet} ${styles.options}`}>
                            <div className={styles.top}>
                                <span>Conversion Menu</span>
                                <Button onClick={closeHelpMenu}>Close</Button>
                            </div>
                            <AnimatePresence mode="popLayout">
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
                                                        <li key={index}>{new Fraction(item.value).simplify(0.001).toFraction(true)} {item.unit}</li>
                                                    ))
                                                }
                                            </ul>
                                        )
                                    }
                                </div>
                            </AnimatePresence>
                        </motion.div>
                    ) : null
                }
            </AnimatePresence>
        </>
    )
}

export const getServerSideProps = withUserTokenSSR({ whenUnauthed: AuthAction.REDIRECT_TO_LOGIN })()
export default withUser({ whenUnauthedBeforeInit: AuthAction.REDIRECT_TO_LOGIN })(Home)