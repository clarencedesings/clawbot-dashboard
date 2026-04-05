import { useState, useEffect, useRef } from "react"

const VOICE_KEY = "preferred_voice"

/**
 * Shared speech hook — loads voices, persists selection, exposes speak/stop.
 * Usage:
 *   const { voices, selectedVoice, setSelectedVoice, speak, stop, speakingId } = useSpeech()
 */
export default function useSpeech() {
  const [voices, setVoices] = useState([])
  const [selectedVoice, setSelectedVoiceState] = useState(null)
  const [speakingId, setSpeakingId] = useState(null)
  const savedNameRef = useRef(localStorage.getItem(VOICE_KEY) || "")

  // Load voices (async — Chrome fires onvoiceschanged, some browsers populate immediately)
  useEffect(() => {
    const synth = window.speechSynthesis
    if (!synth) return

    const load = () => {
      const available = synth.getVoices()
      if (available.length === 0) return
      setVoices(available)

      const saved = savedNameRef.current
      const match = saved ? available.find((v) => v.name === saved) : null
      setSelectedVoiceState(match || available[0])
    }

    load()
    synth.addEventListener("voiceschanged", load)
    return () => synth.removeEventListener("voiceschanged", load)
  }, [])

  const setSelectedVoice = (voice) => {
    setSelectedVoiceState(voice)
    if (voice) {
      localStorage.setItem(VOICE_KEY, voice.name)
      savedNameRef.current = voice.name
    }
  }

  const speak = (text, id) => {
    const synth = window.speechSynthesis
    if (!text || !synth) return
    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.0
    if (selectedVoice) utterance.voice = selectedVoice
    utterance.onend = () => setSpeakingId(null)
    utterance.onerror = () => setSpeakingId(null)
    setSpeakingId(id)
    synth.speak(utterance)
  }

  const stop = () => {
    window.speechSynthesis?.cancel()
    setSpeakingId(null)
  }

  return { voices, selectedVoice, setSelectedVoice, speak, stop, speakingId }
}
