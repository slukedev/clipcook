import Head from 'next/head'
import styles from '@/styles/Home.module.scss'
import { useEffect, useState } from 'react';
import { Main } from '@/components/main';
import { Recipe } from '@/components/recipe';
import { Input } from '@/components/input';
import { Icon } from '@/components/icon';
import { Ripple } from '@/components/ripple';
import { AuthAction, useUser, withUser, withUserTokenSSR } from 'next-firebase-auth'
import { Spinner } from '@/components/spinner';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, where, getDocs, query } from "firebase/firestore";

export function Home() {
    const user = useUser()
    const [recipes, setRecipes] = useState<any>({});
    const [filteredRecipes, setFilteredRecipes] = useState<any>(-1);

    const firebaseConfig = {
        apiKey: "AIzaSyAlg5bcO368inwAQwIBNlespVC3mPfs8Qw",
        authDomain: "clipcook-59c6b.firebaseapp.com",
        projectId: "clipcook-59c6b",
        storageBucket: "clipcook-59c6b.appspot.com",
        messagingSenderId: "958728612297",
        appId: "1:958728612297:web:04335a54632029b2726018"
    };

    const app = initializeApp(firebaseConfig);

    const db = getFirestore();

    function search(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.value.length > 0) {
            const filtered = recipes.filter((recipe: any) => {
                const title = recipe.title.toLowerCase();
                const search = e.target.value.toLowerCase();

                recipe.boldIndexes = [];

                for (let i = 0; i < search.length; i++) {
                    if (title.indexOf(search[i]) === -1) {
                        return false;
                    }

                    recipe.boldIndexes.push(title.indexOf(search[i]));
                }

                return true;
            });

            setFilteredRecipes(filtered);
        } else {
            for (let i = 0; i < recipes.length; i++) {
                recipes[i].boldIndexes = [];
            }

            setFilteredRecipes(recipes);
        }
    }

    async function loadRecipes() {
        // const idToken = await user.getIdToken();

        // const headers = new Headers();
        // headers.append("authorization", idToken || "");

        // const req = await fetch("/api/getrecipes", {
        //     method: "GET",
        //     headers: headers
        // });

        // const res = await req.json();

        // if (res.message != "Success") {
        //     alert(res.data);
        //     return;
        // }

        // for (let i = 0; i < res.data.length; i++) {
        //     res.data[i].boldIndexes = [];
        // }

        // setRecipes(res.data);
        // setFilteredRecipes(res.data);

        const recipesRef = query(collection(db, 'allRecipes'), where("uid", "==", user.id));
        const recipeSnapshot = await getDocs(recipesRef);
        let data: any = [];

        recipeSnapshot.forEach((doc) => {
            const recipeData = doc.data();

            data.push({
                id: doc.id,
                title: recipeData.title,
                image: recipeData.image
            });
        });


        for (let i = 0; i < data.length; i++) {
            data[i].boldIndexes = [];
        }

        setRecipes(data);
        setFilteredRecipes(data);
    }

    useEffect(() => {
        loadRecipes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <>
            <Head>
                <title>ClipCook</title>
                <meta name="description" content="A recipe clipper, based on the Material You design system!" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/favicon.ico" />
                <meta name="theme-color" content="#D0BCFF" />
            </Head>
            <Main pageName="index" photoUrl={user.photoURL || undefined}>
                <h1>Welcome, {user.displayName}!</h1>
                {
                    filteredRecipes == -1 ? <></> : <Input onInput={search} label="Search" name="search" type="text" icon="search" />
                }
                <div className={styles.recipes}>
                    {
                        filteredRecipes == -1 ? (
                            <motion.div key="loading" initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ease: "easeInOut", duration: 0.3 }} exit={{ opacity: 0 }} className={styles.loading}>
                                <h1>Loading recipes...</h1>
                                <Spinner />
                                <p>And chasing Belle off the counter...</p>
                            </motion.div>
                        ) : filteredRecipes.length === 0 ? (
                            <motion.div key="error" initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ease: "easeInOut", duration: 0.3 }} exit={{ opacity: 0 }} className={styles.couldntFind}>
                                <Icon name="sound_detection_dog_barking" iconsize="128" />
                                <h1>Sorry, we couldn&apos;t find anything that matches</h1>
                                <p>We put our best searcher out and she came back with crumbs on her face, but no food to be found</p>
                            </motion.div>
                        ) : (
                            <motion.div style={{ overflowX: "hidden" }} key="recipes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ ease: "easeInOut", duration: 0.3 }} exit={{ opacity: 0 }}>
                                {
                                    filteredRecipes.map((recipe: any) => {
                                        return (
                                            <Recipe key={recipe.id} id={recipe.id.toString()} title={recipe.title} image={recipe.image} boldindexes={recipe.boldIndexes} />
                                        )
                                    })
                                }
                            </motion.div>
                        )
                    }
                </div>
            </Main>

            <Link href="/create" passHref>
                <div className={styles.fab}>
                    <Ripple feather="5px" speedms={500}>
                        <button>
                            <Icon name="add" iconsize="24" />
                        </button>
                    </Ripple>
                </div>
            </Link>
        </>
    )
}

export const getServerSideProps = withUserTokenSSR({ whenUnauthed: AuthAction.REDIRECT_TO_LOGIN })()
export default withUser({ whenUnauthedBeforeInit: AuthAction.REDIRECT_TO_LOGIN })(Home)