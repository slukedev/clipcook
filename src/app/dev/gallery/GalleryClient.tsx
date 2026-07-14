'use client'

import { useState } from 'react'
import { useTheme } from '@/components/theme/theme-provider'
import {
    AlertDialog,
    AlertDialogActions,
    AlertDialogBody,
    AlertDialogClose,
    AlertDialogContent,
    AlertDialogHeadline,
    AlertDialogTrigger,
    Avatar,
    BottomSheet,
    BottomSheetContent,
    BottomSheetTitle,
    BottomSheetTrigger,
    Button,
    Card,
    Checkbox,
    Chip,
    Dialog,
    DialogActions,
    DialogBody,
    DialogClose,
    DialogContent,
    DialogHeadline,
    DialogTrigger,
    EmptyState,
    Fab,
    Icon,
    IconButton,
    LinearProgress,
    ListItem,
    LoadingIndicator,
    Menu,
    MenuContent,
    MenuItem,
    MenuSeparator,
    MenuTrigger,
    NumberField,
    SearchBar,
    SnackbarProvider,
    Switch,
    TextField,
    Tooltip,
    TopAppBar,
    useSnackbar,
} from '@/components/ui'
import styles from './gallery.module.scss'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{title}</h2>
            <div className={styles.row}>{children}</div>
        </section>
    )
}

function SnackbarDemo() {
    const snackbar = useSnackbar()
    return (
        <>
            <Button variant="tonal" onClick={() => snackbar.show('Recipe saved to your collection')}>
                Show snackbar
            </Button>
            <Button
                variant="outlined"
                onClick={() => snackbar.show('Recipe deleted', { action: { label: 'Undo', onClick: () => undefined } })}
            >
                With action
            </Button>
        </>
    )
}

export function GalleryClient() {
    const { preference, setPreference } = useTheme()
    const [search, setSearch] = useState('')
    const [checked, setChecked] = useState(true)
    const [selectedChip, setSelectedChip] = useState('Dinner')

    return (
        <SnackbarProvider>
            <TopAppBar
                title="Component gallery"
                trailing={
                    <IconButton
                        icon={preference === 'dark' ? 'light_mode' : 'dark_mode'}
                        label="Toggle theme"
                        onClick={() => setPreference(preference === 'dark' ? 'light' : 'dark')}
                    />
                }
            />
            <main className={styles.main}>
                <Section title="Buttons">
                    <Button>Filled</Button>
                    <Button variant="tonal">Tonal</Button>
                    <Button variant="elevated">Elevated</Button>
                    <Button variant="outlined">Outlined</Button>
                    <Button variant="text">Text</Button>
                    <Button icon="add">With icon</Button>
                    <Button disabled>Disabled</Button>
                    <Button size="large" icon="restaurant">
                        Large hero
                    </Button>
                </Section>

                <Section title="Icon buttons">
                    <IconButton icon="edit" label="Edit" />
                    <IconButton icon="bookmark" label="Save" variant="filled" />
                    <IconButton icon="bookmark" label="Save" variant="filled" selected />
                    <IconButton icon="timer" label="Timer" variant="tonal" />
                    <IconButton icon="link" label="Link" variant="outlined" />
                    <IconButton icon="delete" label="Delete" disabled />
                </Section>

                <Section title="FAB">
                    <Fab icon="add" aria-label="New recipe" />
                    <Fab icon="add" label="New recipe" />
                    <Fab icon="edit" label="Edit" color="secondary" />
                    <Fab icon="scale" aria-label="Convert" color="tertiary" />
                </Section>

                <Section title="Chips">
                    {['Dinner', 'Dessert', 'Quick', 'Vegetarian'].map((label) => (
                        <Chip key={label} selected={selectedChip === label} onClick={() => setSelectedChip(label)}>
                            {label}
                        </Chip>
                    ))}
                    <Chip icon="schedule">45 min</Chip>
                    <Chip icon="group">4 servings</Chip>
                </Section>

                <Section title="Selection">
                    <Checkbox label="Ingredients gathered" checked={checked} onCheckedChange={setChecked} />
                    <Checkbox label="Preheated" defaultChecked={false} />
                    <Checkbox label="Disabled" disabled />
                    <Switch label="Keep screen awake" defaultChecked />
                    <Switch label="Disabled" disabled />
                </Section>

                <Section title="Text fields">
                    <TextField label="Recipe title" supportingText="Give it a memorable name" />
                    <TextField label="Source URL" variant="outlined" leadingIcon="link" />
                    <TextField label="Notes" multiline rows={3} />
                    <TextField label="Servings" errorText="Must be a number" defaultValue="four" />
                    <TextField label="Disabled" disabled />
                </Section>

                <Section title="Search & stepper">
                    <SearchBar value={search} onChange={setSearch} placeholder="Search your recipes" />
                    <NumberField label="Servings" defaultValue={4} min={1} max={99} />
                </Section>

                <Section title="Cards">
                    <Card className={styles.demoCard}>
                        <div className={styles.demoCardBody}>
                            <h3>Elevated card</h3>
                            <p>Surface container low with level-1 shadow.</p>
                        </div>
                    </Card>
                    <Card variant="filled" className={styles.demoCard}>
                        <div className={styles.demoCardBody}>
                            <h3>Filled card</h3>
                            <p>Surface container highest.</p>
                        </div>
                    </Card>
                    <Card variant="outlined" href="#cards" className={styles.demoCard} aria-label="Outlined card demo">
                        <div className={styles.demoCardBody}>
                            <h3>Outlined + interactive</h3>
                            <p>Press me ripple and shape morph.</p>
                        </div>
                    </Card>
                </Section>

                <Section title="List items">
                    <div className={styles.listDemo}>
                        <ListItem
                            leading={<Icon name="restaurant" />}
                            headline="Weeknight carbonara"
                            supportingText="25 min · 4 servings"
                            trailing={<Icon name="keyboard_arrow_down" />}
                            onClick={() => undefined}
                        />
                        <ListItem
                            leading={<Avatar name="Belle Cat" />}
                            headline="Belle's favorite salmon"
                            supportingText="Clipped from seriouseats.com"
                        />
                    </div>
                </Section>

                <Section title="Progress">
                    <LinearProgress value={65} label="Uploading" />
                    <LinearProgress label="Working" />
                    <LoadingIndicator />
                </Section>

                <Section title="Dialogs & sheets">
                    <Dialog>
                        <DialogTrigger render={<Button variant="outlined">Basic dialog</Button>} />
                        <DialogContent>
                            <DialogHeadline>Reset checklist?</DialogHeadline>
                            <DialogBody>All checked ingredients and steps will be unchecked.</DialogBody>
                            <DialogActions>
                                <DialogClose render={<Button variant="text">Cancel</Button>} />
                                <DialogClose render={<Button variant="text">Reset</Button>} />
                            </DialogActions>
                        </DialogContent>
                    </Dialog>
                    <AlertDialog>
                        <AlertDialogTrigger render={<Button variant="outlined">Alert dialog</Button>} />
                        <AlertDialogContent>
                            <AlertDialogHeadline>Delete this recipe?</AlertDialogHeadline>
                            <AlertDialogBody>This permanently removes it from your collection.</AlertDialogBody>
                            <AlertDialogActions>
                                <AlertDialogClose render={<Button variant="text">Cancel</Button>} />
                                <AlertDialogClose render={<Button variant="text">Delete</Button>} />
                            </AlertDialogActions>
                        </AlertDialogContent>
                    </AlertDialog>
                    <BottomSheet>
                        <BottomSheetTrigger render={<Button variant="outlined">Bottom sheet</Button>} />
                        <BottomSheetContent>
                            <BottomSheetTitle>Convert units</BottomSheetTitle>
                            <p>Drag the handle down or tap the scrim to dismiss.</p>
                        </BottomSheetContent>
                    </BottomSheet>
                    <Menu>
                        <MenuTrigger
                            render={
                                <Button variant="outlined" icon="more_vert">
                                    Menu
                                </Button>
                            }
                        />
                        <MenuContent>
                            <MenuItem icon="edit">Edit recipe</MenuItem>
                            <MenuItem icon="link">Copy source link</MenuItem>
                            <MenuSeparator />
                            <MenuItem icon="delete" destructive>
                                Delete
                            </MenuItem>
                        </MenuContent>
                    </Menu>
                    <Tooltip label="Keeps your screen on while cooking">
                        <IconButton icon="visibility" label="Wake lock" variant="tonal" />
                    </Tooltip>
                    <SnackbarDemo />
                </Section>

                <Section title="Empty state">
                    <EmptyState
                        icon="skillet"
                        headline="No recipes yet"
                        body="Clip your first recipe from any site, or write one from scratch. Belle is waiting."
                    >
                        <Button icon="add">New recipe</Button>
                        <Button variant="outlined" icon="link">
                            Clip from URL
                        </Button>
                    </EmptyState>
                </Section>
            </main>
        </SnackbarProvider>
    )
}
