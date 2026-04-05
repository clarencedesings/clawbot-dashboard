import { useState, useEffect } from "react"
import { Volume2 } from "lucide-react"

const VOICE_KEY = "preferred_voice"

/**
 * Compact voice picker for the sidebar. Reads/writes localStorage directly
 * so the useSpeech hook picks up the selection on next speak() call.
 */
export default function VoiceSelector() {
  const [voices, setVoices] = useState([])
  const [selected, setSelected] = useState("")

  useEffect(() => {
    const synth = window.speechSynthesis
    if (!synth) return

    const load = () => {
      const available = synth.getVoices()
      if (available.length === 0) return
      setVoices(available)
      const saved = localStorage.getItem(VOICE_KEY)
      const match = saved ? available.find((v) => v.name === saved) : null
      setSelected(match ? match.name : available[0].name)
    }

    load()
    synth.addEventListener("voiceschanged", load)
    return () => synth.removeEventListener("voiceschanged", load)
  }, [])

  const handleChange = (e) => {
    setSelected(e.target.value)
    localStorage.setItem(VOICE_KEY, e.target.value)
  }

  if (voices.length === 0) return null

  return (
    <div className="flex items-center gap-2">
      <Volume2 size={14} className="text-text-dim shrink-0" />
      <select
        value={selected}
        onChange={handleChange}
        className="flex-1 bg-sidebar border border-border rounded px-2 py-1 text-[11px] text-text-dim focus:outline-none focus:border-accent cursor-pointer truncate"
        title="TTS voice"
      >
        {voices.map((v) => (
          <option key={v.name} value={v.name}>
            {v.name}
          </option>
        ))}
      </select>
    </div>
  )
}
