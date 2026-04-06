import { useState } from "react"
import { Volume2 } from "lucide-react"

const VOICE_KEY = "tts_voice"

const VOICES = [
  { id: "nova", label: "Nova", desc: "Warm, female" },
  { id: "shimmer", label: "Shimmer", desc: "Soft, female" },
  { id: "alloy", label: "Alloy", desc: "Neutral" },
  { id: "echo", label: "Echo", desc: "Smooth, male" },
  { id: "fable", label: "Fable", desc: "Expressive" },
  { id: "onyx", label: "Onyx", desc: "Deep, male" },
]

/**
 * Compact voice picker for OpenAI TTS voices.
 * Writes to localStorage so useSpeech picks it up on next speak() call.
 */
export default function VoiceSelector() {
  const [selected, setSelected] = useState(
    () => localStorage.getItem(VOICE_KEY) || "nova"
  )

  const handleChange = (e) => {
    setSelected(e.target.value)
    localStorage.setItem(VOICE_KEY, e.target.value)
  }

  return (
    <div className="flex items-center gap-2">
      <Volume2 size={14} className="text-text-dim shrink-0" />
      <select
        value={selected}
        onChange={handleChange}
        className="flex-1 bg-sidebar border border-border rounded px-2 py-1 text-[11px] text-text-dim focus:outline-none focus:border-accent cursor-pointer truncate"
        title="TTS voice"
      >
        {VOICES.map((v) => (
          <option key={v.id} value={v.id}>
            {v.label} — {v.desc}
          </option>
        ))}
      </select>
    </div>
  )
}
