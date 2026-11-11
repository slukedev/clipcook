import { describe, expect, it } from 'vitest'
import { findEquipment } from '@/lib/cook/equipment'
import { RECIPES } from '@/server/starter/recipes'

const steps = (key: string) => RECIPES.find((r) => r.key === key)?.instructions ?? []

describe('findEquipment', () => {
    it('lists tools in the order they are first needed, keeping sizes', () => {
        expect(findEquipment(steps('shakshuka'))).toEqual(['12-inch skillet'])
        expect(findEquipment(steps('pesto'))).toEqual(['Large pot', 'Food processor', 'Skillet'])
    })

    it('names the oven with its temperature and tells it apart from a Dutch oven', () => {
        expect(findEquipment(steps('lemonChicken'))).toEqual(['Oven, 425°F', 'Large sheet pan'])
        expect(findEquipment(steps('sourdough'))).toEqual(['Banneton', 'Oven, 500°F', 'Dutch oven'])
        expect(findEquipment(['Bake in a 350 F oven for 20 minutes.'])).toEqual(['Oven, 350°F'])
    })

    it('keeps one entry per tool and prefers the most specific mention', () => {
        expect(findEquipment(['Heat a skillet.', 'Wipe out the skillet.', 'Use a 10-inch cast-iron skillet.'])).toEqual(
            ['10-inch cast-iron skillet'],
        )
        expect(findEquipment(['Line a 9 by 5-inch loaf pan with parchment.'])).toEqual([
            '9 by 5-inch loaf pan',
            'Parchment',
        ])
    })

    it('skips headings and steps with no named tools', () => {
        expect(findEquipment(['# Sauce', 'Stir in the cream and season to taste.'])).toEqual([])
        expect(findEquipment([])).toEqual([])
    })

    it('keeps the step text casing and names lined sheets as baking sheets', () => {
        expect(findEquipment(steps('curry'))).toEqual(['Large Dutch oven'])
        expect(findEquipment(steps('gingerbread'))).toEqual(['Oven, 350°F', 'Baking sheet'])
    })
})
