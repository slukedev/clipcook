'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'

export type VoiceCommand = 'next' | 'back' | 'repeat' | 'timer' | 'ingredients' | 'stop'

interface RecognitionResultList {
    length: number
    [index: number]: { isFinal: boolean; 0: { transcript: string } }
}

interface Recognition {
    continuous: boolean
    interimResults: boolean
    lang: string
    onresult: ((event: { resultIndex: number; results: RecognitionResultList }) => void) | null
    onerror: ((event: { error: string }) => void) | null
    onend: (() => void) | null
    start(): void
    stop(): void
    abort(): void
}

type RecognitionCtor = new () => Recognition

function recognitionCtor(): RecognitionCtor | null {
    if (typeof window === 'undefined') return null
    const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Whether this browser can listen at all; the toggle is hidden otherwise. */
export function useSpeechSupported(): boolean {
    return useSyncExternalStore(
        () => () => undefined,
        () => recognitionCtor() !== null,
        () => false,
    )
}

const PATTERNS: Array<[VoiceCommand, RegExp]> = [
    ['stop', /\b(stop listening|stop)\b/],
    ['timer', /\b(start (the )?timer|set (a |the )?timer)\b/],
    ['ingredients', /\bingredients?\b/],
    ['repeat', /\b(repeat|read( it)?|again)\b/],
    ['back', /\b(back|previous|go back)\b/],
    ['next', /\b(next|continue|forward)\b/],
]

export function parseCommand(transcript: string): VoiceCommand | null {
    const text = transcript.toLowerCase()
    for (const [command, pattern] of PATTERNS) if (pattern.test(text)) return command
    return null
}

/** Reads text aloud. Returns a promise that settles when speech ends. */
export function speak(text: string): Promise<void> {
    return new Promise((resolve) => {
        try {
            const synth = window.speechSynthesis
            if (!synth) return resolve()
            synth.cancel()
            const utterance = new SpeechSynthesisUtterance(text)
            utterance.lang = document.documentElement.lang || navigator.language
            utterance.rate = 0.95
            utterance.onend = () => resolve()
            utterance.onerror = () => resolve()
            synth.speak(utterance)
        } catch {
            resolve()
        }
    })
}

/**
 * Continuous listening for a handful of cooking commands. Browsers end recognition
 * after silence, so it restarts until switched off. It pauses while speaking so it
 * does not hear itself.
 */
export function useHandsFree(
    enabled: boolean,
    onCommand: (command: VoiceCommand) => void,
    onError: (reason: 'blocked' | 'failed') => void,
) {
    const handlers = useRef({ onCommand, onError })
    useEffect(() => {
        handlers.current = { onCommand, onError }
    })
    const speaking = useRef(false)
    const live = useRef<{ recognition: Recognition | null; start: () => void } | null>(null)

    useEffect(() => {
        const Ctor = recognitionCtor()
        if (!enabled || !Ctor) return
        let active = true
        let recognition: Recognition | null = null

        const start = () => {
            if (!active || speaking.current) return
            recognition = new Ctor()
            live.current = { recognition, start }
            recognition.continuous = true
            recognition.interimResults = false
            recognition.lang = document.documentElement.lang || navigator.language
            recognition.onresult = (event) => {
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i]
                    if (!result?.isFinal) continue
                    const command = parseCommand(result[0].transcript)
                    if (command) handlers.current.onCommand(command)
                }
            }
            recognition.onerror = (event) => {
                if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                    active = false
                    handlers.current.onError('blocked')
                } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
                    handlers.current.onError('failed')
                }
            }
            recognition.onend = () => {
                if (active && !speaking.current) window.setTimeout(start, 250)
            }
            try {
                recognition.start()
            } catch {
                // Already started.
            }
        }
        live.current = { recognition: null, start }
        start()
        return () => {
            active = false
            live.current = null
            recognition?.abort()
        }
    }, [enabled])

    return {
        /** Speaks while recognition is paused. */
        say: async (text: string) => {
            speaking.current = true
            live.current?.recognition?.abort()
            await speak(text)
            speaking.current = false
            live.current?.start()
        },
    }
}
