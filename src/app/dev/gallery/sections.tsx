'use client'

import { type ComponentType, useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { BottomSheet, BottomSheetContent, BottomSheetTrigger } from '@/components/ui/bottom-sheet'
import { Button, type ButtonSize, type ButtonVariant } from '@/components/ui/button'
import { ButtonGroup, ConnectedButtonGroup, ConnectedButtonGroupItem } from '@/components/ui/button-group'
import { Card } from '@/components/ui/card'
import { Carousel } from '@/components/ui/carousel'
import { Checkbox } from '@/components/ui/checkbox'
import { AssistChip, ChipSet, FilterChip, InputChip, SuggestionChip } from '@/components/ui/chip'
import {
    AlertDialog,
    AlertDialogClose,
    AlertDialogContent,
    AlertDialogTrigger,
    Dialog,
    DialogClose,
    DialogContent,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Divider } from '@/components/ui/divider'
import { EmptyState } from '@/components/ui/empty-state'
import { ExtendedFab, Fab, FabMenu, FabMenuItem } from '@/components/ui/fab'
import { Icon } from '@/components/ui/icon'
import { IconButton } from '@/components/ui/icon-button'
import { Kbd } from '@/components/ui/kbd'
import { List, ListItem } from '@/components/ui/list'
import { LoadingIndicator } from '@/components/ui/loading-indicator'
import {
    Menu,
    MenuCheckboxItem,
    MenuContent,
    MenuGroup,
    MenuItem,
    MenuRadioGroup,
    MenuRadioItem,
    MenuSeparator,
    MenuTrigger,
    Submenu,
} from '@/components/ui/menu'
import { NavigationBar, NavigationBarItem } from '@/components/ui/navigation-bar'
import { NavigationRail, NavigationRailItem, RailFab } from '@/components/ui/navigation-rail'
import { NumberStepper } from '@/components/ui/number-stepper'
import { CircularProgress, LinearProgress } from '@/components/ui/progress'
import { Radio, RadioGroup } from '@/components/ui/radio'
import { Search, SearchBar } from '@/components/ui/search'
import { Select } from '@/components/ui/select'
import { MorphShape, SHAPES, Shape, type ShapeName } from '@/components/ui/shape'
import { SideSheet, SideSheetContent, SideSheetTrigger } from '@/components/ui/side-sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { useSnackbar } from '@/components/ui/snackbar'
import { SplitButton } from '@/components/ui/split-button'
import { Switch } from '@/components/ui/switch'
import { Tab, TabList, TabPanel, Tabs } from '@/components/ui/tabs'
import { TextField } from '@/components/ui/text-field'
import { Toolbar, ToolbarButton, ToolbarSeparator } from '@/components/ui/toolbar'
import { RichTooltip, Tooltip } from '@/components/ui/tooltip'
import { TopAppBar } from '@/components/ui/top-app-bar'
import styles from './gallery.module.scss'

const SIZES: ButtonSize[] = ['xs', 's', 'm', 'l', 'xl']
const VARIANTS: ButtonVariant[] = ['filled', 'tonal', 'outlined', 'elevated', 'text']

function Panel({ title, children }: { title?: string; children: React.ReactNode }) {
    return (
        <div className={styles.panel}>
            {title && <h3 className={styles.panelTitle}>{title}</h3>}
            {children}
        </div>
    )
}

const TYPE_ROLES = [
    'display-large',
    'display-medium',
    'display-small',
    'headline-large',
    'headline-medium',
    'headline-small',
    'title-large',
    'title-medium',
    'title-small',
    'body-large',
    'body-medium',
    'body-small',
    'label-large',
    'label-medium',
    'label-small',
]

function typeStyle(role: string, emphasized: boolean): React.CSSProperties {
    const p = emphasized ? 'emphasized-' : ''
    const rond = emphasized && /^(display|headline)/.test(role) ? (role.startsWith('display') ? 100 : 60) : 0
    return {
        fontFamily: `var(--md-sys-typescale-${role}-font)`,
        fontSize: `var(--md-sys-typescale-${role}-size)`,
        lineHeight: `var(--md-sys-typescale-${role}-line-height)`,
        fontWeight: `var(--md-sys-typescale-${p}${role}-weight)`,
        letterSpacing: `var(--md-sys-typescale-${p}${role}-tracking)`,
        fontVariationSettings: `'ROND' ${rond}`,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    }
}

function Typography() {
    return (
        <div className={styles.grid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(520px, 100%), 1fr))' }}>
            {[false, true].map((emphasized) => (
                <Panel key={String(emphasized)} title={emphasized ? 'Emphasized' : 'Baseline'}>
                    {TYPE_ROLES.map((role) => (
                        <div key={role} className={styles.typeRow}>
                            <span>{role}</span>
                            <span style={typeStyle(role, emphasized)}>Shakshuka for four</span>
                        </div>
                    ))}
                </Panel>
            ))}
            <Panel title="Tabular numerals">
                <p className="cc-tabular" style={typeStyle('display-small', true)}>
                    12:05 · 1½ cups · 350°
                </p>
            </Panel>
        </div>
    )
}

const COLOR_PAIRS: [string, string][] = [
    ['primary', 'on-primary'],
    ['primary-container', 'on-primary-container'],
    ['secondary', 'on-secondary'],
    ['secondary-container', 'on-secondary-container'],
    ['tertiary', 'on-tertiary'],
    ['tertiary-container', 'on-tertiary-container'],
    ['error', 'on-error'],
    ['error-container', 'on-error-container'],
    ['surface', 'on-surface'],
    ['surface-dim', 'on-surface'],
    ['surface-bright', 'on-surface'],
    ['surface-container-lowest', 'on-surface'],
    ['surface-container-low', 'on-surface'],
    ['surface-container', 'on-surface'],
    ['surface-container-high', 'on-surface'],
    ['surface-container-highest', 'on-surface-variant'],
    ['inverse-surface', 'inverse-on-surface'],
    ['inverse-primary', 'on-primary-container'],
    ['outline', 'surface'],
    ['outline-variant', 'on-surface'],
    ['primary-fixed', 'on-primary-fixed'],
    ['secondary-fixed', 'on-secondary-fixed'],
    ['tertiary-fixed', 'on-tertiary-fixed'],
    ['primary-fixed-dim', 'on-primary-fixed-variant'],
]

function Colors() {
    return (
        <Panel>
            <div className={styles.swatches}>
                {COLOR_PAIRS.map(([bg, fg]) => (
                    <div
                        key={bg}
                        className={styles.swatch}
                        style={{ background: `var(--md-sys-color-${bg})`, color: `var(--md-sys-color-${fg})` }}
                    >
                        {bg}
                        <small>on: {fg}</small>
                    </div>
                ))}
            </div>
        </Panel>
    )
}

const MORPH_CYCLE: ShapeName[] = ['circle', 'cookie9', 'clover4', 'sunny', 'puffy-diamond', 'heart', 'gem', 'flower']

function Shapes() {
    const [index, setIndex] = useState(0)
    return (
        <>
            <Panel title="MaterialShapes">
                <div className={styles.shapes}>
                    {SHAPES.map((name) => (
                        <div key={name} className={styles.shapeCell}>
                            <Shape name={name} size={56} />
                            <span>{name}</span>
                        </div>
                    ))}
                </div>
            </Panel>
            <Panel title="Morph (spring)">
                <div className={styles.morphStage}>
                    <MorphShape shape={MORPH_CYCLE[index % MORPH_CYCLE.length] as ShapeName} size={120} />
                    <MorphShape shape={MORPH_CYCLE[(index + 3) % MORPH_CYCLE.length] as ShapeName} size={72} spring="spatial-fast" />
                    <Button variant="tonal" onClick={() => setIndex((i) => i + 1)} icon={<Icon name="refresh" />}>
                        Next shape
                    </Button>
                </div>
            </Panel>
            <Panel title="Shape as a mask">
                <div className={styles.row}>
                    {(['cookie12', 'clover8', 'arch', 'pill', 'soft-burst'] as ShapeName[]).map((name) => (
                        <Shape
                            key={name}
                            name={name}
                            size={96}
                            style={{ background: 'var(--md-sys-color-secondary-container)', color: 'var(--md-sys-color-on-secondary-container)' }}
                        >
                            <Icon name="restaurant" size={40} />
                        </Shape>
                    ))}
                </div>
            </Panel>
        </>
    )
}

function Buttons() {
    const [loading, setLoading] = useState(false)
    return (
        <>
            {VARIANTS.map((variant) => (
                <Panel key={variant} title={variant}>
                    <div className={styles.row}>
                        {SIZES.map((size) => (
                            <Button key={size} variant={variant} size={size} icon={<Icon name="add" />}>
                                Add
                            </Button>
                        ))}
                    </div>
                    <div className={styles.row}>
                        <Button variant={variant} shape="square">
                            Square
                        </Button>
                        <Button variant={variant} defaultSelected={false} icon={<Icon name="bookmark" />} selectedIcon={<Icon name="bookmark" filled />}>
                            Toggle
                        </Button>
                        <Button variant={variant} disabled>
                            Disabled
                        </Button>
                    </div>
                </Panel>
            ))}
            <Panel title="Loading">
                <div className={styles.row}>
                    <Button
                        loading={loading}
                        icon={<Icon name="download" />}
                        onClick={() => {
                            setLoading(true)
                            setTimeout(() => setLoading(false), 2500)
                        }}
                    >
                        Import
                    </Button>
                    <Button variant="tonal" loading>
                        Saving
                    </Button>
                    <Button variant="outlined" size="m" loading icon={<Icon name="check" />}>
                        Clip
                    </Button>
                </div>
            </Panel>
        </>
    )
}

function IconButtons() {
    const variants = ['standard', 'filled', 'tonal', 'outlined'] as const
    return (
        <>
            {variants.map((variant) => (
                <Panel key={variant} title={variant}>
                    <div className={styles.row}>
                        {SIZES.map((size) => (
                            <IconButton key={size} variant={variant} size={size} label="Favorite" icon={<Icon name="favorite" />} />
                        ))}
                        <IconButton variant={variant} width="narrow" label="Narrow" icon={<Icon name="edit" />} />
                        <IconButton variant={variant} width="wide" label="Wide" icon={<Icon name="edit" />} />
                        <IconButton
                            variant={variant}
                            label="Favorite toggle"
                            defaultSelected
                            icon={<Icon name="favorite" />}
                            selectedIcon={<Icon name="favorite" filled />}
                        />
                        <IconButton variant={variant} shape="square" label="Square" icon={<Icon name="tune" />} />
                        <IconButton variant={variant} disabled label="Disabled" icon={<Icon name="delete" />} />
                    </div>
                </Panel>
            ))}
        </>
    )
}

function Groups() {
    const [sort, setSort] = useState(['recent'])
    const [filters, setFilters] = useState(['veg'])
    return (
        <>
            <Panel title="Standard (press to squish neighbors)">
                <ButtonGroup>
                    <Button variant="tonal" icon={<Icon name="skip_previous" />}>
                        Back
                    </Button>
                    <Button icon={<Icon name="play_arrow" />}>Start</Button>
                    <Button variant="tonal" icon={<Icon name="skip_next" />}>
                        Next
                    </Button>
                </ButtonGroup>
                <ButtonGroup size="m">
                    <IconButton size="m" variant="tonal" label="Previous" icon={<Icon name="skip_previous" />} />
                    <IconButton size="m" variant="filled" width="wide" label="Play" icon={<Icon name="play_arrow" />} />
                    <IconButton size="m" variant="tonal" label="Next" icon={<Icon name="skip_next" />} />
                </ButtonGroup>
            </Panel>
            <Panel title="Connected">
                <ConnectedButtonGroup label="Sort" value={sort} onValueChange={(v) => v.length && setSort(v)}>
                    <ConnectedButtonGroupItem value="recent">Recent</ConnectedButtonGroupItem>
                    <ConnectedButtonGroupItem value="az">A to Z</ConnectedButtonGroupItem>
                    <ConnectedButtonGroupItem value="quick">Quickest</ConnectedButtonGroupItem>
                </ConnectedButtonGroup>
                <ConnectedButtonGroup label="Diet" multiple value={filters} onValueChange={setFilters} variant="filled" size="m">
                    <ConnectedButtonGroupItem size="m" value="veg" check>
                        Veggie
                    </ConnectedButtonGroupItem>
                    <ConnectedButtonGroupItem size="m" value="gf" check>
                        Gluten free
                    </ConnectedButtonGroupItem>
                    <ConnectedButtonGroupItem size="m" value="df" check>
                        Dairy free
                    </ConnectedButtonGroupItem>
                </ConnectedButtonGroup>
                <ConnectedButtonGroup label="View" defaultValue={['grid']} fill variant="outlined">
                    <ConnectedButtonGroupItem value="grid" icon={<Icon name="grid_view" />}>
                        Grid
                    </ConnectedButtonGroupItem>
                    <ConnectedButtonGroupItem value="list" icon={<Icon name="view_list" />}>
                        List
                    </ConnectedButtonGroupItem>
                </ConnectedButtonGroup>
            </Panel>
            <Panel title="Split button">
                <div className={styles.row}>
                    {SIZES.slice(0, 3).map((size) => (
                        <SplitButton
                            key={size}
                            size={size}
                            icon={<Icon name="add_shopping_cart" />}
                            menuLabel="More list options"
                            menu={
                                <>
                                    <MenuItem icon={<Icon name="playlist_add" />}>Add some</MenuItem>
                                    <MenuItem icon={<Icon name="content_copy" />}>Copy list</MenuItem>
                                </>
                            }
                        >
                            Add to list
                        </SplitButton>
                    ))}
                    <SplitButton variant="tonal" menuLabel="More" menu={<MenuItem>Duplicate</MenuItem>}>
                        Save
                    </SplitButton>
                    <SplitButton variant="outlined" menuLabel="More" menu={<MenuItem>Duplicate</MenuItem>}>
                        Save
                    </SplitButton>
                </div>
            </Panel>
        </>
    )
}

function Fabs() {
    const [collapsed, setCollapsed] = useState(false)
    return (
        <>
            <Panel title="FAB">
                <div className={styles.row}>
                    <Fab label="New" icon={<Icon name="add" />} size="small" />
                    <Fab label="New" icon={<Icon name="add" />} />
                    <Fab label="New" icon={<Icon name="add" />} size="medium" color="secondary" />
                    <Fab label="New" icon={<Icon name="add" />} size="large" color="tertiary" />
                    <Fab label="New" icon={<Icon name="edit" />} vibrant />
                    <Fab label="New" icon={<Icon name="edit" />} vibrant color="tertiary" />
                </div>
            </Panel>
            <Panel title="Extended FAB">
                <div className={styles.row}>
                    <ExtendedFab icon={<Icon name="add_link" />} collapsed={collapsed}>
                        Clip recipe
                    </ExtendedFab>
                    <ExtendedFab icon={<Icon name="edit" />} size="medium" color="secondary" collapsed={collapsed}>
                        New recipe
                    </ExtendedFab>
                    <ExtendedFab icon={<Icon name="skillet" />} size="large" vibrant collapsed={collapsed}>
                        Cook
                    </ExtendedFab>
                    <Switch label="Collapsed" checked={collapsed} onCheckedChange={setCollapsed} />
                </div>
            </Panel>
            <Panel title="FAB menu">
                <div className={styles.fabStage}>
                    <FabMenu label="Add" icon={<Icon name="add" />}>
                        <FabMenuItem icon={<Icon name="link" />}>From a link</FabMenuItem>
                        <FabMenuItem icon={<Icon name="content_paste" />}>Paste text</FabMenuItem>
                        <FabMenuItem icon={<Icon name="photo_camera" />}>Photo</FabMenuItem>
                        <FabMenuItem icon={<Icon name="edit" />}>Write one</FabMenuItem>
                    </FabMenu>
                </div>
            </Panel>
        </>
    )
}

function Progress() {
    const [value, setValue] = useState(0.4)
    return (
        <>
            <Panel title="Loading indicator">
                <div className={styles.row}>
                    <LoadingIndicator />
                    <LoadingIndicator contained />
                    <LoadingIndicator size={96} />
                    <LoadingIndicator contained size={64} value={value} label="Clipping" />
                </div>
            </Panel>
            <Panel title="Linear">
                <div className={styles.stack}>
                    <LinearProgress value={value} />
                    <LinearProgress value={value} wavy />
                    <LinearProgress />
                    <LinearProgress wavy />
                </div>
            </Panel>
            <Panel title="Circular">
                <div className={styles.row}>
                    <CircularProgress value={value} />
                    <CircularProgress value={value} wavy />
                    <CircularProgress />
                    <CircularProgress wavy />
                </div>
                <Slider label="Progress" value={value * 100} onValueChange={(v) => setValue(v / 100)} format={(v) => `${v}%`} />
            </Panel>
        </>
    )
}

function Bars() {
    return (
        <>
            <Panel title="Floating toolbar">
                <div className={styles.row}>
                    <Toolbar label="Recipe actions" fab={<Fab label="Cook" icon={<Icon name="skillet" />} />}>
                        <ToolbarButton label="Favorite" icon={<Icon name="favorite" />} selectedIcon={<Icon name="favorite" filled />} defaultSelected={false} />
                        <ToolbarButton label="Share" icon={<Icon name="share" />} />
                        <ToolbarButton label="Cast" icon={<Icon name="cast" />} />
                        <ToolbarSeparator />
                        <ToolbarButton label="Edit" icon={<Icon name="edit" />} />
                    </Toolbar>
                    <Toolbar label="Vibrant" color="vibrant" fab={<Fab label="Add" color="tertiary" icon={<Icon name="add" />} />}>
                        <ToolbarButton label="Bold" icon={<Icon name="format_list_bulleted" />} defaultSelected />
                        <ToolbarButton label="Numbered" icon={<Icon name="format_list_numbered" />} defaultSelected={false} />
                        <ToolbarButton label="Timer" icon={<Icon name="timer" />} />
                    </Toolbar>
                </div>
            </Panel>
            <Panel title="Docked toolbar">
                <Toolbar label="Docked" variant="docked">
                    <ToolbarButton label="Back" icon={<Icon name="arrow_back" />} />
                    <ToolbarButton label="Timer" icon={<Icon name="timer" />} />
                    <ToolbarButton label="Scale" icon={<Icon name="scale" />} />
                    <ToolbarButton label="Forward" icon={<Icon name="arrow_forward" />} />
                </Toolbar>
            </Panel>
            <Panel title="Top app bars (scroll inside each frame)">
                <div className={styles.grid}>
                    {(['small', 'medium', 'large'] as const).map((variant) => (
                        <div key={variant} className={styles.frame}>
                            <TopAppBar
                                variant={variant}
                                titleAs="div"
                                title={variant === 'small' ? 'Library' : 'Lemony white bean soup'}
                                subtitle={variant === 'small' ? undefined : 'Serious Eats'}
                                leading={<IconButton label="Back" icon={<Icon name="arrow_back" />} />}
                                trailing={
                                    <>
                                        <IconButton label="Favorite" icon={<Icon name="favorite" />} />
                                        <IconButton label="More" icon={<Icon name="more_vert" />} />
                                    </>
                                }
                            />
                            <div className={styles.frameBody}>
                                <Skeleton lines={14} />
                            </div>
                        </div>
                    ))}
                    <div className={styles.frame}>
                        <TopAppBar centered titleAs="div" title="Cook mode" leading={<IconButton label="Close" icon={<Icon name="close" />} />} />
                    </div>
                </div>
            </Panel>
            <Panel title="Navigation bar">
                <div className={styles.navFrame}>
                    <NavigationBar>
                        <NavigationBarItem href="/dev/gallery" selected icon={<Icon name="home" />} selectedIcon={<Icon name="home" filled />} label="Library" />
                        <NavigationBarItem href="/collections" selected={false} icon={<Icon name="collections_bookmark" />} label="Collections" />
                        <NavigationBarItem href="/grocery" selected={false} icon={<Icon name="grocery" />} label="Grocery" badge={3} />
                        <NavigationBarItem href="/settings" selected={false} icon={<Icon name="settings" />} label="Settings" badge />
                    </NavigationBar>
                </div>
            </Panel>
            <Panel title="Navigation rail">
                <div className={styles.railFrame}>
                    <NavigationRail fab={<RailFab icon={<Icon name="add_link" />} label="Clip recipe" />}>
                        <NavigationRailItem href="/dev/gallery" selected icon={<Icon name="home" />} selectedIcon={<Icon name="home" filled />} label="Library" />
                        <NavigationRailItem href="/collections" selected={false} icon={<Icon name="collections_bookmark" />} label="Collections" />
                        <NavigationRailItem href="/grocery" selected={false} icon={<Icon name="grocery" />} label="Grocery" badge={2} />
                        <NavigationRailItem href="/settings" selected={false} icon={<Icon name="settings" />} label="Settings" />
                    </NavigationRail>
                    <div className={styles.frameBody} style={{ flex: 1 }}>
                        <Skeleton lines={6} />
                    </div>
                </div>
            </Panel>
        </>
    )
}

function SearchSection() {
    const [q, setQ] = useState('')
    const [q2, setQ2] = useState('')
    const results = ['Shakshuka', 'Short rib ragu', 'Shortbread', 'Shrimp tacos'].filter((r) => r.toLowerCase().includes(q.toLowerCase()))
    return (
        <Panel>
            <Search value={q} onValueChange={setQ} placeholder="Search recipes" trailing={<Avatar name="Demo Cook" size={30} />}>
                <List>
                    {results.map((r) => (
                        <ListItem key={r} headline={r} leading={<Icon name="history" />} onClick={() => setQ(r)} />
                    ))}
                </List>
            </Search>
            <SearchBar value={q2} onValueChange={setQ2} placeholder="Filter ingredients" />
        </Panel>
    )
}

function Chips() {
    const [tags, setTags] = useState(['weeknight', 'vegetarian', 'one pot'])
    return (
        <Panel>
            <ChipSet label="Assist">
                <AssistChip icon={<Icon name="add_shopping_cart" />}>Add to list</AssistChip>
                <AssistChip icon={<Icon name="timer" />} elevated>
                    Start timer
                </AssistChip>
                <SuggestionChip>Under 30 min</SuggestionChip>
                <SuggestionChip elevated>Uses eggs</SuggestionChip>
                <AssistChip disabled icon={<Icon name="cast" />}>
                    Cast
                </AssistChip>
            </ChipSet>
            <ChipSet label="Filters" scroll>
                <FilterChip defaultSelected>All</FilterChip>
                <FilterChip icon={<Icon name="favorite" />}>Favorites</FilterChip>
                <FilterChip>Breakfast</FilterChip>
                <FilterChip>Weeknight dinners</FilterChip>
                <FilterChip elevated>Baking</FilterChip>
                <FilterChip>Soups</FilterChip>
                <FilterChip>Holiday</FilterChip>
                <FilterChip>Grilling</FilterChip>
                <FilterChip trailing={<Icon name="arrow_drop_down" />}>Sort</FilterChip>
            </ChipSet>
            <ChipSet label="Tags">
                {tags.map((t) => (
                    <InputChip key={t} onRemove={() => setTags((all) => all.filter((x) => x !== t))}>
                        {t}
                    </InputChip>
                ))}
                <InputChip avatar={<Avatar name="Demo Cook" size={24} />}>Demo Cook</InputChip>
            </ChipSet>
        </Panel>
    )
}

function Cards() {
    return (
        <div className={styles.grid}>
            {(['elevated', 'filled', 'outlined'] as const).map((variant) => (
                <Card key={variant} variant={variant} href="#cards">
                    <div className={styles.cardMedia}>
                        <Icon name="ramen_dining" />
                    </div>
                    <div className={styles.cardBody}>
                        <h3>Spicy miso ramen ({variant})</h3>
                        <p>45 min · Serves 2</p>
                    </div>
                </Card>
            ))}
            <Card variant="outlined">
                <div className={styles.cardBody}>
                    <h3>Static card</h3>
                    <p>No state layer, no ripple.</p>
                </div>
            </Card>
        </div>
    )
}

function Lists() {
    const [selected, setSelected] = useState('2')
    return (
        <div className={styles.grid}>
            <Panel title="Segmented">
                <List segmented>
                    {[
                        ['1', 'Shakshuka', '35 min'],
                        ['2', 'Lemony white bean soup', '50 min'],
                        ['3', 'Brown butter cornbread with a long title that wraps onto two lines', '1 hr'],
                    ].map(([id, title, time]) => (
                        <ListItem
                            key={id}
                            headline={title}
                            supporting="Serious Eats"
                            leading={<span className={styles.thumb}><Icon name="restaurant" /></span>}
                            trailingText={time}
                            selected={selected === id}
                            onClick={() => setSelected(id ?? '')}
                        />
                    ))}
                </List>
            </Panel>
            <Panel title="Plain with controls">
                <List>
                    <ListItem as="label" headline="2 eggs" leading={<Checkbox aria-label="2 eggs" defaultChecked />} />
                    <ListItem as="label" headline="1 cup flour" leading={<Checkbox aria-label="1 cup flour" />} />
                    <ListItem headline="Keep screen on" supporting="While cooking" trailing={<Switch aria-label="Keep screen on" defaultChecked />} />
                    <ListItem overline="Collection" headline="Weeknight" supporting="12 recipes, updated today" trailing={<Icon name="chevron_right" />} href="#lists" />
                </List>
            </Panel>
        </div>
    )
}

function Selection() {
    return (
        <div className={styles.grid}>
            <Panel title="Checkbox">
                <Checkbox label="Unchecked" />
                <Checkbox label="Checked" defaultChecked />
                <Checkbox label="Indeterminate" indeterminate />
                <Checkbox label="Error" invalid />
                <Checkbox label="Disabled" disabled defaultChecked />
            </Panel>
            <Panel title="Radio">
                <RadioGroup label="Units" defaultValue="metric">
                    <Radio value="metric" label="Metric" />
                    <Radio value="us" label="US cups" />
                    <Radio value="none" label="Disabled" disabled />
                </RadioGroup>
            </Panel>
            <Panel title="Switch">
                <Switch label="Keep screen on" defaultChecked />
                <Switch label="With icons" icons />
                <Switch label="With icons, on" icons defaultChecked />
                <Switch label="Disabled" disabled />
            </Panel>
        </div>
    )
}

function Sliders() {
    return (
        <Panel>
            <Slider label="Servings" size="xs" defaultValue={4} min={1} max={12} />
            <Slider label="Spice" size="s" defaultValue={30} />
            <Slider label="Volume" size="m" defaultValue={60} icon={<Icon name="volume_up" />} />
            <Slider label="Brightness" size="l" defaultValue={45} icon={<Icon name="light_mode" />} />
            <Slider label="Scale" size="xl" defaultValue={70} icon={<Icon name="scale" />} format={(v) => `${v / 10}×`} />
            <Slider label="Disabled" disabled defaultValue={20} />
        </Panel>
    )
}

function Fields() {
    const [notes, setNotes] = useState('')
    return (
        <div className={styles.grid}>
            {(['filled', 'outlined'] as const).map((variant) => (
                <Panel key={variant} title={variant}>
                    <TextField variant={variant} label="Title" defaultValue="Shakshuka" surfaceColor="var(--md-sys-color-surface-container-low)" />
                    <TextField variant={variant} label="Source" placeholder="https://" leadingIcon={<Icon name="link" />} surfaceColor="var(--md-sys-color-surface-container-low)" />
                    <TextField variant={variant} label="Prep time" suffix="min" inputMode="numeric" supportingText="Hands-on time" surfaceColor="var(--md-sys-color-surface-container-low)" />
                    <TextField variant={variant} label="Price" prefix="$" defaultValue="12" surfaceColor="var(--md-sys-color-surface-container-low)" />
                    <TextField variant={variant} label="Servings" error="Enter a number" defaultValue="a few" surfaceColor="var(--md-sys-color-surface-container-low)" />
                    <TextField
                        variant={variant}
                        label="Notes"
                        multiline
                        maxLength={280}
                        counter
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        surfaceColor="var(--md-sys-color-surface-container-low)"
                    />
                    <TextField variant={variant} label="Disabled" disabled defaultValue="Locked" />
                </Panel>
            ))}
            <Panel title="Stepper and select">
                <NumberStepper label="Servings" defaultValue={4} min={1} max={48} />
                <NumberStepper label="Minutes" size="l" defaultValue={12} min={0} />
                <NumberStepper label="Scale" size="s" defaultValue={1} step={0.5} min={0.5} />
                <Select
                    label="Category"
                    defaultValue="dinner"
                    options={[
                        { value: 'breakfast', label: 'Breakfast', icon: <Icon name="breakfast_dining" /> },
                        { value: 'lunch', label: 'Lunch', icon: <Icon name="lunch_dining" /> },
                        { value: 'dinner', label: 'Dinner', icon: <Icon name="dinner_dining" /> },
                        { value: 'dessert', label: 'Dessert', icon: <Icon name="cake" /> },
                    ]}
                />
                <Select label="Units" variant="outlined" options={[{ value: 'm', label: 'Metric' }, { value: 'us', label: 'US' }]} />
            </Panel>
        </div>
    )
}

function Menus() {
    const [sort, setSort] = useState('recent')
    const [showTags, setShowTags] = useState(true)
    return (
        <Panel>
            <div className={styles.row}>
                <Menu>
                    <MenuTrigger render={<IconButton label="More" icon={<Icon name="more_vert" />} />} />
                    <MenuContent>
                        <MenuItem icon={<Icon name="edit" />}>Edit</MenuItem>
                        <MenuItem icon={<Icon name="content_copy" />} trailing={<Kbd>D</Kbd>}>
                            Duplicate
                        </MenuItem>
                        <Submenu label="Add to" icon={<Icon name="playlist_add" />}>
                            <MenuItem>Weeknight</MenuItem>
                            <MenuItem>Baking</MenuItem>
                            <MenuItem icon={<Icon name="add" />}>New collection</MenuItem>
                        </Submenu>
                        <MenuSeparator />
                        <MenuItem icon={<Icon name="delete" />}>Delete</MenuItem>
                    </MenuContent>
                </Menu>
                <Menu>
                    <MenuTrigger render={<Button variant="tonal" trailingIcon={<Icon name="arrow_drop_down" />} />}>Sort</MenuTrigger>
                    <MenuContent>
                        <MenuGroup label="Sort by">
                            <MenuRadioGroup value={sort} onValueChange={(v) => setSort(String(v))}>
                                <MenuRadioItem value="recent">Recent</MenuRadioItem>
                                <MenuRadioItem value="az">A to Z</MenuRadioItem>
                                <MenuRadioItem value="cooked">Recently cooked</MenuRadioItem>
                            </MenuRadioGroup>
                        </MenuGroup>
                        <MenuSeparator />
                        <MenuCheckboxItem checked={showTags} onCheckedChange={setShowTags}>
                            Show tags
                        </MenuCheckboxItem>
                        <MenuItem selected icon={<Icon name="grid_view" />}>
                            Grid
                        </MenuItem>
                    </MenuContent>
                </Menu>
            </div>
        </Panel>
    )
}

function Overlays() {
    const snackbar = useSnackbar()
    return (
        <Panel>
            <div className={styles.row}>
                <Dialog>
                    <DialogTrigger render={<Button variant="tonal" />}>Dialog</DialogTrigger>
                    <DialogContent
                        icon={<Icon name="cast" />}
                        headline="Send to kitchen display"
                        actions={
                            <>
                                <DialogClose render={<Button variant="text" />}>Cancel</DialogClose>
                                <DialogClose render={<Button variant="text" />}>Send</DialogClose>
                            </>
                        }
                    >
                        The recipe opens on the display at step one.
                    </DialogContent>
                </Dialog>
                <Dialog>
                    <DialogTrigger render={<Button variant="tonal" />}>Full-screen dialog</DialogTrigger>
                    <DialogContent
                        fullScreen
                        headline="New collection"
                        fullScreenAction={<DialogClose render={<Button variant="text" />}>Save</DialogClose>}
                        actions={
                            <>
                                <DialogClose render={<Button variant="text" />}>Cancel</DialogClose>
                                <DialogClose render={<Button variant="text" />}>Save</DialogClose>
                            </>
                        }
                    >
                        <TextField label="Name" variant="outlined" surfaceColor="var(--md-sys-color-surface-container-high)" />
                    </DialogContent>
                </Dialog>
                <AlertDialog>
                    <AlertDialogTrigger render={<Button variant="outlined" />}>Alert dialog</AlertDialogTrigger>
                    <AlertDialogContent
                        headline="Delete recipe?"
                        actions={
                            <>
                                <AlertDialogClose render={<Button variant="text" />}>Cancel</AlertDialogClose>
                                <AlertDialogClose render={<Button variant="text" />}>Delete</AlertDialogClose>
                            </>
                        }
                    >
                        It leaves your library and every collection.
                    </AlertDialogContent>
                </AlertDialog>
                <BottomSheet>
                    <BottomSheetTrigger render={<Button variant="tonal" />}>Bottom sheet</BottomSheetTrigger>
                    <BottomSheetContent title="Scale recipe">
                        <div className={styles.stack}>
                            <NumberStepper label="Servings" defaultValue={4} min={1} />
                            <List>
                                <ListItem headline="Half" onClick={() => {}} />
                                <ListItem headline="Double" onClick={() => {}} />
                                <ListItem headline="Triple" onClick={() => {}} />
                            </List>
                        </div>
                    </BottomSheetContent>
                </BottomSheet>
                <BottomSheet snapPoints={['220px', 1]}>
                    <BottomSheetTrigger render={<Button variant="outlined" />}>Sheet with snap points</BottomSheetTrigger>
                    <BottomSheetContent title="Ingredients">
                        <Skeleton lines={24} />
                    </BottomSheetContent>
                </BottomSheet>
                <SideSheet>
                    <SideSheetTrigger render={<Button variant="outlined" />}>Side sheet</SideSheetTrigger>
                    <SideSheetContent title="Filters" actions={<Button>Apply</Button>}>
                        <div className={styles.stack}>
                            <Checkbox label="Favorites" />
                            <Checkbox label="Under 30 min" />
                            <Checkbox label="Vegetarian" />
                        </div>
                    </SideSheetContent>
                </SideSheet>
            </div>
            <div className={styles.row}>
                <Button variant="text" onClick={() => snackbar('Saved')}>
                    Snackbar
                </Button>
                <Button
                    variant="text"
                    onClick={() => snackbar({ message: 'Removed from grocery list', action: 'Undo', onAction: () => snackbar('Restored') })}
                >
                    With action
                </Button>
                <Button
                    variant="text"
                    onClick={() =>
                        snackbar({ message: 'Could not clip that page. Check the link and try again.', closable: true, urgent: true })
                    }
                >
                    Two lines, closable
                </Button>
                <Tooltip content="Favorite">
                    <IconButton label="Favorite" icon={<Icon name="favorite" />} />
                </Tooltip>
                <Tooltip content="Share">
                    <IconButton label="Share" icon={<Icon name="share" />} />
                </Tooltip>
                <RichTooltip
                    subhead="Kitchen displays"
                    text="Pair a tablet or smart display once, then send recipes to it from any device."
                    actions={<Button variant="text">Learn how</Button>}
                >
                    <IconButton label="About displays" icon={<Icon name="info" />} />
                </RichTooltip>
            </div>
        </Panel>
    )
}

function TabsSection() {
    return (
        <div className={styles.grid}>
            <Panel title="Primary">
                <Tabs defaultValue="ingredients">
                    <TabList label="Recipe">
                        <Tab value="ingredients" icon={<Icon name="grocery" />}>
                            Ingredients
                        </Tab>
                        <Tab value="steps" icon={<Icon name="format_list_numbered" />}>
                            Steps
                        </Tab>
                        <Tab value="notes" icon={<Icon name="notes" />}>
                            Notes
                        </Tab>
                    </TabList>
                    <TabPanel value="ingredients">
                        <Skeleton lines={3} />
                    </TabPanel>
                    <TabPanel value="steps">Steps</TabPanel>
                    <TabPanel value="notes">Notes</TabPanel>
                </Tabs>
            </Panel>
            <Panel title="Secondary">
                <Tabs defaultValue="all">
                    <TabList variant="secondary" label="Filter">
                        <Tab value="all">All</Tab>
                        <Tab value="fav">Favorites</Tab>
                        <Tab value="recent">Recent</Tab>
                    </TabList>
                </Tabs>
            </Panel>
        </div>
    )
}

const TILES = [
    ['ramen_dining', 'primary'],
    ['bakery_dining', 'secondary'],
    ['icecream', 'tertiary'],
    ['lunch_dining', 'primary'],
    ['set_meal', 'secondary'],
    ['rice_bowl', 'tertiary'],
    ['cake', 'primary'],
] as const

function Carousels() {
    const tiles = TILES.map(([icon, role]) => (
        <div
            key={icon}
            className={styles.carouselTile}
            style={{ background: `var(--md-sys-color-${role}-container)`, color: `var(--md-sys-color-on-${role}-container)` }}
        >
            <Icon name={icon} />
        </div>
    ))
    return (
        <>
            <Panel title="Multi-browse">
                <Carousel label="Recent recipes">{tiles}</Carousel>
            </Panel>
            <Panel title="Hero">
                <Carousel label="Featured" variant="hero">
                    {tiles}
                </Carousel>
            </Panel>
        </>
    )
}

function Misc() {
    return (
        <div className={styles.grid}>
            <Panel title="Badge and avatar">
                <div className={styles.row}>
                    <Badge />
                    <Badge value={3} label="3 new" />
                    <Badge value={1200} />
                    <Avatar name="Demo Cook" />
                    <Avatar name="Ada Lovelace" size={56} shape="cookie9" />
                    <Avatar name="Julia" size={32} shape="clover4" />
                </div>
            </Panel>
            <Panel title="Divider and keys">
                <Divider />
                <div className={styles.row}>
                    <Kbd>Space</Kbd>
                    <Kbd>N</Kbd>
                    <Divider vertical />
                    <span>Next step</span>
                </div>
            </Panel>
            <Panel title="Skeleton">
                <div className={styles.row}>
                    <Skeleton shape="circle" width={40} />
                    <div style={{ flex: 1 }}>
                        <Skeleton shape="text" width="60%" />
                        <Skeleton shape="text" width="40%" />
                    </div>
                </div>
                <Skeleton shape="large" height={120} />
            </Panel>
            <Panel title="Empty state">
                <EmptyState
                    icon={<Icon name="menu_book" />}
                    title="No recipes yet"
                    action={<Button icon={<Icon name="add_link" />}>Clip a recipe</Button>}
                />
            </Panel>
            <Panel title="Empty state, other shapes">
                <EmptyState shape="clover8" icon={<Icon name="grocery" />} title="List is empty" titleAs="h3" />
            </Panel>
        </div>
    )
}

export const SECTIONS: { id: string; title: string; Component: ComponentType }[] = [
    { id: 'type', title: 'Typography', Component: Typography },
    { id: 'color', title: 'Color', Component: Colors },
    { id: 'shape', title: 'Shape', Component: Shapes },
    { id: 'buttons', title: 'Buttons', Component: Buttons },
    { id: 'icon-buttons', title: 'Icon buttons', Component: IconButtons },
    { id: 'groups', title: 'Button groups', Component: Groups },
    { id: 'fab', title: 'FABs', Component: Fabs },
    { id: 'progress', title: 'Progress', Component: Progress },
    { id: 'bars', title: 'Toolbars and navigation', Component: Bars },
    { id: 'search', title: 'Search', Component: SearchSection },
    { id: 'chips', title: 'Chips', Component: Chips },
    { id: 'cards', title: 'Cards', Component: Cards },
    { id: 'lists', title: 'Lists', Component: Lists },
    { id: 'selection', title: 'Selection', Component: Selection },
    { id: 'sliders', title: 'Sliders', Component: Sliders },
    { id: 'fields', title: 'Text input', Component: Fields },
    { id: 'menus', title: 'Menus', Component: Menus },
    { id: 'overlays', title: 'Dialogs, sheets, snackbars, tooltips', Component: Overlays },
    { id: 'tabs', title: 'Tabs', Component: TabsSection },
    { id: 'carousel', title: 'Carousel', Component: Carousels },
    { id: 'misc', title: 'Odds and ends', Component: Misc },
]
