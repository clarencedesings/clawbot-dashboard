import { useState, useRef, useCallback } from "react"

const VOICE_KEY = "tts_voice"
const MAX_CHUNK = 800

/** Strip markdown and normalize unicode for clean TTS input */
function stripMarkdown(text) {
  return (text || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/^---+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/[^\x00-\x7F]/g, " ")
    .trim()
}

/** Split text into chunks of MAX_CHUNK chars at sentence boundaries */
function chunkText(text) {
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g)
  if (!sentences) return text.trim() ? [text.trim()] : []

  const chunks = []
  let buf = ""
  for (const s of sentences) {
    if ((buf + s).length > MAX_CHUNK && buf.trim()) {
      chunks.push(buf.trim())
      buf = s
    } else {
      buf += s
    }
  }
  if (buf.trim()) chunks.push(buf.trim())
  return chunks.length > 0 ? chunks : [text.trim()]
}

export default function useSpeech() {
  const [speakingId, setSpeakingId] = useState(null)
  const stoppedRef = useRef(false)
  const audioRef = useRef(null)
  const urlRef = useRef(null)
  const selectedVoice = useRef(localStorage.getItem(VOICE_KEY) || "nova")

  const setSelectedVoice = useCallback((voice) => {
    selectedVoice.current = voice
    localStorage.setItem(VOICE_KEY, voice)
  }, [])

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current = null
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    stoppedRef.current = true
    cleanup()
    setSpeakingId(null)
  }, [cleanup])

  const speak = useCallback((text, id) => {
    if (!text) return

    // Stop any current playback
    stop()
    stoppedRef.current = false
    setSpeakingId(id)

    const cleaned = stripMarkdown(text)
    const chunks = chunkText(cleaned)
    const voice = selectedVoice.current || "nova"
    console.log(`[TTS] ${chunks.length} chunks, voice=${voice}`)

    // Cache for prefetched blobs: index -> Promise<Blob>
    const cache = {}

    function fetchChunk(idx) {
      if (cache[idx]) return cache[idx]
      console.log(`[TTS] fetching chunk ${idx + 1}/${chunks.length}: ${chunks[idx].length} chars`)
      cache[idx] = fetch("http://localhost:8002/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: chunks[idx], voice }),
      }).then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.blob()
      })
      return cache[idx]
    }

    function playChunk(idx) {
      if (stoppedRef.current || idx >= chunks.length) {
        cleanup()
        if (!stoppedRef.current) setSpeakingId(null)
        return
      }

      // Prefetch next chunk while this one plays
      if (idx + 1 < chunks.length) fetchChunk(idx + 1)

      fetchChunk(idx)
        .then((blob) => {
          if (stoppedRef.current) return
          cleanup()
          const url = URL.createObjectURL(blob)
          urlRef.current = url
          const audio = new Audio(url)
          audioRef.current = audio
          audio.onended = () => {
            console.log(`[TTS] chunk ${idx + 1} done`)
            playChunk(idx + 1)
          }
          audio.onerror = (e) => {
            console.error(`[TTS] chunk ${idx + 1} playback error`, e)
            playChunk(idx + 1)
          }
          audio.play().catch((err) => {
            console.error(`[TTS] chunk ${idx + 1} play() rejected`, err)
            playChunk(idx + 1)
          })
        })
        .catch((err) => {
          console.error(`[TTS] chunk ${idx + 1} fetch failed`, err)
          playChunk(idx + 1)
        })
    }

    playChunk(0)
  }, [stop, cleanup])

  return {
    voices: [],
    selectedVoice: selectedVoice.current,
    setSelectedVoice,
    speak,
    stop,
    speakingId,
  }
}
