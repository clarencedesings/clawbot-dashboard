import { Store } from 'lucide-react'

export default function StorePage() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center">
      <Store size={48} className="text-accent mb-4" />
      <h2 className="text-2xl font-bold text-white">Store</h2>
      <p className="text-text-dim mt-2">Coming Soon</p>
    </div>
  )
}
