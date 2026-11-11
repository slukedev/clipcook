// Editor state and its conversions. Client-safe: the server pages build the
// initial values, the client turns them back into the createRecipe FormData.

import type { ImportedRecipe, Recipe } from '@/lib/domain/types'
import { headingText, isHeadingLine } from '@/lib/recipe/text'

export interface EditorLine {
    id: string
    text: string
    heading: boolean
}

export interface EditorValues {
    title: string
    description: string
    servings: string
    prepTime: string
    cookTime: string
    totalTime: string
    notes: string
    sourceUrl: string
    sourceName: string
    tags: string[]
    collectionIds: string[]
    ingredients: EditorLine[]
    instructions: EditorLine[]
}

/** What the photo slot holds. `src` is always something an <img> can show. */
export type EditorPhoto =
    | { kind: 'none' }
    | { kind: 'existing'; src: string }
    | { kind: 'clipped'; src: string }
    | { kind: 'picked'; src: string; file: Blob }

export interface EditorCollection {
    id: string
    name: string
}

/** Dynamic color from the photo is scoped to this selector. */
export const EDITOR_SCOPE = '[data-editor]'

let counter = 0

/** Ids for rows created on the client after the first render. */
export function newLineId(): string {
    counter += 1
    return `n${counter}`
}

/** Deterministic ids for the first render so server and client agree. */
function toLines(prefix: string, lines: readonly string[] | undefined): EditorLine[] {
    return (lines ?? []).map((line, i) =>
        isHeadingLine(line)
            ? { id: `${prefix}${i}`, text: headingText(line), heading: true }
            : { id: `${prefix}${i}`, text: line, heading: false },
    )
}

export function fromLines(lines: readonly EditorLine[]): string[] {
    const out: string[] = []
    for (const line of lines) {
        const text = line.text.replace(/\s+/g, ' ').trim()
        if (!text) continue
        out.push(line.heading ? `# ${text}` : text)
    }
    return out
}

export function emptyValues(): EditorValues {
    return {
        title: '',
        description: '',
        servings: '',
        prepTime: '',
        cookTime: '',
        totalTime: '',
        notes: '',
        sourceUrl: '',
        sourceName: '',
        tags: [],
        collectionIds: [],
        ingredients: [],
        instructions: [],
    }
}

export function valuesFromRecipe(recipe: Recipe): EditorValues {
    return {
        title: recipe.title,
        description: recipe.description,
        servings: recipe.servings,
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        totalTime: recipe.totalTime,
        notes: recipe.notes,
        sourceUrl: recipe.sourceUrl ?? '',
        sourceName: recipe.sourceName ?? '',
        tags: recipe.tags,
        collectionIds: recipe.collectionIds,
        ingredients: toLines('i', recipe.ingredients),
        instructions: toLines('s', recipe.instructions),
    }
}

export function valuesFromImported(recipe: ImportedRecipe): EditorValues {
    return {
        title: recipe.title ?? '',
        description: recipe.description ?? '',
        servings: recipe.servings ?? '',
        prepTime: recipe.prepTime ?? '',
        cookTime: recipe.cookTime ?? '',
        totalTime: recipe.totalTime ?? '',
        notes: recipe.notes ?? '',
        sourceUrl: recipe.sourceUrl ?? '',
        sourceName: recipe.sourceName ?? '',
        tags: recipe.tags ?? [],
        collectionIds: [],
        ingredients: toLines('i', recipe.ingredients),
        instructions: toLines('s', recipe.instructions),
    }
}

/** A stable string for dirty checks; row ids and blank rows do not count as edits. */
export function snapshot(values: EditorValues, photo: EditorPhoto): string {
    return JSON.stringify([
        values.title.trim(),
        values.description.trim(),
        values.servings.trim(),
        values.prepTime.trim(),
        values.cookTime.trim(),
        values.totalTime.trim(),
        values.notes.trim(),
        values.sourceUrl.trim(),
        values.sourceName.trim(),
        values.tags,
        values.collectionIds,
        fromLines(values.ingredients),
        fromLines(values.instructions),
        photo.kind === 'none' ? '' : photo.src,
    ])
}

/** The FormData contract of createRecipe / updateRecipe (src/server/schemas.ts). */
export function toFormData(values: EditorValues, photo: EditorPhoto, initialPhoto: EditorPhoto): FormData {
    const fd = new FormData()
    fd.set('title', values.title.trim())
    fd.set('description', values.description)
    fd.set('servings', values.servings)
    fd.set('prepTime', values.prepTime)
    fd.set('cookTime', values.cookTime)
    fd.set('totalTime', values.totalTime)
    fd.set('notes', values.notes)
    fd.set('sourceUrl', values.sourceUrl.trim())
    fd.set('sourceName', values.sourceName.trim())
    fd.set('tags', JSON.stringify(values.tags))
    fd.set('collectionIds', JSON.stringify(values.collectionIds))
    fd.set('ingredients', JSON.stringify(fromLines(values.ingredients)))
    fd.set('instructions', JSON.stringify(fromLines(values.instructions)))
    if (photo.kind === 'picked') {
        const type = photo.file.type || 'image/jpeg'
        const ext = type.split('/')[1] ?? 'jpg'
        fd.set('photo', new File([photo.file], `photo.${ext}`, { type }))
    } else if (photo.kind === 'clipped') {
        fd.set('photoDataUrl', photo.src)
    } else if (photo.kind === 'none' && initialPhoto.kind !== 'none') {
        fd.set('removePhoto', '1')
    }
    return fd
}

/** 'www.seriouseats.com' → 'seriouseats.com'. */
export function hostOf(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, '')
    } catch {
        return ''
    }
}

/** Clipped recipes that look incomplete open straight in the editor. */
export function isLowConfidence(recipe: ImportedRecipe): boolean {
    const ingredients = (recipe.ingredients ?? []).filter((l) => !isHeadingLine(l)).length
    const steps = (recipe.instructions ?? []).filter((l) => !isHeadingLine(l)).length
    return !recipe.title?.trim() || ingredients < 2 || steps < 1
}
